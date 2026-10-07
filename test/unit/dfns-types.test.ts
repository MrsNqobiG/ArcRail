/**
 * F1a DFNS decoders, deterministic keys and the DFNS status → stage mapping
 * (src/dfns/types.ts), checked against fixtures derived from the archived DFNS
 * documentation examples (src/dfns/fakes/fixtures.ts).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ARC_TESTNET } from '../../src/chain/config/index.js';
import { feesFixture, transferFixture, walletFixture } from '../../src/dfns/fakes/fixtures.js';
import { type JsonObject, JsonShapeError, parseJson } from '../../src/dfns/json.js';
import {
  ARC_TESTNET_CHAIN_ID,
  DFNS_ARC_MAINNET,
  DFNS_ARC_TESTNET,
  DFNS_BASE_URLS,
  type DfnsTransfer,
  DfnsBodyError,
  decodeChallenge,
  decodeFees,
  decodeTransfer,
  decodeTransferPage,
  decodeUserAction,
  decodeWallet,
  ONLY_ATTEMPT,
  bodyTextDigest,
  deriveExternalId,
  detailsNonce,
  lengthPrefixed,
  lpDigestHex,
  mapTransferStatus,
  transferBodyDigest,
  transferBodyText,
  transferDedupeKey,
  transferPayloadDigest,
  transferStatusRank,
} from '../../src/dfns/types.js';

const j = (v: unknown) => parseJson(JSON.stringify(v));
const transfer = (over: Record<string, unknown> = {}): DfnsTransfer => decodeTransfer(j(transferFixture(over)));
const HASH = `0x${'ab'.repeat(32)}`;

describe('constants', () => {
  it('pins Arc testnet and names mainnet only to refuse it', () => {
    expect(ARC_TESTNET_CHAIN_ID).toBe(BigInt(ARC_TESTNET.chainId));
    expect(DFNS_ARC_TESTNET).toBe('ArcTestnet');
    expect(DFNS_ARC_MAINNET).toBe('Arc');
    expect(DFNS_BASE_URLS).toEqual(['https://api.dfns.io', 'https://api.uae.dfns.io']);
  });
});

describe('decodeWallet [DF:get-wallet]', () => {
  it('decodes the archived example (network changed to ArcTestnet)', () => {
    expect(decodeWallet(j(walletFixture()))).toEqual({
      id: 'wa-1f04s-lqc9q-xxxxxxxxxxxxxxxx',
      network: 'ArcTestnet',
      address: '0x00e3495cf6af59008f22ffaf32d4c92ac33dac47',
      status: 'Active',
      vaultId: null,
    });
  });
  it('keeps an absent address as null and reads vaultId', () => {
    const w = walletFixture({ vaultId: 'vlt-5vbsp-u62g1-ostmunqgds5o9tc2' });
    delete w['address'];
    expect(decodeWallet(j(w))).toMatchObject({ address: null, vaultId: 'vlt-5vbsp-u62g1-ostmunqgds5o9tc2' });
  });
  it.each(['Inactive', 'Archived'])('accepts status %s', (status) => {
    expect(decodeWallet(j(walletFixture({ status }))).status).toBe(status);
  });
  it('rejects an unknown status and a malformed id', () => {
    expect(() => decodeWallet(j(walletFixture({ status: 'Deleted' })))).toThrow(new JsonShapeError('DFNS response shape: wallet status "Deleted"'));
    expect(() => decodeWallet(j(walletFixture({ id: 'wa-short' })))).toThrow('id: does not match');
    expect(() => decodeWallet(j([]))).toThrow('wallet: expected an object');
  });
});

describe('id and address patterns are anchored', () => {
  it.each([
    ['wallet id with a prefix', () => decodeWallet(j(walletFixture({ id: 'xwa-1f04s-lqc9q-xxxxxxxxxxxxxxxx' })))],
    ['wallet id with a long tail', () => decodeWallet(j(walletFixture({ id: 'wa-1f04s-lqc9q-xxxxxxxxxxxxxxxxx' })))],
    ['transfer id with a prefix', () => transfer({ id: 'axfr-20g4k-nsdpo-mg6arrifgvid4orn' })],
    ['transfer id with a long tail', () => transfer({ id: 'xfr-20g4k-nsdpo-mg6arrifgvid4ornab' })],
    ['approval id with a prefix', () => transfer({ approvalId: 'zap-2a9in-tt2a1-983lho480p35ejd0' })],
    ['approval id with a long tail', () => transfer({ approvalId: 'ap-2a9in-tt2a1-983lho480p35ejd0abc' })],
    ['tx hash with a prefix', () => transfer({ txHash: `z${HASH}` })],
    ['tx hash too long', () => transfer({ txHash: `${HASH}0` })],
    ['fee kind with a prefix', () => decodeFees(j({ ...feesFixture(), kind: 'XEip1559' }))],
    ['fee kind with a suffix', () => decodeFees(j({ ...feesFixture(), kind: 'Eip1559X' }))],
  ])('%s is refused', (_n, run) => {
    expect(run).toThrow(JsonShapeError);
  });
  it('addresses in bodies are anchored', () => {
    const to = '0xb282dc7cde21717f18337a596e91ded00b79b25f';
    expect(() => transferBodyText({ kind: 'Native', to: `zz${to}`, amount: '1', externalId: 'e' })).toThrow('to must be an EVM address');
    expect(() => transferBodyText({ kind: 'Native', to: `${to}0`, amount: '1', externalId: 'e' })).toThrow('to must be an EVM address');
  });
  it('decoder errors name the object', () => {
    expect(() => decodeTransfer(j([]))).toThrow('transferRequest: expected an object');
    expect(() => decodeFees(j([]))).toThrow('fees: expected an object');
    expect(() => decodeTransferPage(j([]))).toThrow('transfer list: expected an object');
    expect(() => decodeTransferPage(j({ walletId: 'wa-5pfuu-9euek-h0odgb6snva8ph3k' }))).toThrow('items: expected an array');
    expect(() => decodeChallenge(j([]))).toThrow('challenge: expected an object');
    expect(() => decodeChallenge(j({ challenge: 'c', challengeIdentifier: 'i' }))).toThrow('allowCredentials: expected an object');
    expect(() => decodeChallenge(j({ challenge: 'c', challengeIdentifier: 'i', allowCredentials: {} }))).toThrow('allowCredentials.key: expected an array');
    expect(() => decodeUserAction(j([]))).toThrow('user action: expected an object');
    expect(new DfnsBodyError('x').name).toBe('DfnsBodyError');
  });
});

describe('decodeFees [DF:fees]', () => {
  it('reads every tier as bigint wei', () => {
    expect(decodeFees(j({ ...feesFixture('99'), slow: { maxPriorityFeePerGas: '1', maxFeePerGas: '7' }, fast: { maxPriorityFeePerGas: '1', maxFeePerGas: '8' } }))).toEqual({
      network: 'ArcTestnet',
      slowMaxFeePerGas: 7n,
      standardMaxFeePerGas: 99n,
      fastMaxFeePerGas: 8n,
    });
  });
  it('fails closed on another fee kind, a missing tier or a non-integer string', () => {
    expect(() => decodeFees(j({ ...feesFixture(), kind: 'Bitcoin' }))).toThrow('kind: does not match');
    expect(() => decodeFees(j({ ...feesFixture(), standard: undefined }))).toThrow('standard: expected an object');
    expect(() => decodeFees(j(feesFixture('1.5')))).toThrow('maxFeePerGas: does not match');
    expect(() => decodeFees(j(feesFixture('1e9')))).toThrow(JsonShapeError);
  });
});

describe('decodeTransfer [DF:transfer TransferRequest]', () => {
  it('decodes the webhook example transfer and never reads the float quote', () => {
    const t = transfer();
    expect(t).toMatchObject({
      id: 'xfr-20g4k-nsdpo-mg6arrifgvid4orn',
      walletId: 'wa-5pfuu-9euek-h0odgb6snva8ph3k',
      network: 'ArcTestnet',
      status: 'Pending',
      txHash: null,
      externalId: null,
      replacementId: null,
      approvalId: null,
      reason: null,
      dateBroadcasted: null,
      details: null,
    });
    expect(t.requestBody.get('amount')).toBe('1000000000');
  });
  it('reads the optional fields', () => {
    const t = transfer({ status: 'Failed', txHash: HASH, externalId: 'e1', replacementId: 'r1', approvalId: 'ap-2a9in-tt2a1-983lho480p35ejd0', reason: 'boom', dateBroadcasted: '2023-04-14T20:41:28.715Z' });
    expect(t).toMatchObject({ txHash: HASH, externalId: 'e1', replacementId: 'r1', approvalId: 'ap-2a9in-tt2a1-983lho480p35ejd0', reason: 'boom', dateBroadcasted: '2023-04-14T20:41:28.715Z' });
  });
  it.each(['Pending', 'Executing', 'Broadcasted', 'Confirmed', 'Failed', 'Rejected'])('accepts status %s', (status) => {
    expect(transfer({ status }).status).toBe(status);
  });
  it('fails closed on unknown status and bad ids or hashes', () => {
    expect(() => transfer({ status: 'Aborted' })).toThrow('transfer status "Aborted"');
    expect(() => transfer({ id: 'xfr-bad' })).toThrow('id: does not match');
    expect(() => transfer({ walletId: 'wa-bad' })).toThrow('walletId: does not match');
    expect(() => transfer({ txHash: '0x1234' })).toThrow('txHash: does not match');
    expect(() => transfer({ approvalId: 'ap-x' })).toThrow('approvalId: does not match');
    expect(() => transfer({ requestBody: 'x' })).toThrow('requestBody: expected an object');
    expect(() => transfer({ details: 'x' })).toThrow('details: expected an object');
    expect(() => transfer({ details: null })).toThrow('details: expected an object');
  });
  it('keeps `details` verbatim [DF:transfer TransferRequest.details]', () => {
    expect(transfer({ details: { nonce: 7, gasLimit: '21000' } }).details?.get('gasLimit')).toBe('21000');
  });
  it('decodes a transfer page', () => {
    const p = decodeTransferPage(j({ walletId: 'wa-5pfuu-9euek-h0odgb6snva8ph3k', items: [transferFixture()], nextPageToken: 'n1' }));
    expect(p.items.map((t) => t.id)).toEqual(['xfr-20g4k-nsdpo-mg6arrifgvid4orn']);
    expect(p.nextPageToken).toBe('n1');
    expect(decodeTransferPage(j({ walletId: 'wa-5pfuu-9euek-h0odgb6snva8ph3k', items: [] })).nextPageToken).toBeNull();
    expect(() => decodeTransferPage(j({ walletId: 'x', items: [] }))).toThrow('walletId: does not match');
  });
});

describe('user-action decoders [DF:action-init, DF:action-sig]', () => {
  const challenge = { challenge: 'c1', challengeIdentifier: 'ci', allowCredentials: { key: [{ type: 'public-key', id: 'cred-1' }], webauthn: [] } };
  it('takes the first Key credential', () => {
    expect(decodeChallenge(j(challenge))).toEqual({ challenge: 'c1', challengeIdentifier: 'ci', credId: 'cred-1' });
  });
  it('fails closed without a Key credential or with empty fields', () => {
    expect(() => decodeChallenge(j({ ...challenge, allowCredentials: { key: [], webauthn: [] } }))).toThrow('allowCredentials.key is empty');
    expect(() => decodeChallenge(j({ ...challenge, challenge: '' }))).toThrow('challenge: does not match');
    expect(() => decodeChallenge(j({ ...challenge, challengeIdentifier: '' }))).toThrow('challengeIdentifier: does not match');
    expect(() => decodeChallenge(j({ ...challenge, allowCredentials: { key: [{ id: '' }] } }))).toThrow('id: does not match');
    expect(() => decodeChallenge(j({ ...challenge, allowCredentials: { key: ['x'] } }))).toThrow('allowCredentials.key[0]: expected an object');
  });
  it('reads userAction', () => {
    expect(decodeUserAction(j({ userAction: 'tok' }))).toBe('tok');
    expect(() => decodeUserAction(j({ userAction: '' }))).toThrow('userAction: does not match');
  });
});

describe('transferBodyText [DF:transfer request schemas]', () => {
  const to = '0xb282dc7cde21717f18337a596e91ded00b79b25f';
  it('builds a canonical Native body with priority Standard and nothing else', () => {
    expect(transferBodyText({ kind: 'Native', to, amount: '1000000000000000000', externalId: 'nv1-x' })).toBe(
      `{"amount":"1000000000000000000","externalId":"nv1-x","kind":"Native","priority":"Standard","to":"${to}"}`,
    );
  });
  it('builds an Erc20 body', () => {
    expect(transferBodyText({ kind: 'Erc20', contract: '0x3600000000000000000000000000000000000000', to, amount: '1', externalId: 'e' })).toBe(
      `{"amount":"1","contract":"0x3600000000000000000000000000000000000000","externalId":"e","kind":"Erc20","priority":"Standard","to":"${to}"}`,
    );
  });
  it.each([
    [{ kind: 'Native', to, amount: '1.5', externalId: 'e' }, 'amount must match'],
    [{ kind: 'Native', to, amount: '-1', externalId: 'e' }, 'amount must match'],
    [{ kind: 'Native', to: '0x12', amount: '1', externalId: 'e' }, 'to must be an EVM address'],
    [{ kind: 'Native', to, amount: '1', externalId: '' }, 'externalId must be 1–50'],
    [{ kind: 'Native', to, amount: '1', externalId: 'x'.repeat(51) }, 'externalId must be 1–50'],
    [{ kind: 'Erc20', contract: '0x36', to, amount: '1', externalId: 'e' }, 'contract must be an EVM address'],
  ] as const)('refuses a malformed body %#', (body, message) => {
    expect(() => transferBodyText(body)).toThrow(DfnsBodyError);
    expect(() => transferBodyText(body)).toThrow(message);
  });
  it('bodyDigest is sha256 of the exact body text (§7.3 SubmitMarker)', () => {
    const b = { kind: 'Native', to, amount: '1', externalId: 'e' } as const;
    const text = transferBodyText(b);
    expect(transferBodyDigest(b)).toBe(`0x${createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex')}`);
    expect(bodyTextDigest(text)).toBe(transferBodyDigest(b));
    expect(transferBodyDigest({ ...b, amount: '2' })).not.toBe(transferBodyDigest(b));
    expect(() => transferBodyDigest({ ...b, amount: '1.0' })).toThrow(DfnsBodyError);
  });
  it('accepts a 50-character externalId', () => {
    expect(transferBodyText({ kind: 'Native', to, amount: '1', externalId: 'x'.repeat(50) })).toContain('x'.repeat(50));
  });
});

describe('deterministic keys (§10.2)', () => {
  it('lp is a 4-byte big-endian UTF-8 length then the bytes', () => {
    expect(lengthPrefixed('ab').toString('hex')).toBe('000000026162');
    expect(lengthPrefixed('é').toString('hex')).toBe('00000002c3a9');
    expect(lengthPrefixed('').toString('hex')).toBe('00000000');
    expect(lengthPrefixed('x'.repeat(300)).subarray(0, 4).toString('hex')).toBe('0000012c');
  });
  it('lpDigestHex is sha256 over the concatenation', () => {
    const expected = createHash('sha256').update(Buffer.from('00000001610000000162', 'hex')).digest('hex');
    expect(lpDigestHex(['a', 'b'])).toBe(expected);
    expect(lpDigestHex(['a', 'b'])).not.toBe(lpDigestHex(['ab', '']));
  });
  it('externalId is nv1- + 40 hex of sha256(lp(paymentId) ‖ lp(\'1\')): one per payment (R3-B2)', () => {
    const pid = 'pay-0123456789abcdef0123456789abcdef';
    const expected = `nv1-${createHash('sha256').update(Buffer.concat([lengthPrefixed(pid), lengthPrefixed('1')])).digest('hex').slice(0, 40)}`;
    expect(ONLY_ATTEMPT).toBe(1n);
    expect(deriveExternalId(pid)).toBe(expected);
    expect(deriveExternalId(pid)).toHaveLength(44);
    expect(deriveExternalId('pay-ffffffffffffffffffffffffffffffff')).not.toBe(expected);
    expect(deriveExternalId('mov-0123456789abcdef0123456789abcdef')).not.toBe(expected);
  });
});

describe('signal keys (§10.3)', () => {
  it('dedupe key is per transfer state', () => {
    expect(transferDedupeKey(transfer())).toBe('dfns:transfer:xfr-20g4k-nsdpo-mg6arrifgvid4orn:Pending');
    expect(transferDedupeKey(transfer({ status: 'Executing' }))).toBe('dfns:transfer:xfr-20g4k-nsdpo-mg6arrifgvid4orn:Executing');
  });
  it('payload digest covers the projection and ignores dates, requester and metadata', () => {
    const base = transferPayloadDigest(transfer());
    expect(base).toMatch(/^0x[0-9a-f]{64}$/);
    expect(transferPayloadDigest(transfer({ dateRequested: '2030-01-01T00:00:00.000Z', requester: { userId: 'x' }, metadata: { asset: {} } }))).toBe(base);
    expect(transferPayloadDigest(transfer({ dateBroadcasted: '2030-01-01T00:00:00.000Z' }))).toBe(base);
    for (const over of [{ txHash: HASH }, { externalId: 'e' }, { replacementId: 'r' }, { network: 'Arc' }, { status: 'Executing' }, { walletId: 'wa-5pfuu-9euek-h0odgb6snva8ph3x' }, { id: 'xfr-20g4k-nsdpo-mg6arrifgvid4orx' }, { requestBody: { kind: 'Native', to: '0x', amount: '2' } }]) {
      expect(transferPayloadDigest(transfer(over)), JSON.stringify(over)).not.toBe(base);
    }
  });
  it('the digest is sha256 of the canonical projection with nulls', () => {
    const t = transfer();
    const projection =
      '{"externalId":null,"id":"' + t.id + '","network":"ArcTestnet","replacementId":null,' +
      '"requestBody":{"amount":"1000000000","kind":"Native","to":"0xb282dc7cde21717f18337a596e91ded00b79b25f"},' +
      '"status":"Pending","txHash":null,"walletId":"' + t.walletId + '"}';
    expect(transferPayloadDigest(t)).toBe(`0x${createHash('sha256').update(projection).digest('hex')}`);
  });
  it('ranks statuses in DFNS order', () => {
    expect(['Pending', 'Executing', 'Broadcasted', 'Confirmed', 'Failed', 'Rejected'].map((s) => transferStatusRank(s as DfnsTransfer['status']))).toEqual([1n, 2n, 3n, 4n, 4n, 4n]);
  });
});

describe('detailsNonce (§8.4 check 3 (c); Q-N20)', () => {
  const d = (v: unknown) => transfer({ details: v }).details;
  it('reads `nonce` as a JSON integer, a decimal string or a 0x hex string', () => {
    expect(detailsNonce(d({ nonce: 81 }))).toBe(81n);
    expect(detailsNonce(d({ nonce: 0 }))).toBe(0n);
    expect(detailsNonce(d({ nonce: '81' }))).toBe(81n);
    expect(detailsNonce(d({ nonce: '0x51' }))).toBe(81n);
    expect(detailsNonce(d({ nonce: '0X51' }))).toBeNull();
    expect(detailsNonce(d({ nonce: '0xZZ' }))).toBeNull();
    expect(detailsNonce(d({ nonce: 'x0x51' }))).toBeNull();
    expect(detailsNonce(d({ nonce: '0x51z' }))).toBeNull();
    expect(detailsNonce(d({ nonce: '0x51\n' }))).toBeNull();
  });
  it('anything else is unknown (null), never a guess', () => {
    expect(detailsNonce(null)).toBeNull();
    expect(detailsNonce(d({}))).toBeNull();
    expect(detailsNonce(d({ nonce: '0x' }))).toBeNull();
    expect(detailsNonce(d({ nonce: '' }))).toBeNull();
    expect(detailsNonce(d({ nonce: ' 81' }))).toBeNull();
    expect(detailsNonce(d({ nonce: '81 ' }))).toBeNull();
    expect(detailsNonce(d({ nonce: -1 }))).toBeNull();
    expect(detailsNonce(d({ nonce: 1.5 }))).toBeNull();
    expect(detailsNonce(d({ nonce: 1e3 }))).toBe(1000n);
    expect(detailsNonce(parseJson('{"nonce":1e3}') as JsonObject)).toBeNull();
    expect(detailsNonce(parseJson('{"nonce":-0}') as JsonObject)).toBeNull();
    expect(detailsNonce(d({ nonce: true }))).toBeNull();
    expect(detailsNonce(d({ nonce: { n: 1 } }))).toBeNull();
    expect(detailsNonce(d({ n: 1 }))).toBeNull();
  });
});

describe('mapTransferStatus (§8.6): input only, never COMPLETED, nothing released by a DFNS status alone', () => {
  const NO = { abortAccepted: false } as const;
  const ABORTED = { abortAccepted: true } as const;
  const XFR = 'xfr-20g4k-nsdpo-mg6arrifgvid4orn';
  it('Pending → PENDING_APPROVAL, Executing → APPROVED (with or without an abort on record)', () => {
    for (const ev of [NO, ABORTED]) {
      expect(mapTransferStatus(transfer(), ev)).toEqual({ kind: 'STAGE', stage: 'PENDING_APPROVAL', txHash: null, crossCheckOnly: false });
      expect(mapTransferStatus(transfer({ status: 'Executing' }), ev)).toEqual({ kind: 'STAGE', stage: 'APPROVED', txHash: null, crossCheckOnly: false });
    }
  });
  it('Broadcasted → SUBMITTED; Confirmed stays CONFIRMING as a cross-check only', () => {
    expect(mapTransferStatus(transfer({ status: 'Broadcasted', txHash: HASH }), NO)).toEqual({ kind: 'STAGE', stage: 'SUBMITTED', txHash: HASH, crossCheckOnly: false });
    expect(mapTransferStatus(transfer({ status: 'Confirmed', txHash: HASH }), NO)).toEqual({ kind: 'STAGE', stage: 'CONFIRMING', txHash: HASH, crossCheckOnly: true });
  });
  it('Rejected → proof (a1): REJECTED APPROVAL_DENIED, approval unverified (Q-N3); a hold only when details shows a nonce', () => {
    expect(mapTransferStatus(transfer({ status: 'Rejected' }), NO)).toEqual({
      kind: 'NEVER_SIGNED',
      proof: 'A1_REJECTED',
      stage: 'REJECTED',
      reason: 'APPROVAL_DENIED',
      approvalUnverified: true,
      nonceHold: null,
    });
    expect(mapTransferStatus(transfer({ status: 'Rejected', details: { nonce: '0x10' } }), NO)).toMatchObject({
      kind: 'NEVER_SIGNED',
      nonceHold: { dfnsTransferId: XFR, nonce: 16n, aborted: false },
    });
  });
  it('B5: a hash-less Failed without an accepted abort is NOT proof (a): stage unchanged, quarantine, nonce hold, nothing released', () => {
    const m = mapTransferStatus(transfer({ status: 'Failed', details: { nonce: 81 } }), NO);
    expect(m).toEqual({
      kind: 'FAILED_UNPROVEN',
      quarantine: true,
      nonceHold: { dfnsTransferId: XFR, nonce: 81n, aborted: false },
      detail: `hash-less Failed ${XFR} without an accepted abort is not proof (a); nonce 81`,
    });
    expect('stage' in m).toBe(false);
    const unknown = mapTransferStatus(transfer({ status: 'Failed' }), NO);
    expect(unknown).toMatchObject({ kind: 'FAILED_UNPROVEN', nonceHold: { nonce: null, aborted: false } });
    expect(unknown.kind === 'FAILED_UNPROVEN' ? unknown.detail : '').toContain('nonce unknown (Q-N20)');
  });
  it('a hash-less Failed after an accepted abort is proof (a2): CANCELLED_BY_OPERATOR, and the nonce hold still applies', () => {
    expect(mapTransferStatus(transfer({ status: 'Failed', details: { nonce: '5' } }), ABORTED)).toEqual({
      kind: 'NEVER_SIGNED',
      proof: 'A2_ABORT_ACCEPTED',
      stage: 'CANCELLED',
      reason: 'CANCELLED_BY_OPERATOR',
      approvalUnverified: false,
      nonceHold: { dfnsTransferId: XFR, nonce: 5n, aborted: true },
    });
    expect(mapTransferStatus(transfer({ status: 'Failed' }), ABORTED)).toMatchObject({ proof: 'A2_ABORT_ACCEPTED', nonceHold: { nonce: null, aborted: true } });
  });
  it('Failed with a txHash: the indexer decides (with or without dateBroadcasted)', () => {
    expect(mapTransferStatus(transfer({ status: 'Failed', txHash: HASH }), NO)).toEqual({ kind: 'HOLD_FOR_INDEXER', stage: 'CONFIRMING', txHash: HASH });
    expect(mapTransferStatus(transfer({ status: 'Failed', txHash: HASH, dateBroadcasted: '2023-04-14T20:41:28.715Z' }), NO)).toEqual({ kind: 'HOLD_FOR_INDEXER', stage: 'CONFIRMING', txHash: HASH });
  });
  it('B1 (lens R-1): Failed with dateBroadcasted but no txHash is FAILED_UNPROVEN (quarantine + nonce hold), never HOLD_FOR_INDEXER', () => {
    const at = '2023-04-14T20:41:28.715Z';
    expect(mapTransferStatus(transfer({ status: 'Failed', dateBroadcasted: at, details: { nonce: 7 } }), NO)).toEqual({
      kind: 'FAILED_UNPROVEN',
      quarantine: true,
      nonceHold: { dfnsTransferId: XFR, nonce: 7n, aborted: false },
      detail: `hash-less Failed ${XFR} broadcast trace dateBroadcasted ${at} but no txHash is not proof (a); nonce 7`,
    });
    expect(mapTransferStatus(transfer({ status: 'Failed', dateBroadcasted: at }), NO)).toMatchObject({
      kind: 'FAILED_UNPROVEN',
      quarantine: true,
      nonceHold: { dfnsTransferId: XFR, nonce: null, aborted: false },
    });
    // An accepted abort plus a broadcast trace stays an ANOMALY (DFNS aborts only unsigned transfers).
    expect(mapTransferStatus(transfer({ status: 'Failed', dateBroadcasted: at }), ABORTED)).toMatchObject({ kind: 'ANOMALY' });
  });
  it('no mapping is ever COMPLETED or carries DFNS_FAILED (that needs proof (c), F-3b)', () => {
    for (const status of ['Pending', 'Executing', 'Broadcasted', 'Confirmed', 'Failed', 'Rejected']) {
      for (const ev of [NO, ABORTED]) {
        const text = JSON.stringify(mapTransferStatus(transfer({ status, ...(status === 'Broadcasted' || status === 'Confirmed' ? { txHash: HASH } : {}) }), ev), (_k, v: unknown) => (typeof v === 'bigint' ? `${v}` : v));
        expect(text).not.toContain('COMPLETED');
        expect(text).not.toContain('DFNS_FAILED');
      }
    }
  });
  it.each([
    [{ status: 'Pending', txHash: HASH }, NO, 'Pending transfer'],
    [{ status: 'Executing', dateBroadcasted: '2023-04-14T20:41:28.715Z' }, NO, 'Executing transfer'],
    [{ status: 'Broadcasted' }, NO, 'Broadcasted transfer xfr-20g4k-nsdpo-mg6arrifgvid4orn has no txHash'],
    [{ status: 'Confirmed' }, NO, 'Confirmed transfer'],
    [{ status: 'Rejected', txHash: HASH }, NO, 'Rejected transfer'],
    [{ status: 'Rejected', dateBroadcasted: '2023-04-14T20:41:28.715Z' }, NO, 'Rejected transfer'],
    [{ status: 'Confirmed', txHash: HASH, replacementId: 'xfr-r' }, NO, 'replacement xfr-r'],
    [{ status: 'Failed', txHash: HASH }, ABORTED, 'abort accepted for xfr-20g4k-nsdpo-mg6arrifgvid4orn, but DFNS shows Failed with broadcast evidence'],
    [{ status: 'Failed', dateBroadcasted: '2023-04-14T20:41:28.715Z' }, ABORTED, 'with broadcast evidence'],
    [{ status: 'Broadcasted', txHash: HASH }, ABORTED, 'abort accepted'],
    [{ status: 'Rejected' }, ABORTED, 'abort accepted for xfr-20g4k-nsdpo-mg6arrifgvid4orn, but DFNS shows Rejected'],
  ] as const)('anomaly %#', (over, ev, detail) => {
    const m = mapTransferStatus(transfer(over), ev);
    expect(m.kind).toBe('ANOMALY');
    expect(m.kind === 'ANOMALY' ? m.detail : '').toContain(detail);
  });
  it('an abort on a Rejected transfer names no broadcast evidence', () => {
    const m = mapTransferStatus(transfer({ status: 'Rejected' }), ABORTED);
    expect(m.kind === 'ANOMALY' ? m.detail : '').not.toContain('broadcast');
  });
});
