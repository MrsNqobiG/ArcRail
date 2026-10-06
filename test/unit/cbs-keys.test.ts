/**
 * CBS unit: CONTRACT §1.2/§1.3 key derivation, subject references, the
 * case-return ID and the approval payload digest (src/cbs/keys.ts).
 *
 * Expected values are recomputed here from the CONTRACT text with node:crypto
 * and hand-written JCS strings, never with the module under test.
 */
import { createHash } from 'node:crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  TESTNET_CHAIN_ID,
  canonical,
  caseReturnInstructionId,
  deriveKey,
  isCanonicalAddress,
  isDecimalString,
  isId,
  isIdempotencyKey,
  isTxHash,
  payloadDigest,
  subjectRef,
  type KeyName,
  type KeyTuple,
  type Subject,
  type TxHashString,
} from '../../src/cbs/keys.js';

const sha256hex = (text: string): string => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
const decode = (bytes: Uint8Array): string => Buffer.from(bytes).toString('utf8');
const TX: TxHashString = `0x${'ab'.repeat(32)}`;
const PH = 'cd'.repeat(32);
const SREF = '["in","5042002","0xabab","7"]';

/** Element kinds of each key tuple, written from the CONTRACT §1.3 table (attempt last). */
type Kind = 'lit' | 'chain' | 'tx' | 'dec' | 'id' | 'role' | 'text' | 'hex64' | 'scrRole';
const KEYS: Record<KeyName, readonly (readonly [string, Kind])[]> = {
  'K.recv': [['arc1', 'lit'], ['in', 'lit'], ['5042002', 'chain'], [TX, 'tx'], ['3', 'dec'], ['recv', 'lit'], ['0', 'dec']],
  'K.avail': [['arc1', 'lit'], ['in', 'lit'], ['5042002', 'chain'], [TX, 'tx'], ['3', 'dec'], ['avail', 'lit'], ['1', 'dec']],
  'K.unid': [['arc1', 'lit'], ['in', 'lit'], ['5042002', 'chain'], [TX, 'tx'], ['0', 'dec'], ['unid', 'lit'], ['0', 'dec']],
  'K.assign': [['arc1', 'lit'], ['in', 'lit'], ['5042002', 'chain'], [TX, 'tx'], ['12', 'dec'], ['assign', 'lit'], ['2', 'dec']],
  'K.reserve': [['arc1', 'lit'], ['out', 'lit'], ['ins-1', 'id'], ['reserve', 'lit'], ['0', 'dec']],
  'K.settle': [['arc1', 'lit'], ['out', 'lit'], ['ins-1', 'id'], ['settle', 'lit'], ['0', 'dec']],
  'K.release': [['arc1', 'lit'], ['out', 'lit'], ['ins-1', 'id'], ['release', 'lit'], ['0', 'dec']],
  'K.move': [['arc1', 'lit'], ['tre', 'lit'], ['mv.9', 'id'], ['move', 'lit'], ['0', 'dec']],
  'K.gas': [['arc1', 'lit'], ['gas', 'lit'], ['5042002', 'chain'], ['gas', 'role'], ['b:1', 'id'], ['0', 'dec']],
  'K.dust': [['arc1', 'lit'], ['dust', 'lit'], ['5042002', 'chain'], ['collection', 'role'], ['b_2', 'id'], ['0', 'dec']],
  'K.scr': [['arc1', 'lit'], ['scr', 'lit'], [SREF, 'text'], ['destination', 'scrRole'], ['4', 'dec'], ['0', 'dec']],
  'K.case': [['arc1', 'lit'], ['case', 'lit'], ['SCREENING_HIT', 'text'], [SREF, 'text'], ['0', 'dec'], ['0', 'dec']],
  'K.mon': [['arc1', 'lit'], ['mon', 'lit'], [SREF, 'text'], ['0', 'dec']],
  'K.appr': [['arc1', 'lit'], ['appr', 'lit'], ['ins-1', 'id'], [PH, 'hex64'], ['0', 'dec']],
  'K.rpt': [['arc1', 'lit'], ['rpt', 'lit'], ['STR', 'text'], [SREF, 'text'], ['0', 'dec']],
};

