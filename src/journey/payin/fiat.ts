/**
 * JPAYIN, FIAT method (delta D-3, answer 35). A fiat pay-in is confirmed only
 * by a human-reviewed internal-ledger entry event: signed (scheme is open
 * question DQ-1, so an unconfigured verifier rejects everything), deduplicated
 * on `payin:<expectedPayInId>`, with `reviewer` different from `bookedBy`.
 * The booked entry is read back (balanced, right client, right amount) and
 * `settlementConsentRef` is consumed before money may move on.
 */
import { cbsMinor } from '../../amounts/index.js';
import { lpDigestHex } from '../../nova-ports/ids.js';
import type { PortResult } from '../../nova-ports/ids.js';
import type { ConsentPort } from '../../ops/ports.js';
import { hold } from './cases.js';
import type { CaseOpener } from './cases.js';
import { assertConfig, expectationProblem, settlementDigest } from './types.js';
import type { FiatExpectation, PayInConfig, PayInExpectation, PayInPort, PayInResult } from './types.js';

/** Authenticity of an inbound pay-in event over the raw body. Two structurally different fakes exist; production: Nova's (DQ-1). */
export interface PayInEventVerifier {
  verify(rawBody: string, headers: Readonly<Record<string, string>>): boolean;
}

/** Fail-closed default while DQ-1 is open: nothing is authentic. */
export const unconfiguredVerifier: PayInEventVerifier = { verify: () => false };

export interface PayInEvent {
  readonly expectedPayInId: string;
  readonly bookedEntryRef: string;
  readonly confirmedAmount: bigint;
  readonly bookedBy: string;
  readonly reviewer: string;
  readonly confirmedAtMs: bigint;
}

/** What the internal ledger says it booked under `bookedEntryRef`. */
export interface BookedEntry {
  readonly balanced: boolean;
  readonly clientUid: string;
  readonly amount: bigint;
}

/**
 * Read-back of a booked entry. NOTE: the exported LedgerPort has no read by
 * entry reference, so this narrow port is the interface JPAYIN needs from
 * Nova (reported as an interface issue).
 */
export interface BookedEntryReader {
  read(bookedEntryRef: string): Promise<PortResult<BookedEntry, 'NOT_FOUND'>>;
}

export type IngestResult =
  | { readonly kind: 'ACCEPTED'; readonly dedupeKey: string }
  | { readonly kind: 'DUPLICATE'; readonly dedupeKey: string }
  | { readonly kind: 'CONFLICT'; readonly dedupeKey: string }
  | { readonly kind: 'REJECTED'; readonly code: 'AUTHENTICITY_FAILED' | 'MALFORMED' | 'SAME_PERSON' };

interface InboxRecord {
  readonly event: PayInEvent;
  readonly digest: string;
  conflict: boolean;
}

const DIGITS = /^\d{1,19}$/;
const REF = /^\S{1,255}$/;

export function eventDigest(e: PayInEvent): string {
  return lpDigestHex(['payin-confirmation', e.expectedPayInId, e.bookedEntryRef, e.confirmedAmount.toString(10), e.bookedBy, e.reviewer, e.confirmedAtMs.toString(10)]);
}

