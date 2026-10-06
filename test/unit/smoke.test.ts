/**
 * Skeleton smoke test: every module imports, exports exactly the names the
 * skeleton declares, and every stub fails closed with `not implemented: <unit>`.
 */
import { describe, expect, it } from 'vitest';
import * as amounts from '../../src/amounts/index.js';
import * as audit from '../../src/audit/index.js';
import * as cbs from '../../src/cbs/index.js';
import * as chainClient from '../../src/chain/client/index.js';
import * as chainConfig from '../../src/chain/config/index.js';
import * as compliance from '../../src/compliance/index.js';
import * as gas from '../../src/gas/index.js';
import * as inbound from '../../src/inbound/index.js';
import * as ingestion from '../../src/ingestion/index.js';
import * as outbound from '../../src/outbound/index.js';
import * as policy from '../../src/policy/index.js';
import * as recon from '../../src/recon/index.js';
import * as registry from '../../src/registry/index.js';
import * as signer from '../../src/signer/index.js';

const modules: Record<string, { mod: Record<string, unknown>; exports: string[] }> = {
  'src/amounts (U1)': {
    mod: amounts,
    exports: ['cbsMinor', 'usdcUnits', 'nativeWei', 'nativeWeiToCbsMinor', 'cbsMinorToNativeWei', 'nativeWeiToUsdcUnits', 'usdcUnitsToNativeWei', 'cbsPrecision'],
  },
  'src/chain/config (U2)': {
    mod: chainConfig,
    exports: ['ARC_TESTNET', 'ARC_MAINNET_DISABLED', 'REQUIRED_MAINNET_GATES', 'DEFAULT_GATES_FILE', 'MainnetGateError', 'assertMainnetAllowed', 'resolveChain'],
  },
  'src/chain/client (U3)': { mod: chainClient, exports: ['pageBlockRange', 'createChainReader'] },
  'src/ingestion (U4)': { mod: ingestion, exports: ['decodeLog', 'createIngestor'] },
  'src/registry (U5)': { mod: registry, exports: ['createAddressRegistry'] },
  'src/inbound (U6)': { mod: inbound, exports: ['createInboundFlow'] },
  'src/policy (U7)': { mod: policy, exports: ['createPolicyEngine'] },
  'src/compliance (U8)': { mod: compliance, exports: ['createAddressScreener', 'createTravelRuleChecker'] },
  'src/signer (U9)': { mod: signer, exports: ['MockSigner'] },
  'src/outbound (U10)': { mod: outbound, exports: ['createNonceWriter', 'createOutboundOrchestrator'] },
  'src/gas (U11)': { mod: gas, exports: ['receiptFeeWei', 'createGasTreasury'] },
  'src/recon (U12)': { mod: recon, exports: ['createReconciler', 'createCircuitBreaker'] },
  'src/audit (U13)': { mod: audit, exports: ['createAuditLog'] },
  'src/cbs (CBS port)': {
    mod: cbs,
    exports: ['REJECTED_CODES', 'canonical', 'deriveKey', 'subjectRef', 'caseReturnInstructionId', 'payloadDigest', 'buildLegs', 'createPostingTranslator'],
  },
};

const W = amounts.nativeWei(1n);
const U = amounts.usdcUnits(1n);
const C = amounts.cbsMinor(1n);
const P = 6 as amounts.CbsPrecision;