/** A value that breaks exactly this kind, while passing as many other kinds as possible. */
const BAD: Record<Kind, readonly string[]> = {
  lit: ['zzz', ''],
  chain: ['5042', '1', '05042002'],
  tx: [`0x${'AB'.repeat(32)}`, `0x${'ab'.repeat(31)}`, 'ab'.repeat(33), ''],
  dec: ['01', '-1', '1.0', '', 'x'],
  id: ['bad id', 'a'.repeat(129), '', 'a/b'],
  role: ['cold', 'HOT', ''],
  text: [''],
  hex64: ['AB'.repeat(32), 'ab'.repeat(31), ''],
  scrRole: ['receiver', 'Sender', ''],
};

const tupleOf = (name: KeyName): KeyTuple => ({ name, k: KEYS[name].map(([v]) => v) } as unknown as KeyTuple);
const withElement = (name: KeyName, at: number, value: unknown): KeyTuple => {
  const k: unknown[] = KEYS[name].map(([v]) => v);
  k[at] = value;
  return { name, k } as unknown as KeyTuple;
};

describe('canonical (RFC 8785 JCS, CONTRACT §1.3)', () => {
  it('encodes an array of strings with no whitespace, UTF-8', () => {
    expect(decode(canonical(['arc1', 'in', '5042002']))).toBe('["arc1","in","5042002"]');
    expect(decode(canonical([]))).toBe('[]');
    expect(decode(canonical(['é', '€']))).toBe('["é","€"]');
    expect([...canonical(['é'])]).toEqual([0x5b, 0x22, 0xc3, 0xa9, 0x22, 0x5d]);
  });

  it('escapes exactly as RFC 8785 §3.2.2.2 (JSON.stringify string rules)', () => {
    expect(decode(canonical(['a"b', 'c\\d', '\n', '\u0000', '\u001f', '/', '\u007f']))).toBe(
      '["a\\"b","c\\\\d","\\n","\\u0000","\\u001f","/","\u007f"]',
    );
  });

  it('sorts object members by UTF-16 code units (RFC 8785 §3.2.3), not by code point', () => {
    // U+1F600 is the surrogate pair D83D DE00, which sorts before U+FB33 by code unit.
    const text = decode(canonical({ '\ufb33': 'c', '\u{1f600}': 'b', '\u20ac': 'a', b: 'y', a: 'x', '': 'e' }));
    expect(text).toBe('{"":"e","a":"x","b":"y","€":"a","\u{1f600}":"b","\ufb33":"c"}');
  });

  it('encodes the approval-payload object form', () => {
    expect(decode(canonical({ z: '1', a: '2' }))).toBe('{"a":"2","z":"1"}');
    expect(decode(canonical({}))).toBe('{}');
  });

  it('refuses a non-string field, a lone surrogate, and a non-container (fail closed)', () => {
    expect(() => canonical(['a', 1 as unknown as string])).toThrow(TypeError);
    expect(() => canonical({ a: null as unknown as string })).toThrow(TypeError);
    expect(() => canonical({ a: 'x', b: 2 as unknown as string })).toThrow(/JSON string/);
    expect(() => canonical(['\ud800'])).toThrow(RangeError);
    expect(() => canonical(['a\udc00b'])).toThrow(/lone surrogate/);
    expect(() => canonical({ '\ud83d': 'x' })).toThrow(RangeError);
    expect(() => canonical('abc' as unknown as string[])).toThrow(TypeError);
    expect(() => canonical(null as unknown as string[])).toThrow(/array or an object/);
    expect(() => canonical(7 as unknown as string[])).toThrow(TypeError);
  });

  it('accepts a well-formed surrogate pair', () => {
    expect(decode(canonical(['\u{1f600}']))).toBe('["\u{1f600}"]');
  });
});

