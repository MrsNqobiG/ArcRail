import { inspect } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import {
  BankRecipientStore,
  DEFAULT_RETENTION_MS,
  REDACTED,
  RecipientError,
  Secret,
  isScreenedWallet,
  TRAVEL_RULE_NOT_APPLICABLE_TESTNET,
  screenWalletRecipient,
} from '../../src/journey/recipients/index.js';
import type { AddressScreeningPort, KeyManagement, ScreeningAnswer, TravelRuleAnswer, TravelRuleContext, TravelRuleHook } from '../../src/journey/recipients/index.js';
import { fiatCode, novaOwnerRef } from '../../src/nova-ports/ids.js';
import type { UsdcUnits } from '../../src/amounts/index.js';
import type { NetworkAddress } from '../../src/nova-ports/ids.js';
import { AesKms, Clock, PII, PII_STRINGS, bankDetails, makeStore } from './jpartner-support.js';

const owner = novaOwnerRef('owner-1');
const XFER: TravelRuleContext = { amount: 12_345n as UsdcUnits, originator: owner };
type ScreenDeps = Omit<Parameters<typeof screenWalletRecipient>[1], 'travelRule'> & { readonly travelRule?: TravelRuleHook };
const screen = (a: string, d: ScreenDeps) => screenWalletRecipient(a, { travelRule: TRAVEL_RULE_NOT_APPLICABLE_TESTNET, ...d }, XFER);
const leaks = (text: string): string[] => PII_STRINGS.filter((p) => text.includes(p));

describe('BankRecipient: encryption and the opaque ref', () => {
  it('returns only an opaque random ref; meta has routing facts and no PII', async () => {
    const { store, clock } = makeStore(1000n, new Clock(100n));
    const ref = await store.create(owner, bankDetails());
    expect(ref).toMatch(/^rcp-[0-9a-f]{32}$/);
    const meta = store.meta(ref);
    expect(meta).toEqual({ ref, ownerRef: owner, country: 'ZA', currency: 'ZAR', createdAt: 100n, expiresAt: 1100n });
    expect(leaks(ref + inspect(meta, { depth: 9 }))).toEqual([]);
    clock.t = 5n;
    const ref2 = await store.create(owner, bankDetails());
    expect(ref2).not.toBe(ref);
  });

  it('refs are derived from nothing personal: equal details give different refs', async () => {
    const { store } = makeStore();
    const a = await store.create(owner, bankDetails());
    const b = await store.create(owner, bankDetails());
    expect(a).not.toBe(b);
  });

  it('encrypts with the ref as context; the stored ciphertext holds no plaintext', async () => {
    const kms = new AesKms();
    const { store } = makeStore(1000n, new Clock(1n), kms);
    const ref = await store.create(owner, bankDetails());
    expect(kms.contexts).toEqual([ref]);
    expect(kms.sealed).toHaveLength(1);
    const text = Buffer.from(kms.sealed[0] as Uint8Array).toString('latin1');
    expect(leaks(text)).toEqual([]);
  });

  it('reveal decrypts the same details, bound to the ref', async () => {
    const { store } = makeStore();
    const ref = await store.create(owner, bankDetails());
    const s = await store.reveal(ref, 'PAYOUT');
    expect(s.use((d) => d)).toEqual(bankDetails());
    expect(s.use((d) => d.accountNumber)).toBe('62837465192');
  });

  it('a ciphertext cannot be moved to another ref (context binding)', async () => {
    const kms = new AesKms();
    const { store } = makeStore(1000n, new Clock(1n), kms);
    const ref = await store.create(owner, bankDetails());
    const sealed = kms.sealed[0] as Uint8Array;
    await expect(kms.decrypt(sealed, 'rcp-' + '0'.repeat(32))).rejects.toThrow();
    expect(ref).toMatch(/^rcp-/);
  });

  it('uses the injected random source and refuses a colliding ref', async () => {
    const fixed = (): Uint8Array => new Uint8Array(16).fill(7);
    const store = new BankRecipientStore({ keys: new AesKms(), clock: () => 1n, retentionMs: 10n, randomBytes: fixed });
    const ref = await store.create(owner, bankDetails());
    expect(ref).toBe('rcp-' + '07'.repeat(16));
    await expect(store.create(owner, bankDetails())).rejects.toMatchObject({ code: 'KEY_MANAGEMENT_FAILED' });
  });

  it('a short random source is refused (the ref would not be 128 bits)', async () => {
    const store = new BankRecipientStore({ keys: new AesKms(), clock: () => 1n, retentionMs: 10n, randomBytes: () => new Uint8Array(15) });
    await expect(store.create(owner, bankDetails())).rejects.toMatchObject({ code: 'KEY_MANAGEMENT_FAILED' });
  });

  it('the default random source gives 128-bit refs', async () => {
    const store = new BankRecipientStore({ keys: new AesKms(), clock: () => 1n, retentionMs: 10n });
    const refs = new Set([await store.create(owner, bankDetails()), await store.create(owner, bankDetails())]);
    expect(refs.size).toBe(2);
  });

  it('rejects a non-positive retention', () => {
    for (const r of [0n, -1n]) {
      expect(() => new BankRecipientStore({ keys: new AesKms(), clock: () => 1n, retentionMs: r })).toThrow(RangeError);
    }
    expect(() => new BankRecipientStore({ keys: new AesKms(), clock: () => 1n, retentionMs: 1n })).not.toThrow();
  });

  it('states the retention default: five years in ms', () => {
    expect(DEFAULT_RETENTION_MS).toBe(157_680_000_000n);
  });
});

