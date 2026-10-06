/**
 * RUBRIC MC-01: the money-path float lint (tools/lint-money-floats.mjs) is
 * clean on the repository and fails on every planted float. Each plant goes
 * into a temp copy of src/ (never into the repository) and must fail with its
 * own rule.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { lintMoneyFloats } from '../../tools/lint-money-floats.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'arc-mc01-')));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** sha256 of every file under dir (sorted path → content hash); symlinks are refused. */
function treeHash(dir: string): string {
  const h = createHash('sha256');
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((x, y) => (x.name < y.name ? -1 : 1))) {
      const p = join(d, e.name);
      if (e.isSymbolicLink()) throw new Error(`unexpected symlink ${p}`);
      if (e.isDirectory()) walk(p);
      else h.update(`${p}\0${createHash('sha256').update(readFileSync(p)).digest('hex')}\n`);
    }
  };
  walk(dir);
  return h.digest('hex');
}
// Guard: the plant suite must never change the real src/ (checked by the last test of this file).
const SRC_BEFORE = treeHash(join(ROOT, 'src'));

/** Refuse any write that does not resolve to a regular file or new path strictly inside the scratch dir. */
function assertInScratch(path: string): void {
  const abs = resolve(path);
  let real: string;
  try {
    if (lstatSync(abs).isSymbolicLink()) throw new Error(`plant target is a symlink: ${abs}`);
    real = realpathSync(abs);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    real = join(realpathSync(resolve(abs, '..')), abs.split(sep).pop() as string);
  }
  if (!real.startsWith(scratch + sep)) throw new Error(`refusing to write outside the scratch dir: ${real}`);
}

let n = 0;
/**
 * A temp copy (real files, never symlinks) of src/ and docs/MONEY_PATH.md
 * with `code` appended to `target` (and to each `also` file). Every write is
 * checked to land inside the mkdtemp scratch dir.
 */
function plantedCopy(target: string, code: string, also: Readonly<Record<string, string>> = {}, doc?: (md: string) => string): string {
  n += 1;
  const root = join(scratch, `copy-${n}`);
  assertInScratch(root);
  mkdirSync(join(root, 'docs'), { recursive: true });
  cpSync(join(ROOT, 'src'), join(root, 'src'), { recursive: true, dereference: true, verbatimSymlinks: false });
  treeHash(join(root, 'src')); // throws if the copy holds any symlink
  const md = readFileSync(join(ROOT, 'docs/MONEY_PATH.md'), 'utf8');
  assertInScratch(join(root, 'docs/MONEY_PATH.md'));
  writeFileSync(join(root, 'docs/MONEY_PATH.md'), doc ? doc(md) : md);
  for (const [file, extra] of Object.entries({ ...also, [target]: code })) {
    assertInScratch(join(root, file));
    appendFileSync(join(root, file), `\n${extra}\n`);
  }
  return root;
}

