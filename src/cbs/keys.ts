/**
 * CBS port: identifiers, subject references and idempotency-key derivation
 * (CONTRACT §1.2, §1.3). Money path (RUBRIC item 10): every translator call
 * carries a key built here.
 *
 * key = "arc1-" + lowercase_hex(SHA-256(JCS(K))), 69 ASCII characters.
 * `attempt` (decimal from "0") is the last element of every key tuple.
 *
 * Every input is checked against the CONTRACT §1.2/§1.3 grammars before it is
 * encoded, and anything that doesn't match throws (fail closed): a key, a
 * subject reference or a derived ID is never built from a malformed value.
 * No JS number is used anywhere in this module (RUBRIC MC-01).
 */
import { createHash } from 'node:crypto';
import type { WalletRole } from '../registry/index.js';

export type ChainIdString = '5042002';
export type TxHashString = `0x${string}`;
/** Decimal string with no leading zeros (CONTRACT §1.2). */
export type DecimalString = string;
/** CONTRACT §1.2 ID grammar `^[A-Za-z0-9._:-]{1,128}$`. */
export type Id = string;

/** Idempotency key: "arc1-" + 64 lowercase hex (CONTRACT §1.3). */
export type IdempotencyKey = `arc1-${string}` & { readonly __idempotencyKey: true };

/** Subject references (CONTRACT §1.2). `subjectRef` is the JCS string of one of these. */
export type Subject =
  | readonly ['in', ChainIdString, TxHashString, DecimalString]
  | readonly ['out', Id]
  | readonly ['move', Id]
  | readonly ['batch', 'gas' | 'dust', WalletRole, Id]
  | readonly ['recon', DecimalString, DecimalString]
  | readonly ['event', Id]
  | readonly ['rail', DecimalString]
  | readonly ['account', Id]
  | readonly ['wallet', WalletRole, DecimalString];

export type SubjectRef = string & { readonly __subjectRef: true };

type Attempt = DecimalString;

/** Key tuples `K` (CONTRACT §1.3 table), each ending in `attempt`. */
export type KeyTuple =
  | { readonly name: 'K.recv'; readonly k: readonly ['arc1', 'in', ChainIdString, TxHashString, DecimalString, 'recv', Attempt] }
  | { readonly name: 'K.avail'; readonly k: readonly ['arc1', 'in', ChainIdString, TxHashString, DecimalString, 'avail', Attempt] }
  | { readonly name: 'K.unid'; readonly k: readonly ['arc1', 'in', ChainIdString, TxHashString, DecimalString, 'unid', Attempt] }
  | { readonly name: 'K.assign'; readonly k: readonly ['arc1', 'in', ChainIdString, TxHashString, DecimalString, 'assign', Attempt] }
  | { readonly name: 'K.reserve'; readonly k: readonly ['arc1', 'out', Id, 'reserve', Attempt] }
  | { readonly name: 'K.settle'; readonly k: readonly ['arc1', 'out', Id, 'settle', Attempt] }
  | { readonly name: 'K.release'; readonly k: readonly ['arc1', 'out', Id, 'release', Attempt] }
  | { readonly name: 'K.move'; readonly k: readonly ['arc1', 'tre', Id, 'move', Attempt] }
  | { readonly name: 'K.gas'; readonly k: readonly ['arc1', 'gas', ChainIdString, WalletRole, Id, Attempt] }
  | { readonly name: 'K.dust'; readonly k: readonly ['arc1', 'dust', ChainIdString, WalletRole, Id, Attempt] }
  | { readonly name: 'K.scr'; readonly k: readonly ['arc1', 'scr', string, 'sender' | 'destination', DecimalString, Attempt] }
  | { readonly name: 'K.case'; readonly k: readonly ['arc1', 'case', string, string, DecimalString, Attempt] }
  | { readonly name: 'K.mon'; readonly k: readonly ['arc1', 'mon', string, Attempt] }
  | { readonly name: 'K.appr'; readonly k: readonly ['arc1', 'appr', Id, string, Attempt] }
  | { readonly name: 'K.rpt'; readonly k: readonly ['arc1', 'rpt', string, string, Attempt] };

export type KeyName = KeyTuple['name'];

// ---------------------------------------------------------------------------
// CONTRACT §1.2 grammars.
// ---------------------------------------------------------------------------

/** The only chain ID the contract accepts (C-01, CLAUDE.md N1). */
export const TESTNET_CHAIN_ID: ChainIdString = '5042002';

const DECIMAL = /^(0|[1-9][0-9]*)$/;
const ID = /^[A-Za-z0-9._:-]{1,128}$/;
const TX_HASH = /^0x[0-9a-f]{64}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const ADDRESS_LOWER = /^0x[0-9a-f]{40}$/;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const KEY = /^arc1-[0-9a-f]{64}$/;
/** A lone UTF-16 surrogate: not valid I-JSON, so RFC 8785 can't encode it. */
const LONE_SURROGATE = /\p{Cs}/u;

