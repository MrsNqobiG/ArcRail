/**
 * U9 limits and the internal-move rule, at the boundary (RUBRIC MC-25(b) and
 * (d); ADR-001 items 3 and 6). The total debit of a signature is
 * value + gasLimit × maxFeePerGas; every cap bounds that total.
 */
import { describe, expect, it } from 'vitest';
import type { SignRequest } from '../../src/signer/index.js';
import { CAPS, GWEI, USDC, approvalFor, randomAddress, request, tx, world } from './signer-fixtures.js';
import type { World } from './signer-fixtures.js';

const GAS = 21_000n;
const FEE = GAS * 40n * GWEI; // worst-case fee of the default fixture fees

async function outcome(w: World, req: SignRequest): Promise<string> {
  const r = await w.signer.sign(req);
  return r.kind === 'REFUSED' ? r.reason : 'SIGNED';
}

function payout(w: World, id: string, value: bigint, nonce = 0n, fees: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint; gasLimit?: bigint } = {}): SignRequest {
  return request(w, 'PAYOUT', id, { value, nonce, ...fees });
}

function move(w: World, id: string, value: bigint, o: { nonce?: bigint; approved?: boolean; to?: `0x${string}`; from?: `0x${string}` } = {}): SignRequest {
  const t = tx(w, { to: o.to ?? w.treasuryWallet, value, nonce: o.nonce ?? 0n, ...(o.from ? { from: o.from } : {}) });
  return { kind: 'INTERNAL_MOVE', instructionId: id, tx: t, approval: o.approved ? approvalFor(w, t, id) : null };
}

function cancel(w: World, id: string, nonce: bigint, maxFeePerGas = 40n * GWEI, from?: `0x${string}`): SignRequest {
  const sender = from ?? w.hot;
  return { kind: 'CANCEL', instructionId: id, tx: tx(w, { from: sender, to: sender, value: 0n, nonce, maxFeePerGas }), approval: null };
}

describe('MC-25(b): fee limits on every signature', () => {
  it('maxPriorityFeePerGas at the ceiling → signed; ceiling + 1 wei → refused', async () => {
    const w = await world();
    const c = CAPS.maxPriorityFeePerGasCeilingWei;
    expect(await outcome(w, payout(w, 'a', 1n, 0n, { maxPriorityFeePerGas: c }))).toBe('SIGNED');
    expect(await outcome(w, payout(w, 'b', 1n, 1n, { maxPriorityFeePerGas: c + 1n }))).toBe('FEE_CEILING');
  });

  it('worst-case fee gasLimit × maxFeePerGas at the ceiling → signed; ceiling + 1 wei → refused', async () => {
    const w = await world();
    const ceiling = CAPS.worstCaseFeeCeilingWei; // 21,000 × 100 gwei
    expect(await outcome(w, payout(w, 'a', 1n, 0n, { gasLimit: GAS, maxFeePerGas: 100n * GWEI }))).toBe('SIGNED');
    expect(GAS * 100n * GWEI).toBe(ceiling);
    // ceiling + 1 wei: gasLimit 1 and maxFeePerGas = ceiling + 1
    expect(await outcome(w, payout(w, 'b', 1n, 1n, { gasLimit: 1n, maxFeePerGas: ceiling + 1n }))).toBe('FEE_CEILING');
    expect(await outcome(w, payout(w, 'c', 1n, 2n, { gasLimit: 1n, maxFeePerGas: ceiling }))).toBe('SIGNED');
  });

  it('fee limits apply to cancels and to moves', async () => {
    const w = await world();
    expect(await outcome(w, payout(w, 'p', 1n, 4n))).toBe('SIGNED');
    expect(await outcome(w, cancel(w, 'p', 4n, 101n * GWEI))).toBe('FEE_CEILING');
    expect(await outcome(w, { ...move(w, 'm', 1n), tx: { ...move(w, 'm', 1n).tx, maxPriorityFeePerGas: CAPS.maxPriorityFeePerGasCeilingWei + 1n } as never })).toBe('FEE_CEILING');
  });
});

