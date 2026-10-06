/**
 * docs/MONEY_PATH.md is the single list of money-path source paths (RUBRIC
 * "Money-path modules"). This test recounts it: every item maps to a path,
 * every named part to an anchor in a listed path, the import-graph closure is
 * listed or excluded (excluded only through `import type`), and Stryker
 * (MC-08), coverage (MC-07) and the MC-01 lint cover exactly the listed paths.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { declId, lintMoneyFloats } from '../../tools/lint-money-floats.mjs';
import { readMoneyPath } from '../../tools/money-path.mjs';
import vitestConfig from '../../vitest.config.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const mp = readMoneyPath(ROOT);
const sorted = (xs: readonly string[]): string[] => [...xs].sort();

describe('docs/MONEY_PATH.md recount', () => {
  it('every listed path exists and is listed once', () => {
    for (const p of mp.paths) expect(existsSync(join(ROOT, p)), p).toBe(true);
    expect(new Set(mp.paths).size).toBe(mp.paths.length);
  });

  it('every RUBRIC item 1–10 has a listed path and at least one named part', () => {
    for (let item = 1; item <= 10; item += 1) {
      expect(mp.listed.some((l) => l.item === item), `item ${item} path`).toBe(true);
      expect(mp.parts.some((p) => p.item === item), `item ${item} part`).toBe(true);
    }
  });

  it.each(mp.parts.map((p) => [`${p.item}: ${p.part}`, p] as const))('named part %s maps to an anchor in a listed path', (_n, part) => {
    expect(mp.paths).toContain(part.path);
    const listedItem = mp.listed.find((l) => l.path === part.path)?.item;
    expect(listedItem).toBe(part.item);
    const src = readFileSync(join(ROOT, part.path), 'utf8');
    expect(new RegExp(`\\b${part.anchor}\\b`).test(src), `${part.anchor} in ${part.path}`).toBe(true);
  });

  it('item 10 names src/cbs/keys.ts, the translator, hold ops, getResultByKey and AMBIGUOUS resolution', () => {
    const anchors = mp.parts.filter((p) => p.item === 10).map((p) => p.anchor);
    expect(anchors).toEqual(expect.arrayContaining(['buildLegs', 'placeHold', 'settleHold', 'releaseHold', 'getResultByKey', 'resolveAmbiguous', 'deriveKey']));
    expect(mp.paths).toContain('src/cbs/keys.ts');
  });
});

describe('Number allow-list (MC-01 float-type grep)', () => {
  it('has the documented entries only: chain ID, RPC error code, precision p (by declaration identity)', () => {
    expect(mp.numberAllow.map((a) => `${a.path}#${a.decl}`).sort()).toEqual(
      [
        'src/amounts/index.ts#CbsPrecision',
        'src/amounts/index.ts#cbsPrecision',
        'src/amounts/index.ts#cbsPrecision(0)',
        'src/chain/client/index.ts#ChainReader.chainId',
        'src/chain/client/index.ts#ReadResult.code',
        'src/signer/index.ts#Eip1559ValueSend.chainId',
      ].sort(),
    );
  });

  it.each(mp.numberAllow.map((a) => [`${a.path} ${a.decl}`, a] as const))('%s names exactly one declaration in a listed path', (_n, a) => {
    expect(mp.paths).toContain(a.path);
    const sf = ts.createSourceFile(a.path, readFileSync(join(ROOT, a.path), 'utf8'), ts.ScriptTarget.ES2023, true);
    let count = 0;
    const walk = (node: ts.Node): void => {
      if (declId(node) === a.decl) count += 1;
      ts.forEachChild(node, walk);
    };
    walk(sf);
    expect(count, `${a.decl} in ${a.path}`).toBe(1);
  });
});

describe('tools cover exactly the listed paths', () => {
  it('Stryker mutate (MC-08)', () => {
    const stryker = JSON.parse(readFileSync(join(ROOT, 'stryker.config.json'), 'utf8')) as { mutate: string[] };
    expect(sorted(stryker.mutate)).toEqual(sorted(mp.paths));
  });

  it('coverage include and 100% per-file thresholds (MC-07)', () => {
    const cov = vitestConfig.test?.coverage as { include?: string[]; thresholds?: Record<string, unknown> } | undefined;
    expect(sorted(cov?.include ?? [])).toEqual(sorted(mp.paths));
    expect(cov?.thresholds).toMatchObject({ perFile: true, lines: 100, branches: 100, functions: 100, statements: 100 });
  });

  it('MC-01 lint', () => {
    expect(lintMoneyFloats(ROOT).files).toBe(mp.paths.length);
  });

  it('no coverage-ignore comment in a listed path without a docs/COVERAGE_EXCLUSIONS.md row', () => {
    const md = readFileSync(join(ROOT, 'docs/COVERAGE_EXCLUSIONS.md'), 'utf8');
    const rows = md
      .split('\n')
      .filter((l) => l.startsWith('|'))
      .slice(2);
    let ignores = 0;
    for (const p of mp.paths) {
      const src = readFileSync(join(ROOT, p), 'utf8');
      ignores += (src.match(/(v8|c8|istanbul)\s+ignore/g) ?? []).length;
    }
    expect(ignores).toBe(rows.length);
  });
});

interface Edge {
  readonly spec: string;
  readonly typeOnly: boolean;
}

/**
 * MC-34: LLM and agent SDKs. None may be imported by a money-path module, and
 * none may be in the runtime dependency graph of package.json.
 */