describe('MC-01 money-path float lint', () => {
  it('the repository money path is clean', () => {
    const { files, findings } = lintMoneyFloats(ROOT);
    expect(files).toBeGreaterThanOrEqual(13);
    expect(findings).toEqual([]);
  });

  it.each([
    // round 1
    ['src/amounts/index.ts', 'export const p1 = (x: number): CbsMinor => cbsMinor(BigInt(Math.floor(x * 100)));', 'MC01-math'],
    ['src/amounts/index.ts', "export const p2 = Number('12');", 'MC01-number-call'],
    ['src/amounts/index.ts', "export const p3 = parseFloat('1');", 'MC01-number-call'],
    ['src/amounts/index.ts', "export const p4 = parseInt('100', 10);", 'MC01-number-call'],
    ['src/amounts/index.ts', "export const p5 = Number.parseFloat('1');", 'MC01-number-call'],
    ['src/gas/index.ts', 'export const p6 = (x: number): string => x.toFixed(2);', 'MC01-to-fixed'],
    ['src/cbs/translator.ts', 'export const p7 = 0.1;', 'MC01-float-literal'],
    ['src/cbs/keys.ts', 'export const p8 = 1e-6;', 'MC01-float-literal'],
    ['src/recon/index.ts', 'export const p9 = (a: bigint, b: number): number => Number(a) / b;', 'MC01-non-bigint-div'],
    ['src/policy/index.ts', 'export const p10 = (a: number): number => a / 3;', 'MC01-non-bigint-div'],
    ['src/outbound/index.ts', 'export function p11(a: number): number { let x = a; x /= 2; return x; }', 'MC01-non-bigint-div'],
    ['src/chain/client/index.ts', 'export const p12 = (a: number): number => a ** -1;', 'MC01-non-bigint-pow'],
    // round 2 (verifier F1–F8 and the coordinator's forms)
    ['src/amounts/index.ts', 'declare const hex: string;\nexport const f1 = nativeWei(BigInt(+hex));', 'MC01-unary-plus'],
    ['src/amounts/index.ts', 'declare const s: string;\nexport const f2 = cbsMinor(BigInt((+s * 100) | 0));', 'MC01-unary-plus'],
    ['src/amounts/index.ts', 'declare const s: string;\nexport const f2b = cbsMinor(BigInt((+s * 100) | 0));', 'MC01-non-bigint-bitwise'],
    ['src/amounts/index.ts', 'export const f2c = BigInt(("1.15" as unknown as number * 100) | 0);', 'MC01-non-bigint-bitwise'],
    ['src/amounts/index.ts', 'export const f2d = BigInt(("1.15" as unknown as number * 100) | 0);', 'MC01-non-bigint-arith'],
    ['src/amounts/index.ts', 'declare const x: number;\nexport const f3 = globalThis.Math.floor(x * 100);', 'MC01-math'],
    ['src/amounts/index.ts', 'declare const x: number;\nexport const f3b = globalThis.Math.floor(x * 100);', 'MC01-global-object'],
    ['src/amounts/index.ts', 'declare const s: string;\nexport const f4 = globalThis.Number(s);', 'MC01-number-call'],
    ['src/amounts/index.ts', "declare const s: string;\nexport const f4b = globalThis['Number'](s);", 'MC01-number-call'],
    ['src/amounts/index.ts', "declare const g: Record<string, (v: string) => bigint>;\nexport const f4c = g['parseInt']?.('1');", 'MC01-number-call'],
    ['src/amounts/index.ts', 'declare const s: string;\nexport const f5 = (JSON.parse(s) as number) * 100;', 'MC01-json-parse'],
    ['src/amounts/index.ts', 'declare const s: string;\nexport const f5b = (JSON.parse(s) as number) * 100;', 'MC01-non-bigint-arith'],
    ['src/amounts/index.ts', 'declare const x: number;\nexport const f6 = ~~(x * 100);', 'MC01-non-bigint-bitwise'],
    ['src/amounts/index.ts', 'declare const x: number;\nexport const f8 = x * 100 - (x * 100) % 1;', 'MC01-non-bigint-arith'],
    ['src/amounts/index.ts', 'declare const x: number;\nexport const f9 = x >>> 0;', 'MC01-non-bigint-bitwise'],
    ['src/amounts/index.ts', 'export function f10(a: number): number { let y = a; y++; return y; }', 'MC01-non-bigint-arith'],
    ['src/amounts/index.ts', 'declare const x: number;\nexport const f11 = -x;', 'MC01-non-bigint-arith'],
    ['src/amounts/index.ts', "const { floor } = Math;\nexport const f12 = floor;", 'MC01-math'],
    ['src/amounts/index.ts', 'declare const x: number;\nexport const f13 = BigInt(x);', 'MC01-bigint-from-number'],
    ['src/amounts/index.ts', 'declare const v: any;\nexport const f14 = v;', 'MC01-any'],
    // the "grep for float types"
    ['src/gas/index.ts', 'export const t1: number = 5;', 'MC01-number-type'],
    ['src/gas/index.ts', "export const t2 = 'abc'.length;", 'MC01-number-type'],
    ['src/gas/index.ts', 'export function t3() { return 1; }', 'MC01-number-type'],
    ['src/gas/index.ts', 'export interface T4 { readonly feeRate: number }', 'MC01-number-type'],
    ['src/gas/index.ts', 'export type T5 = readonly number[];', 'MC01-number-type'],
    ['src/gas/index.ts', 'export const t6 = (amount: bigint, rate: number): bigint => amount;', 'MC01-number-type'],
    // round 3 (verifier m15: Z1/Z2, N1/N2, A1/A9/A12, A5/A10, A6/A7)
    ['src/amounts/index.ts', 'declare const s: unknown;\nexport function z1(): CbsMinor { const p = s as number; return cbsMinor(BigInt(p)); }', 'MC01-number-assertion'],
    ['src/amounts/index.ts', 'declare const s: unknown;\nexport function z1b(): CbsMinor { const p = s as number; return cbsMinor(BigInt(p)); }', 'MC01-number-type'],
    ['src/amounts/index.ts', 'declare const s: unknown;\nexport function z1c(): CbsMinor { const p = s as number; return cbsMinor(BigInt(p)); }', 'MC01-bigint-from-number'],
    ['src/amounts/index.ts', 'export const z2 = (p: number, _p: number): CbsMinor => cbsMinor(BigInt((p * _p) | _p));', 'MC01-number-type'],
    ['src/amounts/index.ts', 'export const z2b = (p: number, _p: number): CbsMinor => cbsMinor(BigInt((p * _p) | _p));', 'MC01-bigint-from-number'],
    ['src/amounts/index.ts', 'export const z2c = (p: number, _p: number): CbsMinor => cbsMinor(BigInt((p * _p) | _p));', 'MC01-non-bigint-bitwise'],
    ['src/amounts/index.ts', 'export const p = 5;', 'MC01-number-type'],
    ['src/signer/index.ts', 'export interface Z3 { readonly chainId: number }', 'MC01-number-type'],
    ['src/chain/client/index.ts', 'export interface Z4 { readonly code: number }', 'MC01-number-type'],
    ['src/amounts/index.ts', 'declare const a: unknown;\nexport const n1 = nativeWei(BigInt(String(a as number)));', 'MC01-number-assertion'],
    ['src/amounts/index.ts', 'declare const a: unknown;\nexport const n1b = nativeWei(BigInt(String(a as number)));', 'MC01-number-expr'],
    ['src/amounts/index.ts', 'declare const a: unknown;\nexport const n2 = nativeWei(BigInt((a as number).toString()));', 'MC01-number-assertion'],
    ['src/amounts/index.ts', 'declare const a: unknown;\nexport const n3 = nativeWei(BigInt(String(<number>a)));', 'MC01-number-assertion'],
    ['src/amounts/index.ts', 'export const n4 = nativeWei(BigInt(String(7 satisfies number)));', 'MC01-number-assertion'],
    ['src/amounts/index.ts', 'declare const s: unknown;\nexport const n5 = s as CbsPrecision;', 'MC01-number-assertion'],
    ['src/amounts/index.ts', 'declare const dv: DataView;\nexport const a6 = nativeWei(BigInt(String(dv.getFloat64(0))));', 'MC01-number-expr'],
    ['src/amounts/index.ts', 'declare const dv: DataView;\nexport const a7 = nativeWei(BigInt(`${dv.getFloat64(0)}`));', 'MC01-number-expr'],
    ['src/amounts/index.ts', 'declare const r: Response;\nexport const a1 = async (): Promise<NativeWei> => nativeWei(BigInt(((await r.json()) as { result: string }).result));', 'MC01-json-parse'],
    ['src/cbs/translator.ts', 'declare const r: Response;\nexport const a9 = async (): Promise<string> => { const body: unknown = await r.json(); return (body as { v: string }).v; };', 'MC01-json-parse'],
    ['src/cbs/translator.ts', "declare const r: Response;\nexport const a12 = async (): Promise<unknown> => r['json']();", 'MC01-json-parse'],
    ['src/amounts/index.ts', 'declare const hex: string;\nexport const a5 = nativeWei(BigInt(((0).constructor as (s: string) => string)(hex)));', 'MC01-constructor'],
    ['src/amounts/index.ts', 'export const a10 = (() => 0n).constructor as new (b: string) => () => bigint;', 'MC01-constructor'],
    ['src/amounts/index.ts', "export const a10b = (0n)['constructor'];", 'MC01-constructor'],
    ['src/amounts/index.ts', 'export const a10c = (x: bigint): unknown => { const { constructor: c } = x; return c; };', 'MC01-constructor'],
  ])('a plant in %s fails: %s', (target, code, rule) => {
    const { findings } = lintMoneyFloats(plantedCopy(target, code));
    expect(findings.map((f) => `${f.file} ${f.rule}`)).toContain(`${target} ${rule}`);
  });

  it('A8: a number type declared in an excluded module is caught where it is used', () => {
    const root = plantedCopy(
      'src/policy/index.ts',
      "import type { Limits } from '../registry/index.js';\nexport const a8 = (a: bigint, l: Limits): boolean => a > l.perTxMinor;",
      { 'src/registry/index.ts': 'export interface Limits { readonly perTxMinor: number }' },
    );
    const got = lintMoneyFloats(root).findings.map((f) => `${f.file} ${f.rule} ${f.text}`);
    expect(got.some((g) => g.startsWith('src/policy/index.ts MC01-number-expr l.perTxMinor'))).toBe(true);
  });

  it('an allow-list row must name exactly one declaration (a rename or a local fails closed)', () => {
    const renamed = plantedCopy('src/amounts/index.ts', '', {}, (md) => md.replace('| `cbsPrecision(0)` |', '| `cbsPrecision(1)` |'));
    expect(() => lintMoneyFloats(renamed)).toThrow(/exactly one declaration: src\/amounts\/index\.ts#cbsPrecision\(1\) \(0\)/);
    const local = plantedCopy('src/amounts/index.ts', 'export function z5(): bigint { const q = 1; return BigInt(q); }', {}, (md) =>
      md.replace('| `cbsPrecision(0)` |', '| `z5.q` |'),
    );
    expect(() => lintMoneyFloats(local)).toThrow(/z5\.q \(0\)/);
  });

  it('the recomputed losses the plants model are real', () => {
    // F1: ToNumber of an RPC hex quantity above 2^53 drops wei.
    expect(BigInt(+'0x1bc16d674ec80001')).toBe(2000000000000000000n);
    expect(BigInt('0x1bc16d674ec80001')).toBe(2000000000000000001n);
    // coordinator form: "1.15" * 100 truncated with |0 gives 114, not 115.
    expect(BigInt(((('1.15' as unknown as number) * 100) | 0))).toBe(114n);
  });

  it('an allow-listed name may be a number and an operand, and nothing else may', () => {
    const ok = plantedCopy('src/amounts/index.ts', 'export const scale = (p: CbsPrecision): bigint => 10n ** BigInt(p + 1);');
    expect(lintMoneyFloats(ok).findings).toEqual([]);
    const div = plantedCopy('src/amounts/index.ts', 'export const half = (p: CbsPrecision): bigint => BigInt(p / 2);');
    expect(lintMoneyFloats(div).findings.map((f) => f.rule)).toContain('MC01-non-bigint-div');
    const len = plantedCopy('src/amounts/index.ts', 'export const fromLen = (h: string): CbsMinor => cbsMinor(BigInt(h.length));');
    expect(lintMoneyFloats(len).findings.map((f) => f.rule)).toContain('MC01-bigint-from-number');
    const bad = plantedCopy('src/amounts/index.ts', 'export const scale2 = (q: number): bigint => 10n ** BigInt(q + 1);');
    expect(lintMoneyFloats(bad).findings.map((f) => f.rule)).toEqual(
      expect.arrayContaining(['MC01-number-type', 'MC01-non-bigint-arith', 'MC01-bigint-from-number']),
    );
  });

  it('bigint arithmetic, string concatenation, negative literals and JSON.stringify are not flagged', () => {
    const root = plantedCopy(
      'src/amounts/index.ts',
      [
        'export const ok1 = (w: bigint, k: bigint): bigint => w / k;',
        'export const ok2 = (w: NativeWei): bigint => w / 1_000_000_000_000n;',
        'export const ok3 = (a: bigint, b: bigint): bigint => (a * b + a % b - -a) | (a << 2n) ^ ~b;',
        "export const ok4 = (id: string, n: bigint): string => 'arc1-' + id + n;",
        'export const ok5 = JSON.stringify({ a: 1n.toString() });',
        "export const ok6 = BigInt('0x1bc16d674ec80001');",
        'export const ok7 = -32014 === -32014;',
        "export const ok8 = (h: string): boolean => h.length === 66 && h.split('').length > 2;",
        'export const ok9 = (p: CbsPrecision): boolean => p > 2 && p % 2 === 0 && BigInt(p) < 19n;',
      ].join('\n'),
    );
    expect(lintMoneyFloats(root).findings).toEqual([]);
  });

  it('guard: the plant suite left the real src/ unchanged', () => {
    expect(treeHash(join(ROOT, 'src'))).toBe(SRC_BEFORE);
  });
});
