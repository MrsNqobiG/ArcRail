/**
 * U9 refusal fixtures for the shape allow-list (RUBRIC MC-23, ADR-001 item 2,
 * THREAT_MODEL T-E5). The requests come from a stub orchestrator that asks for
 * every signature, so each refusal comes from the signer itself (MC-25).
 */
import { encodeFunctionData, parseAbi } from 'viem';
import { describe, expect, it } from 'vitest';
import type { SignRequest } from '../../src/signer/index.js';
import { GWEI, approvalFor, randomAddress, request, tx, world } from './signer-fixtures.js';
import type { World } from './signer-fixtures.js';

const USDC_ERC20 = '0x3600000000000000000000000000000000000000'; // C-12
const MEMO = '0x5294E9927c3306DcBaDb03fe70b92e01cCede505'; // C-62
// Illustrative ABI for the fixtures only: the signer refuses any non-empty data, whatever its selector.
const abi = parseAbi([
  'function approve(address spender, uint256 amount)',
  'function transfer(address to, uint256 amount)',
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
  'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
  'function memo(address target, bytes data, bytes32 memoId, bytes memoData)',
]);
const approveCalldata = encodeFunctionData({ abi, functionName: 'approve', args: [randomAddress(), 2n ** 256n - 1n] });
const transferCalldata = encodeFunctionData({ abi, functionName: 'transfer', args: [randomAddress(), 1_000_000n] });
const permitCalldata = encodeFunctionData({
  abi,
  functionName: 'permit',
  args: [randomAddress(), randomAddress(), 1n, 1n, 27, `0x${'11'.repeat(32)}`, `0x${'22'.repeat(32)}`],
});
const eip3009Calldata = encodeFunctionData({
  abi,
  functionName: 'transferWithAuthorization',
  args: [randomAddress(), randomAddress(), 1n, 0n, 1n, `0x${'33'.repeat(32)}`, 27, `0x${'11'.repeat(32)}`, `0x${'22'.repeat(32)}`],
});
const memoOf = (inner: `0x${string}`): `0x${string}` =>
  encodeFunctionData({ abi, functionName: 'memo', args: [USDC_ERC20, inner, `0x${'44'.repeat(32)}`, '0x'] });

/** A fully approved payout whose tx is then altered (approval stays valid for the original fields). */
function altered(w: World, change: Record<string, unknown>, drop: string[] = []): SignRequest {
  const base = request(w, 'PAYOUT', 'ins-shape');
  const t: Record<string, unknown> = { ...base.tx, ...change };
  for (const k of drop) delete t[k];
  return { ...base, tx: t as never };
}

async function refusal(w: World, req: unknown): Promise<string> {
  const r = await w.signer.sign(req as SignRequest);
  return r.kind === 'REFUSED' ? r.reason : 'SIGNED';
}

