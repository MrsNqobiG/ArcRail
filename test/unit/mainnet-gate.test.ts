/**
 * RUBRIC MC-20: mainnet configuration is unreachable while any G-M gate is
 * unsigned, and the gate check passes only when every G-M row is SIGNED-OFF.
 *
 * Every gates file used here is a synthetic fixture generated in a temp dir
 * at test time (never written into the repository), so these tests stay green
 * when humans legitimately sign the real docs/GATES.md. Even with every gate
 * signed, `resolveChain(5042)` still refuses, because the mainnet entry is
 * disabled in code. Content-only acceptance is not provenance: whether a
 * SIGNED-OFF line was written by the named human is MC-42 (git provenance),
 * a separate control.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  ARC_MAINNET_DISABLED,
  ARC_TESTNET,
  DEFAULT_GATES_FILE,
  MainnetGateError,
  REQUIRED_MAINNET_GATES,
  assertMainnetAllowed,
  resolveChain,
} from '../../src/chain/config/index.js';

const dir = mkdtempSync(join(tmpdir(), 'arc-gates-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

let counter = 0;
function fixture(content: string): string {
  counter += 1;
  const file = join(dir, `GATES-${counter}.md`);
  writeFileSync(file, content);
  return file;
}

interface Row {
  readonly gate: string;
  readonly status: string;
  readonly name?: string;
  readonly role?: string;
  readonly date?: string;
}

/** A gates document in the real layout (Gate | Requirement | Status | Name | Role | Date). */
function gatesDoc(rows: readonly Row[]): string {
  return [
    '# GATES (synthetic test fixture)',
    '',
    '| Gate | Meaning | Status | Name | Role | Date |',
    '|---|---|---|---|---|---|',
    '| G1 | phase gate, not a mainnet gate | SIGNED-OFF | A | B | 2026-01-01 |',
    '',
    '| Gate | Requirement | Status | Name | Role | Date |',
    '|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.gate} | "requirement text" | ${r.status} | ${r.name ?? ''} | ${r.role ?? ''} | ${r.date ?? ''} |`),
    '',
  ].join('\n');
}

const signed = (gate: string): Row => ({ gate, status: 'SIGNED-OFF', name: 'Test Person', role: 'Test Role', date: '2026-01-01' });
const unsigned = (gate: string): Row => ({ gate, status: 'NOT SIGNED' });
const allSigned = (): Row[] => REQUIRED_MAINNET_GATES.map(signed);
const allUnsigned = (): Row[] => REQUIRED_MAINNET_GATES.map(unsigned);
const replace = (rows: Row[], gate: string, row: Row): Row[] => rows.map((r) => (r.gate === gate ? row : r));

describe('assertMainnetAllowed (MC-20)', () => {
  it('throws on a fully unsigned gates file', () => {
    const file = fixture(gatesDoc(allUnsigned()));
    expect(() => assertMainnetAllowed(file)).toThrow(MainnetGateError);
    expect(() => assertMainnetAllowed(file)).toThrow(/mainnet refused: G-M 1: status is "NOT SIGNED"/);
  });

  it('passes when every G-M row is SIGNED-OFF with name, role and date', () => {
    expect(() => assertMainnetAllowed(fixture(gatesDoc(allSigned())))).not.toThrow();
  });

  it.each(REQUIRED_MAINNET_GATES.map((g) => [g]))('throws when only %s is unsigned', (gate) => {
    const file = fixture(gatesDoc(replace(allSigned(), gate, unsigned(gate))));
    expect(() => assertMainnetAllowed(file)).toThrow(new RegExp(`${gate}: status is "NOT SIGNED"`));
  });

  it('throws when a G-M row is deleted', () => {
    const rows = allSigned().filter((r) => r.gate !== 'G-M 8');
    expect(() => assertMainnetAllowed(fixture(gatesDoc(rows)))).toThrow(/G-M 8: expected exactly one row, found 0/);
  });

  it('throws when a G-M row is duplicated', () => {
    const rows = [...allSigned(), signed('G-M 3')];
    expect(() => assertMainnetAllowed(fixture(gatesDoc(rows)))).toThrow(/G-M 3: expected exactly one row, found 2/);
  });

  it('throws on an unexpected G-M row', () => {
    const rows = [...allSigned(), signed('G-M 9')];
    expect(() => assertMainnetAllowed(fixture(gatesDoc(rows)))).toThrow(/G-M 9: unexpected gate row/);
  });

  it.each([
    ['name', { ...signed('G-M 2'), name: '' }],
    ['role', { ...signed('G-M 2'), role: '' }],
    ['date', { ...signed('G-M 2'), date: '' }],
  ])('throws when a SIGNED-OFF row has no %s', (_field, row) => {
    const file = fixture(gatesDoc(replace(allSigned(), 'G-M 2', row)));
    expect(() => assertMainnetAllowed(file)).toThrow(/G-M 2: SIGNED-OFF without name, role and date/);
  });

  it('does not accept look-alike statuses', () => {
    for (const status of ['signed-off', 'SIGNED OFF', 'SIGNED-OFF (pending)', 'NOT SIGNED-OFF', '**SIGNED-OFF**']) {
      const file = fixture(gatesDoc(replace(allSigned(), 'G-M 5', { ...signed('G-M 5'), status })));
      expect(() => assertMainnetAllowed(file)).toThrow(/G-M 5: status is/);
    }
  });

  it('a reformatted gate cell drops out as missing (fails closed)', () => {
    const file = fixture(gatesDoc(replace(allSigned(), 'G-M 4', { ...signed('G-M 4'), gate: '**G-M 4**' })));
    expect(() => assertMainnetAllowed(file)).toThrow(/G-M 4: expected exactly one row, found 0/);
  });

  it('throws when the gates file cannot be read', () => {
    expect(() => assertMainnetAllowed(join(dir, 'missing.md'))).toThrow(/mainnet refused: cannot read gates file/);
  });

  it('throws on an empty gates file', () => {
    expect(() => assertMainnetAllowed(fixture(''))).toThrow(/G-M 1: expected exactly one row, found 0/);
  });
});