describe('MC-25(b): per-transaction cap on value + worst-case fee', () => {
  it('a total equal to the per-tx cap → signed; cap + 1 wei → refused', async () => {
    const w = await world();
    expect(await outcome(w, payout(w, 'eq', CAPS.perTxCapWei - FEE, 0n))).toBe('SIGNED');
    expect(await outcome(w, payout(w, 'over', CAPS.perTxCapWei - FEE + 1n, 1n))).toBe('PER_TX_CAP');
  });

  it('the cap counts the fee: a value equal to the cap alone is refused', async () => {
    const w = await world();
    expect(await outcome(w, payout(w, 'v', CAPS.perTxCapWei, 0n))).toBe('PER_TX_CAP');
  });

  it('applies to case returns too', async () => {
    const w = await world();
    expect(await outcome(w, request(w, 'CASE_RETURN', 'r1', { value: CAPS.perTxCapWei - FEE + 1n }))).toBe('PER_TX_CAP');
    expect(await outcome(w, request(w, 'CASE_RETURN', 'r2', { value: CAPS.perTxCapWei - FEE }))).toBe('SIGNED');
  });

  it('a zero-value self-send with an unbounded tip cannot drain the wallet as fees', async () => {
    const w = await world();
    const t = tx(w, { to: w.hot, value: 0n, maxFeePerGas: 1_000_000n * GWEI, maxPriorityFeePerGas: 1_000_000n * GWEI });
    expect(await outcome(w, { kind: 'PAYOUT', instructionId: 'drain', tx: t, approval: approvalFor(w, t, 'drain') })).toBe('FEE_CEILING');
  });
});

describe('MC-25(b): daily cap on the total debit, including fees, cancels and replacements', () => {
  it('a send whose total would exceed the remaining daily cap by 1 wei → refused; exactly the remainder → signed', async () => {
    const w = await world();
    const big = CAPS.perTxCapWei - FEE; // total = perTx
    expect(await outcome(w, payout(w, 'd1', big, 0n))).toBe('SIGNED');
    expect(await outcome(w, payout(w, 'd2', big, 1n))).toBe('SIGNED');
    const remaining = CAPS.dailyCapWei - 2n * CAPS.perTxCapWei;
    expect(await outcome(w, payout(w, 'd3', remaining - FEE + 1n, 2n))).toBe('DAILY_CAP');
    expect(await outcome(w, payout(w, 'd4', remaining - FEE, 2n))).toBe('SIGNED');
    expect(await outcome(w, payout(w, 'd5', 0n, 3n, { gasLimit: 1n, maxFeePerGas: 1n, maxPriorityFeePerGas: 0n }))).toBe('DAILY_CAP');
  });

  it('a zero-value cancel whose fee would exceed the remaining daily cap by 1 wei → refused', async () => {
    const w = await world();
    expect(await outcome(w, payout(w, 'c1', CAPS.perTxCapWei - FEE, 0n))).toBe('SIGNED');
    expect(await outcome(w, payout(w, 'c2', CAPS.perTxCapWei - FEE, 1n))).toBe('SIGNED');
    const remaining = CAPS.dailyCapWei - 2n * CAPS.perTxCapWei; // 500 USDC
    // fill all but (FEE − 1) wei of the cap
    expect(await outcome(w, payout(w, 'c3', remaining - FEE - (FEE - 1n), 2n))).toBe('SIGNED');
    expect(await outcome(w, cancel(w, 'c2', 1n))).toBe('DAILY_CAP');
    expect(await outcome(w, cancel(w, 'c2', 1n, 40n * GWEI - 1n))).toBe('SIGNED'); // 21,000 wei less: fits
  });

  it("a same-nonce replacement's worst-case fee is counted against the daily cap (and not its value again)", async () => {
    const w = await world();
    const req = payout(w, 'rep', CAPS.perTxCapWei - FEE, 0n);
    expect(await outcome(w, req)).toBe('SIGNED');
    expect(await outcome(w, payout(w, 'x1', CAPS.perTxCapWei - FEE, 1n))).toBe('SIGNED');
    const remaining = CAPS.dailyCapWei - 2n * CAPS.perTxCapWei;
    // leave exactly FEE − 1 wei
    expect(await outcome(w, payout(w, 'x2', remaining - FEE - (FEE - 1n), 2n))).toBe('SIGNED');
    expect(await outcome(w, req)).toBe('DAILY_CAP'); // replacement adds FEE > FEE − 1
    const cheaper = { ...req, tx: { ...req.tx, maxFeePerGas: req.tx.maxFeePerGas - 1n } } as SignRequest;
    expect(await outcome(w, cheaper)).toBe('SIGNED'); // adds FEE − 21,000 wei
  });

  it('the daily cap resets on the next UTC day', async () => {
    const w = await world();
    for (const [i, id] of ['a', 'b'].entries()) expect(await outcome(w, payout(w, id, CAPS.perTxCapWei - FEE, BigInt(i)))).toBe('SIGNED');
    expect(await outcome(w, payout(w, 'c', CAPS.perTxCapWei - FEE, 2n))).toBe('DAILY_CAP');
    const nextDay = (w.clock.now / 86_400_000n + 1n) * 86_400_000n;
    w.clock.now = nextDay;
    w.attest('ALL_CLEAR');
    expect(await outcome(w, payout(w, 'c', CAPS.perTxCapWei - FEE, 2n))).toBe('SIGNED');
  });

  it('the last millisecond of a day still counts against that day', async () => {
    const w = await world();
    const dayEnd = (w.clock.now / 86_400_000n + 1n) * 86_400_000n - 1n;
    w.clock.now = dayEnd;
    w.attest('ALL_CLEAR');
    expect(await outcome(w, payout(w, 'a', CAPS.perTxCapWei - FEE, 0n))).toBe('SIGNED');
    expect(await outcome(w, payout(w, 'b', CAPS.perTxCapWei - FEE, 1n))).toBe('SIGNED');
    expect(await outcome(w, payout(w, 'c', CAPS.perTxCapWei - FEE, 2n))).toBe('DAILY_CAP');
  });

  it('moves do not consume the payout daily cap, and payouts do not consume the move cap', async () => {
    const w = await world();
    expect(await outcome(w, move(w, 'm1', CAPS.perMoveCapWei - FEE, { approved: true }))).toBe('SIGNED');
    expect(await outcome(w, payout(w, 'p1', CAPS.perTxCapWei - FEE, 1n))).toBe('SIGNED');
    expect(await outcome(w, payout(w, 'p2', CAPS.perTxCapWei - FEE, 2n))).toBe('SIGNED');
    expect(await outcome(w, move(w, 'm2', CAPS.perMoveCapWei - FEE, { approved: true, nonce: 3n }))).toBe('MOVE_CAP'); // 1,600 > 1,500
    expect(await outcome(w, move(w, 'm3', CAPS.dailyMoveCapWei - CAPS.perMoveCapWei - FEE, { approved: true, nonce: 3n }))).toBe('SIGNED');
  });
});