/** `^(0|[1-9][0-9]*)$` (CONTRACT §1.1, §1.2). */
export const isDecimalString = (s: unknown): boolean => typeof s === 'string' && DECIMAL.test(s);
/** ID grammar `^[A-Za-z0-9._:-]{1,128}$` (CONTRACT §1.2). */
export const isId = (s: unknown): boolean => typeof s === 'string' && ID.test(s);
/** `0x` + 64 lowercase hex (CONTRACT §1.2). */
export const isTxHash = (s: unknown): boolean => typeof s === 'string' && TX_HASH.test(s);
/** `arc1-` + 64 lowercase hex (CONTRACT §1.3). */
export const isIdempotencyKey = (s: unknown): boolean => typeof s === 'string' && KEY.test(s);
/** A canonical address (CONTRACT §1.2): `0x` + 40 lowercase hex, and not `0x0` (C-54). */
export const isCanonicalAddress = (s: unknown): boolean => typeof s === 'string' && ADDRESS_LOWER.test(s) && s !== ZERO_ADDRESS;

/** `x` as a list, or undefined if it isn't an array. (Not a type predicate: no `any[]` narrowing on the money path.) */
function asList(x: unknown): readonly unknown[] | undefined {
  const list = x as readonly unknown[];
  return Array.isArray(x) ? list : undefined;
}

/** One element check: a set of literals, or a named grammar. */
type Check = { readonly lit: readonly string[] } | 'chain' | 'tx' | 'dec' | 'id' | 'role' | 'text' | 'hex64';

const lit = (...values: string[]): Check => ({ lit: values });

const ROLES: readonly string[] = ['hot', 'gas', 'collection'];

function passes(check: Check, el: unknown): boolean {
  if (typeof el !== 'string') return false;
  if (typeof check === 'object') return check.lit.includes(el);
  switch (check) {
    case 'chain':
      return el === TESTNET_CHAIN_ID;
    case 'tx':
      return isTxHash(el);
    case 'dec':
      return isDecimalString(el);
    case 'id':
      return isId(el);
    case 'role':
      return ROLES.includes(el);
    case 'hex64':
      return HEX64.test(el);
    case 'text':
      return el !== '';
  }
}

/** Element-by-element match of `xs` against `spec`: same length, every element passes. No index arithmetic. */
function matches(spec: readonly Check[], xs: readonly unknown[]): boolean {
  if (xs.length !== spec.length) return false;
  const checks = spec[Symbol.iterator]();
  for (const el of xs) {
    const check = checks.next();
    if (check.done === true || !passes(check.value, el)) return false;
  }
  return true;
}

const IN = (step: string): readonly Check[] => [lit('arc1'), lit('in'), 'chain', 'tx', 'dec', lit(step), 'dec'];
const OUT = (step: string): readonly Check[] => [lit('arc1'), lit('out'), 'id', lit(step), 'dec'];

/** Per key name, the element grammar of `K` (CONTRACT §1.3 table, `attempt` last). */
const KEY_SPECS: Readonly<Record<KeyName, readonly Check[]>> = Object.freeze({
  'K.recv': IN('recv'),
  'K.avail': IN('avail'),
  'K.unid': IN('unid'),
  'K.assign': IN('assign'),
  'K.reserve': OUT('reserve'),
  'K.settle': OUT('settle'),
  'K.release': OUT('release'),
  'K.move': [lit('arc1'), lit('tre'), 'id', lit('move'), 'dec'],
  'K.gas': [lit('arc1'), lit('gas'), 'chain', 'role', 'id', 'dec'],
  'K.dust': [lit('arc1'), lit('dust'), 'chain', 'role', 'id', 'dec'],
  'K.scr': [lit('arc1'), lit('scr'), 'text', lit('sender', 'destination'), 'dec', 'dec'],
  'K.case': [lit('arc1'), lit('case'), 'text', 'text', 'dec', 'dec'],
  'K.mon': [lit('arc1'), lit('mon'), 'text', 'dec'],
  'K.appr': [lit('arc1'), lit('appr'), 'id', 'hex64', 'dec'],
  'K.rpt': [lit('arc1'), lit('rpt'), 'text', 'text', 'dec'],
});

/** Per subject kind, the element grammar (CONTRACT §1.2 subject table). */
const SUBJECT_SPECS: Readonly<Record<Subject[0], readonly Check[]>> = Object.freeze({
  in: [lit('in'), 'chain', 'tx', 'dec'],
  out: [lit('out'), 'id'],
  move: [lit('move'), 'id'],
  batch: [lit('batch'), lit('gas', 'dust'), 'role', 'id'],
  recon: [lit('recon'), 'dec', 'dec'],
  event: [lit('event'), 'id'],
  rail: [lit('rail'), 'dec'],
  account: [lit('account'), 'id'],
  wallet: [lit('wallet'), 'role', 'dec'],
});

// ---------------------------------------------------------------------------
// Canonical encoding (RFC 8785 JCS) and hashing.
// ---------------------------------------------------------------------------