describe('BankRecipient: validation', () => {
  const bad: [string, Parameters<typeof bankDetails>[0]][] = [
    ['empty holderName', { holderName: '' }],
    ['empty accountNumber', { accountNumber: '' }],
    ['empty branchCode', { branchCode: '' }],
    ['empty bankName', { bankName: '' }],
    ['empty country', { country: '' }],
    ['lower-case country', { country: 'za' }],
    ['3-letter country', { country: 'ZAF' }],
    ['1-letter country', { country: 'Z' }],
    ['lower-case currency', { currency: 'zar' as ReturnType<typeof fiatCode> }],
    ['2-letter currency', { currency: 'ZA' as ReturnType<typeof fiatCode> }],
    ['4-letter currency', { currency: 'ZARR' as ReturnType<typeof fiatCode> }],
    ['141-char holderName', { holderName: 'x'.repeat(141) }],
    ['141-char accountNumber', { accountNumber: 'x'.repeat(141) }],
    ['141-char branchCode', { branchCode: 'x'.repeat(141) }],
    ['141-char bankName', { bankName: 'x'.repeat(141) }],
  ];
  it.each(bad)('rejects %s', async (_n, over) => {
    const { store } = makeStore();
    await expect(store.create(owner, bankDetails(over))).rejects.toMatchObject({ code: 'INVALID_DETAILS' });
  });
  it('accepts 1 and 140 characters, multi-line and non-ASCII', async () => {
    const { store } = makeStore();
    await expect(store.create(owner, bankDetails({ holderName: 'x'.repeat(140), accountNumber: 'a', branchCode: 'é\nb', bankName: '𝒳'.repeat(140) }))).resolves.toMatch(/^rcp-/);
  });
  it('the invalid-details error never echoes the input', async () => {
    const { store } = makeStore();
    const err = await store.create(owner, bankDetails({ holderName: PII.holderName + 'x'.repeat(200) })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RecipientError);
    expect(leaks(String(err) + JSON.stringify(err) + inspect(err))).toEqual([]);
    expect(leaks((err as Error).stack ?? '')).toEqual([]);
  });
});