describe('deriveKey (CONTRACT §1.3)', () => {
  it.each(Object.keys(KEYS) as KeyName[])('%s = "arc1-" + hex(SHA-256(JCS(K))), 69 characters', (name) => {
    const k = KEYS[name].map(([v]) => v);
    const key = deriveKey(tupleOf(name));
    expect(key).toBe(`arc1-${sha256hex(JSON.stringify(k))}`);
    expect(key).toHaveLength(69);
    expect(isIdempotencyKey(key)).toBe(true);
  });

  const breaks = (Object.keys(KEYS) as KeyName[]).flatMap((name) =>
    KEYS[name].flatMap(([, kind], at) => BAD[kind].map((bad) => [name, at, kind, bad] as const)),
  );
  it.each(breaks)('%s refuses element %i (%s) = %j', (name, at, _kind, bad) => {
    expect(() => deriveKey(withElement(name, at, bad))).toThrow(RangeError);
  });

  it.each(Object.keys(KEYS) as KeyName[])('%s refuses a tuple one element too short or too long, or a non-string element', (name) => {
    const k = KEYS[name].map(([v]) => v);
    expect(() => deriveKey({ name, k: k.slice(0, -1) } as unknown as KeyTuple)).toThrow(/does not match/);
    expect(() => deriveKey({ name, k: [...k, '0'] } as unknown as KeyTuple)).toThrow(/does not match/);
    expect(() => deriveKey(withElement(name, k.length - 1, 0))).toThrow(RangeError);
  });

  it('refuses an unknown key name or a tuple that is not an array', () => {
    expect(() => deriveKey({ name: 'K.nope', k: ['arc1'] } as unknown as KeyTuple)).toThrow(/unknown key name K\.nope/);
    expect(() => deriveKey({ name: 'toString', k: ['arc1'] } as unknown as KeyTuple)).toThrow(/unknown key name/);
    expect(() => deriveKey({ name: 7, k: ['arc1'] } as unknown as KeyTuple)).toThrow(/unknown key name 7/);
    expect(() => deriveKey({ name: 'K.mon', k: 'arc1,mon,s,0' } as unknown as KeyTuple)).toThrow(/does not match/);
    expect(() => deriveKey({ name: 'K.mon', k: { 0: 'arc1', 1: 'mon', 2: 's', 3: '0', length: 4 } } as unknown as KeyTuple)).toThrow(RangeError);
  });

  it('only chain ID 5042002 is accepted (CONTRACT §1.2; mainnet 5042 refused)', () => {
    expect(TESTNET_CHAIN_ID).toBe('5042002');
    expect(() => deriveKey(withElement('K.recv', 2, '5042'))).toThrow(RangeError);
  });

  it('every role and screen role value is accepted where the table allows it', () => {
    for (const role of ['hot', 'gas', 'collection']) expect(isIdempotencyKey(deriveKey(withElement('K.gas', 3, role)))).toBe(true);
    for (const role of ['sender', 'destination']) expect(isIdempotencyKey(deriveKey(withElement('K.scr', 3, role)))).toBe(true);
    expect(() => deriveKey(withElement('K.gas', 3, 'sender'))).toThrow(RangeError);
  });

  it('IDs are case-preserving and the ID grammar is honoured at its maximum length (MC-10)', () => {
    const upper = deriveKey(withElement('K.move', 2, 'Ab'));
    const lower = deriveKey(withElement('K.move', 2, 'ab'));
    expect(upper).not.toBe(lower);
    expect(isIdempotencyKey(deriveKey(withElement('K.move', 2, 'A'.repeat(128))))).toBe(true);
    expect(isIdempotencyKey(deriveKey(withElement('K.move', 2, 'a.b_c:d-e')))).toBe(true);
  });

  it('attempt is the last element: a new attempt gives a new key, the same attempt the same key', () => {
    expect(deriveKey(withElement('K.recv', 6, '0'))).toBe(deriveKey(withElement('K.recv', 6, '0')));
    expect(deriveKey(withElement('K.recv', 6, '1'))).not.toBe(deriveKey(withElement('K.recv', 6, '0')));
  });

  it('is collision-free under delimiter variation (MC-10)', () => {
    const a = deriveKey({ name: 'K.rpt', k: ['arc1', 'rpt', 'ab', 'c', '0'] });
    const b = deriveKey({ name: 'K.rpt', k: ['arc1', 'rpt', 'a', 'bc', '0'] });
    const c = deriveKey({ name: 'K.rpt', k: ['arc1', 'rpt', 'a","b', 'c', '0'] });
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it('property: distinct K.recv inputs give distinct keys, equal inputs equal keys (MC-10)', () => {
    const hex = fc.stringMatching(/^[0-9a-f]{64}$/);
    const dec = fc.bigInt({ min: 0n, max: 10n ** 30n }).map((n) => n.toString());
    const recv = fc.tuple(hex, dec, dec);
    fc.assert(
      fc.property(recv, recv, ([h1, l1, a1], [h2, l2, a2]) => {
        const k1 = deriveKey({ name: 'K.recv', k: ['arc1', 'in', '5042002', `0x${h1}`, l1, 'recv', a1] });
        const k2 = deriveKey({ name: 'K.recv', k: ['arc1', 'in', '5042002', `0x${h2}`, l2, 'recv', a2] });
        return (k1 === k2) === (h1 === h2 && l1 === l2 && a1 === a2);
      }),
      { numRuns: 300 },
    );
  });

  it('property: different key names over the same subject never collide (MC-10)', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[0-9a-f]{64}$/), (h) => {
        const steps = ['recv', 'avail', 'unid', 'assign'] as const;
        const names = ['K.recv', 'K.avail', 'K.unid', 'K.assign'] as const;
        const keys = steps.map((s, i) => deriveKey({ name: names[i], k: ['arc1', 'in', '5042002', `0x${h}`, '0', s, '0'] } as KeyTuple));
        return new Set(keys).size === 4;
      }),
      { numRuns: 50 },
    );
  });
});

