/**
 * U1: no module other than the conversion module (src/amounts/index.ts)
 * re-brands a raw arithmetic result as an amount (CLAUDE.md "Conversions
 * happen in exactly one module", RUBRIC MC-03). The rule is in
 * test/unit/amounts-rebrand-lint.ts. Every plant goes into a fresh mkdtemp
 * copy of src/ under the OS temp dir (real files, never a symlink to the
 * repository; asserted) and must be flagged with its own rule; every sanctioned
 * form must stay clean; the documented limit is pinned.
 */
import { appendFileSync, cpSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { lintRebrands } from './amounts-rebrand-lint.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const TMP = realpathSync(tmpdir());
const scratch = mkdtempSync(join(TMP, 'arc-u1-rebrand-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

// Exactly 12 lines, so the first planted line is line 13.
const HEADER = [
  "import { addNativeWei, cbsMinor, nativeWei, usdcUnits } from './amounts/index.js';",
  "import * as amounts from './amounts/index.js';",
  "import { nativeWei as nw } from './amounts/index.js';",
  "import type { CbsMinor, NativeToCbsResult, NativeWei, UsdcUnits } from './amounts/index.js';",
  'export const a: bigint = 7n;',
  'export const b: bigint = 3n;',
  'export const wa: NativeWei = nativeWei(7n);',
  'export const wb: NativeWei = nativeWei(3n);',
  'export const xs: readonly bigint[] = [1n, 2n];',
  "export const hex: `0x${string}` = '0x10';",
  "export const parts: readonly string[] = ['1', '2'];",
  'export const i: number = 0;',
].join('\n');

let n = 0;
/** A temp copy of src/ with the planted module `src/zz-plant.ts` (HEADER + code) and optional extra files. */
function plantedCopy(code: string, extra: Readonly<Record<string, string>> = {}, file = 'src/zz-plant.ts'): string {
  n += 1;
  const root = join(scratch, `copy-${n}`);
  if (!root.startsWith(TMP + sep)) throw new Error(`plant root ${root} is not under ${TMP}`);
  cpSync(join(ROOT, 'src'), join(root, 'src'), { recursive: true });
  if (lstatSync(join(root, 'src')).isSymbolicLink() || lstatSync(join(root, 'src/amounts/index.ts')).isSymbolicLink()) {
    throw new Error('plant copy must be real files, not a symlink to the repository');
  }
  writeFileSync(join(root, file), `${HEADER}\n${code}\n`);
  for (const [path, text] of Object.entries(extra)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const plantFindings = (code: string, extra: Readonly<Record<string, string>> = {}): string[] =>
  lintRebrands(plantedCopy(code, extra))
    .filter((f) => f.file.startsWith('src/zz-'))
    .map((f) => f.rule);

describe('U1 re-brand rule: only the conversion module re-brands arithmetic', () => {
  it('the repository src/ is clean', () => {
    expect(lintRebrands(ROOT)).toEqual([]);
  });

  it.each([
    // REBRAND-ARITH: direct.
    ['direct sum', 'export const x = nativeWei(a + b);', 'REBRAND-ARITH'],
    ['branded sum', 'export const x = nativeWei(wa + wb);', 'REBRAND-ARITH'],
    ['re-implemented division (a second conversion)', 'export const x = usdcUnits(wa / 1_000_000_000_000n);', 'REBRAND-ARITH'],
    ['re-implemented remainder', 'export const x = nativeWei(wa % 1_000_000_000_000n);', 'REBRAND-ARITH'],
    ['product', 'export const x = cbsMinor(a * 100n);', 'REBRAND-ARITH'],
    ['power', 'export const x = nativeWei(10n ** a);', 'REBRAND-ARITH'],
    ['shift', 'export const x = nativeWei(a << 2n);', 'REBRAND-ARITH'],
    ['unary minus', 'export const x = cbsMinor(-a);', 'REBRAND-ARITH'],
    ['inside a conditional', 'export const x = nativeWei(a > b ? a - b : 0n);', 'REBRAND-ARITH'],
    ['spread argument', 'export const x = nativeWei(...([a + b] as const));', 'REBRAND-ARITH'],
    // REBRAND-ARITH: through variables and assignments.
    ['through a variable', 'const s = a + b;\nexport const x = nativeWei(s);', 'REBRAND-ARITH'],
    ['through two variables', 'const s = a + b;\nconst t = s;\nexport const x = nativeWei(t);', 'REBRAND-ARITH'],
    ['through an assignment', 'let s = 0n;\ns = a - b;\nexport const x = nativeWei(s);', 'REBRAND-ARITH'],
    ['through a compound assignment', 'export function f(): NativeWei { let s = 0n; for (const v of xs) s += v; return nativeWei(s); }', 'REBRAND-ARITH'],
    ['through ++', 'export function f(): NativeWei { let s = a; s++; return nativeWei(s); }', 'REBRAND-ARITH'],
    ['through a write in another function (closure)', 'let s = 0n;\nexport function setS(): void { s = a + b; }\nexport const get = (): NativeWei => nativeWei(s);', 'REBRAND-ARITH'],
    // REBRAND-ARITH: destructuring (verifier D2).
    ['through object destructuring', 'const { v } = { v: a + b };\nexport const x = nativeWei(v);', 'REBRAND-ARITH'],
    ['through array destructuring', 'const [s] = [a + b];\nexport const x = nativeWei(s);', 'REBRAND-ARITH'],
    ['through nested destructuring', 'const { o: [s] } = { o: [a * b] };\nexport const x = nativeWei(s);', 'REBRAND-ARITH'],
    ['through a destructuring assignment', 'let s = 0n;\n[s] = [a + b];\nexport const x = nativeWei(s);', 'REBRAND-ARITH'],
    ['through an object destructuring assignment', 'let s = 0n;\n({ s } = { s: a + b });\nexport const x = nativeWei(s);', 'REBRAND-ARITH'],
    // REBRAND-ARITH: through objects, arrays and containers.
    ['through an object property initializer', 'const o = { v: a + b };\nexport const x = nativeWei(o.v);', 'REBRAND-ARITH'],
    ['through a property write', 'const o = { v: 0n };\no.v = a + b;\nexport const x = nativeWei(o.v);', 'REBRAND-ARITH'],
    ['through an element write', 'const arr = [0n];\narr[0] = a - b;\nexport const x = nativeWei(arr[0] ?? 0n);', 'REBRAND-ARITH'],
    ['through Array.push', 'const arr: bigint[] = [];\narr.push(a + b);\nexport const x = nativeWei(arr[0] ?? 0n);', 'REBRAND-ARITH'],
    ['through Map.set', "const m = new Map<string, bigint>();\nm.set('k', a + b);\nexport const x = nativeWei(m.get('k') ?? 0n);", 'REBRAND-ARITH'],
    ['through a class field (this.total +=)', 'class Acc { total = 0n; add(v: bigint): void { this.total += v; } }\nconst acc = new Acc();\nexport const x = nativeWei(acc.total);', 'REBRAND-ARITH'],
    ['through a getter', 'class G { get v(): bigint { return a + b; } }\nexport const x = nativeWei(new G().v);', 'REBRAND-ARITH'],
    // REBRAND-ARITH: through functions.
    ['through a reduce callback', 'export const x = nativeWei(xs.reduce((s, v) => s + v, 0n));', 'REBRAND-ARITH'],
    ['through a helper return', 'function sum(p1: bigint, p2: bigint): bigint { return p1 + p2; }\nexport const x = nativeWei(sum(a, b));', 'REBRAND-ARITH'],
    ['through an arrow helper', 'const sum = (p1: bigint, p2: bigint): bigint => p1 + p2;\nexport const x = nativeWei(sum(a, b));', 'REBRAND-ARITH'],
    ['through a parameter', 'function brand(v: bigint): NativeWei { return nativeWei(v); }\nexport const x = brand(a + b);', 'REBRAND-ARITH'],
    ['through a destructured parameter', 'function brand({ v }: { v: bigint }): NativeWei { return nativeWei(v); }\nexport const x = brand({ v: a + b });', 'REBRAND-ARITH'],
    ['through a rest parameter', 'function brand(...vs: bigint[]): NativeWei { return nativeWei(vs[0] ?? 0n); }\nexport const x = brand(1n, a + b);', 'REBRAND-ARITH'],
    ['through a constructor parameter', 'class Box { readonly v: NativeWei; constructor(raw: bigint) { this.v = nativeWei(raw); } }\nexport const x = new Box(a + b);', 'REBRAND-ARITH'],
    ['through a callback on a tainted receiver', 'export const x = [a + b].map((v) => nativeWei(v));', 'REBRAND-ARITH'],
    ['through Promise.then', 'export const x = Promise.resolve(a + b).then((v) => nativeWei(v));', 'REBRAND-ARITH'],
    ['through for...of', 'export function f(): NativeWei[] { const out: NativeWei[] = []; for (const v of [a + b]) out.push(nativeWei(v)); return out; }', 'REBRAND-ARITH'],
    ['through a generator yield', 'function* gen(): Generator<bigint, bigint, unknown> { yield a + b; return 0n; }\nexport const x = nativeWei(gen().next().value);', 'REBRAND-ARITH'],
    ['through throw and catch', 'export function f(): NativeWei { try { throw a + b; } catch (e) { return nativeWei(e as bigint); } }', 'REBRAND-ARITH'],
    // REBRAND-ARITH: import forms.
    ['namespace import', 'export const x = amounts.cbsMinor(a * b);', 'REBRAND-ARITH'],
    ['renamed import', 'export const x = nw(a + b);', 'REBRAND-ARITH'],
    ['parenthesised callee', 'export const x = (nativeWei)(a + b);', 'REBRAND-ARITH'],
    // REBRAND-CAST.
    ['as cast', 'export const x = (a + b) as NativeWei;', 'REBRAND-CAST'],
    ['double cast', 'export const x = 5 as unknown as CbsMinor;', 'REBRAND-CAST'],
    ['angle-bracket cast', 'export const x = <UsdcUnits>a;', 'REBRAND-CAST'],
    ['cast of a result object', 'export const x = { minor: a, dustWei: 0n } as NativeToCbsResult;', 'REBRAND-CAST'],
    ['cast to a union', 'export const x = a as NativeWei | undefined;', 'REBRAND-CAST'],
    ['cast to an array', 'export const x = xs as readonly NativeWei[];', 'REBRAND-CAST'],
    ['cast to a tuple', 'export const x = [a] as [NativeWei];', 'REBRAND-CAST'],
    ['cast to a function returning a brand', 'export const f = (() => a + b) as () => NativeWei;', 'REBRAND-CAST'],
    ['cast to a Promise of a brand', 'export const p = Promise.resolve(a + b) as Promise<NativeWei>;', 'REBRAND-CAST'],
    ['generic type-parameter assertion (verifier D2)', 'function id<T>(v: unknown): T { return v as T; }\nexport const x: NativeWei = id<NativeWei>(a + b);', 'REBRAND-CAST'],
    ['generic assertion with a bigint constraint', 'function as2<T extends bigint>(v: bigint): T { return v as T; }\nexport const x: NativeWei = as2<NativeWei>(a + b);', 'REBRAND-CAST'],
    // REBRAND-ANY.
    ['an any variable into a branded slot (verifier D2)', 'const s: any = a + b;\nexport const x: NativeWei = s;', 'REBRAND-ANY'],
    ['an any-returning helper (verifier D2)', "function h(v: string) { return JSON.parse(v); }\nexport const x: NativeWei = h('1');", 'REBRAND-ANY'],
    ['a library any into a branded slot', "export const x: NativeWei = JSON.parse('1');", 'REBRAND-ANY'],
    ['a library any returned into a generic T', 'export function g<T>(v: string): T { return JSON.parse(v); }', 'REBRAND-ANY'],
    ['an any-returning method behind a branded interface', "interface Src { get(): NativeWei }\nexport class Impl implements Src { get() { return JSON.parse('1'); } }", 'REBRAND-ANY'],
    ['an explicit any return type', 'export function h(): any { return a + b; }', 'REBRAND-ANY'],
    // REBRAND-GUARD.
    ['a type predicate to a brand', 'function isW(v: bigint): v is NativeWei { return v >= 0n; }\nconst s = a + b;\nexport const x: NativeWei | undefined = isW(s) ? s : undefined;', 'REBRAND-GUARD'],
    ['an assertion predicate to a brand', 'function assertW(v: bigint): asserts v is NativeWei { if (v < 0n) throw new RangeError(); }\nexport const s = a + b;', 'REBRAND-GUARD'],
    // REBRAND-SIGNATURE.
    ['an overload signature returning a brand', 'function f(v: bigint): NativeWei;\nfunction f(v: bigint): bigint { return v; }\nexport const x = f(a + b);', 'REBRAND-SIGNATURE'],
    ['a declare function returning a brand', 'declare function mk(v: bigint): NativeWei;\nexport const x = mk(a);', 'REBRAND-SIGNATURE'],
    ['a declare const of a brand', 'declare const w0: NativeWei;\nexport const x = w0;', 'REBRAND-SIGNATURE'],
    ['a declare class field of a brand', 'export class C { declare v: NativeWei; }', 'REBRAND-SIGNATURE'],
    // REBRAND-REFLECT.
    ['Object.assign onto a branded field', 'class C { v: NativeWei = nativeWei(0n); }\nconst c = new C();\nObject.assign(c, { v: a + b });', 'REBRAND-REFLECT'],
    ['Object.defineProperty onto a branded field', "class C { v: NativeWei = nativeWei(0n); }\nconst c = new C();\nObject.defineProperty(c, 'v', { value: a + b });", 'REBRAND-REFLECT'],
    ['Reflect.set onto a branded field', "class C { v: NativeWei = nativeWei(0n); }\nconst c = new C();\nReflect.set(c, 'v', a + b);", 'REBRAND-REFLECT'],
    // REBRAND-ALIAS.
    ['alias of a constructor', 'const brand = nativeWei;\nexport const x = brand(a + b);', 'REBRAND-ALIAS'],
    ['constructor passed as a value', 'export const x = xs.map(nativeWei);', 'REBRAND-ALIAS'],
    ['constructor via .call', 'export const x = nativeWei.call(undefined, a + b);', 'REBRAND-ALIAS'],
    ['namespace member alias', 'export const brand = amounts.usdcUnits;', 'REBRAND-ALIAS'],
    // REBRAND-ARITH: routes added for verifier round 2 D2.
    ['through a setter', 'class C { w: NativeWei = nativeWei(0n); set v(x: bigint) { this.w = nativeWei(x); } }\nconst c = new C();\nc.v = a + b;', 'REBRAND-ARITH'],
    ['through a setter written by element access', "class C { w: NativeWei = nativeWei(0n); set v(x: bigint) { this.w = nativeWei(x); } }\nconst c = new C();\nc['v'] = a + b;", 'REBRAND-ARITH'],
    ['through a setter in an object literal', 'const o = { w: nativeWei(0n), set v(x: bigint) { this.w = nativeWei(x); } };\no.v = a * b;', 'REBRAND-ARITH'],
    ['through a default parameter', 'function f(v: bigint = a + b): NativeWei { return nativeWei(v); }\nexport const x = f();', 'REBRAND-ARITH'],
    ['through a destructuring default', 'const { v = a + b }: { v?: bigint } = {};\nexport const x = nativeWei(v);', 'REBRAND-ARITH'],
    ['through a tagged template', 'function tag(_s: TemplateStringsArray, v: bigint): NativeWei { return nativeWei(v); }\nexport const x = tag`${a + b}`;', 'REBRAND-ARITH'],
    ['through Function.prototype.call', 'function br(v: bigint): NativeWei { return nativeWei(v); }\nexport const x = br.call(undefined, a + b);', 'REBRAND-ARITH'],
    ['through Function.prototype.apply', 'function br(v: bigint): NativeWei { return nativeWei(v); }\nexport const x = br.apply(undefined, [a + b]);', 'REBRAND-ARITH'],
    ['through bind with a bound argument', 'function br(v: bigint): NativeWei { return nativeWei(v); }\nexport const x = br.bind(undefined, a + b)();', 'REBRAND-ARITH'],
    ['through a bound function called later', 'function br(v: bigint): NativeWei { return nativeWei(v); }\nexport const x = br.bind(undefined)(a + b);', 'REBRAND-ARITH'],
    ['through Reflect.apply', 'function br(v: bigint): NativeWei { return nativeWei(v); }\nexport const x: unknown = Reflect.apply(br, undefined, [a + b]);', 'REBRAND-ARITH'],
    // REBRAND-CROSS: one unit re-labelled as another with no conversion (verifier round 2 D1, D2).
    ['a brand widened to bigint, then another constructor (verifier D1)', 'const raw: bigint = wa;\nexport const x = usdcUnits(raw);', 'REBRAND-CROSS'],
    ['a brand cast to plain bigint', 'export const x = cbsMinor(wa as bigint);', 'REBRAND-CROSS'],
    ['a brand through a relabelling helper', 'function relabel(v: bigint): UsdcUnits { return usdcUnits(v); }\nexport const x = relabel(wa);', 'REBRAND-CROSS'],
    ['a conversion result widened and relabelled', 'const { minor } = amounts.nativeWeiToCbsMinor(wa, amounts.cbsPrecision(6));\nconst m: bigint = minor;\nexport const x = nativeWei(m);', 'REBRAND-CROSS'],
    ['a second conversion by string shifting (verifier D2)', "export const x = usdcUnits(BigInt(wa.toString().slice(0, -12) || '0'));", 'REBRAND-CROSS'],
    ['a second conversion through floats (verifier D2)', 'export const x = nativeWei(BigInt(Math.floor(Number(wa) / 1e12)));', 'REBRAND-CROSS'],
    ['a widened brand accumulated with +=', 'let s: bigint = 0n;\nexport function acc(): void { s += wb; }\nexport const x = nativeWei(s);', 'REBRAND-CROSS'],
    // REBRAND-NUMBER: a JS number becoming an amount.
    ['a number scaled by floats (verifier D2)', "export const x = nativeWei(BigInt(Math.floor(Number(parts[0] ?? '0') * 1e18)));", 'REBRAND-NUMBER'],
    ['a number through a variable', 'const n = BigInt(i * 100);\nexport const x = cbsMinor(n);', 'REBRAND-NUMBER'],
    ['a number literal', 'export const x = nativeWei(BigInt(5));', 'REBRAND-NUMBER'],
  ])('flags %s', (_name, code, rule) => {
    expect(plantFindings(code)).toContain(rule);
  });

  it('flags taint that crosses a module boundary through a named export', () => {
    const findings = plantFindings("import { s } from './zz-other.js';\nexport const x = nativeWei(s);", {
      'src/zz-other.ts': 'export const s: bigint = 5n * 3n;\n',
    });
    expect(findings).toContain('REBRAND-ARITH');
  });

  it('flags taint that crosses a module boundary through a default export', () => {
    const findings = plantFindings("import s from './zz-other.js';\nexport const x = nativeWei(s);", {
      'src/zz-other.ts': 'export default 5n * 3n;\n',
    });
    expect(findings).toContain('REBRAND-ARITH');
  });

  it('flags the float route through a brand under both CROSS and NUMBER', () => {
    expect(plantFindings('export const x = nativeWei(BigInt(Math.floor(Number(wa) / 1e12)));').sort()).toEqual(['REBRAND-CROSS', 'REBRAND-NUMBER']);
  });

  it.each([
    ['an .mts module', 'src/zz-esm.mts'],
    ['a .cts module', 'src/zz-cjs.cts'],
    ['a .tsx module', 'src/zz-view.tsx'],
  ])('scans %s (verifier round 2 D2)', (_name, file) => {
    const root = plantedCopy('export {};', {
      [file]: "import { nativeWei as nw } from './amounts/index.js';\nexport const x = nw(7n + 3n);\n",
    });
    expect(lintRebrands(root).filter((f) => f.file === file).map((f) => f.rule)).toEqual(['REBRAND-ARITH']);
  });

  /** A stub `viem` package in the temp copy (real files), so a plant can import library helpers. */
  const VIEM_STUB = {
    'node_modules/viem/package.json': JSON.stringify({ name: 'viem', type: 'module', types: './index.d.ts', exports: { '.': { types: './index.d.ts' } } }),
    'node_modules/viem/index.d.ts': [
      'export declare function parseUnits(value: string, decimals: number): bigint;',
      'export declare function parseEther(value: string): bigint;',
      'export declare function formatEther(value: bigint): string;',
      'export declare function formatUnits(value: bigint, decimals: number): string;',
      'export declare function hexToBigInt(hex: `0x${string}`): bigint;',
      '',
    ].join('\n'),
  };

  it.each([
    ['parseUnits into a constructor (verifier D2)', "import { parseUnits } from 'viem';\nexport const x = nativeWei(parseUnits('1.5', 18));"],
    ['parseEther held in a variable', "import { parseEther } from 'viem';\nexport const v = parseEther('2');"],
    ['formatUnits for display', "import { formatUnits } from 'viem';\nexport const t = formatUnits(wa, 18);"],
    ['a namespace formatEther', "import * as viem from 'viem';\nexport const t = viem.formatEther(wa);"],
  ])('flags a library unit converter: %s', (_name, code) => {
    const root = plantedCopy(code, VIEM_STUB);
    expect(lintRebrands(root).filter((f) => f.file === 'src/zz-plant.ts').map((f) => f.rule)).toContain('REBRAND-LIBCONV');
  });

  it('does not flag a library hex parse into a constructor', () => {
    const root = plantedCopy("import { hexToBigInt } from 'viem';\nexport const x = nativeWei(hexToBigInt(hex));", VIEM_STUB);
    expect(lintRebrands(root).filter((f) => f.file === 'src/zz-plant.ts')).toEqual([]);
  });

  it('flags an ambient brand in a declaration file under src', () => {
    const root = plantedCopy('export {};', {
      'src/zz-ambient.d.ts': "export declare const w1: import('./amounts/index.js').NativeWei;\n",
    });
    expect(lintRebrands(root).filter((f) => f.file === 'src/zz-ambient.d.ts').map((f) => f.rule)).toEqual(['REBRAND-SIGNATURE']);
  });

  it.each([
    ['a literal', 'export const x = nativeWei(20_000_000_000n);'],
    ['a parsed hex quantity', 'export const x = nativeWei(BigInt(hex));'],
    ['number index arithmetic', 'export const x = nativeWei(BigInt(parts[i + 1] ?? "0"));'],
    ['an untouched variable', 'const s = a;\nexport const x = nativeWei(s);'],
    ['the sanctioned helper', 'export const x = addNativeWei(wa, wb);'],
    ['a comparison only', 'export const over = wa + wb > 10n;'],
    ['arithmetic that is never re-branded', 'export const s = a + b;'],
    ['a sanctioned conversion', 'export const x = amounts.nativeWeiToCbsMinor(wa, amounts.cbsPrecision(6)).dustWei;'],
    ['a string concatenation', "export const x = nativeWei(BigInt('0x' + hex.slice(2)));"],
    ['a cast to a plain bigint', 'export const x = wa as bigint;'],
    ['as const over genuinely branded values', 'export const x = { fee: nativeWei(1n) } as const;'],
    ['a branded property read', 'const o = { v: wa };\nexport const x = o.v;'],
    ['a type predicate to a non-brand', "export function isStr(v: unknown): v is string { return typeof v === 'string'; }"],
    ['an overload returning a non-brand', 'export function f(v: string): string;\nexport function f(v: string): string { return v; }'],
    ['a generic assertion whose constraint excludes brands', 'export function asStr<T extends string>(v: unknown): T { return v as T; }'],
    ['Object.assign onto a plain object', 'export const o = Object.assign({}, { v: a + b });'],
    ['a library any into a non-branded slot', "export const cfg: { name: string } = JSON.parse('{}');"],
    ['an abstract method returning a brand', 'export abstract class Port { abstract balance(): NativeWei; }'],
    ['an interface method returning a brand', 'export interface P { balance(): Promise<NativeWei> }'],
    ['a callback with an annotated return', 'export const s = xs.map((v): string => String(v));'],
    ['a decimal string parsed, not scaled', "export const x = nativeWei(BigInt(parts[0] ?? '0'));"],
    ['a bigint-typed value that never held an amount', 'const raw: bigint = a;\nexport const x = usdcUnits(raw);'],
    ['a brand compared, then a literal constructed', 'export const x = wa > wb ? nativeWei(1n) : nativeWei(0n);'],
    ['a sanctioned conversion of a brand', 'export const x = amounts.nativeWeiToUsdcUnits(wa).units;'],
    ['a setter written with a plain value', 'class C { w: NativeWei = nativeWei(0n); set v(x: bigint) { this.w = nativeWei(x); } }\nconst c = new C();\nc.v = a;'],
    ['a default parameter that is a literal', 'function f(v: bigint = 5n): NativeWei { return nativeWei(v); }\nexport const x = f();'],
    ['BigInt of a hex string', 'export const x = cbsMinor(BigInt(hex));'],
  ])('does not flag %s', (_name, code) => {
    expect(plantFindings(code)).toEqual([]);
  });

  it('documented limit L1: a write through a widened alias is not flagged (TypeScript property covariance)', () => {
    const code = 'const holder: { v: NativeWei } = { v: nativeWei(1n) };\nconst wide: { v: bigint } = holder;\nwide.v = a + b;\nexport const x: NativeWei = holder.v;';
    expect(plantFindings(code)).toEqual([]);
  });

  it('documented limit L4: scaling a decimal string that never was an amount, by string manipulation, is not flagged', () => {
    const code = "export const x = nativeWei(BigInt((parts[0] ?? '0').replace('.', '') + '000000000000'));";
    expect(plantFindings(code)).toEqual([]);
  });

  it('the conversion module itself is exempt', () => {
    const root = plantedCopy('export const inModule = (x: bigint, y: bigint): NativeWei => nativeWei(x + y) as NativeWei;', {}, 'src/zz-unused.ts');
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