/** RFC 8785 serialisation of one JSON string. ECMAScript `JSON.stringify` is the RFC's own string algorithm (§3.2.2.2). */
function jcsString(s: unknown): string {
  if (typeof s !== 'string') throw new TypeError('canonical: every field must be a JSON string (CONTRACT §1.3)');
  if (LONE_SURROGATE.test(s)) throw new RangeError('canonical: a lone surrogate is not valid I-JSON (RFC 8785 §3.1)');
  return JSON.stringify(s);
}

/** RFC 8785 JCS text of an array of strings, or of an object whose values are strings. */
function jcsText(x: unknown): string {
  const list = asList(x);
  if (list !== undefined) return `[${list.map((s) => jcsString(s)).join(',')}]`;
  if (typeof x !== 'object' || x === null) throw new TypeError('canonical: expected an array or an object of strings (CONTRACT §1.3)');
  const members = new Map(Object.entries(x as Readonly<Record<string, unknown>>));
  // Array.prototype.sort with no comparator orders by UTF-16 code units: RFC 8785 §3.2.3.
  const names = [...members.keys()].sort();
  return `{${names.map((n) => `${jcsString(n)}:${jcsString(members.get(n))}`).join(',')}}`;
}

/** RFC 8785 JCS of an array of strings (or an object of strings), UTF-8 (CONTRACT §1.3). */
export function canonical(x: readonly string[] | Readonly<Record<string, string>>): Uint8Array {
  return new TextEncoder().encode(jcsText(x));
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** CONTRACT §1.3: `"arc1-" + lowercase_hex(SHA-256(canonical(K)))`. Throws on a tuple that breaks the §1.2/§1.3 grammar. */
export function deriveKey(tuple: KeyTuple): IdempotencyKey {
  const name: unknown = tuple.name;
  if (typeof name !== 'string' || !Object.hasOwn(KEY_SPECS, name)) throw new RangeError(`deriveKey: unknown key name ${String(name)}`);
  const k = asList(tuple.k);
  if (k === undefined || !matches(KEY_SPECS[tuple.name], k)) {
    throw new RangeError(`deriveKey: ${tuple.name} tuple does not match CONTRACT §1.3`);
  }
  return `arc1-${sha256Hex(canonical(tuple.k))}` as IdempotencyKey;
}

/** CONTRACT §1.2: `subjectRef` = the canonical-JSON string of the subject array. Throws on a malformed subject. */
export function subjectRef(subject: Subject): SubjectRef {
  const raw = asList(subject);
  if (raw === undefined) throw new RangeError('subjectRef: a subject is an array (CONTRACT §1.2)');
  const kind = raw[0];
  if (typeof kind !== 'string' || !Object.hasOwn(SUBJECT_SPECS, kind) || !matches(SUBJECT_SPECS[subject[0]], raw)) {
    throw new RangeError('subjectRef: subject does not match CONTRACT §1.2');
  }
  return jcsText(raw) as SubjectRef;
}

/** "cr-" + first 32 hex of SHA-256(JCS(["arc1","cr",caseId,dispositionSeq])) (CONTRACT §1.2). Always 35 characters. */
export function caseReturnInstructionId(caseId: Id, dispositionSeq: DecimalString): Id {
  if (!isId(caseId)) throw new RangeError('caseReturnInstructionId: caseId breaks the ID grammar');
  if (!isDecimalString(dispositionSeq)) throw new RangeError('caseReturnInstructionId: dispositionSeq is not a decimal string');
  return `cr-${sha256Hex(canonical(['arc1', 'cr', caseId, dispositionSeq])).slice(0, 32)}`;
}

/** payloadDigest (32 raw bytes) over the approval payload (CONTRACT §1.3). Nonce and fees are left out on purpose. */
export function payloadDigest(payload: {
  readonly amountWei: DecimalString;
  readonly asset: 'USDC';
  readonly chainId: ChainIdString;
  readonly destination: string;
  readonly instructionId: Id;
}): Uint8Array {
  if (!isDecimalString(payload.amountWei)) throw new RangeError('payloadDigest: amountWei is not a decimal string');
  if (payload.asset !== 'USDC') throw new RangeError('payloadDigest: asset must be USDC');
  if (payload.chainId !== TESTNET_CHAIN_ID) throw new RangeError('payloadDigest: chainId must be 5042002');
  if (!isCanonicalAddress(payload.destination)) throw new RangeError('payloadDigest: destination must be 0x + 40 lowercase hex, not 0x0');
  if (!isId(payload.instructionId)) throw new RangeError('payloadDigest: instructionId breaks the ID grammar');
  const digest = createHash('sha256')
    .update(
      canonical({
        amountWei: payload.amountWei,
        asset: payload.asset,
        chainId: payload.chainId,
        destination: payload.destination,
        instructionId: payload.instructionId,
      }),
    )
    .digest();
  return new Uint8Array(digest);
}
