/**
 * RUBRIC MC-02, by reconstruction: proves that every `@ts-expect-error` in
 * test/types/amount-mixing.typecheck.ts is satisfied by the intended error and
 * not by an unrelated one (a typo would also satisfy a bare directive).
 *
 * Method: strip each directive (keeping line numbers), compile the stripped
 * copy with the project's tsc, and require that each tagged line fails with
 * exactly its tagged TS code, and that no untagged line fails.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const sourceFile = join(repoRoot, 'test/types/amount-mixing.typecheck.ts');
const tscBin = join(repoRoot, 'node_modules/typescript/bin/tsc');
const amountsModule = join(repoRoot, 'src/amounts/index.js');

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
    return text.replace("'../../src/amounts/index.js'", JSON.stringify(amountsModule));
  });

  const dir = mkdtempSync(join(tmpdir(), 'arc-mc02-'));
  try {
    const file = join(dir, 'stripped.ts');
    writeFileSync(file, stripped.join('\n'));
    // Same module kind as the repository (package.json "type": "module").
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({
        extends: join(repoRoot, 'tsconfig.json'),
        compilerOptions: { types: [], noUnusedLocals: false },
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

describe('MC-02 amount types cannot be mixed (compile-fail, reconstructed)', () => {
  const { expectations, errors, rawDirectives } = stripAndCompile();

  it('every @ts-expect-error carries a MIX tag', () => {
    expect(rawDirectives).toBe(expectations.length);
    expect(expectations.length).toBe(25);
  });

  it('covers every ordered pair for assignment and argument passing, and every unordered pair for equality and raw sums', () => {
    const ids = new Set(expectations.map((e) => e.id));
    for (const [from, to] of [
      ['cbs', 'usdc'],
      ['cbs', 'wei'],
      ['usdc', 'cbs'],
      ['usdc', 'wei'],
      ['wei', 'cbs'],
      ['wei', 'usdc'],
    ] as const) {
      expect(ids.has(`assign-${from}-to-${to}`)).toBe(true);
      expect(ids.has(`arg-${from}-to-${to}`)).toBe(true);
    }
    for (const pair of ['cbs-usdc', 'cbs-wei', 'usdc-wei']) {
      expect(ids.has(`eq-${pair}`)).toBe(true);
    }
  });

  it.each(expectations.map((e) => [e.id, e] as const))('%s fails with its tagged code only', (_id, e) => {
    expect(errors.get(e.line)).toEqual([e.code]);
  });

  it('no untagged line fails to compile', () => {
    const tagged = new Set(expectations.map((e) => e.line));
    const untagged = [...errors.keys()].filter((line) => !tagged.has(line));
    expect(untagged).toEqual([]);
  });
});
