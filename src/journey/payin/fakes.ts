/** JPAYIN test support: two structurally different event verifiers and two booked-entry readers. No real keys. */
import { createHmac, createPublicKey, timingSafeEqual, verify as edVerify } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { ok, rejected } from '../../nova-ports/ids.js';
import type { PortResult } from '../../nova-ports/ids.js';
import type { BookedEntry, BookedEntryReader, PayInEventVerifier } from './fiat.js';

/** Fake A: shared-secret HMAC-SHA256 over the raw body, header `x-payin-signature` (hex). */
export class HmacVerifier implements PayInEventVerifier {
  constructor(private readonly secret: Buffer) {}
  sign(rawBody: string): string {
    return createHmac('sha256', this.secret).update(rawBody, 'utf8').digest('hex');
  }
  verify(rawBody: string, headers: Readonly<Record<string, string>>): boolean {
    const got = headers['x-payin-signature'];
    if (typeof got !== 'string' || !/^[0-9a-f]{64}$/.test(got)) return false;
    return timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(this.sign(rawBody), 'hex'));
  }
}

/** Fake B: Ed25519 signature (base64) over the raw body, with a key id header; only a known key id is trusted. */
export class Ed25519Verifier implements PayInEventVerifier {
  private readonly keys = new Map<string, KeyObject>();
  trust(keyId: string, publicKeyPem: string): void {
    this.keys.set(keyId, createPublicKey(publicKeyPem));
  }
  verify(rawBody: string, headers: Readonly<Record<string, string>>): boolean {
    const key = this.keys.get(headers['x-payin-key-id'] ?? '');
    const sig = headers['x-payin-sig'];
    if (key === undefined || typeof sig !== 'string') return false;
    try {
      return edVerify(null, Buffer.from(rawBody, 'utf8'), key, Buffer.from(sig, 'base64'));
    } catch {
      return false;
    }
  }
}

/** Booked-entry reader A: a map. */
export class MapEntries implements BookedEntryReader {
  private readonly m = new Map<string, BookedEntry>();
  book(ref: string, e: BookedEntry): void {
    this.m.set(ref, e);
  }
  async read(ref: string): Promise<PortResult<BookedEntry, 'NOT_FOUND'>> {
    const e = this.m.get(ref);
    return e === undefined ? rejected('NOT_FOUND', ref) : ok(e, false);
  }
}

/** Booked-entry reader B: an append-only log; the latest line for a ref wins. */
export class LogEntries implements BookedEntryReader {
  readonly log: { ref: string; e: BookedEntry }[] = [];
  book(ref: string, e: BookedEntry): void {
    this.log.push({ ref, e });
  }
  async read(ref: string): Promise<PortResult<BookedEntry, 'NOT_FOUND'>> {
    const hit = this.log.filter((l) => l.ref === ref).at(-1);
    return hit === undefined ? rejected('NOT_FOUND', ref) : ok(hit.e, false);
  }
}