describe('BankRecipient: PII never appears in logs, JSON or errors', () => {
  it('redacts every rendering of a revealed secret and of the store', async () => {
    const { store } = makeStore();
    const ref = await store.create(owner, bankDetails());
    const secret = await store.reveal(ref, 'PAYOUT');
    const renderings = [
      JSON.stringify(secret),
      JSON.stringify({ nested: secret }),
      String(secret),
      `${secret.toString()}`,
      inspect(secret),
      inspect({ a: [secret] }, { depth: 9 }),
      JSON.stringify(store),
      inspect(store),
      inspect({ store }, { depth: 9 }),
    ];
    for (const r of renderings) expect(leaks(r)).toEqual([]);
    expect(JSON.stringify(secret)).toBe(JSON.stringify(REDACTED));
    expect(String(secret)).toBe(REDACTED);
    expect(inspect(secret)).toBe(REDACTED);
    expect(JSON.stringify(store)).toBe(JSON.stringify(REDACTED));
    expect(inspect(store)).toBe('BankRecipientStore [REDACTED]');
    expect(new Secret(1n).toJSON()).toBe(REDACTED);
  });

  it('writes nothing with PII to console or stdout/stderr during a whole lifecycle', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const errw = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const { store, clock } = makeStore(10n, new Clock(0n));
      const ref = await store.create(owner, bankDetails());
      await store.reveal(ref, 'PAYOUT');
      store.meta(ref);
      clock.t = 50n;
      store.purgeExpired();
      await store.reveal(ref, 'PAYOUT').catch(() => undefined);
      const seen = [...spies.flatMap((s) => s.mock.calls), ...out.mock.calls, ...errw.mock.calls].map((c) => c.map(String).join(' ')).join('\n');
      expect(leaks(seen)).toEqual([]);
    } finally {
      for (const s of spies) s.mockRestore();
      out.mockRestore();
      errw.mockRestore();
    }
  });

  it('a KeyManagement failure that carries PII is replaced by a fixed error', async () => {
    const leaky: KeyManagement = {
      encrypt: () => Promise.reject(new Error(`boom for ${PII.accountNumber} ${PII.holderName}`)),
      decrypt: () => Promise.reject(new Error(`boom for ${PII.accountNumber}`)),
    };
    const { store } = makeStore(1000n, new Clock(1n), leaky);
    const e1 = await store.create(owner, bankDetails()).catch((e: unknown) => e);
    expect(e1).toMatchObject({ code: 'KEY_MANAGEMENT_FAILED', message: 'key management failed' });
    expect(leaks(String(e1) + JSON.stringify(e1) + inspect(e1, { depth: 9 }))).toEqual([]);
    expect((e1 as Error).cause).toBeUndefined();

    const good = new AesKms();
    const { store: s2 } = makeStore(1000n, new Clock(1n), { encrypt: (p, c) => good.encrypt(p, c), decrypt: leaky.decrypt });
    const ref = await s2.create(owner, bankDetails());
    const e2 = await s2.reveal(ref, 'PAYOUT').catch((e: unknown) => e);
    expect(e2).toMatchObject({ code: 'KEY_MANAGEMENT_FAILED' });
    expect(leaks(String(e2) + inspect(e2, { depth: 9 }))).toEqual([]);
  });

  it('every error code has a fixed message and a code-only JSON form', () => {
    const codes = ['INVALID_DETAILS', 'INVALID_REF', 'NOT_FOUND', 'RETENTION_EXPIRED', 'KEY_MANAGEMENT_FAILED', 'CORRUPT_RECORD'] as const;
    const messages = new Set(codes.map((c) => new RecipientError(c).message));
    expect(messages.size).toBe(6);
    for (const c of codes) {
      const e = new RecipientError(c);
      expect(e.name).toBe('RecipientError');
      expect(e.code).toBe(c);
      expect(e.toJSON()).toEqual({ name: 'RecipientError', code: c });
    }
    expect(new RecipientError('NOT_FOUND').message).toBe('recipient not found');
  });

  it('a corrupt decrypted record is a fixed error, not a parse error carrying content', async () => {
    const garbage: [string, Uint8Array][] = [
      ['not utf-8', Uint8Array.from([0xff, 0xfe, 0xfd])],
      ['not json', new TextEncoder().encode(`{"holderName": "${PII.holderName}"`)],
      ['not an object', new TextEncoder().encode('[1]')],
      ['missing fields', new TextEncoder().encode(JSON.stringify({ holderName: PII.holderName }))],
    ];
    for (const [, bytes] of garbage) {
      const kms: KeyManagement = { encrypt: async () => Uint8Array.from([1]), decrypt: async () => bytes };
      const { store } = makeStore(1000n, new Clock(1n), kms);
      const ref = await store.create(owner, bankDetails());
      const e = await store.reveal(ref, 'PAYOUT').catch((x: unknown) => x);
      expect(e).toMatchObject({ code: 'CORRUPT_RECORD' });
      expect(leaks(String(e) + inspect(e, { depth: 9 }))).toEqual([]);
    }
  });

  it('each required field missing from a record is corrupt', async () => {
    const full = { holderName: 'a', accountNumber: 'b', branchCode: 'c', bankName: 'd', country: 'ZA', currency: 'ZAR' };
    for (const k of Object.keys(full)) {
      const { [k as keyof typeof full]: _omit, ...rest } = full;
      const kms: KeyManagement = { encrypt: async () => Uint8Array.from([1]), decrypt: async () => new TextEncoder().encode(JSON.stringify(rest)) };
      const { store } = makeStore(1000n, new Clock(1n), kms);
      const ref = await store.create(owner, bankDetails());
      await expect(store.reveal(ref, 'PAYOUT')).rejects.toMatchObject({ code: 'CORRUPT_RECORD' });
    }
  });

  it('never puts PII in anything an on-chain memo or ledger could take: meta and ref only', async () => {
    const { store } = makeStore();
    const ref = await store.create(owner, bankDetails());
    const everything = JSON.stringify({ ref, meta: store.meta(ref) }, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v));
    expect(leaks(everything)).toEqual([]);
  });
});