export const LLM_SDK_DENYLIST: readonly RegExp[] = [
  /^openai$/, /^@openai\//, /^@anthropic-ai\//, /^langchain/, /^@langchain\//, /^@google\/generative-ai$/, /^@google\/genai$/,
  /^@google-cloud\/vertexai$/, /^cohere-ai$/, /^ollama$/, /^@mistralai\//, /^ai$/, /^@ai-sdk\//, /^llamaindex$/, /^@llamaindex\//,
  /^@modelcontextprotocol\//, /^groq-sdk$/, /^@huggingface\/inference$/, /^replicate$/, /^together-ai$/, /^@aws-sdk\/client-bedrock/,
  /^@azure\/openai$/, /^@azure-rest\/ai-inference$/, /^portkey-ai$/,
];
const packageOf = (spec: string): string => {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] as string);
};
export const isLlmSdk = (spec: string): boolean => LLM_SDK_DENYLIST.some((re) => re.test(packageOf(spec)));

/**
 * The only non-relative specifiers a listed path may import (MC-34 import scan,
 * m16). Grow it only through a LEDGER entry. `viem` covers its subpaths.
 */
export const MONEY_PATH_PACKAGES: readonly string[] = ['viem', 'node:crypto'];
const isAllowedPackage = (spec: string): boolean => MONEY_PATH_PACKAGES.some((p) => spec === p || (!p.startsWith('node:') && spec.startsWith(`${p}/`)));
/** A specifier that names a file: relative, absolute or a file: URL. */
const isPathSpec = (spec: string): boolean => spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('file:');

/**
 * Import edges of one module. Under `verbatimModuleSyntax` only `import type`
 * and `export type` are erased. `import { type X } from` still emits
 * `import {} from '…'`, so it is a runtime edge, and so is a side-effect import,
 * a dynamic `import()` or a `require()`. `import('…')` in a type position is
 * type-only. A dynamic import or require with a non-literal specifier is an
 * error: the closure can't be computed. So is any loader that can't be traced:
 * `createRequire`, `getBuiltinModule`, `module.require`, `import.meta.resolve`.
 */
export function importEdges(fileName: string, text: string): { edges: Edge[]; errors: string[] } {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.ES2023, true);
  const edges: Edge[] = [];
  const errors: string[] = [];
  const LOADERS = new Set(['createRequire', 'createRequireFromPath', 'getBuiltinModule']);
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      edges.push({ spec: node.moduleSpecifier.text, typeOnly: node.importClause?.isTypeOnly === true });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      edges.push({ spec: node.moduleSpecifier.text, typeOnly: node.isTypeOnly });
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const e = node.moduleReference.expression;
      if (ts.isStringLiteral(e)) edges.push({ spec: e.text, typeOnly: node.isTypeOnly });
      else errors.push(`${fileName}: import = require() with a non-literal specifier`);
    } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteralLike(arg)) edges.push({ spec: arg.text, typeOnly: false });
      else errors.push(`${fileName}: dynamic import()/require() with a non-literal specifier`);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      edges.push({ spec: node.argument.literal.text, typeOnly: true });
    }
    // Untraceable loaders, however reached: createRequire(...), process.getBuiltinModule(...),
    // process['getBuiltinModule'], import.meta.resolve(...), module.require(...), Module._load(...).
    const name = ts.isIdentifier(node)
      ? node.text
      : ts.isPropertyAccessExpression(node)
        ? node.name.text
        : ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)
          ? node.argumentExpression.text
          : undefined;
    const isMemberName = node.parent !== undefined && ts.isPropertyAccessExpression(node.parent) && node.parent.name === node;
    if (name !== undefined && !isMemberName) {
      const member = ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node);
      const metaResolve = ts.isPropertyAccessExpression(node) && name === 'resolve' && ts.isMetaProperty(node.expression);
      if (LOADERS.has(name) || metaResolve || (member && (name === 'require' || name === '_load'))) {
        errors.push(`${fileName}: untraceable module loader \`${node.getText(sf)}\``);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { edges, errors };
}