describe('MC-23: only EIP-1559 type-2 value sends with empty data, chain ID 5042002', () => {
  it('the control: the unaltered request is signed', async () => {
    const w = await world();
    expect(await refusal(w, altered(w, {}))).toBe('SIGNED');
  });

  it.each([
    ['memo(0x3600…, approve(…)) to the Memo contract', { to: MEMO, data: memoOf(approveCalldata) }],
    ['memo(0x3600…, transfer(unbound recipient, …)) to the Memo contract', { to: MEMO, data: memoOf(transferCalldata) }],
    ['approve calldata to USDC', { to: USDC_ERC20, data: approveCalldata }],
    ['transfer calldata to USDC', { to: USDC_ERC20, data: transferCalldata }],
    ['permit calldata to USDC', { to: USDC_ERC20, data: permitCalldata }],
    ['EIP-3009 transferWithAuthorization calldata', { to: USDC_ERC20, data: eip3009Calldata }],
    ['a single non-empty data byte', { data: '0x00' }],
    ['data missing', {}, ['data']],
    ['a contract deployment (no to, init code)', { data: '0x6080604052' }, ['to']],
    ['a deployment with to = null', { to: null }],
    ['to = the zero address', { to: '0x0000000000000000000000000000000000000000' }],
    ['to not 20 bytes', { to: '0x1234' }],
    ['to without 0x', { to: '3600000000000000000000000000000000000000' }],
    ['from not an address', { from: 'hot' }],
    ['legacy transaction type', { type: 'legacy', gasPrice: 40n * GWEI }],
    ['EIP-2930 transaction type', { type: 'eip2930' }],
    ['EIP-4844 blob transaction type', { type: 'eip4844' }],
    ['EIP-7702 transaction type with an authorization list', { type: 'eip7702', authorizationList: [{ address: randomAddress(), chainId: 5042002, nonce: 0 }] }],
    ['an EIP-7702 authorization list smuggled into an eip1559 send', { authorizationList: [{ address: randomAddress(), chainId: 5042002, nonce: 0 }] }],
    ['an access list (any extra field)', { accessList: [] }],
    ['a gasPrice field', { gasPrice: 40n * GWEI }],
    ['nonce as a number', { nonce: 0 }],
    ['negative nonce', { nonce: -1n }],
    ['nonce above 2^64 − 1 (EIP-2681)', { nonce: 2n ** 64n }],
    ['value as a decimal string', { value: '1000' }],
    ['negative value', { value: -1n }],
    ['value above uint256', { value: 2n ** 256n }],
    ['gasLimit zero', { gasLimit: 0n }],
    ['gasLimit as a number', { gasLimit: 21000 }],
    ['maxFeePerGas missing', {}, ['maxFeePerGas']],
    ['maxFeePerGas above uint256', { maxFeePerGas: 2n ** 256n }],
    ['maxPriorityFeePerGas above maxFeePerGas', { maxPriorityFeePerGas: 41n * GWEI, maxFeePerGas: 40n * GWEI }],
    ['maxPriorityFeePerGas as a number', { maxPriorityFeePerGas: 1 }],
  ])('refuses %s', async (_label, change, drop: string[] = []) => {
    const w = await world();
    expect(await refusal(w, altered(w, change, drop))).toBe('SHAPE_NOT_ALLOWED');
    expect(w.log).toEqual([]);
  });

  it('maxPriorityFeePerGas equal to maxFeePerGas is a valid shape', async () => {
    const w = await world();
    const t = tx(w, { maxFeePerGas: 4n * GWEI, maxPriorityFeePerGas: 4n * GWEI });
    expect(await refusal(w, { kind: 'PAYOUT', instructionId: 'eq', tx: t, approval: approvalFor(w, t, 'eq') })).toBe('SIGNED');
  });

  it.each([
    ['Arc mainnet 5042', 5042],
    ['Ethereum mainnet 1', 1],
    ['5042002 as a string', '5042002'],
    ['5042002 as a bigint', 5042002n],
    ['missing chain ID', undefined],
  ])('refuses a transaction with a different chain ID: %s', async (_label, chainId) => {
    const w = await world();
    expect(await refusal(w, altered(w, { chainId }))).toBe('CHAIN_ID');
  });

  it.each([
    ['an EIP-712 typed-data request (EIP-3009 authorization)', {
      kind: 'PAYOUT',
      instructionId: 'x',
      tx: { type: 'eip712', domain: { name: 'USDC', version: '2', chainId: 5042002, verifyingContract: USDC_ERC20 }, primaryType: 'TransferWithAuthorization', message: {} },
      approval: null,
    }],
    ['an EIP-2612 permit typed-data request', { kind: 'PAYOUT', instructionId: 'x', tx: { type: 'eip712', primaryType: 'Permit', message: {} }, approval: null }],
    ['a personal_sign request', { kind: 'PAYOUT', instructionId: 'x', tx: { type: 'personal_sign', message: 'hello' }, approval: null }],
    ['a raw-hash signing request', { kind: 'PAYOUT', instructionId: 'x', tx: { type: 'hash', hash: `0x${'aa'.repeat(32)}` }, approval: null }],
    ['an EIP-7702 authorization request', { kind: 'PAYOUT', instructionId: 'x', tx: { type: 'authorization', contractAddress: randomAddress(), chainId: 5042002, nonce: 0n }, approval: null }],
    ['an unknown kind', { kind: 'SWEEP', instructionId: 'x', tx: {}, approval: null }],
    ['kind not a string', { kind: 1, instructionId: 'x', tx: {}, approval: null }],
    ['an empty instructionId', { kind: 'PAYOUT', instructionId: '', tx: {}, approval: null }],
    ['instructionId not a string', { kind: 'PAYOUT', instructionId: 7, tx: {}, approval: null }],
    ['no tx', { kind: 'PAYOUT', instructionId: 'x', approval: null }],
    ['tx = null', { kind: 'PAYOUT', instructionId: 'x', tx: null, approval: null }],
    ['a string instead of a request', 'sign this'],
    ['null instead of a request', null],
  ])('refuses %s', async (_label, req) => {
    const w = await world();
    expect(await refusal(w, req)).toBe('SHAPE_NOT_ALLOWED');
  });

  it('a well-formed request from an address this signer holds no key for is refused', async () => {
    const w = await world();
    expect(await refusal(w, request(w, 'PAYOUT', 'foreign', { from: randomAddress() }))).toBe('SHAPE_NOT_ALLOWED');
  });

  it('a checksummed (mixed-case) sender and destination are accepted', async () => {
    const w = await world();
    expect(w.hot).not.toBe(w.hot.toLowerCase());
    const t = tx(w, { from: w.hot, to: '0xAbCdEf0123456789aBcDeF0123456789ABCDEF01' });
    expect(await refusal(w, { kind: 'PAYOUT', instructionId: 'cs', tx: t, approval: approvalFor(w, t, 'cs') })).toBe('SIGNED');
  });

  it('the shape is read once: a getter that changes value after validation cannot change what is signed', async () => {
    const w = await world();
    const base = request(w, 'PAYOUT', 'getter');
    let reads = 0n;
    const t = { ...base.tx };
    Object.defineProperty(t, 'value', {
      enumerable: true,
      get: () => {
        reads += 1n;
        return reads === 1n ? base.tx.value : base.tx.value * 1000n;
      },
    });
    const r = await w.signer.sign({ ...base, tx: t });
    expect(r.kind).toBe('SIGNED');
    expect(reads).toBe(1n);
    expect(w.log[0]?.payloadHash).toBe(base.approval?.payloadHash);
  });
});

