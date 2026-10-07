/**
 * JPARTNER recipients: the receiver's destination, as data.
 *
 * - BankRecipient is PII. It is encrypted at rest through an INJECTED
 *   KeyManagement interface (Nova's KMS or a test double; no key lives here),
 *   only an opaque `recipientRef` ever leaves this module, and every way the
 *   plaintext could leak (JSON, string, inspect, errors, logs) is redacted.
 *   It is never put on-chain and never given to a ledger or status store.
 *   It is deleted after a stated retention (an explicit constructor input, in
 *   milliseconds as bigint; assumption: `DEFAULT_RETENTION_MS`, to be fixed by
 *   Compliance: docs/OPEN_QUESTIONS.md Q-R2 and Q-R12(d), both OPEN).
 * - WalletRecipient is an address, screened before it can be used: the local
 *   USDC blocklist copy is checked first, then the screening port, and anything
 *   but a clear answer fails closed.
 *
 * - Retention is enforced on access and by `purgeExpired()`. NOTHING here schedules
 *   the purge: the composition root (OWNER) must call `purgeExpired()` on a timer
 *   (JTIME / OPS runbook item, to be added by the integrator), or an unread row
 *   outlives its retention.
 * - Every `reveal` states a purpose and leaves an access record (no PII).
 *
 * Money path rule MC-01: no `number`; time is bigint milliseconds.
 */
import { randomBytes } from 'node:crypto';
import { asObject, canonicalJson, jsonObject, parseJson, reqString } from '../../dfns/json.js';
import { normaliseAddress } from '../../nova-ports/ids.js';
import type { FiatCode, NetworkAddress, NovaOwnerRef } from '../../nova-ports/ids.js';
import type { UsdcUnits } from '../../amounts/index.js';

/** `util.inspect.custom` without importing node:util (outside the money-path import allow-list, MC-34). */
const INSPECT = Symbol.for('nodejs.util.inspect.custom');

/** Opaque handle to a stored BankRecipient: `rcp-` + 32 hex characters, random, derived from nothing personal. */
export type RecipientRef = string & { readonly __recipientRef: true };

const REF_RE = /^rcp-[0-9a-f]{32}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const CCY_RE = /^[A-Z]{3}$/;
/** One to 140 characters (code points), no `number` needed: the bound lives in the pattern. */
const FIELD_RE = /^[\s\S]{1,140}$/u;

/**
 * Stated retention: PLACEHOLDER of five years, in milliseconds. It is an
 * UNVERIFIED assumption, not legal advice and not a quoted rule: the FIC Act
 * record-keeping period, its start (record creation here, not the end of the
 * relationship) and its scope are OPEN (docs/OPEN_QUESTIONS.md Q-R2, Q-R12(d)).
 * The store does not default to it; the composition root passes the value
 * Compliance states explicitly. Time is counted from record creation.
 */
export const DEFAULT_RETENTION_MS = 5n * 365n * 24n * 60n * 60n * 1000n;

export const REDACTED = '[REDACTED]';

/** What KeyManagement is asked for. `context` binds a ciphertext to its ref (AAD). */
export interface KeyManagement {
  encrypt(plaintext: Uint8Array, context: string): Promise<Uint8Array>;
  decrypt(ciphertext: Uint8Array, context: string): Promise<Uint8Array>;
}

/** Bank account details of a receiver: all of it is PII except country and currency routing data. */
export interface BankDetails {
  readonly holderName: string;
  readonly accountNumber: string;
  readonly branchCode: string;
  readonly bankName: string;
  /** ISO 3166-1 alpha-2, upper case. */
  readonly country: string;
  readonly currency: FiatCode;
}

/** The non-PII routing facts about a stored recipient. */
export interface RecipientMeta {
  readonly ref: RecipientRef;
  readonly ownerRef: NovaOwnerRef;
  readonly country: string;
  readonly currency: FiatCode;
  readonly createdAt: bigint;
  readonly expiresAt: bigint;
}

export type RecipientErrorCode =
  | 'INVALID_DETAILS'
  | 'INVALID_REF'
  | 'NOT_FOUND'
  | 'RETENTION_EXPIRED'
  | 'KEY_MANAGEMENT_FAILED'
  | 'INVALID_PURPOSE'
  | 'CORRUPT_RECORD';

