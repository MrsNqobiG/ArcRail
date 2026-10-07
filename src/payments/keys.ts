/**
 * PAY: deterministic keys (docs/NOVA_ARC_DESIGN.md §10.2). Pure; no clock, no randomness.
 */
import { createHash } from 'node:crypto';
import { idempotencyKey, lpDigestHex, paymentId } from '../nova-ports/ids.js';
import type { Hex32, IdempotencyKey, NovaOwnerRef, PaymentId, WalletRef } from '../nova-ports/ids.js';

/** Client `Idempotency-Key`: 1 to 255 printable ASCII characters (§10.2), else HTTP 400. */
const CLIENT_KEY_RE = /^[\x20-\x7e]{1,255}$/;

export function isClientIdempotencyKey(s: string): boolean {
  return CLIENT_KEY_RE.test(s);
}

export interface RequestIds {
  readonly requestKey: IdempotencyKey;
  readonly paymentId: PaymentId;
}

/** `h = sha256(lp('nv1-request') ‖ lp(payer) ‖ lp(clientKey))`; length-prefixed, so no two (payer, key) pairs collide. */
export function deriveRequestIds(payer: NovaOwnerRef, clientKey: string): RequestIds {
  if (!isClientIdempotencyKey(clientKey)) throw new TypeError('client idempotency key must be 1 to 255 printable ASCII characters');
  const h = lpDigestHex(['nv1-request', payer, clientKey]);
  return { requestKey: idempotencyKey(`req-${h}`), paymentId: paymentId(`pay-${h.slice(0, 32)}`) };
}

/** Wallet tag `<w>` of §10.2: `wt` + 32 hex characters. Nova's walletRef charset never appears in a key. */
export function walletTag(ref: WalletRef): string {
  return `wt${lpDigestHex(['nv1-wallet', ref]).slice(0, 32)}`;
}

export function ledgerKey(id: PaymentId, template: 'p1' | 'p2' | 'p3' | 'p6'): IdempotencyKey {
  return idempotencyKey(`pay:${id}:${template}`);
}

export function gasKey(chainId: bigint, txHash: Hex32): IdempotencyKey {
  return idempotencyKey(`gas:${chainId}:${txHash.toLowerCase()}`);
}

/** sha256 over a canonical text, as the `0x` hex the store expects for payload digests. */
export function digestHex(canonical: string): Hex32 {
  return `0x${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}
