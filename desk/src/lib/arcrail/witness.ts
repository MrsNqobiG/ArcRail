/** Pure comparison of chain witnesses. No network, no key. */

export interface WitnessView {
  ok: boolean;
  status?: string;
  blockNumber?: string;
  from?: string;
  to?: string | null;
  value?: string;
}

export interface WitnessSummary {
  included: boolean;
  corroborated: boolean;
  agreed: number;
  status?: string;
  blockNumber?: string;
  from?: string;
  to?: string | null;
  value?: string;
}

/** RPC receipts are decimal wei; some explorers return 0x-hex. Compare one form. */
export function canonWei(value?: string): string {
  if (!value) return "";
  const s = value.trim();
  if (/^0x[0-9a-f]+$/i.test(s)) {
    try {
      return BigInt(s).toString();
    } catch {
      return s.toLowerCase();
    }
  }
  return s;
}

function keyOf(row: WitnessView): string {
  return [
    row.status ?? "",
    row.blockNumber ?? "",
    (row.from ?? "").toLowerCase(),
    (row.to ?? "").toLowerCase(),
    canonWei(row.value),
  ].join("|");
}

/** A receipt is included when any witness has a block. Corroborated when two agree on the body. */
export function summariseWitnesses(rows: readonly WitnessView[]): WitnessSummary {
  const good = rows.filter((row) => row.ok && row.blockNumber && (row.status === "success" || row.status === "reverted"));
  if (good.length === 0) {
    return { included: false, corroborated: false, agreed: 0 };
  }
  const counts = new Map<string, { n: number; row: WitnessView }>();
  for (const row of good) {
    const key = keyOf(row);
    const prev = counts.get(key);
    counts.set(key, { n: (prev?.n ?? 0) + 1, row });
  }
  let bestN = 0;
  let best: WitnessView = good[0]!;
  for (const entry of counts.values()) {
    if (entry.n > bestN) {
      bestN = entry.n;
      best = entry.row;
    }
  }
  return {
    included: true,
    corroborated: bestN >= 2,
    agreed: bestN,
    status: best.status,
    blockNumber: best.blockNumber,
    from: best.from,
    to: best.to,
    value: canonWei(best.value),
  };
}
