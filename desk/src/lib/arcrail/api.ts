/**
 * The demo's /api/* surface, run in the browser (see src/api-shim.ts).
 * Same routes and responses as the operator desk, minus the live testnet
 * treasury and chain probe: the public demo holds no keys and broadcasts nothing.
 */
import { applyEvent, createPayment, fmt, resetDemo, runRecon, actOnCase, type EventType } from "./engine";
import { db, serialized } from "./memory";

const ARC_EXPLORER = "https://explorer.testnet.arc.io";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function fail(e: unknown): Response {
  const err = e as Error & { statusCode?: number };
  const code = typeof err.statusCode === "number" ? err.statusCode : 500;
  return json({ error: err.message }, code >= 400 && code < 600 ? code : 500);
}

type Idem = { digest: string; paymentId: string };
const idempotency = new Map<string, Idem>();

function explorerFor(live: unknown, txHash: unknown): string | null {
  if (live === true && typeof txHash === "string" && txHash.startsWith("0x") && txHash.length === 66) {
    return `${ARC_EXPLORER}/tx/${txHash}`;
  }
  return null;
}
function digestOf(body: {
  payIn?: string;
  payout?: string;
  amount?: string;
  beneficiaryRef?: string;
  fee?: string;
}): string {
  return JSON.stringify({
    payIn: body.payIn,
    payout: body.payout,
    amount: body.amount,
    beneficiaryRef: body.beneficiaryRef,
    fee: body.fee ?? "0.25",
  });
}

async function paymentsGet(): Promise<Response> {
  const payments = await db.payment.findMany({ orderBy: { createdAt: "desc" } });
  const rail = await db.railState.findUnique({ where: { id: "rail" } });
  return json({
    paused: Boolean(rail?.paused),
    pausedReason: (rail?.pausedReason as string | null) ?? null,
    broadcasts: false,
    payments: payments.map((p) => ({
      id: p.id,
      payIn: p.payIn,
      payout: p.payout,
      amount: p.amountMinor,
      amountText: fmt(Number(p.amountMinor)),
      fee: p.feeMinor,
      status: p.status,
      stage: p.stage,
      reason: p.reason,
      dfnsState: p.dfnsState,
      txHash: p.txHash,
      live: p.live === true,
      explorerUrl: explorerFor(p.live, p.txHash),
      beneficiaryRef: p.beneficiaryRef,
      createdAt: p.createdAt,
    })),
  });
}

async function paymentsPost(req: Request): Promise<Response> {
  const body = (await req.json()) as {
    payIn: string;
    payout: string;
    amount: string;
    fee?: string;
    beneficiaryRef: string;
  };
  const key = req.headers.get("idempotency-key") ?? `auto-${Date.now()}`;
  const digest = digestOf(body);
  const existing = idempotency.get(key);
  if (existing) {
    if (existing.digest === digest) {
      return json({
        replay: true,
        id: existing.paymentId,
        paymentId: existing.paymentId,
        note: "200 replay: same key, same request — no second reservation",
      });
    }
    return json(
      { error: "409 KEY_CONFLICT: same Idempotency-Key with a different request body" },
      409,
    );
  }
  const r = await createPayment(body);
  idempotency.set(key, { digest, paymentId: r.id });
  return json({ ...r, idempotencyKey: key, broadcasts: false }, 201);
}

async function paymentGet(id: string): Promise<Response> {
  const p = await db.payment.findUnique({ where: { id } });
  if (!p) return json({ error: "404 NOT_FOUND (existence is not disclosed)" }, 404);
  const entries = await db.ledgerEntry.findMany({
    where: { paymentId: id },
    orderBy: { createdAt: "asc" },
  });
  const hist = await db.historyEvent.findMany({
    where: { paymentId: id, eventId: { startsWith: `hist:${id}:` } },
    orderBy: { createdAt: "asc" },
  });
  const cases = await db.opsCase.findMany({ where: { paymentId: id }, orderBy: { createdAt: "asc" } });
  const txHash = (p.txHash as string | null) ?? null;
  return json({
    id: p.id,
    payIn: p.payIn,
    payout: p.payout,
    amount: p.amountMinor,
    amountText: fmt(Number(p.amountMinor)),
    feeText: fmt(Number(p.feeMinor)),
    gas: p.gasMinor,
    status: p.status,
    stage: p.stage,
    reason: p.reason,
    dfnsState: p.dfnsState,
    externalRef: p.externalRef,
    txHash,
    live: p.live === true,
    submitMarker: p.submitMarker,
    beneficiaryRef: p.beneficiaryRef,
    payerAccount: p.payerAccount,
    legs: p.legs,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    broadcasts: p.live === true,
    explorerUrl: explorerFor(p.live, txHash),
    chainNote: !txHash
      ? null
      : p.live === true
        ? "Included on Arc testnet. The journal moved to SETTLED only after a receipt was read back and a second provider agreed."
        : "Rehearsal hash only. It was not submitted to Arc or any other chain.",
    postings: entries.map((e) => ({ ...e, amountText: fmt(Number(e.amountMinor)) })),
    history: hist.map((h) => ({
      eventId: h.eventId,
      body: JSON.parse(String(h.body)),
      createdAt: h.createdAt,
    })),
    cases,
  });
}