describe('subjectRef (CONTRACT §1.2)', () => {
  const SUBJECTS: readonly (readonly [Subject, readonly Kind[]])[] = [
    [['in', '5042002', TX, '9'], ['lit', 'chain', 'tx', 'dec']],
    [['out', 'ins-1'], ['lit', 'id']],
    [['move', 'mv-1'], ['lit', 'id']],
    [['batch', 'gas', 'hot', 'b1'], ['lit', 'lit', 'role', 'id']],
    [['batch', 'dust', 'collection', 'b1'], ['lit', 'lit', 'role', 'id']],
    [['recon', '100', '42'], ['lit', 'dec', 'dec']],
    [['event', 'ev-1'], ['lit', 'id']],
    [['rail', '3'], ['lit', 'dec']],
    [['account', 'acct:7'], ['lit', 'id']],
    [['wallet', 'gas', '0'], ['lit', 'role', 'dec']],
  ];

  it.each(SUBJECTS)('%j is its JCS string', (subject) => {
    expect(subjectRef(subject)).toBe(JSON.stringify(subject));
  });

  const breaks = SUBJECTS.flatMap(([subject, kinds]) =>
    kinds.flatMap((kind, at) => (at === 0 ? [] : BAD[kind].map((bad) => [subject, at, bad] as const))),
  );
  it.each(breaks)('%j refuses element %i = %j', (subject, at, bad) => {
    const s: unknown[] = [...subject];
    s[at] = bad;
    expect(() => subjectRef(s as unknown as Subject)).toThrow(RangeError);
  });

  it('refuses a batch kind other than gas or dust, wrong length, unknown kind or non-array', () => {
    expect(() => subjectRef(['batch', 'fee', 'hot', 'b1'] as unknown as Subject)).toThrow(/CONTRACT §1\.2/);
    expect(() => subjectRef(['out'] as unknown as Subject)).toThrow(RangeError);
    expect(() => subjectRef(['out', 'a', 'b'] as unknown as Subject)).toThrow(RangeError);
    expect(() => subjectRef(['nope', 'a'] as unknown as Subject)).toThrow(RangeError);
    expect(() => subjectRef(['constructor', 'a'] as unknown as Subject)).toThrow(RangeError);
    expect(() => subjectRef([7, 'a'] as unknown as Subject)).toThrow(RangeError);
    expect(() => subjectRef([] as unknown as Subject)).toThrow(RangeError);
    expect(() => subjectRef('["out","a"]' as unknown as Subject)).toThrow(/is an array/);
    expect(() => subjectRef(['out', 5] as unknown as Subject)).toThrow(RangeError);
  });
});

describe('caseReturnInstructionId (CONTRACT §1.2)', () => {
  it('is "cr-" + the first 32 hex of SHA-256(JCS(["arc1","cr",caseId,dispositionSeq]))', () => {
    const id = caseReturnInstructionId('case-1', '2');
    expect(id).toBe(`cr-${sha256hex('["arc1","cr","case-1","2"]').slice(0, 32)}`);
    expect(id).toHaveLength(35);
  });

  it('satisfies the ID grammar at the maximum caseId length (MC-10) and differs per disposition', () => {
    const id = caseReturnInstructionId('Z'.repeat(128), '18446744073709551616');
    expect(isId(id)).toBe(true);
    expect(id).toMatch(/^cr-[0-9a-f]{32}$/);
    expect(caseReturnInstructionId('c', '1')).not.toBe(caseReturnInstructionId('c', '2'));
    expect(caseReturnInstructionId('C', '1')).not.toBe(caseReturnInstructionId('c', '1'));
  });

  it('refuses a bad caseId or dispositionSeq', () => {
    expect(() => caseReturnInstructionId('', '0')).toThrow(/caseId/);
    expect(() => caseReturnInstructionId('a'.repeat(129), '0')).toThrow(RangeError);
    expect(() => caseReturnInstructionId('a b', '0')).toThrow(RangeError);
    expect(() => caseReturnInstructionId('c', '01')).toThrow(/dispositionSeq/);
    expect(() => caseReturnInstructionId('c', '')).toThrow(RangeError);
  });
});