const MESSAGES: Readonly<Record<RecipientErrorCode, string>> = {
  INVALID_DETAILS: 'recipient details rejected',
  INVALID_REF: 'recipient ref is not valid',
  NOT_FOUND: 'recipient not found',
  RETENTION_EXPIRED: 'recipient data past its retention and deleted',
  KEY_MANAGEMENT_FAILED: 'key management failed',
  INVALID_PURPOSE: 'reveal purpose is not valid',
  CORRUPT_RECORD: 'recipient record could not be decoded',
};

/** An error whose message is a fixed string per code: it never carries input, so it cannot leak PII. */
export class RecipientError extends Error {
  override readonly name = 'RecipientError';
  constructor(readonly code: RecipientErrorCode) {
    super(MESSAGES[code]);
  }
  toJSON(): { readonly name: string; readonly code: RecipientErrorCode } {
    return { name: this.name, code: this.code };
  }
}

/** Holds revealed PII. Every default rendering is redacted; `use` is the only way to read it. */
export class Secret<T> {
  readonly #value: T;
  constructor(value: T) {
    this.#value = value;
  }
  use<R>(fn: (value: T) => R): R {
    return fn(this.#value);
  }
  toJSON(): string {
    return REDACTED;
  }
  toString(): string {
    return REDACTED;
  }
  [INSPECT](): string {
    return REDACTED;
  }
}

interface Row {
  readonly meta: RecipientMeta;
  readonly sealed: Uint8Array;
}

function field(s: string, pattern: RegExp = FIELD_RE): void {
  if (!FIELD_RE.test(s) || !pattern.test(s)) throw new RecipientError('INVALID_DETAILS');
}

function checkDetails(d: BankDetails): void {
  field(d.holderName);
  field(d.accountNumber);
  field(d.branchCode);
  field(d.bankName);
  field(d.country, COUNTRY_RE);
  field(d.currency, CCY_RE);
}

function encode(d: BankDetails): Uint8Array {
  const text = canonicalJson(
    jsonObject([
      ['holderName', d.holderName],
      ['accountNumber', d.accountNumber],
      ['branchCode', d.branchCode],
      ['bankName', d.bankName],
      ['country', d.country],
      ['currency', d.currency],
    ]),
  );
  return new TextEncoder().encode(text);
}

function decode(bytes: Uint8Array): BankDetails {
  try {
    const o = asObject(parseJson(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), 'recipient');
    return {
      holderName: reqString(o, 'holderName'),
      accountNumber: reqString(o, 'accountNumber'),
      branchCode: reqString(o, 'branchCode'),
      bankName: reqString(o, 'bankName'),
      country: reqString(o, 'country'),
      currency: reqString(o, 'currency') as FiatCode,
    };
  } catch {
    throw new RecipientError('CORRUPT_RECORD');
  }
}

/** Why PII is being decrypted. */
export type RevealPurpose = 'PAYOUT' | 'COMPLIANCE_REVIEW' | 'ERASURE_REQUEST';
const PURPOSES: readonly string[] = ['PAYOUT', 'COMPLIANCE_REVIEW', 'ERASURE_REQUEST'];

/** One PII access: who it concerned (the opaque ref), why, and when. No PII. */
export interface RevealRecord {
  readonly ref: RecipientRef;
  readonly purpose: RevealPurpose;
  readonly at: bigint;
}

export interface BankRecipientStoreOptions {
  readonly keys: KeyManagement;
  /** Milliseconds since the epoch. */
  readonly clock: () => bigint;
  /** Retention in milliseconds, > 0. */
  readonly retentionMs: bigint;
  /** 16 random bytes; injectable for tests. Defaults to the platform CSPRNG. */
  readonly randomBytes?: () => Uint8Array;
}

/** In-memory row store behind the encryption: Nova's database replaces `rows` when this ships. */
export class BankRecipientStore {
  readonly #keys: KeyManagement;
  readonly #clock: () => bigint;
  readonly #retentionMs: bigint;
  readonly #random: () => Uint8Array;
  readonly #rows = new Map<string, Row>();
  #access: readonly RevealRecord[] = [];