function resolvePathSpec(root: string, file: string, spec: string): string {
  let abs: string;
  if (spec.startsWith('file:')) abs = fileURLToPath(spec);
  else if (spec.startsWith('/')) abs = spec;
  else abs = join(root, dirname(file), spec);
  return relative(root, normalize(abs.replace(/\.js$/, '.ts'))).split('\\').join('/');
}

/**
 * The closure check. `overrides` (repo-relative path → source text) replaces
 * file contents in memory for the self-tests, so nothing is ever written.
 */
export function closureProblems(root: string, overrides: ReadonlyMap<string, string> = new Map()): string[] {
  const listed = new Set(mp.paths);
  const excluded = new Set(mp.excluded.map((e) => e.path));
  const read = (f: string): string | undefined => overrides.get(f) ?? (existsSync(join(root, f)) ? readFileSync(join(root, f), 'utf8') : undefined);
  const problems: string[] = [];
  const seen = new Set<string>();
  const queue = [...mp.paths];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = read(file);
    if (text === undefined) {
      problems.push(`${file} is missing`);
      continue;
    }
    const { edges, errors } = importEdges(file, text);
    problems.push(...errors);
    for (const edge of edges) {
      if (isLlmSdk(edge.spec)) {
        problems.push(`${file} imports the LLM/agent SDK ${edge.spec} (MC-34)`);
        continue;
      }
      if (!isPathSpec(edge.spec)) {
        if (listed.has(file) && !isAllowedPackage(edge.spec)) problems.push(`${file} imports ${edge.spec}, which is not on the money-path package allow-list`);
        continue;
      }
      const to = resolvePathSpec(root, file, edge.spec);
      if (read(to) === undefined) problems.push(`${file} imports missing ${to}`);
      else if (listed.has(to)) queue.push(to);
      else if (excluded.has(to)) {
        if (listed.has(file) && !edge.typeOnly) problems.push(`${file} imports excluded ${to} at runtime`);
        queue.push(to);
      } else problems.push(`${file} reaches ${to}, which is neither listed nor excluded`);
    }
  }
  for (const e of excluded) if (!seen.has(e)) problems.push(`${e} is excluded but not reached`);
  return problems;
}

interface LockEntry {
  readonly name?: string;
  readonly version?: string;
  readonly resolved?: string;
  readonly link?: boolean;
  readonly dependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}
interface PackageJson {
  readonly dependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
}

/**
 * MC-34 dependency scan: the runtime dependency graph of package.json
 * (dependencies, optionalDependencies, peerDependencies, recursively), resolved
 * through package-lock.json the way Node resolves node_modules. Dev-only
 * packages are not in it. Every reached package is checked against the
 * denylist by its key name, its `name` field (aliases) and its registry URL.
 */