describe('payloadDigest (CONTRACT §1.3)', () => {
  const DEST = `0x${'a1'.repeat(20)}`;
  const payload = { amountWei: '1000000000000000000', asset: 'USDC', chainId: '5042002', destination: DEST, instructionId: 'ins-1' } as const;

  it('is the 32 raw bytes of SHA-256 over the JCS object (members sorted, nonce and fees left out)', () => {
    const digest = payloadDigest(payload);
    expect(digest).toBeInstanceOf(Uint8Array);
    expect(digest).toHaveLength(32);
    const expected = sha256hex(`{"amountWei":"1000000000000000000","asset":"USDC","chainId":"5042002","destination":"${DEST}","instructionId":"ins-1"}`);
    expect(Buffer.from(digest).toString('hex')).toBe(expected);
  });

  it('ignores extra fields (nonce, fees are not part of the payload)', () => {
    const withNonce = { ...payload, nonce: '5', maxFeePerGas: '20000000000' } as typeof payload;
    expect(Buffer.from(payloadDigest(withNonce)).equals(Buffer.from(payloadDigest(payload)))).toBe(true);
  });

  it.each([
    ['amountWei', '01'],
    ['amountWei', ''],
    ['asset', 'EURC'],
    ['chainId', '5042'],
    ['destination', DEST.toUpperCase().replace('0X', '0x')],
    ['destination', `0x${'0'.repeat(40)}`],
    ['destination', `0x${'a1'.repeat(19)}`],
    ['instructionId', ''],
    ['instructionId', 'a b'],
  ])('refuses %s = %j', (field, value) => {
    expect(() => payloadDigest({ ...payload, [field]: value } as typeof payload)).toThrow(RangeError);
  });
});

describe('grammar predicates (CONTRACT §1.2)', () => {
  it('isDecimalString', () => {
    for (const ok of ['0', '1', '10', '9007199254740993']) expect(isDecimalString(ok)).toBe(true);
    for (const bad of ['', '00', '01', '-1', '1.5', '1e3', ' 1', 7, null]) expect(isDecimalString(bad)).toBe(false);
  });
  it('isId', () => {
    for (const ok of ['a', 'A.b_c:d-9', 'x'.repeat(128)]) expect(isId(ok)).toBe(true);
    for (const bad of ['', 'x'.repeat(129), 'a b', 'a/b', 'é', 1]) expect(isId(bad)).toBe(false);
  });
  it('isTxHash', () => {
    expect(isTxHash(TX)).toBe(true);
    for (const bad of [TX.toUpperCase(), `0x${'a'.repeat(63)}`, `0x${'a'.repeat(65)}`, 'ab'.repeat(32), 1]) expect(isTxHash(bad)).toBe(false);
  });
  it('isIdempotencyKey', () => {
    expect(isIdempotencyKey(`arc1-${'0'.repeat(64)}`)).toBe(true);
    for (const bad of [`arc2-${'0'.repeat(64)}`, `arc1-${'A'.repeat(64)}`, `arc1-${'0'.repeat(63)}`, `xarc1-${'0'.repeat(64)}`, `arc1-${'0'.repeat(64)}0`, null]) {
      expect(isIdempotencyKey(bad)).toBe(false);
    }
  });
  it('isCanonicalAddress: 0x + 40 lowercase hex and not 0x0 (C-54)', () => {
    expect(isCanonicalAddress(`0x${'ab'.repeat(20)}`)).toBe(true);
    for (const bad of [`0x${'AB'.repeat(20)}`, `0x${'0'.repeat(40)}`, `0x${'ab'.repeat(19)}`, `0x${'ab'.repeat(21)}`, `1x${'ab'.repeat(20)}`, 5]) {
      expect(isCanonicalAddress(bad)).toBe(false);
    }
  });
});
