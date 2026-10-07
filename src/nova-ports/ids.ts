/**
 * Nova ports: shared identifiers and the result model (docs/NOVA_ARC_DESIGN.md §7.1).
 *
 * The package owns no ledger, wallets or invoices. It reaches Nova only through
 * the ports in this directory, which Nova implements. Every statement about
 * Nova here is an assumption tagged [A-xx] (docs/KHUMO_QUESTIONS.md, row K-xx).
 *
 * Money path: no `number` anywhere (MC-01). Counters and limits are `bigint`.
 */

import { createHash } from 'node:crypto';

/** Deterministic idempotency key, `[a-z0-9:-]`, 1 to 128 characters (§10.2) [A-04]. */
export type IdempotencyKey = string & { readonly __idempotencyKey: true };
/** `pay-` + 32 lower-case hex characters (§10.2); also inside the IdempotencyKey charset. */
export type PaymentId = string & { readonly __paymentId: true };
/** Nova's own ledger account identifier [A-02]. */
export type NovaAccountRef = string & { readonly __novaAccountRef: true };
/** Nova `user_id` / merchant id [A-20]. */
export type NovaOwnerRef = string & { readonly __novaOwnerRef: true };
/** Nova `wallets` row id [A-20]. */
export type WalletRef = string & { readonly __walletRef: true };
/** A server-side beneficiary / receiver record [A-41]. */
export type BeneficiaryRef = string & { readonly __beneficiaryRef: true };
/** Ledger asset code, for example `USDC` or `ZAR` [A-03]. */
export type LedgerAssetCode = string & { readonly __ledgerAssetCode: true };
/** ISO 4217 alpha-3 currency code (upper case). */
export type FiatCode = string & { readonly __fiatCode: true };
/** EVM address, always lower-cased on entry (§7.1) [A-22]. */
export type NetworkAddress = `0x${string}`;
/** 32-byte hash, lower-case hex. */
export type Hex32 = `0x${string}`;

/**
 * Network identifiers: re-exported from the network port (unit NET,
 * `src/network/types.ts`, design §5.1), so there is one definition. FAKENET is
 * test-only and the production composition root rejects it. Type-only: no NET
 * code runs on this path.
 */
export type { AssetId, NetworkId } from '../network/types.js';

/** Why an outcome is unknown (§7.1). The caller resolves it by key lookup, never by a fresh write. */
export type AmbiguousCause = 'TIMEOUT' | 'TRANSPORT' | 'UNAVAILABLE';

/** Every port call returns exactly one of three outcomes. Ports never throw for business outcomes (§7.1). */
export type PortResult<T, Code extends string> =
  | { readonly kind: 'OK'; readonly value: T; readonly replayed: boolean }
  | { readonly kind: 'REJECTED'; readonly code: Code; readonly detail: string }
  | { readonly kind: 'AMBIGUOUS'; readonly cause: AmbiguousCause };

/** Every keyed write rejects a key reused with a different request (§7.1). */
export type KeyConflict = 'KEY_CONFLICT';

export function ok<T>(value: T, replayed: boolean): PortResult<T, never> {
  return { kind: 'OK', value, replayed };
}

export function rejected<C extends string>(code: C, detail: string): PortResult<never, C> {
  return { kind: 'REJECTED', code, detail };
}

export function ambiguous(cause: AmbiguousCause): PortResult<never, never> {
  return { kind: 'AMBIGUOUS', cause };
}

const KEY_RE = /^[a-z0-9:-]{1,128}$/;
const PAYMENT_ID_RE = /^pay-[0-9a-f]{32}$/;
const ADDRESS_RE = /^0x[0-9a-f]{40}$/;
const HEX32_RE = /^0x[0-9a-f]{64}$/;
const FIAT_RE = /^[A-Z]{3}$/;
const REF_RE = /^\S{1,255}$/;

/** True when `s` is a valid idempotency key. */
export function isIdempotencyKey(s: string): boolean {
  return KEY_RE.test(s);
}

/** Checked constructor. Throws on a malformed key (a programming error: keys are derived, §10.2). */
export function idempotencyKey(s: string): IdempotencyKey {
  if (!isIdempotencyKey(s)) throw new TypeError(`invalid idempotency key: ${JSON.stringify(s)}`);
  return s as IdempotencyKey;
}

export function isPaymentId(s: string): boolean {
  return PAYMENT_ID_RE.test(s);
}

export function paymentId(s: string): PaymentId {
  if (!isPaymentId(s)) throw new TypeError(`invalid payment id: ${JSON.stringify(s)}`);
  return s as PaymentId;
}

/** Lower-cases and checks an EVM address; null when it is not 20 bytes of hex. */
export function normaliseAddress(s: string): NetworkAddress | null {
  const lower = s.toLowerCase();
  return ADDRESS_RE.test(lower) ? (lower as NetworkAddress) : null;
}

/** Lower-cases and checks a 32-byte hash; null when malformed. */
export function normaliseHex32(s: string): Hex32 | null {
  const lower = s.toLowerCase();
  return HEX32_RE.test(lower) ? (lower as Hex32) : null;
}

export function fiatCode(s: string): FiatCode {
  if (!FIAT_RE.test(s)) throw new TypeError(`invalid ISO 4217 code: ${JSON.stringify(s)}`);
  return s as FiatCode;
}

function checkedRef(s: string, what: string): string {
  if (!REF_RE.test(s)) throw new TypeError(`invalid ${what}: ${JSON.stringify(s)}`);
  return s;
}

export function novaAccountRef(s: string): NovaAccountRef {
  return checkedRef(s, 'account ref') as NovaAccountRef;
}

export function novaOwnerRef(s: string): NovaOwnerRef {
  return checkedRef(s, 'owner ref') as NovaOwnerRef;
}

export function walletRef(s: string): WalletRef {
  return checkedRef(s, 'wallet ref') as WalletRef;
}

export function beneficiaryRef(s: string): BeneficiaryRef {
  return checkedRef(s, 'beneficiary ref') as BeneficiaryRef;
}

export function ledgerAssetCode(s: string): LedgerAssetCode {
  return checkedRef(s, 'asset code') as LedgerAssetCode;
}

/** UTF-8 byte length of `s`, as a bigint (no `number` on a money path, MC-01). */
function utf8ByteLength(s: string): bigint {
  let hexDigits = 0n;
  for (const _ of Buffer.from(s, 'utf8').toString('hex')) hexDigits += 1n;
  return hexDigits / 2n;
}

/**
 * §10.2 `lp(x)`: the 4-byte big-endian UTF-8 byte length of `x`, then its bytes,
 * so no two field lists encode alike. A JS string has fewer than 2^30 UTF-16
 * units in V8, so at most 3 × 2^30 < 2^32 UTF-8 bytes: the length always fits.
 */
function lengthPrefixed(s: string): Buffer {
  const len = utf8ByteLength(s);
  return Buffer.concat([Buffer.from(len.toString(16).padStart(8, '0'), 'hex'), Buffer.from(s, 'utf8')]);
}

/** Lower-case hex of sha256(lp(f1) ‖ lp(f2) ‖ …), the §10.2 derivation of record and decision ids. */
export function lpDigestHex(fields: readonly string[]): string {
  return createHash('sha256').update(Buffer.concat(fields.map(lengthPrefixed))).digest('hex');
}