export function runtimeLlmScan(pkg: PackageJson, lock: { packages: Record<string, LockEntry> }): { reached: string[]; problems: string[] } {
  const packages = lock.packages;
  const problems: string[] = [];
  const reached = new Set<string>();
  const resolveDep = (from: string, dep: string): string | undefined => {
    let base = from;
    for (;;) {
      const key = base === '' ? `node_modules/${dep}` : `${base}/node_modules/${dep}`;
      if (packages[key]) return key;
      if (base === '') return undefined;
      const at = base.lastIndexOf('/node_modules/');
      base = at < 0 ? '' : base.slice(0, at);
    }
  };
  const visit = (from: string, deps: Record<string, string>, optional: (d: string) => boolean): void => {
    for (const dep of Object.keys(deps)) {
      let key = resolveDep(from, dep);
      if (key === undefined) {
        if (!optional(dep)) problems.push(`${from || 'package.json'}: runtime dependency ${dep} is not in package-lock.json`);
        continue;
      }
      let entry = packages[key] as LockEntry;
      if (entry.link && entry.resolved && packages[entry.resolved]) {
        key = entry.resolved;
        entry = packages[key] as LockEntry;
      }
      if (reached.has(key)) continue;
      reached.add(key);
      const names = [dep, key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length), entry.name ?? ''];
      const reg = /^https:\/\/registry\.npmjs\.org\/((?:@[^/]+\/)?[^/]+)\/-\//.exec(entry.resolved ?? '');
      if (reg) names.push(decodeURIComponent(reg[1] as string));
      const hit = names.find((n) => n !== '' && isLlmSdk(n));
      if (hit) problems.push(`runtime dependency graph reaches the LLM/agent SDK ${hit} (${key}) (MC-34)`);
      const meta = entry.peerDependenciesMeta ?? {};
      visit(key, { ...(entry.dependencies ?? {}) }, () => false);
      visit(key, { ...(entry.optionalDependencies ?? {}) }, () => true);
      visit(key, { ...(entry.peerDependencies ?? {}) }, (d) => meta[d]?.optional === true);
    }
  };
  visit('', { ...(pkg.dependencies ?? {}), ...(pkg.peerDependencies ?? {}) }, () => false);
  visit('', { ...(pkg.optionalDependencies ?? {}) }, () => true);
  return { reached: [...reached].sort(), problems };
}

describe('import-edge classification (verbatimModuleSyntax)', () => {
  it.each([
    ["import type { A } from './a.js';", false],
    ["import { type A } from './a.js';", true],
    ["import { type A, type B } from './a.js';", true],
    ["import { A } from './a.js';", true],
    ["import './a.js';", true],
    ["export type { A } from './a.js';", false],
    ["export { type A } from './a.js';", true],
    ["export * from './a.js';", true],
    ["export const f = async () => import('./a.js');", true],
    ["export type T = typeof import('./a.js');", false],
  ])('%s → runtime: %s', (code, runtime) => {
    const { edges, errors } = importEdges('x.ts', code);
    expect(errors).toEqual([]);
    expect(edges).toEqual([{ spec: './a.js', typeOnly: !runtime }]);
  });

  it('a non-literal dynamic import is an error', () => {
    expect(importEdges('x.ts', 'declare const m: string; export const f = () => import(m);').errors).toHaveLength(1);
  });
});

describe('import-graph closure of the listed paths', () => {
  it('every reached module is listed or excluded, excluded ones only through `import type`, and no SDK or unlisted package is imported', () => {
    expect(closureProblems(ROOT)).toEqual([]);
  });

  // m16 plants: in-memory edits of src/policy/index.ts (nothing is written).
  const policy = 'src/policy/index.ts';
  const policyText = readFileSync(join(ROOT, policy), 'utf8');
  const absRegistry = join(ROOT, 'src/registry/index.js');
  it.each([
    ['C3 createRequire', "import { createRequire } from 'node:module';\nexport const r3 = createRequire(import.meta.url)('../registry/index.js');", /untraceable module loader `createRequire`/],
    ['C3b node:module itself', "import { createRequire } from 'node:module';\nexport const r3b = createRequire;", /imports node:module, which is not on the money-path package allow-list/],
    ['C7 process.getBuiltinModule', "export const r7 = (process.getBuiltinModule('node:module') as typeof import('node:module')).createRequire(import.meta.url)('../registry/index.js');", /untraceable module loader `process\.getBuiltinModule`/],
    ['C7b getBuiltinModule by element access', "export const r7b = (process as unknown as Record<string, (m: string) => unknown>)['getBuiltinModule']?.('node:module');", /untraceable module loader/],
    ['C8 absolute-path import of an excluded module', `import { createAddressRegistry } from '${absRegistry}';\nexport const r8 = createAddressRegistry;`, /imports excluded src\/registry\/index\.ts at runtime/],
    ['C8b file: URL import of an excluded module', `export const r8b = () => import('file://${absRegistry}');`, /imports excluded src\/registry\/index\.ts at runtime/],
    ['C9 openai', "import OpenAI from 'openai';\nexport const r9 = OpenAI;", /LLM\/agent SDK openai/],
    ['C10 dynamic @anthropic-ai/sdk', "export const r10 = () => import('@anthropic-ai/sdk');", /LLM\/agent SDK @anthropic-ai\/sdk/],
    ['C11 require langchain', "declare const require: (m: string) => unknown;\nexport const r11 = require('@langchain/core/messages');", /LLM\/agent SDK @langchain\/core\/messages/],
    ['C12 type-only cohere-ai', "import type { CohereClient } from 'cohere-ai';\nexport type R12 = CohereClient;", /LLM\/agent SDK cohere-ai/],
    ['C13 an unlisted package', "import { z } from 'zod';\nexport const r13 = z;", /imports zod, which is not on the money-path package allow-list/],
    ['C14 import.meta.resolve', "export const r14 = import.meta.resolve('../registry/index.js');", /untraceable module loader `import\.meta\.resolve`/],
  ])('%s fails the closure', (_n, code, expected) => {
    const problems = closureProblems(ROOT, new Map([[policy, `${policyText}\n${code}\n`]]));
    expect(problems.some((p) => expected.test(p)), problems.join('\n')).toBe(true);
  });

  it('allow-listed packages pass (viem and its subpaths, node:crypto)', () => {
    const code = "import { keccak256 } from 'viem';\nimport { parseAbi } from 'viem/utils';\nimport { createHash } from 'node:crypto';\nexport const ok = [keccak256, parseAbi, createHash];";
    expect(closureProblems(ROOT, new Map([[policy, `${policyText}\n${code}\n`]]))).toEqual([]);
  });
});