  constructor(o: BankRecipientStoreOptions) {
    if (o.retentionMs <= 0n) throw new RangeError('retentionMs must be > 0');
    this.#keys = o.keys;
    this.#clock = o.clock;
    this.#retentionMs = o.retentionMs;
    this.#random = o.randomBytes ?? ((): Uint8Array => randomBytes(16));
  }

  /** Encrypts and stores; returns only the opaque ref. */
  async create(ownerRef: NovaOwnerRef, details: BankDetails): Promise<RecipientRef> {
    checkDetails(details);
    const ref = `rcp-${Buffer.from(this.#random()).toString('hex')}`;
    if (!REF_RE.test(ref) || this.#rows.has(ref)) throw new RecipientError('KEY_MANAGEMENT_FAILED');
    let sealed: Uint8Array;
    try {
      sealed = await this.#keys.encrypt(encode(details), ref);
    } catch {
      throw new RecipientError('KEY_MANAGEMENT_FAILED');
    }
    const createdAt = this.#clock();
    this.#rows.set(ref, {
      sealed,
      meta: Object.freeze({
        ref: ref as RecipientRef,
        ownerRef,
        country: details.country,
        currency: details.currency,
        createdAt,
        expiresAt: createdAt + this.#retentionMs,
      }),
    });
    return ref as RecipientRef;
  }

  /** Routing facts only (no PII). Past retention the row is deleted and this throws. */
  meta(ref: string): RecipientMeta {
    return this.#live(ref).meta;
  }

  /** Decrypts for a stated purpose, which is recorded; the result renders as REDACTED unless read through `use`. */
  async reveal(ref: string, purpose: RevealPurpose): Promise<Secret<BankDetails>> {
    const row = this.#live(ref);
    if (!PURPOSES.includes(purpose)) throw new RecipientError('INVALID_PURPOSE');
    this.#access = [...this.#access, Object.freeze({ ref: row.meta.ref, purpose, at: this.#clock() })];
    let plain: Uint8Array;
    try {
      plain = await this.#keys.decrypt(row.sealed, row.meta.ref);
    } catch {
      throw new RecipientError('KEY_MANAGEMENT_FAILED');
    }
    return new Secret(decode(plain));
  }

  /** Every PII access so far, oldest first (a copy; no PII). */
  accessLog(): readonly RevealRecord[] {
    return [...this.#access];
  }

  /** Deletes one recipient now (the owner's erasure request). True when something was deleted. */
  delete(ref: string): boolean {
    return this.#rows.delete(ref);
  }

  /** Deletes every row past its retention. Returns how many. */
  purgeExpired(): bigint {
    const now = this.#clock();
    let n = 0n;
    for (const [ref, row] of this.#rows) {
      if (now >= row.meta.expiresAt) {
        this.#rows.delete(ref);
        n += 1n;
      }
    }
    return n;
  }

  /** Never serialises its rows. */
  toJSON(): string {
    return REDACTED;
  }

  [INSPECT](): string {
    return 'BankRecipientStore [REDACTED]';
  }

  #live(ref: string): Row {
    if (!REF_RE.test(ref)) throw new RecipientError('INVALID_REF');
    const row = this.#rows.get(ref);
    if (row === undefined) throw new RecipientError('NOT_FOUND');
    if (this.#clock() >= row.meta.expiresAt) {
      this.#rows.delete(ref);
      throw new RecipientError('RETENTION_EXPIRED');
    }
    return row;
  }
}

/**
 * A receiver wallet that passed screening. Only this module constructs it:
 * the type is branded, and `isScreenedWallet` checks a registry that only
 * `screenWalletRecipient` writes, so a hand-built `{kind:'WALLET', address}`
 * neither type-checks nor passes the runtime check. Screening is not cached
 * as a licence: a send must call `screenWalletRecipient` again (the local
 * blocklist copy is checked before EVERY send, CLAUDE.md Arc facts).
 */
export interface WalletRecipient {
  readonly kind: 'WALLET';
  readonly address: NetworkAddress;
  readonly __screened: true;
}

const SCREENED = new WeakSet<object>();

