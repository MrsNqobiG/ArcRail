/**
 * m9 dependency boundary (NOVA_ARC_DESIGN §3, CO-1 v3 rubric "agnosticism"):
 * DFNS knowledge stays inside `src/dfns/**` and the thin gateway `src/gateway/**`.
 * No other source file may import either directory, at runtime or as a type, until
 * a composition root exists and is added to ALLOWED_IMPORTERS by a LEDGER entry.
 * This test stands in for the tools/ dependency lint rule, which does not exist yet.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC = join(ROOT, 'src');
const GUARDED = ['src/dfns/', 'src/gateway/'];
/** Directories allowed to import the guarded ones (the guarded ones themselves; a composition root later). */
const ALLOWED_IMPORTERS = ['src/dfns/', 'src/gateway/'];
/**
 * Guarded files any unit may import. `src/dfns/json.ts` is the strict, float-free JSON parser
 * (MC-01): it carries no DFNS endpoint, field or state and imports nothing, which the
 * "neutral modules" test below proves. JPARTNER and the recipients module reuse it rather than
 * re-implement JSON parsing. Open item: move it to a shared path at integration.
 */
const NEUTRAL_TARGETS = ['src/dfns/json.ts'];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const posix = (p: string): string => p.split(sep).join('/');
/** Every module specifier in a file: static imports and re-exports (type or not), dynamic import() and require(). */
export function specifiers(text: string): string[] {
  const out: string[] = [];
  for (const re of [/\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g, /\bimport\s*['"]([^'"]+)['"]/g, /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g]) {
    for (const m of text.matchAll(re)) out.push(`${m[1]}`);
  }
  return out;
}

function violations(): string[] {
  const bad: string[] = [];
  for (const file of walk(SRC)) {
    const rel = posix(relative(ROOT, file));
    if (ALLOWED_IMPORTERS.some((a) => rel.startsWith(a))) continue;
    for (const spec of specifiers(readFileSync(file, 'utf8'))) {
      if (!spec.startsWith('.')) continue;
      const target = posix(relative(ROOT, resolve(dirname(file), spec))).replace(/\.js$/, '.ts');
      if (NEUTRAL_TARGETS.includes(target)) continue;
      if (GUARDED.some((g) => `${target}/`.startsWith(g))) bad.push(`${rel} imports ${spec}`);
    }
  }
  return bad;
}

describe('DFNS dependency boundary (m9)', () => {
  it('no file outside src/dfns and src/gateway imports them', () => {
    expect(violations()).toEqual([]);
  });
  it('neutral modules import nothing, so they carry no DFNS or gateway code to their importers', () => {
    for (const t of NEUTRAL_TARGETS) expect(specifiers(readFileSync(join(ROOT, t), 'utf8'))).toEqual([]);
  });
  it('only the neutral module is exempt: any other guarded file is still a violation', () => {
    expect(NEUTRAL_TARGETS).toEqual(['src/dfns/json.ts']);
  });
  it('the specifier scan sees every import form', () => {
    const text = [
      "import { a } from '../dfns/client.js';",
      "import type { B } from '../gateway/index.js';",
      "export { c } from '../dfns/types.js';",
      "export type { D } from '../dfns/json.js';",
      "import '../dfns/webhook.js';",
      "const e = await import('../gateway/wrapper.js');",
      "const f = require('../dfns/fakes/stores.js');",
      "import {\n  g,\n  h,\n} from '../dfns/x.js';",
    ].join('\n');
    expect(specifiers(text)).toEqual(
      expect.arrayContaining(['../dfns/client.js', '../gateway/index.js', '../dfns/types.js', '../dfns/json.js', '../dfns/webhook.js', '../gateway/wrapper.js', '../dfns/fakes/stores.js', '../dfns/x.js']),
    );
  });
});
