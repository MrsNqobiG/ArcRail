/**
 * CBS port: identifiers, subject references and idempotency-key derivation
 * types (CONTRACT §1.2, §1.3). Types and stubs only.
 *
 * key = "arc1-" + lowercase_hex(SHA-256(JCS(K))), 69 ASCII characters.
 * `attempt` (decimal from "0") is the last element of every key tuple.
 */
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

/** RFC 8785 JCS of an array of strings, UTF-8 (CONTRACT §1.3). */
export function canonical(_x: readonly string[] | Readonly<Record<string, string>>): Uint8Array {
  throw new Error('not implemented: CBS port keys');
}

export function deriveKey(_tuple: KeyTuple): IdempotencyKey {
  throw new Error('not implemented: CBS port keys');
}

export function subjectRef(_subject: Subject): SubjectRef {
  throw new Error('not implemented: CBS port keys');
}

/** "cr-" + first 32 hex of SHA-256(JCS(["arc1","cr",caseId,dispositionSeq])) (CONTRACT §1.2). */
export function caseReturnInstructionId(_caseId: Id, _dispositionSeq: DecimalString): Id {
  throw new Error('not implemented: CBS port keys');
}

/** payloadDigest (32 raw bytes) over the approval payload (CONTRACT §1.3). */
export function payloadDigest(_payload: {
  readonly amountWei: DecimalString;
  readonly asset: 'USDC';
  readonly chainId: ChainIdString;
  readonly destination: string;
  readonly instructionId: Id;
}): Uint8Array {
  throw new Error('not implemented: CBS port keys');
}