/** Parses the event body. Null for anything malformed (fail closed). Amounts and times are decimal strings. */
export function parsePayInEvent(rawBody: string): PayInEvent | null {
  let o: unknown;
  try {
    o = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (typeof o !== 'object' || o === null) return null;
  const r = o as Record<string, unknown>;
  const s = (k: string): string | null => (typeof r[k] === 'string' && REF.test(r[k] as string) ? (r[k] as string) : null);
  const n = (k: string): bigint | null => (typeof r[k] === 'string' && DIGITS.test(r[k] as string) ? BigInt(r[k] as string) : null);
  const expectedPayInId = s('expectedPayInId');
  const bookedEntryRef = s('bookedEntryRef');
  const bookedBy = s('bookedBy');
  const reviewer = s('reviewer');
  const amount = n('confirmedAmount');
  const at = n('confirmedAt');
  if ([expectedPayInId, bookedEntryRef, bookedBy, reviewer, amount, at].some((x) => x === null)) return null;
  if (amount === null || amount <= 0n || amount > 9_223_372_036_854_775_807n) return null;
  return {
    expectedPayInId: expectedPayInId as string,
    bookedEntryRef: bookedEntryRef as string,
    confirmedAmount: amount,
    bookedBy: bookedBy as string,
    reviewer: reviewer as string,
    confirmedAtMs: at as bigint,
  };
}

export interface FiatPayInDeps {
  readonly verifier: PayInEventVerifier;
  readonly entries: BookedEntryReader | null;
  readonly consent: ConsentPort;
  readonly ops: CaseOpener;
  readonly config: PayInConfig;
}

export class FiatPayIn implements PayInPort {
  readonly method = 'FIAT' as const;
  private readonly inbox = new Map<string, InboxRecord>();
  private readonly done = new Map<string, Extract<PayInResult, { kind: 'CONFIRMED' }>>();
  private readonly cfg: PayInConfig;

  constructor(private readonly d: FiatPayInDeps) {
    this.cfg = assertConfig(d.config);
  }

  /** Authenticity first, then shape, then the reviewer rule, then dedupe. Nothing is stored for a rejected event. */
  ingest(rawBody: string, headers: Readonly<Record<string, string>>): IngestResult {
    if (!this.d.verifier.verify(rawBody, headers)) return { kind: 'REJECTED', code: 'AUTHENTICITY_FAILED' };
    const ev = parsePayInEvent(rawBody);
    if (ev === null) return { kind: 'REJECTED', code: 'MALFORMED' };
    if (ev.reviewer.trim().toLowerCase() === ev.bookedBy.trim().toLowerCase()) return { kind: 'REJECTED', code: 'SAME_PERSON' };
    const key = `payin:${ev.expectedPayInId}`;
    const digest = eventDigest(ev);
    const seen = this.inbox.get(key);
    if (seen === undefined) {
      this.inbox.set(key, { event: ev, digest, conflict: false });
      return { kind: 'ACCEPTED', dedupeKey: key };
    }
    if (seen.digest === digest) return { kind: 'DUPLICATE', dedupeKey: key };
    seen.conflict = true; // at most one confirmation per expected pay-in: a second distinct one is SIGNAL_CONFLICT
    return { kind: 'CONFLICT', dedupeKey: key };
  }

  async settle(exp: PayInExpectation, nowMs: bigint): Promise<PayInResult> {
    if (exp.method !== 'FIAT') return { kind: 'FAILED_CLOSED', code: 'METHOD_UNSUPPORTED', detail: 'FiatPayIn settles FIAT only' };
    const bad = expectationProblem(exp);
    if (bad !== null) return { kind: 'FAILED_CLOSED', code: 'EXPECTATION_INVALID', detail: bad };
    const f: FiatExpectation = exp;
    const key = `payin:${f.expectedPayInId}`;
    const confirmed = this.done.get(key);
    if (confirmed !== undefined) return confirmed;
    const rec = this.inbox.get(key);
    if (rec === undefined) return nowMs > f.quoteExpiresAtMs ? { kind: 'EXPIRED' } : { kind: 'PENDING' };
    const ev = rec.event;
    const evidence = [ev.bookedEntryRef];
    if (rec.conflict) return hold(this.d.ops, this.cfg, f, 'SIGNAL_CONFLICT', ev.confirmedAmount, evidence);
    if (this.d.entries === null) return { kind: 'FAILED_CLOSED', code: 'NOT_CONFIGURED', detail: 'no booked-entry reader: cannot read the entry back' };
    // The amount is compared BEFORE any consent is consumed (D-3).
    const amount = cbsMinor(ev.confirmedAmount);
    if (ev.confirmedAtMs > f.quoteExpiresAtMs) return hold(this.d.ops, this.cfg, f, 'PAYIN_AFTER_QUOTE_EXPIRY', amount, evidence);
    const entry = await this.d.entries.read(ev.bookedEntryRef);
    if (entry.kind === 'AMBIGUOUS') return { kind: 'PENDING' };
    if (entry.kind === 'REJECTED' || !entry.value.balanced || entry.value.clientUid !== f.clientUid || entry.value.amount !== ev.confirmedAmount) {
      return hold(this.d.ops, this.cfg, f, 'BOOKED_ENTRY_MISMATCH', amount, evidence);
    }
    if (amount < f.expected) return hold(this.d.ops, this.cfg, f, 'CONFIRMED_BELOW_EXPECTED', amount, evidence);
    if (amount > f.expected) return hold(this.d.ops, this.cfg, f, 'CONFIRMED_ABOVE_EXPECTED', amount, evidence);
    if (f.settlementConsentRef === null) return hold(this.d.ops, this.cfg, f, 'CONSENT_MISSING', amount, evidence);
    const used = await this.d.consent.consume(f.settlementConsentRef, { clientUid: f.clientUid, paymentId: f.paymentId, caseId: null, digest: settlementDigest(f) });
    if (used.kind === 'AMBIGUOUS') return { kind: 'PENDING' };
    if (used.kind === 'REJECTED') return hold(this.d.ops, this.cfg, f, 'CONSENT_MISSING', amount, evidence);
    const res = { kind: 'CONFIRMED', method: 'FIAT', amount, evidenceRef: ev.bookedEntryRef, consentRef: f.settlementConsentRef } as const;
    this.done.set(key, res);
    return res;
  }
}
