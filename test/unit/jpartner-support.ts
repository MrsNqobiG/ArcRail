/**
 * Shared test support for JPARTNER: a throwaway AES-GCM KeyManagement (key
 * generated at runtime, never stored) and the known PII used to prove it never leaks.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { BankRecipientStore } from '../../src/journey/recipients/index.js';
import type { BankDetails, KeyManagement } from '../../src/journey/recipients/index.js';
import { fiatCode } from '../../src/nova-ports/ids.js';

export const PII = {
  holderName: 'Thandiwe Nkosi-Mokoena',
  accountNumber: '62837465192',
  branchCode: '250655',
  bankName: 'Ubuntu Test Bank',
} as const;
export const PII_STRINGS: readonly string[] = Object.values(PII);

export function bankDetails(over: Partial<BankDetails> = {}): BankDetails {
  return { ...PII, country: 'ZA', currency: fiatCode('ZAR'), ...over };
}

/** AES-256-GCM with the ref as AAD; records the ciphertexts it produced. */
export class AesKms implements KeyManagement {
  readonly #key = randomBytes(32);
  readonly sealed: Uint8Array[] = [];
  readonly contexts: string[] = [];
  async encrypt(plaintext: Uint8Array, context: string): Promise<Uint8Array> {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.#key, iv, { authTagLength: 16 });
    c.setAAD(Buffer.from(context));
    const out = Buffer.concat([iv, c.update(plaintext), c.final(), c.getAuthTag()]);
    this.sealed.push(out);
    this.contexts.push(context);
    return out;
  }
  async decrypt(ciphertext: Uint8Array, context: string): Promise<Uint8Array> {
    const b = Buffer.from(ciphertext);
    const d = createDecipheriv('aes-256-gcm', this.#key, b.subarray(0, 12), { authTagLength: 16 });
    d.setAAD(Buffer.from(context));
    d.setAuthTag(b.subarray(b.byteLength - 16));
    return Buffer.concat([d.update(b.subarray(12, b.byteLength - 16)), d.final()]);
  }
}

export class Clock {
  constructor(public t: bigint) {}
  now = (): bigint => this.t;
}

export function makeStore(retentionMs = 1000n, clock = new Clock(100n), keys: KeyManagement = new AesKms()): { store: BankRecipientStore; clock: Clock; keys: KeyManagement } {
  return { store: new BankRecipientStore({ keys, clock: clock.now, retentionMs }), clock, keys };
}
