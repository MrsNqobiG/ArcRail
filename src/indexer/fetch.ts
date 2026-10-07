/**
 * Unit NET: paging and RPC error handling of the Arc event indexer (§6.2).
 *
 * | Condition | Handling |
 * |---|---|
 * | range size | pages of at most `maxBlocksPerPage` blocks, inclusive (C-40) |
 * | -32012 anyway (C-40) | halve the range and retry, never widen |
 * | -32602 result cap (C-41, Q-A4) | bisect down to one block; never parse the suggested range |
 * | one block still too large | RANGE_UNRECOVERABLE |
 * | -32014 head lag (C-42), transport error | retry with capped exponential backoff and jitter; exhausted: SOURCE_LAGGING |
 * | any other JSON-RPC error | SOURCE_STOPPED: stop, keep the cursor; never read as "no logs" |
 *
 * A source that returns a log outside the requested range is SOURCE_STOPPED.
 */
import type { NetworkFailure } from '../network/types.js';
import type { RetryPolicy } from '../network/arc/params.js';
import type { LogFilter, RawLog, RpcError, RpcOutcome, RpcSource, Timing } from './rpc.js';

export interface BlockRange {
  readonly from: bigint;
  readonly to: bigint;
}

/**
 * Split [from, to] into inclusive pages of at most `maxBlocks` blocks. Empty when from > to.
 * Design §6.2 asks to implement U3's stub `pageBlockRange` (src/chain/client) and reuse it;
 * that file is unit U3's, outside NET's scope, so this is the one paging function NET uses,
 * and U3's stub should delegate to it when U3 is generated (verifier NOVA-NET-lensR-1 m6, routed).
 */
export function pageRange(from: bigint, to: bigint, maxBlocks: bigint): readonly BlockRange[] {
  if (maxBlocks < 1n) throw new RangeError('maxBlocks must be at least 1');
  const pages: BlockRange[] = [];
  for (let start = from; start <= to; start += maxBlocks) {
    const end = start + maxBlocks - 1n;
    pages.splice(pages.length, 0, { from: start, to: end < to ? end : to });
  }
  return pages;
}

/**
 * Delay before retry number `attempt` (0-based): `d = min(cap, initial × 2^attempt)`,
 * then "equal jitter": `d/2 + random(d − d/2 + 1)`, so the result is in [d/2, d].
 */
export function backoffDelay(policy: RetryPolicy, attempt: bigint, random: (bound: bigint) => bigint): bigint {
  const raw = policy.initialMs * 2n ** attempt;
  const d = raw < policy.capMs ? raw : policy.capMs;
  const half = d / 2n;
  return half + random(d - half + 1n);
}

export type Retried<T> =
  | { readonly kind: 'OK'; readonly value: T }
  /** A JSON-RPC error that is not retryable here: the caller decides (split or stop). */
  | { readonly kind: 'ERROR'; readonly code: bigint; readonly message: string }
  /** -32014 or transport errors on every attempt. */
  | { readonly kind: 'EXHAUSTED'; readonly last: RpcError };

/** Call `op`, retrying head lag (C-42) and transport errors with backoff, up to `policy.maxAttempts` attempts in total. */
export async function withRetry<T>(
  op: () => Promise<RpcOutcome<T>>,
  policy: RetryPolicy,
  headLagCode: bigint,
  timing: Timing,
): Promise<Retried<T>> {
  let last: RpcError = { kind: 'TRANSPORT', message: 'no attempt made' };
  for (let attempt = 0n; attempt < policy.maxAttempts; attempt += 1n) {
    if (attempt > 0n) await timing.sleep(backoffDelay(policy, attempt - 1n, (b) => timing.random(b)));
    const out = await op();
    if (out.ok) return { kind: 'OK', value: out.value };
    last = out.error;
    if (out.error.kind === 'RPC' && out.error.code !== headLagCode) {
      return { kind: 'ERROR', code: out.error.code, message: out.error.message };
    }
  }
  return { kind: 'EXHAUSTED', last };
}

/** The failure for a retry outcome that is not OK and not a split code. */
export function sourceFailure(source: string, r: Exclude<Retried<unknown>, { kind: 'OK' }>): NetworkFailure {
  if (r.kind === 'EXHAUSTED') {
    return { kind: 'SOURCE_LAGGING', source, detail: `retries exhausted: ${r.last.message}` };
  }
  return { kind: 'SOURCE_STOPPED', source, code: r.code, detail: r.message };
}

export interface FetchParams {
  readonly retry: RetryPolicy;
  readonly headLagCode: bigint;
  /** Codes that mean "range too large": split and retry (C-40 -32012, C-41 -32602). */
  readonly splitCodes: readonly bigint[];
}

export type Fetched = { readonly ok: true; readonly logs: readonly RawLog[] } | { readonly ok: false; readonly failure: NetworkFailure };

/** Fetch all logs of `filter` in [filter.fromBlock, filter.toBlock] from one source, splitting on the split codes. */
export async function fetchLogs(source: RpcSource, filter: LogFilter, params: FetchParams, timing: Timing): Promise<Fetched> {
  const { fromBlock: from, toBlock: to } = filter;
  const r = await withRetry(() => source.getLogs(filter), params.retry, params.headLagCode, timing);
  if (r.kind === 'OK') {
    const outside = r.value.find((log) => log.blockNumber < from || log.blockNumber > to);
    if (outside !== undefined) {
      return {
        ok: false,
        failure: { kind: 'SOURCE_STOPPED', source: source.name, code: null, detail: `log in block ${outside.blockNumber} outside [${from}, ${to}]` },
      };
    }
    return { ok: true, logs: r.value };
  }
  if (r.kind === 'ERROR' && params.splitCodes.includes(r.code)) {
    if (from === to) return { ok: false, failure: { kind: 'RANGE_UNRECOVERABLE', source: source.name, from, to } };
    const mid = from + (to - from) / 2n;
    const left = await fetchLogs(source, { ...filter, toBlock: mid }, params, timing);
    if (!left.ok) return left;
    const right = await fetchLogs(source, { ...filter, fromBlock: mid + 1n }, params, timing);
    if (!right.ok) return right;
    return { ok: true, logs: [...left.logs, ...right.logs] };
  }
  return { ok: false, failure: sourceFailure(source.name, r) };
}