describe('ADR-001 item 6 and MC-25(b)/(d): internal moves', () => {
  it("a move whose to is not on Treasury's list is refused", async () => {
    const w = await world();
    expect(await outcome(w, move(w, 'm', 1n, { to: randomAddress() }))).toBe('MOVE_NOT_ON_TREASURY_LIST');
  });

  it("a move's to is matched case-insensitively against Treasury's list", async () => {
    const w = await world();
    expect(await outcome(w, move(w, 'm', 1n, { to: w.treasuryWallet.toUpperCase().replace('0X', '0x') as `0x${string}` }))).toBe('SIGNED');
  });

  it('a move whose total equals the per-move cap → signed; cap + 1 wei → refused', async () => {
    const w = await world();
    expect(await outcome(w, move(w, 'eq', CAPS.perMoveCapWei - FEE, { approved: true }))).toBe('SIGNED');
    expect(await outcome(w, move(w, 'over', CAPS.perMoveCapWei - FEE + 1n, { approved: true, nonce: 1n }))).toBe('MOVE_CAP');
  });

  it('a move whose total exceeds the remaining daily move cap by 1 wei → refused', async () => {
    const w = await world();
    expect(await outcome(w, move(w, 'a', CAPS.perMoveCapWei - FEE, { approved: true }))).toBe('SIGNED');
    const remaining = CAPS.dailyMoveCapWei - CAPS.perMoveCapWei;
    expect(await outcome(w, move(w, 'b', remaining - FEE + 1n, { approved: true, nonce: 1n }))).toBe('MOVE_CAP');
    expect(await outcome(w, move(w, 'c', remaining - FEE, { approved: true, nonce: 1n }))).toBe('SIGNED');
  });

  it('a move at the approval threshold is signed without a checker; 1 wei above without one is refused', async () => {
    const w = await world();
    expect(await outcome(w, move(w, 'at', CAPS.moveApprovalThresholdWei))).toBe('SIGNED');
    expect(await outcome(w, move(w, 'above', CAPS.moveApprovalThresholdWei + 1n, { nonce: 1n }))).toBe('CHECKER_REQUIRED');
    expect(await outcome(w, move(w, 'above-ok', CAPS.moveApprovalThresholdWei + 1n, { nonce: 1n, approved: true }))).toBe('SIGNED');
  });

  it('a move strictly above the threshold with an invalid assertion is refused', async () => {
    const w = await world();
    const req = move(w, 'bad', CAPS.moveApprovalThresholdWei + 1n, { approved: true });
    const forged = { ...req, approval: { ...req.approval!, checkerAssertion: req.approval!.checkerAssertion.replace(/\.[^.]+$/, '.AAAA') } };
    expect(await outcome(w, forged)).toBe('APPROVAL_INVALID');
    const otherDigest = { ...req, tx: { ...req.tx, value: req.tx.value + 1n } } as SignRequest;
    expect(await outcome(w, otherDigest)).toBe('APPROVAL_MISMATCH');
  });

  it('an approval supplied with a small move is still verified (an invalid one is refused)', async () => {
    const w = await world();
    const req = move(w, 'small', 1n, { approved: true });
    expect(await outcome(w, { ...req, approval: { ...req.approval!, checkerId: 'nobody' } })).toBe('APPROVAL_INVALID');
    expect(await outcome(w, req)).toBe('SIGNED');
  });

  it('the threshold is the signer\'s own copy: a request cannot declare it (extra fields are refused)', async () => {
    const w = await world();
    const req = move(w, 'decl', CAPS.moveApprovalThresholdWei + 1n);
    expect(await outcome(w, { ...req, moveApprovalThresholdWei: CAPS.moveApprovalThresholdWei * 2n } as SignRequest)).toBe('CHECKER_REQUIRED');
  });

  it("a move cancel's fee counts against the daily move cap, not the payout cap", async () => {
    const w = await world();
    expect(await outcome(w, move(w, 'mv', CAPS.perMoveCapWei - FEE, { approved: true, nonce: 0n }))).toBe('SIGNED');
    const remaining = CAPS.dailyMoveCapWei - CAPS.perMoveCapWei;
    expect(await outcome(w, move(w, 'fill', remaining - FEE - (FEE - 1n), { approved: true, nonce: 1n }))).toBe('SIGNED');
    expect(await outcome(w, cancel(w, 'mv', 0n))).toBe('MOVE_CAP');
    // the payout daily cap is untouched
    expect(await outcome(w, payout(w, 'p', CAPS.perTxCapWei - FEE, 2n))).toBe('SIGNED');
  });

  it('a same-nonce move replacement adds only its fee to the daily move cap', async () => {
    const w = await world();
    const req = move(w, 'mr', CAPS.perMoveCapWei - FEE, { approved: true });
    expect(await outcome(w, req)).toBe('SIGNED');
    const remaining = CAPS.dailyMoveCapWei - CAPS.perMoveCapWei; // 700 USDC
    expect(await outcome(w, move(w, 'f', remaining - FEE - FEE, { approved: true, nonce: 1n }))).toBe('SIGNED');
    expect(await outcome(w, req)).toBe('SIGNED'); // exactly FEE left
    expect(await outcome(w, req)).toBe('MOVE_CAP');
  });

  it('a cancel slot belongs to its sender: a collection wallet cannot cancel a hot-wallet instruction', async () => {
    const w = await world();
    const col = await w.signer.deriveAddress('collection', 0n);
    expect(await outcome(w, payout(w, 'p', 1n, 3n))).toBe('SIGNED');
    expect(await outcome(w, cancel(w, 'p', 3n, 40n * GWEI, col))).toBe('SHAPE_NOT_ALLOWED');
  });

  it('a large move (well over USDC 100) is not a payout: no per-tx cap applies, the move caps do', async () => {
    const w = await world();
    expect(CAPS.perMoveCapWei < CAPS.perTxCapWei).toBe(true);
    expect(await outcome(w, move(w, 'l', 799n * USDC, { approved: true }))).toBe('SIGNED');
  });
});