async function journalGet(): Promise<Response> {
  const entries = await db.ledgerEntry.findMany({ orderBy: { createdAt: "asc" } });
  const balances = new Map<string, number>();
  for (const e of entries) {
    const amt = Number(e.amountMinor);
    const dr = String(e.debitAccount);
    const cr = String(e.creditAccount);
    balances.set(dr, (balances.get(dr) ?? 0) + amt);
    balances.set(cr, (balances.get(cr) ?? 0) - amt);
  }
  // Recomputed from the journal on every read: each side summed on its own, and every account balance netted.
  let totalDr = 0;
  let totalCr = 0;
  for (const e of entries) {
    if (e.debitAccount) totalDr += Number(e.amountMinor);
    if (e.creditAccount) totalCr += Number(e.amountMinor);
  }
  const net = [...balances.values()].reduce((s, v) => s + v, 0);
  return json({
    entries: entries.map((e) => ({ ...e, amountText: fmt(Number(e.amountMinor)) })),
    balances: [...balances.entries()]
      .map(([account, minor]) => ({ account, minor, text: fmt(minor) }))
      .sort((a, b) => a.account.localeCompare(b.account)),
    conservation: {
      totalDr,
      totalCr,
      balanced: totalDr === totalCr && net === 0,
      note: "For every business event, debits equal credits",
    },
  });
}

async function metaGet(): Promise<Response> {
  const rail = await db.railState.findUnique({ where: { id: "rail" } });
  const openCases = await db.opsCase.count({ where: { status: "OPEN" } });
  const settled = await db.payment.count({ where: { status: "SETTLED" } });
  return json({
    payments: await db.payment.count(),
    entries: await db.ledgerEntry.count(),
    cases: await db.opsCase.count(),
    audit: await db.auditEntry.count(),
    history: await db.historyEvent.count(),
    openCases,
    settled,
    paused: Boolean(rail?.paused),
    pausedReason: (rail?.pausedReason as string | null) ?? null,
    broadcasts: false,
    treasuryBroadcasts: false,
    chainId: 5042002,
    mainnet: "disabled",
  });
}

async function casesGet(): Promise<Response> {
  const cases = await db.opsCase.findMany({ orderBy: { createdAt: "desc" } });
  const audit = await db.auditEntry.findMany({ orderBy: { seq: "desc" }, take: 60 });
  return json({
    cases: cases.map((c) => ({
      id: c.id,
      kind: c.kind,
      reason: c.reason,
      paymentId: c.paymentId,
      status: c.status,
      options: c.options,
      closedAt: c.closedAt,
      closedBy: c.closedBy,
      decision: c.decision,
      createdAt: c.createdAt,
    })),
    audit,
  });
}

async function reconGet(): Promise<Response> {
  const rail = await db.railState.findUnique({ where: { id: "rail" } });
  const r = await runRecon("run");
  return json({ ...r, paused: Boolean(rail?.paused), pausedReason: (rail?.pausedReason as string | null) ?? null });
}

export async function handleArcApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean); // api / ...
  const method = request.method.toUpperCase();
  const route = parts.slice(1); // drop "api"

  try {
    if (route[0] === "treasury" || route[0] === "chain") {
      return json({ error: "Live testnet sending is not part of the public demo. Nothing here is signed or broadcast." }, 501);
    }
    if (route[0] === "meta" && method === "GET") return await metaGet();
    if (route[0] === "meta" && method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { action?: string };
      if (body.action === "reset") {
        await serialized(async () => {
          idempotency.clear();
          await resetDemo();
        });
        return json({ reset: true });
      }
      return json({ error: "unknown action" }, 400);
    }
    if (route[0] === "reset" && method === "POST") {
      await serialized(async () => {
        idempotency.clear();
        await resetDemo();
      });
      return json({ reset: true });
    }
    if (route[0] === "journal" && method === "GET") return await journalGet();
    if (route[0] === "payments" && route.length === 1 && method === "GET") return await paymentsGet();
    if (route[0] === "payments" && route.length === 1 && method === "POST") {
      return await serialized(() => paymentsPost(request));
    }
    if (route[0] === "payments" && route.length === 2 && method === "GET") {
      return await paymentGet(decodeURIComponent(route[1]!));
    }
    if (route[0] === "payments" && route[2] === "events" && method === "POST") {
      const id = decodeURIComponent(route[1]!);
      const body = (await request.json()) as { type: EventType };
      const r = await serialized(() => applyEvent(id, body.type));
      return json({ ...r, broadcasts: false });
    }
    if (route[0] === "cases" && method === "GET") return await casesGet();
    if (route[0] === "cases" && method === "POST") {
      const body = await request.json();
      const r = await serialized(() => actOnCase(body));
      return json(r);
    }
    if (route[0] === "recon" && method === "GET") return await reconGet();
    if (route[0] === "recon" && method === "POST") {
      const body = (await request.json()) as { mode: "run" | "inject-drift" | "unpause"; approver1?: string; approver2?: string };
      const r = await serialized(() => runRecon(body.mode, { a1: body.approver1, a2: body.approver2 }));
      return json(r);
    }
    return json({ error: "404 NOT_FOUND" }, 404);
  } catch (e) {
    return fail(e);
  }
}