describe('the real docs/GATES.md keeps the layout the gate check parses', () => {
  // Structure only, never signing state, so these hold before and after humans sign.
  const real = readFileSync(DEFAULT_GATES_FILE, 'utf8');

  it('has exactly the eight required G-M rows, in a Gate | Requirement | Status | Name | Role | Date table', () => {
    const rows = real.split('\n').filter((l) => /^\|\s*G-M\s*\d+\s*\|/.test(l));
    expect(rows).toHaveLength(8);
    expect(REQUIRED_MAINNET_GATES).toEqual(['G-M 1', 'G-M 2', 'G-M 3', 'G-M 4', 'G-M 5', 'G-M 6', 'G-M 7', 'G-M 8']);
    expect(real).toContain('| Gate | Requirement | Status | Name | Role | Date |');
    for (const row of rows) expect(row.split('|').length - 2).toBe(6);
  });

  it('resolveChain(5042) refuses with the real file, whatever its signing state', () => {
    expect(() => resolveChain(ARC_MAINNET_DISABLED.chainId)).toThrow(MainnetGateError);
    expect(() => resolveChain(ARC_MAINNET_DISABLED.chainId)).toThrow(/^mainnet refused: /);
  });
});

describe('resolveChain (U2)', () => {
  it('resolves testnet 5042002 to the cited testnet config', () => {
    const cfg = resolveChain(5042002);
    expect(cfg).toBe(ARC_TESTNET);
    expect(cfg.enabled).toBe(true);
  });

  it('refuses mainnet on an unsigned gates file (gate check runs first)', () => {
    const file = fixture(gatesDoc(allUnsigned()));
    expect(() => resolveChain(ARC_MAINNET_DISABLED.chainId, file)).toThrow(/mainnet refused: G-M 1: status is "NOT SIGNED"/);
  });

  it('still refuses mainnet when every gate is signed, because the entry is disabled in code', () => {
    const file = fixture(gatesDoc(allSigned()));
    expect(() => assertMainnetAllowed(file)).not.toThrow();
    expect(() => resolveChain(ARC_MAINNET_DISABLED.chainId, file)).toThrow(
      new MainnetGateError('mainnet refused: disabled in code (enabled: false)'),
    );
    let returned: unknown = 'nothing';
    try {
      returned = resolveChain(ARC_MAINNET_DISABLED.chainId, file);
    } catch {
      // expected
    }
    expect(returned).toBe('nothing');
  });

  it('refuses any other chain', () => {
    expect(() => resolveChain(1)).toThrow(new MainnetGateError('chain 1 is not enabled'));
  });

  it('the mainnet entry is disabled and carries no endpoint', () => {
    expect(ARC_MAINNET_DISABLED).toEqual({ name: 'arc-mainnet', enabled: false, chainId: 5042 });
    expect(Object.isFrozen(ARC_MAINNET_DISABLED)).toBe(true);
  });
});

describe('testnet constants match docs/constants.md (re-read, not copied)', () => {
  const constants = readFileSync(new URL('../../docs/constants.md', import.meta.url), 'utf8');
  const row = (id: string): string => constants.split('\n').find((l) => l.startsWith(`| ${id} |`)) ?? '';

  it.each([
    ['C-01', String(ARC_TESTNET.chainId)],
    ['C-03', ARC_TESTNET.rpcHttp],
    ['C-03', ARC_TESTNET.rpcWs],
    ['C-06', ARC_TESTNET.explorer],
    ['C-12', ARC_TESTNET.usdcErc20Address],
    ['C-20', ARC_TESTNET.systemEmitter],
    ['C-21', ARC_TESTNET.transferTopic0],
    ['C-30', ARC_TESTNET.feeFloorWei.toLocaleString('en-US').replaceAll(',', '_')],
    ['C-32', '30,000,000'],
    ['C-40', '9,999'],
    ['C-40', String(ARC_TESTNET.rpcErrorRangeTooLarge)],
    ['C-41', String(ARC_TESTNET.rpcErrorResultCapObserved)],
    ['C-42', String(ARC_TESTNET.rpcErrorHeadLag)],
    ['C-60', String(ARC_TESTNET.cctpDomain)],
  ])('%s contains %s', (id, value) => {
    expect(row(id)).toContain(value);
  });

  it('decimals and limits', () => {
    expect(row('C-10')).toContain(`\`${ARC_TESTNET.nativeDecimals}\``);
    expect(row('C-11')).toContain(`\`${ARC_TESTNET.usdcErc20Decimals}\``);
    expect(ARC_TESTNET.blockGasLimit).toBe(30_000_000n);
    expect(ARC_TESTNET.getLogsMaxBlocksPerPage).toBe(9_999n);
    expect(ARC_TESTNET.maxBaseFeeWei).toBe(20_000n * 1_000_000_000n);
    expect(row('C-31')).toContain('20,000 gwei');
    expect(ARC_TESTNET.erc20TransferEmitsTwoLogs).toBe(true);
    expect(ARC_TESTNET.eip155Required).toBe(true);
    expect(ARC_TESTNET.nativeSymbol).toBe('USDC');
    expect(ARC_TESTNET.name).toBe('arc-testnet');
    expect(Object.isFrozen(ARC_TESTNET)).toBe(true);
  });
});
