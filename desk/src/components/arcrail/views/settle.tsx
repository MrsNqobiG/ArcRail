import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, KV, Mono, Panel, SectionTitle } from "../bits";

interface Wallet {
  address: string;
  balance: string;
  funded?: boolean;
}

interface Settlement {
  id: string;
  at: string;
  from: string;
  to: string;
  amount: string;
  txHash: string;
  blockNumber: string | null;
  status: string;
  gasUsdc: string | null;
  paymentId: string | null;
  attached: boolean;
  explorerUrl: string;
  mirrorUrl?: string;
  providers?: string[];
  corroborated?: boolean;
}

interface TraceStep {
  at: string;
  level: "info" | "ok" | "fail";
  title: string;
  detail: string;
}

interface Witness {
  provider: string;
  kind: string;
  ok: boolean;
  status?: string;
  blockNumber?: string;
  error?: string;
}

interface Proof {
  hash: string;
  found: boolean;
  onChain: boolean;
  corroborated: boolean;
  verdict: string;
  status?: string;
  blockNumber?: string;
  from?: string;
  to?: string | null;
  value?: string;
  explorerUrl?: string;
  mirrorUrl?: string;
  agreed: number;
  witnesses: Witness[];
}

interface Status {
  error?: string;
  legal?: string;
  legalPoints?: string[];
  keyStore?: "browser" | "memory";
  faucet: string;
  explorer: string;
  rpc: string;
  chain: {
    chainId: number;
    chainIdOk: boolean;
    blockNumber: string;
    ageSeconds: number;
    baseFeeGwei: string | null;
    txCount: number;
  } | null;
  caps: { perTx: string; perHour: string; gasReserve: string; spentThisHour: string };
  desk: Wallet;
  receiver: Wallet;
  settlements: Settlement[];
  rules: string[];
}

const ACK_KEY = "arcrail-testnet-ack";

