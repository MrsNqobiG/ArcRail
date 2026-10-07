/**
 * F2b Wrapper-call rule (kit-v3 CLAUDE.md "Wrapper-call signing rule";
 * NOVA_ARC_DESIGN §8.4 check 4).
 *
 * Plain USDC value transfers are the default. A contract call is acceptable only if
 *  - its target is allow-listed by exact address (here, and separately in the DFNS policy);
 *  - we can decode it with a decoder built from a cited ABI, and the decoded call
 *    re-encodes to exactly the same bytes (no trailing data, no non-canonical encoding);
 *  - it carries no native value;
 *  - every inner call targets the USDC ERC-20 interface (C-12) or an approved
 *    settlement contract, is ERC-20 `transfer(address,uint256)` (EIP-20), and its
 *    recipient and amount equal the server-side binding.
 *
 * Decoders. Only `Memo` (C-62) has one: its ABI is
 * `memo(address target, bytes data, bytes32 memoId, bytes memoData)`, quoted from
 * the archived Arc page docs/sources/arc/arc_concepts_transaction-memos.md.
 * `Multicall3From` (C-63) has no documented ABI in our sources, so it has no
 * decoder and cannot be allow-listed (fail closed). Memo rules of our own: the
 * memo carries no personal data (C-64), so `memoData` must be empty and
 * `memoId` must equal `deriveMemoId(paymentId)`, a hash of our payment id.
 *
 * Selectors are computed by viem from the signatures above, never typed in.
 */
import { decodeFunctionData, encodeFunctionData } from 'viem';
import type { NativeWei, UsdcUnits } from '../amounts/index.js';
import { usdcUnits, usdcUnitsToNativeWei } from '../amounts/index.js';
import { lpDigestHex } from '../dfns/types.js';

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

/** USDC ERC-20 interface, C-12 (docs/constants.md). */
export const USDC_ERC20_ADDRESS: Address = '0x3600000000000000000000000000000000000000';
/** Predeployed Memo contract, C-62 (docs/constants.md). */
export const MEMO_ADDRESS: Address = '0x5294E9927c3306DcBaDb03fe70b92e01cCede505';

/** EIP-20 `transfer(address _to, uint256 _value) returns (bool success)`. */
const ERC20_TRANSFER_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
] as const;

/** Arc `Memo.memo(address target, bytes data, bytes32 memoId, bytes memoData)` (C-62 page). */
const MEMO_ABI = [
  {
    type: 'function',
    name: 'memo',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'memoId', type: 'bytes32' },
      { name: 'memoData', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

export type WrapperDecoder = 'MEMO';

/** One allow-listed wrapper contract. Only contracts with a decoder can be listed. */
export interface WrapperRule {
  readonly contract: Address;
  readonly decoder: WrapperDecoder;
}

export interface ContractCall {
  readonly target: Address;
  readonly data: Hex;
  readonly value: NativeWei;
}

/** What the decoded call must equal: taken from the server-side binding only. */
export interface WrapperExpectation {
  readonly paymentId: string;
  readonly to: Address;
  readonly amount: NativeWei;
}

export type WrapperRefusal =
  | 'NOT_ALLOW_LISTED'
  | 'VALUE_NOT_ZERO'
  | 'UNDECODABLE'
  | 'NON_CANONICAL'
  | 'MEMO_DATA_NOT_EMPTY'
  | 'MEMO_ID_MISMATCH'
  | 'INNER_TARGET'
  | 'INNER_FUNCTION'
  | 'INNER_RECIPIENT'
  | 'INNER_AMOUNT';

export type WrapperVerdict =
  | { readonly ok: true; readonly innerTarget: Address; readonly recipient: Address; readonly amount: UsdcUnits }
  | { readonly ok: false; readonly reason: WrapperRefusal; readonly detail: string };

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

function refuse(reason: WrapperRefusal, detail: string): WrapperVerdict {
  return { ok: false, reason, detail };
}

/** Our non-PII memo reference for a payment: `0x` + sha256(lp('nv1-memo') ‖ lp(paymentId)). */
export function deriveMemoId(paymentId: string): Hex {
  return `0x${lpDigestHex(['nv1-memo', paymentId])}`;
}

/** Decode the inner ERC-20 call and check it against the binding. */
function verifyInner(target: Address, data: Hex, expect: WrapperExpectation, innerTargets: readonly Address[]): WrapperVerdict {
  if (!innerTargets.some((t) => same(t, target))) return refuse('INNER_TARGET', `inner call targets ${target}`);
  let to: Address;
  let value: bigint;
  try {
    const d = decodeFunctionData({ abi: ERC20_TRANSFER_ABI, data });
    [to, value] = d.args;
  } catch (e: unknown) {
    return refuse('INNER_FUNCTION', `inner call is not ERC-20 transfer(address,uint256): ${String(e).slice(0, 200)}`);
  }
  if (!same(encodeFunctionData({ abi: ERC20_TRANSFER_ABI, functionName: 'transfer', args: [to, value] }), data)) {
    return refuse('NON_CANONICAL', 'inner calldata has trailing or non-canonical bytes');
  }
  if (!same(to, expect.to)) return refuse('INNER_RECIPIENT', `inner recipient ${to} is not the bound recipient`);
  const units = usdcUnits(value);
  if (usdcUnitsToNativeWei(units) !== expect.amount) return refuse('INNER_AMOUNT', `inner amount ${value} USDC units is not the bound amount`);
  return { ok: true, innerTarget: target, recipient: to, amount: units };
}

/**
 * Verify a wrapper contract call against the allow-list and the binding.
 * `innerTargets` defaults to the USDC ERC-20 interface (C-12); an approved
 * settlement contract is added by configuration only.
 */
export function verifyWrapperCall(
  call: ContractCall,
  expect: WrapperExpectation,
  allowList: readonly WrapperRule[],
  innerTargets: readonly Address[] = [USDC_ERC20_ADDRESS],
): WrapperVerdict {
  const rule = allowList.find((r) => same(r.contract, call.target));
  if (rule === undefined) return refuse('NOT_ALLOW_LISTED', `${call.target} is not an allow-listed contract`);
  if (call.value !== 0n) return refuse('VALUE_NOT_ZERO', 'a wrapper call must not carry native value');

  // rule.decoder is 'MEMO', the only decoder that exists.
  let target: Address;
  let inner: Hex;
  let memoId: Hex;
  let memoData: Hex;
  try {
    const d = decodeFunctionData({ abi: MEMO_ABI, data: call.data });
    [target, inner, memoId, memoData] = d.args;
  } catch (e: unknown) {
    return refuse('UNDECODABLE', `not Memo.memo(...): ${String(e).slice(0, 200)}`);
  }
  if (!same(encodeFunctionData({ abi: MEMO_ABI, functionName: 'memo', args: [target, inner, memoId, memoData] }), call.data)) {
    return refuse('NON_CANONICAL', 'memo calldata has trailing or non-canonical bytes');
  }
  if (memoData !== '0x') return refuse('MEMO_DATA_NOT_EMPTY', 'memoData must be empty (no personal data on-chain, C-64)');
  if (!same(memoId, deriveMemoId(expect.paymentId))) return refuse('MEMO_ID_MISMATCH', 'memoId is not this payment\'s reference');
  return verifyInner(target, inner, expect, innerTargets);
}
