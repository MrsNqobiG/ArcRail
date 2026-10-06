/**
 * U1: no module other than the conversion module (src/amounts/index.ts)
 * re-brands a raw arithmetic result as an amount (CLAUDE.md "Conversions
 * happen in exactly one module", RUBRIC MC-03). The rule is in
 * test/unit/amounts-rebrand-lint.ts. Every plant goes into a temp copy of src/
 * (never into the repository) and must be flagged with its own rule; every
 * sanctioned form must stay clean.
 */
import { appendFileSync, cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { lintRebrands } from './amounts-rebrand-lint.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), 'arc-u1-rebrand-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const HEADER = [
  "import { addNativeWei, cbsMinor, nativeWei, usdcUnits } from './amounts/index.js';",
  "import * as amounts from './amounts/index.js';",
  "import { nativeWei as nw } from './amounts/index.js';",
  "import type { CbsMinor, NativeToCbsResult, NativeWei, UsdcUnits } from './amounts/index.js';",
  'declare const a: bigint;',
  'declare const b: bigint;',
  'declare const wa: NativeWei;',
  'declare const wb: NativeWei;',
  'declare const xs: readonly bigint[];',
  'declare const hex: `0x${string}`;',
  'declare const parts: readonly string[];',
  'declare const i: number;',
].join('\n');

let n = 0;
/** A temp copy of src/ with one extra module `src/zz-plant.ts`. */
function plantedCopy(code: string, file = 'src/zz-plant.ts'): string {
  n += 1;
  const root = join(scratch, `copy-${n}`);
  cpSync(join(ROOT, 'src'), join(root, 'src'), { recursive: true });
  writeFileSync(join(root, file), `${HEADER}\n${code}\n`);
  return root;
}

const plantFindings = (code: string): string[] =>
  lintRebrands(plantedCopy(code))
    .filter((f) => f.file === 'src/zz-plant.ts')
    .map((f) => f.rule);

describe('U1 re-brand rule: only the conversion module re-brands arithmetic', () => {
  it('the repository src/ is clean', () => {
    expect(lintRebrands(ROOT)).toEqual([]);
  });

  it.each([
    ['direct sum', 'export const x = nativeWei(a + b);', 'REBRAND-ARITH'],
    ['branded sum', 'export const x = nativeWei(wa + wb);', 'REBRAND-ARITH'],
    ['re-implemented division (a second conversion)', 'export const x = usdcUnits(wa / 1_000_000_000_000n);', 'REBRAND-ARITH'],
    ['re-implemented remainder', 'export const x = nativeWei(wa % 1_000_000_000_000n);', 'REBRAND-ARITH'],
    ['product', 'export const x = cbsMinor(a * 100n);', 'REBRAND-ARITH'],
    ['power', 'export const x = nativeWei(10n ** a);', 'REBRAND-ARITH'],
    ['shift', 'export const x = nativeWei(a << 2n);', 'REBRAND-ARITH'],
    ['unary minus', 'export const x = cbsMinor(-a);', 'REBRAND-ARITH'],
    ['inside a conditional', 'export const x = nativeWei(a > b ? a - b : 0n);', 'REBRAND-ARITH'],
    ['through a variable', 'const s = a + b;\nexport const x = nativeWei(s);', 'REBRAND-ARITH'],
    ['through two variables', 'const s = a + b;\nconst t = s;\nexport const x = nativeWei(t);', 'REBRAND-ARITH'],
    ['through an assignment', 'let s = 0n;\ns = a - b;\nexport const x = nativeWei(s);', 'REBRAND-ARITH'],
    ['through a compound assignment', 'export function f(): NativeWei { let s = 0n; for (const v of xs) s += v; return nativeWei(s); }', 'REBRAND-ARITH'],
    ['through ++', 'export function f(): NativeWei { let s = a; s++; return nativeWei(s); }', 'REBRAND-ARITH'],
    ['through a reduce callback', 'export const x = nativeWei(xs.reduce((s, v) => s + v, 0n));', 'REBRAND-ARITH'],
    ['through a helper return', 'function sum(p1: bigint, p2: bigint): bigint { return p1 + p2; }\nexport const x = nativeWei(sum(a, b));', 'REBRAND-ARITH'],
    ['through an arrow helper', 'const sum = (p1: bigint, p2: bigint): bigint => p1 + p2;\nexport const x = nativeWei(sum(a, b));', 'REBRAND-ARITH'],
    ['through a parameter', 'function brand(v: bigint): NativeWei { return nativeWei(v); }\nexport const x = brand(a + b);', 'REBRAND-ARITH'],
    ['namespace import', 'export const x = amounts.cbsMinor(a * b);', 'REBRAND-ARITH'],
    ['renamed import', 'export const x = nw(a + b);', 'REBRAND-ARITH'],
    ['parenthesised callee', 'export const x = (nativeWei)(a + b);', 'REBRAND-ARITH'],
    ['as cast', 'export const x = (a + b) as NativeWei;', 'REBRAND-CAST'],
    ['double cast', 'export const x = 5 as unknown as CbsMinor;', 'REBRAND-CAST'],
    ['angle-bracket cast', 'export const x = <UsdcUnits>a;', 'REBRAND-CAST'],
    ['cast of a result object', 'export const x = { minor: a, dustWei: 0n } as NativeToCbsResult;', 'REBRAND-CAST'],
    ['cast to a union', 'export const x = a as NativeWei | undefined;', 'REBRAND-CAST'],
    ['cast to an array', 'export const x = xs as readonly NativeWei[];', 'REBRAND-CAST'],
    ['alias of a constructor', 'const brand = nativeWei;\nexport const x = brand(a + b);', 'REBRAND-ALIAS'],
    ['constructor passed as a value', 'export const x = xs.map(nativeWei);', 'REBRAND-ALIAS'],
    ['constructor via .call', 'export const x = nativeWei.call(undefined, a + b);', 'REBRAND-ALIAS'],
    ['namespace member alias', 'export const brand = amounts.usdcUnits;', 'REBRAND-ALIAS'],
  ])('flags %s', (_name, code, rule) => {
    expect(plantFindings(code)).toContain(rule);
  });

  it.each([
    ['a literal', 'export const x = nativeWei(20_000_000_000n);'],
    ['a parsed hex quantity', 'export const x = nativeWei(BigInt(hex));'],
    ['number index arithmetic', 'export const x = nativeWei(BigInt(parts[i + 1] ?? "0"));'],
    ['an untouched variable', 'const s = a;\nexport const x = nativeWei(s);'],
    ['the sanctioned helper', 'export const x = addNativeWei(wa, wb);'],
    ['a comparison only', 'export const over = wa + wb > 10n;'],
    ['a sanctioned conversion', 'export const x = amounts.nativeWeiToCbsMinor(wa, amounts.cbsPrecision(6)).dustWei;'],
    ['a string concatenation', "export const x = nativeWei(BigInt('0x' + hex.slice(2)));"],
    ['a cast to a plain bigint', 'export const x = wa as bigint;'],
    ['as const over genuinely branded values', 'export const x = { fee: nativeWei(1n) } as const;'],
  ])('does not flag %s', (_name, code) => {
    expect(plantFindings(code)).toEqual([]);
  });

  it('the conversion module itself is exempt', () => {
    const root = plantedCopy('export const inModule = (x: bigint, y: bigint): NativeWei => nativeWei(x + y) as NativeWei;', 'src/zz-unused.ts');
    // The same code appended to the conversion module is not flagged.
    appendFileSync(join(root, 'src/amounts/index.ts'), '\nexport const inModule2 = (x: bigint, y: bigint): NativeWei => nativeWei(x + y) as NativeWei;\n');
    const findings = lintRebrands(root);
    expect(findings.filter((f) => f.file === 'src/amounts/index.ts')).toEqual([]);
    expect(findings.filter((f) => f.file === 'src/zz-unused.ts').map((f) => f.rule).sort()).toEqual(['REBRAND-ARITH', 'REBRAND-CAST']);
  });

  it('reports the file, line, rule and text of a finding', () => {
    const findings = lintRebrands(plantedCopy('export const x = nativeWei(a + b);')).filter((f) => f.file === 'src/zz-plant.ts');
    expect(findings).toEqual([{ file: 'src/zz-plant.ts', line: 13, rule: 'REBRAND-ARITH', text: 'nativeWei(a + b)' }]);
  });

  it('fails loudly if the conversion module is missing', () => {
    const root = plantedCopy('export {};');
    rmSync(join(root, 'src/amounts/index.ts'));
    expect(() => lintRebrands(root)).toThrow(/src\/amounts\/index\.ts not found/);
  });
});