export function SettleView({ paymentId }: { paymentId?: string | null }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [amount, setAmount] = useState("0.01");
  const [to, setTo] = useState("");
  const [payId, setPayId] = useState(paymentId ?? "");
  const [busy, setBusy] = useState(false);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [last, setLast] = useState<Settlement | null>(null);
  const [proof, setProof] = useState<Proof | null>(null);
  const [proving, setProving] = useState(false);
  const [lookup, setLookup] = useState("");
  const [ack, setAck] = useState(false);
  const requestRef = useRef("");
  const intentRef = useRef("");

  const load = useCallback(async (fresh = false) => {
    const r = await fetch(fresh ? "/api/treasury?fresh=1" : "/api/treasury");
    if (!r.ok) {
      toast.error("Could not read Arc testnet");
      return;
    }
    const j = (await r.json()) as Status;
    setStatus(j);
    setTo((prev) => prev || j.receiver.address);
  }, []);

  useEffect(() => {
    try {
      setAck(window.sessionStorage.getItem(ACK_KEY) === "yes");
    } catch {
      /* storage blocked: the notice is asked again */
    }
    void load(true);
    const t = setInterval(() => void load(false), 8_000);
    return () => clearInterval(t);
  }, [load]);

  function confirmAck(next: boolean) {
    setAck(next);
    try {
      if (next) window.sessionStorage.setItem(ACK_KEY, "yes");
      else window.sessionStorage.removeItem(ACK_KEY);
    } catch {
      /* storage blocked: the acknowledgement lasts for this view only */
    }
  }

  async function copy(text: string, hint = "Address copied") {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(hint);
    } catch {
      toast.message(`Copy blocked by this browser. Address: ${text}`);
    }
  }

  function requestIdFor(dest: string, value: string) {
    const key = `${dest.toLowerCase()}|${value}`;
    if (intentRef.current !== key || !requestRef.current) {
      intentRef.current = key;
      requestRef.current = crypto.randomUUID();
    }
    return requestRef.current;
  }

  async function prove(hash: string) {
    const clean = hash.trim();
    if (!clean) return;
    setProving(true);
    try {
      const r = await fetch(`/api/chain?tx=${encodeURIComponent(clean)}`);
      const j = (await r.json()) as { tx?: Proof; error?: string };
      if (!j.tx) {
        toast.error(j.error ?? "The chain probe failed");
        return;
      }
      setProof(j.tx);
      if (j.tx.corroborated) toast.success("Two sources agree — it is on Arc testnet");
      else if (j.tx.onChain) toast.message("One source sees it. Waiting for a second.");
      else toast.message(j.tx.found ? "Not settled yet" : "That hash is not on Arc testnet");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Probe failed");
    } finally {
      setProving(false);
    }
  }

  async function sweep() {
    if (!ack) {
      toast.error("Confirm the testnet notice first");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/treasury/sweep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ack: true, requestId: crypto.randomUUID() }),
      });
      const j = (await r.json()) as { ok: boolean; error?: string; trace?: TraceStep[]; settlement?: Settlement };
      setTrace(j.trace ?? []);
      if (j.settlement) {
        setLast(j.settlement);
        await prove(j.settlement.txHash);
      }
      if (j.ok) toast.success("Sweep is on chain");
      else toast.error(j.error ?? "Nothing to sweep");
      await load(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sweep failed");
    } finally {
      setBusy(false);
    }
  }

  async function send(body: { to: string; amount: string; from?: "receiver"; paymentId?: string }) {
    if (!ack) {
      toast.error("Confirm the testnet notice first");
      return;
    }
    setBusy(true);
    setProof(null);
    setTrace([{ at: new Date().toISOString(), level: "info", title: "Submitting", detail: "Checking the chain pin before any signature." }]);
    const requestId = requestIdFor(body.to, `${body.from ?? "desk"}|${body.amount}`);
    try {
      const r = await fetch("/api/treasury/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...body,
          paymentId: body.paymentId || undefined,
          requestId,
          ack: true,
        }),
      });
      const j = (await r.json()) as { ok: boolean; error?: string; trace?: TraceStep[]; settlement?: Settlement; replay?: boolean };
      setTrace(j.trace ?? []);
      if (j.settlement) setLast(j.settlement);
      if (j.ok && j.settlement?.corroborated) {
        requestRef.current = "";
        toast.success(j.replay ? "Already on chain — no second signature" : `On chain · block ${j.settlement.blockNumber}`);
        await prove(j.settlement.txHash);
      } else if (j.settlement?.txHash) {
        toast.message(j.error ?? "Broadcast is waiting for a second source");
        await prove(j.settlement.txHash);
      } else {
        toast.error(j.error ?? "Transfer refused");
      }
      await load(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  const funded = status?.desk.funded === true;
  const headOk = status?.chain?.chainIdOk === true && (status.chain?.ageSeconds ?? 99) < 30;
  const stepOn = {
    pin: trace.some((s) => s.title === "Chain pin" && s.level === "ok"),
    policy: trace.some((s) => s.title === "Policy" && s.level === "ok"),
    broadcast: trace.some((s) => s.title === "Broadcast" && s.level === "ok"),
    agreed: Boolean(last?.corroborated) || trace.some((s) => s.level === "ok" && (s.title === "Second provider" || s.title === "Explorer agrees" || s.title === "Second source")),
  };
  const presets = ["0.001", "0.01", "0.1", "1"];

  return (
    <div>
      <SectionTitle
        title="Settle on Arc testnet"
        sub="A native USDC transfer, signed only after you confirm the notice. The desk pins chain 5042002, screens the destination, then waits until a second operator — or the public explorer — returns the same receipt. Mainnet is not configured. Testnet USDC has no monetary value."
      />

      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <Panel title="Chain head" right={<Chip tone={headOk ? "emerald" : "rose"}>{headOk ? "live" : "checking"}</Chip>}>
          {status?.chain ? (
            <div>
              <KV k="chain" v={status.chain.chainIdOk ? "Arc testnet 5042002" : String(status.chain.chainId)} mono />
              <KV k="block" v={status.chain.blockNumber} mono />
              <KV k="head age" v={`${status.chain.ageSeconds}s`} mono />
              <KV k="base fee" v={status.chain.baseFeeGwei ? `${status.chain.baseFeeGwei} gwei` : "—"} mono />
              <KV k="rpc" v={status.rpc.replace("https://", "")} mono />
            </div>
          ) : (
            <p className="text-sm text-rose-300">{status?.error ?? "Reading the chain…"}</p>
          )}
        </Panel>
        <Panel title="Desk treasury" right={<Chip tone={funded ? "emerald" : "amber"}>{funded ? "funded" : "needs a drip"}</Chip>}>
          <div className="font-mono text-2xl font-semibold tracking-tight text-primary">{status?.desk.balance ?? "—"}</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">testnet USDC · 18 decimals · no value</div>
          <button type="button" onClick={() => status && copy(status.desk.address)} className="mt-2 block min-h-11 w-full truncate text-left font-mono text-xs text-foreground/80 hover:text-primary">
            {status?.desk.address ?? "deriving key…"}
          </button>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="h-11 border-white/15" onClick={() => status && copy(status.desk.address)}>Copy address</Button>
            <Button size="sm" variant="outline" className="h-11 border-white/15" onClick={() => void load(true)}>Refresh</Button>
            <a
              href={status?.faucet ?? "https://faucet.circle.com"}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                if (status) void copy(status.desk.address, "Address copied. In the faucet pick USDC and Arc Testnet, paste it, and press Send. This page updates by itself.");
              }}
              className="inline-flex h-11 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
            >
              Open faucet
            </a>
          </div>
        </Panel>
        <Panel title="Receiver">
          <div className="font-mono text-2xl font-semibold tracking-tight">{status?.receiver.balance ?? "—"}</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">second key · this browser</div>
          <button type="button" onClick={() => status && copy(status.receiver.address)} className="mt-2 block min-h-11 w-full truncate text-left font-mono text-xs text-foreground/80 hover:text-primary">
            {status?.receiver.address ?? "—"}
          </button>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Send here, then sweep back. Both keys were created in this browser and never leave it.</p>
          {status?.keyStore === "memory" && (
            <p className="mt-2 text-xs leading-relaxed text-amber-200">This browser blocks site storage, so these keys live only in this tab. Closing it loses them and any testnet USDC on them.</p>
          )}
        </Panel>
      </div>

      {!ack && (
        <Panel title="Read this before anything is signed" className="mb-4">
          <ul className="space-y-2">
            {(status?.legalPoints ?? []).map((point) => (
              <li key={point} className="text-sm leading-relaxed text-foreground/85">{point}</li>
            ))}
          </ul>
          <label className="mt-4 flex min-h-11 items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-emerald-500"
              checked={ack}
              onChange={(e) => confirmAck(e.target.checked)}
            />
            <span>I understand this moves valueless Arc testnet USDC only. It is not a financial service, not legal tender, and not legal advice.</span>
          </label>
        </Panel>
      )}

      {!funded && status && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-relaxed">
          <div className="font-semibold text-amber-100">The desk address is on Arc testnet and its balance is zero. A signature is refused until a drip arrives.</div>
          <p className="mt-1 text-amber-50/80">That refusal was checked against the live chain, not a mock. Circle’s public faucet is the only way to fund this address, and it asks a human check. One drip is 20 testnet USDC, once per address every two hours. It has no monetary value.</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-amber-50/85">
            <li>Copy the desk address.</li>
            <li>Open the Circle faucet. Leave the network on Arc Testnet and the asset on USDC.</li>
            <li>Paste the address and request the drip.</li>
            <li>Come back and press Refresh. Gas on Arc is the same testnet USDC, so one drip covers fees.</li>
          </ol>
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["1 · Pin", "Chain 5042002", stepOn.pin],
            ["2 · Screen", "Caps and sanctions", stepOn.policy],
            ["3 · Broadcast", "Signed locally", stepOn.broadcast],
            ["4 · Agree", "Second source", stepOn.agreed && stepOn.broadcast],
          ] as const
        ).map(([label, hint, on]) => (
          <div key={label} className={`rounded-lg border px-3 py-2 ${on ? "border-primary/40 bg-primary/10" : "border-white/10"}`}>
            <div className={`text-xs font-semibold ${on ? "text-primary" : "text-muted-foreground"}`}>{label}</div>
            <div className="text-[11px] text-muted-foreground">{hint}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Native transfer">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted-foreground">
              Amount (max {status?.caps.perTx ?? "1.000000"})
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 h-11 font-mono" inputMode="decimal" />
              <span className="mt-2 flex flex-wrap gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(p)}
                    className={`rounded-full border px-3 py-1 font-mono text-xs ${amount === p ? "border-primary/50 bg-primary/15 text-primary" : "border-white/15 text-muted-foreground"}`}
                  >
                    {p}
                  </button>
                ))}
              </span>
            </label>
            <label className="block text-xs text-muted-foreground">
              Attach to an APPROVED payment (optional)
              <Input value={payId} onChange={(e) => setPayId(e.target.value)} placeholder="pm-0001" className="mt-1 h-11 font-mono" />
            </label>
          </div>
          <label className="mt-3 block text-xs text-muted-foreground">
            Recipient
            <Input value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-11 font-mono text-xs" spellCheck={false} />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              disabled={busy || !funded || !ack}
              onClick={() => void send({ to, amount, paymentId: payId.trim() })}
              className="h-11 bg-primary px-5 text-primary-foreground hover:opacity-90"
            >
              {busy ? "Waiting for a second source…" : "Sign and broadcast"}
            </Button>
            <Button variant="outline" disabled={busy} className="h-11 border-white/15" onClick={() => status && setTo(status.receiver.address)}>
              Use receiver
            </Button>
            <Button
              variant="outline"
              disabled={busy || !ack}
              className="h-11 border-white/15"
              onClick={() => void sweep()}
            >
              Sweep receiver
            </Button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            This hour: {status?.caps.spentThisHour ?? "0"} of {status?.caps.perHour ?? "5"} USDC. {status?.caps.gasReserve ?? "0.002"} stays behind for gas. Empty calldata. A repeat click reuses the same request and will not sign twice.
          </p>
          {ack && (
            <button type="button" className="mt-2 text-xs text-muted-foreground underline" onClick={() => confirmAck(false)}>
              Show the notice again
            </button>
          )}
        </Panel>

        <Panel title="What the chain was told">
          {trace.length === 0 ? (
            <p className="text-sm text-muted-foreground">Every check is listed before and after the signature. A refusal stops before the transaction is sent.</p>
          ) : (
            <ol className="space-y-2">
              {trace.map((s, i) => (
                <li key={`${s.at}-${i}`} className="flex gap-2">
                  <span className={s.level === "ok" ? "text-primary" : s.level === "fail" ? "text-rose-400" : "text-muted-foreground"}>{s.level === "ok" ? "ok" : s.level === "fail" ? "no" : "·"}</span>
                  <div>
                    <div className="text-xs font-semibold">{s.title}</div>
                    <div className="text-xs leading-snug text-muted-foreground">{s.detail}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {last && (
            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
              <div className="text-xs uppercase tracking-widest text-primary">
                {last.corroborated ? "corroborated" : last.status} · block {last.blockNumber ?? "pending"}
              </div>
              <Mono className="mt-1 block truncate">{last.txHash}</Mono>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <a className="underline" href={last.explorerUrl} target="_blank" rel="noreferrer">Explorer</a>
                {last.mirrorUrl && <a className="underline" href={last.mirrorUrl} target="_blank" rel="noreferrer">Mirror</a>}
                <button type="button" className="underline" onClick={() => void prove(last.txHash)}>Re-read from the chain</button>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Independent chain proof" className="mt-3">
        <p className="text-sm text-muted-foreground">
          This asks Circle, dRPC, Blockdaemon, QuickNode, and the public explorer again. It does not trust the broadcast response. A hash is settled only when two of them return the same receipt.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            placeholder="0x… transaction hash"
            className="h-11 font-mono text-xs"
            spellCheck={false}
          />
          <Button variant="outline" className="h-11 border-white/15" disabled={proving || lookup.trim().length < 66} onClick={() => void prove(lookup)}>
            {proving ? "Reading…" : "Prove this hash"}
          </Button>
          <Button
            variant="outline"
            className="h-11 border-white/15"
            disabled={proving}
            onClick={() => {
              setProving(true);
              void (async () => {
                try {
                  const r = await fetch("/api/chain?sample=1");
                  const j = (await r.json()) as { tx?: Proof; error?: string; sample?: { hash: string } };
                  if (!j.tx) {
                    toast.error(j.error ?? "No recent plain transfer");
                    return;
                  }
                  setLookup(j.tx.hash);
                  setProof(j.tx);
                  if (j.tx.corroborated) toast.success("A public transfer is on Arc testnet, and two sources agree");
                  else toast.message(j.tx.verdict);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Probe failed");
                } finally {
                  setProving(false);
                }
              })();
            }}
          >
            Prove one already on chain
          </Button>
        </div>
        {proof && (
          <div className="mt-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Chip tone={proof.corroborated ? "emerald" : proof.onChain ? "amber" : "rose"}>
                {proof.corroborated ? "on chain · agreed" : proof.onChain ? "one source" : proof.found ? "not settled" : "not found"}
              </Chip>
              <span className="text-sm">{proof.verdict}</span>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              {proof.witnesses.map((w) => (
                <div key={w.provider + w.kind} className="flex items-center justify-between gap-2 rounded-md border border-white/10 px-2 py-1.5 text-xs">
                  <span className="font-mono">{w.provider}</span>
                  <span className={w.ok && w.blockNumber ? "text-primary" : "text-muted-foreground"}>
                    {w.ok ? `${w.status ?? "seen"}${w.blockNumber ? ` · ${w.blockNumber}` : ""}` : w.error ?? "no"}
                  </span>
                </div>
              ))}
            </div>
            {proof.explorerUrl && (
              <a href={proof.explorerUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline">Open this hash on the explorer</a>
            )}
          </div>
        )}
      </Panel>

      <Panel title="Settlement log" className="mt-3">
        {status && status.settlements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No testnet transfers from this desk yet. An empty log means nothing has been signed.</p>
        ) : (
          <div className="space-y-2">
            {status?.settlements.map((s) => (
              <div key={s.txHash + s.at} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 px-3 py-2">
                <Chip tone={s.corroborated ? "emerald" : s.status === "success" ? "amber" : "rose"}>{s.corroborated ? "corroborated" : s.status}</Chip>
                <span className="font-mono text-xs">{s.amount} USDC</span>
                <Mono className="text-muted-foreground">block {s.blockNumber}</Mono>
                {s.paymentId && <Chip tone="teal">{s.paymentId}{s.attached ? " · journaled" : ""}</Chip>}
                <a href={s.explorerUrl} target="_blank" rel="noreferrer" className="ml-auto max-w-xs truncate font-mono text-xs text-primary">{s.txHash}</a>
                <button type="button" className="text-xs underline" onClick={() => void prove(s.txHash)}>prove</button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="What this desk will not do" className="mt-3">
        <ul className="grid gap-1 sm:grid-cols-2">
          {status?.rules.map((r) => (
            <li key={r} className="text-xs leading-snug text-muted-foreground">{r}</li>
          ))}
        </ul>
        {status?.legal && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{status.legal}</p>}
      </Panel>
    </div>
  );
}