describe('ADR-001 item 2: same-nonce cancel shape', () => {
  it('a cancel must be zero value and sent to the sender itself', async () => {
    const w = await world();
    expect(await refusal(w, request(w, 'PAYOUT', 'p1', { nonce: 4n }))).toBe('SIGNED');
    expect(await refusal(w, { kind: 'CANCEL', instructionId: 'p1', tx: tx(w, { nonce: 4n, to: w.hot, value: 1n }), approval: null })).toBe('SHAPE_NOT_ALLOWED');
    expect(await refusal(w, { kind: 'CANCEL', instructionId: 'p1', tx: tx(w, { nonce: 4n, to: w.treasuryWallet, value: 0n }), approval: null })).toBe('SHAPE_NOT_ALLOWED');
    expect(await refusal(w, { kind: 'CANCEL', instructionId: 'p1', tx: tx(w, { nonce: 4n, to: w.hot, value: 0n }), approval: null })).toBe('SIGNED');
  });

  it('a cancel from a wallet that is neither on Treasury\'s list nor a derived collection address is refused', async () => {
    const w = await world();
    const gas = await w.signer.deriveAddress('gas', 0n);
    expect(await refusal(w, request(w, 'PAYOUT', 'g1', { from: gas, nonce: 1n }))).toBe('SIGNED');
    expect(await refusal(w, { kind: 'CANCEL', instructionId: 'g1', tx: tx(w, { from: gas, to: gas, nonce: 1n, value: 0n }), approval: null })).toBe('SHAPE_NOT_ALLOWED');
  });

  it('a cancel from a collection address the signer derives itself is allowed (a sweep can be cancelled)', async () => {
    const w = await world();
    const col = await w.signer.deriveAddress('collection', 5n);
    const sweep = tx(w, { from: col, to: w.treasuryWallet, nonce: 0n, value: 5n * GWEI });
    expect(await refusal(w, { kind: 'INTERNAL_MOVE', instructionId: 'sweep-1', tx: sweep, approval: null })).toBe('SIGNED');
    expect(await refusal(w, { kind: 'CANCEL', instructionId: 'sweep-1', tx: tx(w, { from: col, to: col, nonce: 0n, value: 0n, maxFeePerGas: 60n * GWEI }), approval: null })).toBe('SIGNED');
  });

  it('a cancel needs an already-signed instruction at the same sender and nonce', async () => {
    const w = await world();
    const cancel = (instructionId: string, nonce: bigint): SignRequest => ({ kind: 'CANCEL', instructionId, tx: tx(w, { to: w.hot, nonce, value: 0n }), approval: null });
    expect(await refusal(w, cancel('never-signed', 0n))).toBe('SHAPE_NOT_ALLOWED');
    expect(await refusal(w, request(w, 'PAYOUT', 'p2', { nonce: 9n }))).toBe('SIGNED');
    expect(await refusal(w, cancel('p2', 8n))).toBe('SHAPE_NOT_ALLOWED');
    const other = await w.signer.deriveAddress('hot', 1n);
    // same nonce, different sender (also on no list): refused
    expect(await refusal(w, { kind: 'CANCEL', instructionId: 'p2', tx: tx(w, { from: other, to: other, nonce: 9n, value: 0n }), approval: null })).toBe('SHAPE_NOT_ALLOWED');
    expect(await refusal(w, cancel('p2', 9n))).toBe('SIGNED');
    // a second cancel at the same slot is another replacement: allowed
    expect(await refusal(w, cancel('p2', 9n))).toBe('SIGNED');
  });
});
