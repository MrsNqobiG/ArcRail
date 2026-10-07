/**
 * Unit NET: the network dependency lint rule (CLAUDE.md "Agnosticism is
 * tested: a lint rule keeps network-specific code inside its adapter";
 * NOVA_ARC_DESIGN §3, §5.2; verifier NOVA-NET-lensR-1 m5).
 *
 * Arc knowledge lives in the Arc adapter `src/network/arc/**` and in the Arc
 * event indexer `src/indexer/**`, which is part of the Arc adapter (the unit's
 * file layout puts it there instead of §3's `src/net/arc/indexer.ts`). U2/U3
 * (`src/chain/**`) own the cited constants. The rule:
 * 1. No module outside those two directories imports either of them, at
 *    runtime or as a type, except a composition root listed below (none yet).
 * 2. The network port (`src/network/types.ts`) and the fake network
 *    (`src/network/fake/**`) import nothing Arc-specific and contain no Arc
 *    literal (chain IDs, the system emitter, the USDC ERC-20 address, the
 *    Transfer topic, Arc RPC error codes, DFNS Arc network names). The one
 *    exception is the chain-agnostic 32-byte hex type: `import type { Hex32 }`
 *    from U2's `src/chain/config`, which the port re-exports.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ARC_DIRS = ['src/network/arc/', 'src/indexer/'];
/** Composition roots allowed to wire the Arc adapter (grow only with the D1 orchestrator's root, by a LEDGER entry). */
const COMPOSITION_ROOTS: readonly string[] = [];
const ARC_FREE = (path: string): boolean => path === 'src/network/types.ts' || path.startsWith('src/network/fake/');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...sourceFiles(rel));
    else if (rel.endsWith('.ts')) out.push(rel);
  }
  return out;
}

/** Every module specifier a file references: import/export declarations, import(), require(), import types. */
function specifiers(path: string): string[] {
  const sf = ts.createSourceFile(path, readFileSync(join(ROOT, path), 'utf8'), ts.ScriptTarget.ES2022, true);
  const out: string[] = [];
  const walk = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)) {
      out.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      const [arg] = node.arguments;
      if (arg !== undefined && ts.isStringLiteralLike(arg)) out.push(arg.text);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) out.push(node.argument.literal.text);
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return out;
}

/** Imports of `src/chain/**` other than `import type { Hex32 }`. */
function chainImportsBeyondHex32(path: string): string[] {
  const sf = ts.createSourceFile(path, readFileSync(join(ROOT, path), 'utf8'), ts.ScriptTarget.ES2022, true);
  const bad: string[] = [];
  for (const st of sf.statements) {
    if (!(ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) || st.moduleSpecifier === undefined || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    if (!(resolveSpec(path, st.moduleSpecifier.text) ?? '').startsWith('src/chain/')) continue;
    const clause = ts.isImportDeclaration(st) ? st.importClause : undefined;
    const typeOnly = ts.isImportDeclaration(st) ? clause?.isTypeOnly === true : st.isTypeOnly;
    const bindings = ts.isImportDeclaration(st) ? clause?.namedBindings : st.exportClause;
    const names = bindings !== undefined && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings)) ? bindings.elements.map((e) => e.name.text) : ['*'];
    if (!typeOnly || clause?.name !== undefined || names.some((n) => n !== 'Hex32')) bad.push(st.getText(sf));
  }
  return bad;
}

/** A relative specifier resolved to a repo path (`.js` → `.ts`); null for a package. */
function resolveSpec(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  return relative(ROOT, normalize(join(ROOT, dirname(from), spec))).replace(/\.js$/, '.ts');
}

const inArc = (path: string): boolean => ARC_DIRS.some((d) => path.startsWith(d));

/** Literals that only Arc code may carry (lower-cased for comparison). */
const ARC_STRINGS = [
  '0xfffffffffffffffffffffffffffffffffffffffe',
  '0x3600000000000000000000000000000000000000',
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  'arctestnet',
];
const ARC_NUMBERS = ['5042002', '5042', '32012', '32014', '32602'];

function arcLiterals(path: string): string[] {
  const sf = ts.createSourceFile(path, readFileSync(join(ROOT, path), 'utf8'), ts.ScriptTarget.ES2022, true);
  const found: string[] = [];
  const walk = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const text = node.text.toLowerCase();
      for (const a of ARC_STRINGS) if (text.includes(a)) found.push(a);
    }
    if (ts.isNumericLiteral(node) || ts.isBigIntLiteral(node)) {
      const digits = node.text.replace(/n$/, '').replace(/_/g, '');
      if (ARC_NUMBERS.includes(digits)) found.push(digits);
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return found;
}

const SRC = sourceFiles('src');

describe('network dependency lint rule (m5)', () => {
  it('finds the Arc adapter, the indexer, the port and the fake network', () => {
    expect(SRC).toEqual(expect.arrayContaining(['src/network/types.ts', 'src/network/arc/adapter.ts', 'src/indexer/indexer.ts', 'src/network/fake/adapter.ts']));
  });

  it('nothing outside the Arc adapter and its indexer imports them (composition roots excepted)', () => {
    const offenders = SRC.filter((f) => !inArc(f) && !COMPOSITION_ROOTS.includes(f)).flatMap((f) =>
      specifiers(f)
        .map((spec) => resolveSpec(f, spec))
        .filter((target): target is string => target !== null && inArc(target))
        .map((target) => `${f} → ${target}`),
    );
    expect(offenders).toEqual([]);
  });

  it('the network port and the fake network carry no Arc literal and import no Arc module', () => {
    const files = SRC.filter(ARC_FREE);
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const f of files) {
      expect(arcLiterals(f), f).toEqual([]);
      expect(chainImportsBeyondHex32(f), f).toEqual([]);
      expect(specifiers(f).filter((spec) => inArc(resolveSpec(f, spec) ?? '')), f).toEqual([]);
    }
  });

  it('the rule catches a planted violation', () => {
    expect(resolveSpec('src/gateway/index.ts', '../indexer/indexer.js')).toBe('src/indexer/indexer.ts');
    expect(inArc(resolveSpec('src/network/fake/adapter.ts', '../arc/adapter.js') as string)).toBe(true);
    expect(resolveSpec('src/x.ts', 'node:crypto')).toBeNull();
    expect(arcLiterals('src/network/arc/params.ts')).toEqual(['5042002', 'arctestnet']);
    expect(chainImportsBeyondHex32('src/network/arc/params.ts')).toEqual([]);
    expect(chainImportsBeyondHex32('src/network/arc/config.ts')).toHaveLength(1);
    expect(arcLiterals('src/indexer/indexer.ts')).toContain('5042002');
  });
});