describe('BankRecipient: access record and immutable meta', () => {
  it('reveal needs a valid purpose and leaves a PII-free access record', async () => {
    const { store, clock } = makeStore(10_000n, new Clock(7n));
    const ref = await store.create(owner, bankDetails());
    expect(store.accessLog()).toEqual([]);
    await store.reveal(ref, 'COMPLIANCE_REVIEW');
    clock.t = 9n;
    await store.reveal(ref, 'PAYOUT');
    expect(store.accessLog()).toEqual([
      { ref, purpose: 'COMPLIANCE_REVIEW', at: 7n },
      { ref, purpose: 'PAYOUT', at: 9n },
    ]);
    expect(leaks(JSON.stringify(store.accessLog(), (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)))).toEqual([]);
    (store.accessLog() as unknown[]).length = 0; // a copy
    expect(store.accessLog().length).toBe(2);
    await expect(store.reveal(ref, 'MARKETING' as 'PAYOUT')).rejects.toMatchObject({ code: 'INVALID_PURPOSE', message: 'reveal purpose is not valid' });
    expect(store.accessLog().length).toBe(2);
    await store.reveal(ref, 'ERASURE_REQUEST');
    expect(store.accessLog().length).toBe(3);
    // a reveal of a missing ref leaves no record
    await expect(store.reveal('rcp-' + 'a'.repeat(32), 'PAYOUT')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(store.accessLog().length).toBe(3);
  });
  it('meta is frozen: retention and routing facts cannot be changed through it', async () => {
    const { store } = makeStore(10_000n, new Clock(1n));
    const ref = await store.create(owner, bankDetails());
    const m = store.meta(ref);
    expect(Object.isFrozen(m)).toBe(true);
    expect(() => { (m as { expiresAt: bigint }).expiresAt = 10n ** 18n; }).toThrow(TypeError);
    expect(store.meta(ref).expiresAt).toBe(10_001n);
  });
});

describe('BankRecipient: refs and retention', () => {
  it('rejects malformed refs and unknown refs', async () => {
    const { store } = makeStore();
    for (const bad of ['', 'x', 'rcp-', 'rcp-' + 'g'.repeat(32), 'rcp-' + 'A'.repeat(32), 'rcp-' + 'a'.repeat(31), 'rcp-' + 'a'.repeat(33), ' rcp-' + 'a'.repeat(32), 'rcp-' + 'a'.repeat(32) + '\n']) {
      expect(() => store.meta(bad)).toThrow(expect.objectContaining({ code: 'INVALID_REF' }));
      await expect(store.reveal(bad, 'PAYOUT')).rejects.toMatchObject({ code: 'INVALID_REF' });
    }
    expect(() => store.meta('rcp-' + 'a'.repeat(32))).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
  });

  it('serves a recipient up to the last millisecond before expiry, then deletes it', async () => {
    const { store, clock } = makeStore(1000n, new Clock(100n));
    const ref = await store.create(owner, bankDetails());
    clock.t = 1099n;
    expect(store.meta(ref).expiresAt).toBe(1100n);
    await expect(store.reveal(ref, 'PAYOUT')).resolves.toBeInstanceOf(Secret);
    clock.t = 1100n;
    expect(() => store.meta(ref)).toThrow(expect.objectContaining({ code: 'RETENTION_EXPIRED' }));
    clock.t = 1099n; // even if the clock went back, the row is gone
    expect(() => store.meta(ref)).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
    await expect(store.reveal(ref, 'PAYOUT')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('retention is counted from creation with the stated period', async () => {
    const { store } = makeStore(5n, new Clock(10n));
    const ref = await store.create(owner, bankDetails());
    expect(store.meta(ref).expiresAt - store.meta(ref).createdAt).toBe(5n);
  });

  it('purgeExpired deletes exactly the expired rows and reports how many', async () => {
    const { store, clock } = makeStore(100n, new Clock(0n));
    const a = await store.create(owner, bankDetails());
    clock.t = 60n;
    const b = await store.create(owner, bankDetails());
    clock.t = 99n;
    expect(store.purgeExpired()).toBe(0n);
    clock.t = 100n;
    expect(store.purgeExpired()).toBe(1n);
    expect(() => store.meta(a)).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
    expect(store.meta(b).ref).toBe(b);
    clock.t = 10_000n;
    expect(store.purgeExpired()).toBe(1n);
    expect(store.purgeExpired()).toBe(0n);
  });

  it('delete removes one recipient on request', async () => {
    const { store } = makeStore();
    const ref = await store.create(owner, bankDetails());
    expect(store.delete(ref)).toBe(true);
    expect(store.delete(ref)).toBe(false);
    expect(() => store.meta(ref)).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
  });
});

// Two structurally different fakes of the screening port, run through one contract.
class SetScreening implements AddressScreeningPort {
  constructor(private readonly answers: ReadonlyMap<string, ScreeningAnswer>, private readonly fallback: ScreeningAnswer | 'THROW') {}
  readonly calls: string[] = [];
  async screen(address: NetworkAddress): Promise<ScreeningAnswer> {
    this.calls.push(address);
    if (this.fallback === 'THROW' && !this.answers.has(address)) throw new Error('down');
    return this.answers.get(address) ?? (this.fallback === 'THROW' ? 'UNAVAILABLE' : this.fallback);
  }
}
class SuffixScreening implements AddressScreeningPort {
  constructor(private readonly rule: (last: string) => ScreeningAnswer) {}
  readonly calls: string[] = [];
  screen(address: NetworkAddress): Promise<ScreeningAnswer> {
    this.calls.push(address);
    return Promise.resolve(this.rule(address.slice(-1)));
  }
}
const ADDR = '0x' + 'AbCd'.repeat(10);
const ADDR_LC = ADDR.toLowerCase() as NetworkAddress;
const fakes: [string, (a: ScreeningAnswer | 'THROW') => AddressScreeningPort & { calls: string[] }][] = [
  ['SetScreening', (a) => new SetScreening(new Map(), a)],
  [
    'SuffixScreening',
    (a) =>
      a === 'THROW'
        ? ({ calls: [], screen: () => Promise.reject(new Error('down')) } as AddressScreeningPort & { calls: string[] })
        : new SuffixScreening(() => a),
  ],
];

describe.each(fakes)('WalletRecipient screening contract: %s', (_n, make) => {
  it('a throwing local blocklist fails closed with a typed rejection', async () => {
    const r = await screen(ADDR, { screening: make('CLEAR'), localBlocklist: () => { throw new Error('stale'); } });
    expect(r).toEqual({ kind: 'REJECTED', code: 'SCREENING_UNAVAILABLE' });
  });
  it('CLEAR gives a normalised screened recipient', async () => {
    const s = make('CLEAR');
    const r = await screen(ADDR, { screening: s, localBlocklist: () => false });
    expect(r).toMatchObject({ kind: 'OK', recipient: { kind: 'WALLET', address: ADDR_LC } });
    expect(r.kind === 'OK' && isScreenedWallet(r.recipient)).toBe(true);
    expect(r.kind === 'OK' && Object.isFrozen(r.recipient)).toBe(true);
    // a hand-built look-alike is not a screened wallet
    expect(isScreenedWallet({ kind: 'WALLET', address: ADDR_LC, __screened: true })).toBe(false);
    expect(isScreenedWallet(null)).toBe(false);
    expect(s.calls).toEqual([ADDR_LC]);
  });
  it('BLOCKED, UNAVAILABLE, a throw and an unknown answer all fail closed', async () => {
    expect(await screen(ADDR, { screening: make('BLOCKED'), localBlocklist: () => false })).toEqual({ kind: 'REJECTED', code: 'SCREENING_BLOCKED' });
    expect(await screen(ADDR, { screening: make('UNAVAILABLE'), localBlocklist: () => false })).toEqual({ kind: 'REJECTED', code: 'SCREENING_UNAVAILABLE' });
    expect(await screen(ADDR, { screening: make('THROW'), localBlocklist: () => false })).toEqual({ kind: 'REJECTED', code: 'SCREENING_UNAVAILABLE' });
    expect(await screen(ADDR, { screening: make('MAYBE' as ScreeningAnswer), localBlocklist: () => false })).toEqual({ kind: 'REJECTED', code: 'SCREENING_UNAVAILABLE' });
  });
  it('the local USDC blocklist is checked first, on the normalised address, and the screening port is not even asked', async () => {
    const s = make('CLEAR');
    const asked: string[] = [];
    const r = await screen(ADDR, { screening: s, localBlocklist: (a) => (asked.push(a), true) });
    expect(r).toEqual({ kind: 'REJECTED', code: 'BLOCKLISTED' });
    expect(asked).toEqual([ADDR_LC]);
    expect(s.calls).toEqual([]);
  });
  it('an invalid address is rejected before any check', async () => {
    const s = make('CLEAR');
    const bl = vi.fn(() => false);
    for (const bad of ['', '0x123', ADDR + '00', ADDR.slice(2), '0x' + 'g'.repeat(40)]) {
      expect(await screen(bad, { screening: s, localBlocklist: bl })).toEqual({ kind: 'REJECTED', code: 'ADDRESS_INVALID' });
    }
    expect(bl).not.toHaveBeenCalled();
    expect(s.calls).toEqual([]);
  });
  it('the travel-rule hook runs after screening and fails closed', async () => {
    const answers: [TravelRuleAnswer, boolean][] = [['NOT_REQUIRED', true], ['READY', true], ['HOLD', false], ['???' as TravelRuleAnswer, false]];
    for (const [answer, passes] of answers) {
      const check = vi.fn(async () => answer);
      const r = await screen(ADDR, { screening: make('CLEAR'), localBlocklist: () => false, travelRule: { check } });
      expect(check).toHaveBeenCalledWith(ADDR_LC, XFER);
      expect(r.kind).toBe(passes ? 'OK' : 'REJECTED');
      if (!passes) expect(r).toEqual({ kind: 'REJECTED', code: 'TRAVEL_RULE_HOLD' });
    }
    const thrower = { check: () => Promise.reject(new Error('x')) };
    expect(await screen(ADDR, { screening: make('CLEAR'), localBlocklist: () => false, travelRule: thrower })).toEqual({ kind: 'REJECTED', code: 'TRAVEL_RULE_HOLD' });
  });
  it('the travel-rule hook is not consulted when screening already failed', async () => {
    const check = vi.fn(async () => 'READY' as TravelRuleAnswer);
    await screen(ADDR, { screening: make('BLOCKED'), localBlocklist: () => false, travelRule: { check } });
    await screen(ADDR, { screening: make('UNAVAILABLE'), localBlocklist: () => false, travelRule: { check } });
    expect(check).not.toHaveBeenCalled();
  });
});