/** True only for an object `screenWalletRecipient` returned. */
export function isScreenedWallet(x: object | null): boolean {
  return x !== null && SCREENED.has(x);
}

export type ScreeningAnswer = 'CLEAR' | 'BLOCKED' | 'UNAVAILABLE';

/** Address screening port (sanctions / risk). Two fakes in the tests. */
export interface AddressScreeningPort {
  screen(address: NetworkAddress): Promise<ScreeningAnswer>;
}

/**
 * Travel-rule data hook (FIC Directive 9). Nova's compliance code answers
 * whether the originator/beneficiary data for a send to this address has been
 * collected and may travel. NOT_REQUIRED and READY let the send proceed; HOLD
 * and any failure block it. Unhosted-wallet handling is an open question
 * (docs/OPEN_QUESTIONS.md Q-R3, Q-R9), so the policy lives behind this hook, not here.
 */
export type TravelRuleAnswer = 'NOT_REQUIRED' | 'READY' | 'HOLD';
/** The transfer the answer is for, so the hook can decide per amount and originator. */
export interface TravelRuleContext {
  readonly amount: UsdcUnits;
  readonly originator: NovaOwnerRef;
}
export interface TravelRuleHook {
  check(address: NetworkAddress, transfer: TravelRuleContext): Promise<TravelRuleAnswer>;
}
/**
 * Explicit "no travel-rule check" for the Arc TESTNET demo only (no real value moves). It must never be wired
 * on mainnet: the hook is REQUIRED, so leaving it out is a compile error and this name is the visible choice.
 */
export const TRAVEL_RULE_NOT_APPLICABLE_TESTNET: TravelRuleHook = { check: () => Promise.resolve('NOT_REQUIRED') };

export type WalletRecipientRejectCode =
  | 'ADDRESS_INVALID'
  | 'BLOCKLISTED'
  | 'SCREENING_BLOCKED'
  | 'SCREENING_UNAVAILABLE'
  | 'TRAVEL_RULE_HOLD';

export type WalletRecipientResult =
  | { readonly kind: 'OK'; readonly recipient: WalletRecipient }
  | { readonly kind: 'REJECTED'; readonly code: WalletRecipientRejectCode };

/**
 * The local USDC blocklist copy is checked before every send, then the screening
 * port. Fail closed: a throw, an unknown answer or UNAVAILABLE is a rejection.
 * The travel-rule hook (FIC Directive 9, REQUIRED, given the transfer context) runs last and also fails closed.
 */
export async function screenWalletRecipient(
  address: string,
  deps: {
    readonly screening: AddressScreeningPort;
    readonly localBlocklist: (address: NetworkAddress) => boolean;
    readonly travelRule: TravelRuleHook;
  },
  transfer: TravelRuleContext,
): Promise<WalletRecipientResult> {
  const a = normaliseAddress(address);
  if (a === null) return { kind: 'REJECTED', code: 'ADDRESS_INVALID' };
  try {
    if (deps.localBlocklist(a)) return { kind: 'REJECTED', code: 'BLOCKLISTED' };
  } catch {
    return { kind: 'REJECTED', code: 'SCREENING_UNAVAILABLE' };
  }
  let answer: ScreeningAnswer;
  try {
    answer = await deps.screening.screen(a);
  } catch {
    return { kind: 'REJECTED', code: 'SCREENING_UNAVAILABLE' };
  }
  if (answer === 'BLOCKED') return { kind: 'REJECTED', code: 'SCREENING_BLOCKED' };
  if (answer !== 'CLEAR') return { kind: 'REJECTED', code: 'SCREENING_UNAVAILABLE' };
  let tr: TravelRuleAnswer;
  try {
    tr = await deps.travelRule.check(a, transfer);
  } catch {
    return { kind: 'REJECTED', code: 'TRAVEL_RULE_HOLD' };
  }
  if (tr !== 'NOT_REQUIRED' && tr !== 'READY') return { kind: 'REJECTED', code: 'TRAVEL_RULE_HOLD' };
  const recipient = Object.freeze({ kind: 'WALLET', address: a, __screened: true } as const);
  SCREENED.add(recipient);
  return { kind: 'OK', recipient };
}