const stubs: [string, () => unknown][] = [
  ['U1', () => amounts.nativeWeiToCbsMinor(W, P)],
  ['U1', () => amounts.cbsMinorToNativeWei(C, P)],
  ['U1', () => amounts.nativeWeiToUsdcUnits(W)],
  ['U1', () => amounts.usdcUnitsToNativeWei(U)],
  ['U1', () => amounts.cbsPrecision(6)],
  ['U3', () => chainClient.pageBlockRange(0n, 1n, 9_999n)],
  ['U3', () => chainClient.createChainReader()],
  ['U4', () => ingestion.decodeLog({} as chainClient.RawLog)],
  ['U4', () => ingestion.createIngestor()],
  ['U5', () => registry.createAddressRegistry()],
  ['U6', () => inbound.createInboundFlow()],
  ['U7', () => policy.createPolicyEngine()],
  ['U8', () => compliance.createAddressScreener()],
  ['U8', () => compliance.createTravelRuleChecker()],
  ['U9', () => new signer.MockSigner()],
  ['U9', () => signer.MockSigner.prototype.acceptAttestation.call(null, {} as signer.MonitorAttestation)],
  ['U9', () => signer.MockSigner.prototype.sign.call(null, {} as signer.SignRequest)],
  ['U9', () => signer.MockSigner.prototype.deriveAddress.call(null, 'hot', 0n)],
  ['U10', () => outbound.createNonceWriter('hot')],
  ['U10', () => outbound.createOutboundOrchestrator()],
  ['U11', () => gas.receiptFeeWei({ gasUsed: 1n, effectiveGasPrice: W })],
  ['U11', () => gas.createGasTreasury()],
  ['U12', () => recon.createReconciler()],
  ['U12', () => recon.createCircuitBreaker()],
  ['U13', () => audit.createAuditLog()],
  ['CBS port keys', () => cbs.canonical(['arc1'])],
  ['CBS port keys', () => cbs.deriveKey({ name: 'K.mon', k: ['arc1', 'mon', 's', '0'] })],
  ['CBS port keys', () => cbs.subjectRef(['rail', '0'])],
  ['CBS port keys', () => cbs.caseReturnInstructionId('c', '0')],
  ['CBS port keys', () => cbs.payloadDigest({ amountWei: '1', asset: 'USDC', chainId: '5042002', destination: '0x', instructionId: 'i' })],
  ['CBS translator', () => cbs.buildLegs({ template: 'T1', amount: C, fee: amounts.cbsMinor(0n) })],
  ['CBS translator', () => cbs.createPostingTranslator({} as cbs.CbsPort)],
];

// A unit is "implemented" once none of its skeleton stubs throws `not implemented: <unit>` any more
// (Phase 3 replaces stubs with real code). Implemented units must still export every name the
// skeleton declared (new exports allowed; their own unit tests and verifier cover behaviour).
// Units still in skeleton form keep the exact-export and fail-closed checks below.
function stillStubbed(unit: string): boolean {
  return stubs.some(([u, call]) => {
    if (u !== unit) return false;
    try { call(); return false; } catch (e) { return e instanceof Error && e.message === `not implemented: ${unit}`; }
  });
}
function unitOf(name: string): string {
  return name.slice(name.indexOf('(') + 1, name.lastIndexOf(')'));
}

describe('every module exports its declared names (exactly, while still a skeleton stub)', () => {
  it.each(Object.entries(modules))('%s', (name, { mod, exports }) => {
    const unit = unitOf(name);
    const stubUnits = new Set(stubs.map(([u]) => u));
    const exact = !stubUnits.has(unit) || stillStubbed(unit);
    if (exact) expect(Object.keys(mod).sort()).toEqual([...exports].sort());
    else for (const e of exports) expect(Object.keys(mod)).toContain(e);
  });
});

describe('every remaining stub fails closed with its unit name', () => {
  it.each(stubs.map(([unit, call], i) => [`${i}: ${unit}`, unit, call] as const))('%s', (_label, unit, call) => {
    if (!stillStubbed(unit)) return; // unit implemented in Phase 3; covered by its own tests
    expect(call).toThrow(new Error(`not implemented: ${unit}`));
  });
});

describe('CBS port result model (CONTRACT §1.4)', () => {
  it('REJECTED codes are exactly the closed list', () => {
    expect([...cbs.REJECTED_CODES]).toEqual([
      'INVALID',
      'UNIT_MISMATCH',
      'CHAIN_NOT_ENABLED',
      'UNKNOWN_ACCOUNT',
      'ACCOUNT_BLOCKED',
      'ACCOUNT_CLOSED',
      'INSUFFICIENT_FUNDS',
      'UNBALANCED',
      'ZERO_AMOUNT',
      'NOT_PERMITTED',
      'HOLD_NOT_FOUND',
      'HOLD_STATE',
      'BINDING_MISMATCH',
    ]);
    expect(Object.isFrozen(cbs.REJECTED_CODES)).toBe(true);
  });
});