describe('MC-34: no LLM or agent SDK in the runtime dependency graph of package.json', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as PackageJson;
  const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')) as { packages: Record<string, LockEntry> };

  it('the repository graph is clean and is actually walked', () => {
    const { reached, problems } = runtimeLlmScan(pkg, lock);
    expect(problems).toEqual([]);
    expect(reached).toContain('node_modules/viem');
    expect(reached.length).toBeGreaterThan(1);
    expect(reached).not.toContain('node_modules/vitest'); // dev-only
  });

  const base = (extra: Record<string, LockEntry>, viemDeps: Record<string, string> = {}) => ({
    packages: {
      '': { name: 'x', dependencies: { viem: '1.0.0' } },
      'node_modules/viem': { version: '1.0.0', dependencies: { ws: '8.0.0', ...viemDeps } },
      'node_modules/ws': { version: '8.0.0', resolved: 'https://registry.npmjs.org/ws/-/ws-8.0.0.tgz' },
      ...extra,
    } as Record<string, LockEntry>,
  });
  const root = { dependencies: { viem: '1.0.0' } };
  it.each([
    ['a direct runtime dependency', { dependencies: { viem: '1.0.0', openai: '4.0.0' } }, base({ 'node_modules/openai': { version: '4.0.0' } }), /SDK openai/],
    ['a transitive dependency nested under another package', root, base({ 'node_modules/viem/node_modules/@anthropic-ai/sdk': { version: '0.1.0' } }, { '@anthropic-ai/sdk': '0.1.0' }), /SDK @anthropic-ai\/sdk/],
    ['a transitive dependency hoisted to the top', root, base({ 'node_modules/ollama': { version: '0.5.0' } }, { ollama: '0.5.0' }), /SDK ollama/],
    ['an npm alias (npm:openai@…)', root, base({ 'node_modules/innocent': { name: 'openai', version: '4.0.0', resolved: 'https://registry.npmjs.org/openai/-/openai-4.0.0.tgz' } }, { innocent: 'npm:openai@4.0.0' }), /SDK openai/],
    ['a non-optional peer dependency', root, base({ 'node_modules/viem': { version: '1.0.0', peerDependencies: { langchain: '0.3.0' } }, 'node_modules/langchain': { version: '0.3.0' } }), /SDK langchain/],
    ['a dependency missing from the lockfile (fails closed)', root, base({}, { 'cohere-ai': '7.0.0' }), /cohere-ai is not in package-lock\.json/],
  ])('fails: %s', (_n, p, l, expected) => {
    const { problems } = runtimeLlmScan(p as PackageJson, l);
    expect(problems.some((x) => expected.test(x)), problems.join('\n')).toBe(true);
  });

  it('a dev-only SDK is outside the runtime graph', () => {
    const l = base({ 'node_modules/openai': { version: '4.0.0' } });
    expect(runtimeLlmScan({ dependencies: { viem: '1.0.0' } }, l).problems).toEqual([]);
  });
});
