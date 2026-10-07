/**
 * JQUOTE `FiatMinor<CCY>` mixing, by reconstruction (verifier JQUOTE-R1 m1):
 * proves that every `@ts-expect-error` in test/types/fiat-mixing.typecheck.ts
 * is satisfied by the intended error and not by an unrelated one (a typo
 * would also satisfy a bare directive).
 *
 * Method: strip each directive (keeping line numbers), compile the stripped
 * copy with the project's tsc in a fresh mkdtemp directory, and require that
 * each tagged line fails with exactly its tagged TS code, and that no
 * untagged line fails.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const sourceFile = join(repoRoot, 'test/types/fiat-mixing.typecheck.ts');
const tscBin = join(repoRoot, 'node_modules/typescript/bin/tsc');
const amountsModule = join(repoRoot, 'src/amounts/index.js');
const fiatModule = join(repoRoot, 'src/journey/quote/fiat.js');

const DIRECTIVE = /^\s*\/\/ @ts-expect-error MIX:([a-z0-9-]+) expect (TS\d{4})\s*$/;

interface Expectation {
  readonly id: string;
  readonly code: string;
  /** 1-based line of the statement the directive guards. */
  readonly line: number;
}

function stripAndCompile(): { expectations: Expectation[]; errors: Map<number, string[]>; rawDirectives: number } {
  const lines = readFileSync(sourceFile, 'utf8').split('\n');
  const expectations: Expectation[] = [];
  let rawDirectives = 0;
  const stripped = lines.map((text, index) => {
    if (text.trimStart().startsWith('// @ts-expect-error')) {
      rawDirectives += 1;
      const match = DIRECTIVE.exec(text);
      if (match) {
        expectations.push({ id: match[1] as string, code: match[2] as string, line: index + 2 });
      }
      return '';
    }
    return text.split("'../../src/amounts/index.js'").join(JSON.stringify(amountsModule)).split("'../../src/journey/quote/fiat.js'").join(JSON.stringify(fiatModule));
  });

  const dir = mkdtempSync(join(tmpdir(), 'arc-jquote-fiat-mix-'));
  try {
    const file = join(dir, 'stripped.ts');
    writeFileSync(file, stripped.join('\n'));
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({
        extends: join(repoRoot, 'tsconfig.json'),
        compilerOptions: { noUnusedLocals: false, typeRoots: [join(repoRoot, 'node_modules/@types')] },
        include: [],
        files: [file],
      }),
    );
    let output = '';
    try {
      output = execFileSync(process.execPath, [tscBin, '--noEmit', '--pretty', 'false', '-p', join(dir, 'tsconfig.json')], {
        encoding: 'utf8',
      });
    } catch (error) {
      output = String((error as { stdout?: unknown }).stdout ?? '');
    }
    const errors = new Map<number, string[]>();
    for (const line of output.split('\n')) {
      const m = /stripped\.ts\((\d+),\d+\): error (TS\d{4})/.exec(line);
      if (m) {
        const lineNo = Number.parseInt(m[1] as string, 10);
        errors.set(lineNo, [...(errors.get(lineNo) ?? []), m[2] as string]);
      } else if (/error TS\d{4}/.test(line)) {
        throw new Error(`unexpected compiler error outside the stripped file: ${line}`);
      }
    }
    return { expectations, errors, rawDirectives };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('JQUOTE FiatMinor<CCY>: mixing currencies, or fiat with U1 amounts, fails to compile (reconstructed)', () => {
  const { expectations, errors, rawDirectives } = stripAndCompile();

  it('every @ts-expect-error carries a MIX tag', () => {
    expect(rawDirectives).toBe(expectations.length);
    expect(expectations.length).toBe(9);
  });

  it('covers add and subtract in both orders', () => {
    const ids = new Set(expectations.map((e) => e.id));
    for (const op of ['add', 'sub']) {
      expect(ids.has(`${op}-zar-usd`)).toBe(true);
      expect(ids.has(`${op}-usd-zar`)).toBe(true);
    }
  });

  it.each(expectations.map((e) => [e.id, e] as const))('%s fails with its tagged code only', (_id, e) => {
    expect(errors.get(e.line)).toEqual([e.code]);
  });

  it('no untagged line fails to compile (same-currency use is accepted)', () => {
    const tagged = new Set(expectations.map((e) => e.line));
    const untagged = [...errors.keys()].filter((line) => !tagged.has(line));
    expect(untagged).toEqual([]);
  });
});
