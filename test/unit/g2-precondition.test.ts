/**
 * m5: signing G2 while cosign or SLSA is still SKIPPED fails CI. A signed G2
 * row must also cite a release-sign run (hosted CI, keyless) as
 * https://github.com/MrsNqobiG/ArcRail/actions/runs/<run-id>; cosign and SLSA
 * stages that scripts/ci.sh delegates to that workflow are accepted only with
 * such a citation. Synthetic gates fixtures only; the real docs/GATES.md is
 * never edited.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { citedRunIds, g2Problems, parseStageArgs } from '../../tools/g2-precondition.mjs';

const doc = (status: string, extra = '', notes = ''): string =>
  [
    '| Gate | Meaning | Status | Name | Role | Date |',
    '|---|---|---|---|---|---|',
    `| G1 | p1 | SIGNED-OFF | A | B | 2026-01-01 |`,
    `| G2 | Phase 2 skeleton | ${status} | ${notes} | | |`,
    extra,
  ].join('\n');

const RUN = 'https://github.com/MrsNqobiG/ArcRail/actions/runs/12345678901';
const NO_CITATION = /G2 row cites no release-sign run/;

describe('G2 precondition (cosign and SLSA before G2)', () => {
  it('passes while G2 is NOT SIGNED, even with both stages skipped or delegated', () => {
    expect(g2Problems(doc('NOT SIGNED'), ['cosign', 'slsa'])).toEqual([]);
    expect(g2Problems(doc('NOT SIGNED. Precondition: cosign and SLSA in hosted CI (MC-33)'), ['cosign'])).toEqual([]);
    expect(g2Problems(doc('NOT SIGNED'), [], ['cosign', 'slsa'])).toEqual([]);
  });

  it.each(['SIGNED-OFF', 'signed-off', 'Signed off by A. Person', 'APPROVED', ''])('fails when G2 status is "%s" and a stage was skipped', (status) => {
    expect(g2Problems(doc(status), ['cosign', 'slsa'])).toContainEqual(expect.stringMatching(/G2-precondition stages were SKIPPED: cosign, slsa/));
  });

  it('a skipped (not delegated) stage still fails a signed G2 that cites a run', () => {
    expect(g2Problems(doc(`SIGNED-OFF. release-sign run ${RUN}`), ['cosign'])).toEqual([
      expect.stringMatching(/stages were SKIPPED: cosign/),
    ]);
  });

  it('passes a signed G2 with delegated cosign and SLSA when the row cites a release-sign run', () => {
    expect(g2Problems(doc(`SIGNED-OFF. release-sign run ${RUN}`), [], ['cosign', 'slsa'])).toEqual([]);
    expect(g2Problems(doc('SIGNED-OFF', '', `evidence: [release-sign](${RUN})`), [], ['cosign', 'slsa'])).toEqual([]);
    expect(g2Problems(doc(`SIGNED-OFF. release-sign run ${RUN}.`), [])).toEqual([]);
  });

  it.each(['SIGNED-OFF', 'Signed off by A. Person', 'APPROVED', ''])('fails a signed G2 ("%s") whose row cites no release-sign run', (status) => {
    const p = g2Problems(doc(status), [], ['cosign', 'slsa']);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(NO_CITATION);
    expect(p[0]).toMatch(/delegated stages: cosign, slsa/);
    expect(g2Problems(doc(status), [])).toEqual([expect.stringMatching(NO_CITATION)]);
  });

  it('reports both a missing citation and a skipped stage', () => {
    const p = g2Problems(doc('SIGNED-OFF'), ['slsa'], ['cosign']);
    expect(p).toHaveLength(2);
    expect(p[0]).toMatch(NO_CITATION);
    expect(p[1]).toMatch(/stages were SKIPPED: slsa/);
  });

  it.each([
    ['another repository', 'https://github.com/someone/ArcRail/actions/runs/123'],
    ['another repository name', 'https://github.com/MrsNqobiG/ArcRail2/actions/runs/123'],
    ['different case', 'https://github.com/mrsnqobig/arcrail/actions/runs/123'],
    ['http, not https', 'http://github.com/MrsNqobiG/ArcRail/actions/runs/123'],
    ['a look-alike host', 'https://github.com.evil.example/MrsNqobiG/ArcRail/actions/runs/123'],
    ['a job URL', 'https://github.com/MrsNqobiG/ArcRail/actions/runs/123/job/456'],
    ['an attempt URL', 'https://github.com/MrsNqobiG/ArcRail/actions/runs/123/attempts/2'],
    ['a non-numeric id', 'https://github.com/MrsNqobiG/ArcRail/actions/runs/abc'],
    ['a trailing word', 'https://github.com/MrsNqobiG/ArcRail/actions/runs/123abc'],
    ['the workflow page, not a run', 'https://github.com/MrsNqobiG/ArcRail/actions/workflows/release-sign.yml'],
    ['no id', 'https://github.com/MrsNqobiG/ArcRail/actions/runs/'],
  ])('does not accept %s as a citation', (_label, url) => {
    expect(citedRunIds(url)).toEqual([]);
    expect(g2Problems(doc(`SIGNED-OFF. release-sign run ${url}`), [], ['cosign', 'slsa'])).toEqual([expect.stringMatching(NO_CITATION)]);
  });

  it('accepts only a citation in the G2 row itself, not elsewhere in the file', () => {
    const elsewhere = doc('SIGNED-OFF', `| G3 | other | SIGNED-OFF ${RUN} | | | |\n\nEvidence: ${RUN}`);
    expect(g2Problems(elsewhere, [], ['cosign', 'slsa'])).toEqual([expect.stringMatching(NO_CITATION)]);
  });

  it('extracts the run id from each exact citation', () => {
    expect(citedRunIds(`run ${RUN}, (${RUN.replace('12345678901', '42')}) and ${RUN.replace('12345678901', '7')}.`)).toEqual(['12345678901', '42', '7']);
  });

  it('fails closed on a missing or duplicated G2 row', () => {
    expect(g2Problems('| G1 | x | NOT SIGNED |', [])).toEqual(['G2: expected exactly one row in the gates file, found 0']);
    expect(g2Problems(doc('NOT SIGNED', '| G2 | dup | NOT SIGNED | | | |'), [])[0]).toMatch(/found 2/);
  });

  it('parses --delegated and rejects unknown options or empty stage names', () => {
    expect(parseStageArgs(['--delegated=cosign,slsa'])).toEqual({ skipped: [], delegated: ['cosign', 'slsa'] });
    expect(parseStageArgs(['cosign', '--delegated=slsa'])).toEqual({ skipped: ['cosign'], delegated: ['slsa'] });
    expect(parseStageArgs([])).toEqual({ skipped: [], delegated: [] });
    expect(() => parseStageArgs(['--delegate=cosign'])).toThrow(/unknown option/);
    expect(() => parseStageArgs(['--delegated='])).toThrow(/empty stage name/);
    expect(() => parseStageArgs(['--delegated=cosign,'])).toThrow(/empty stage name/);
  });

  it('CLI: exit 0 / 1 / 2 on fixture files, as scripts/ci.sh and release-sign.yml call it', () => {
    const tool = fileURLToPath(new URL('../../tools/g2-precondition.mjs', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'g2-'));
    const run = (gates: string, ...args: string[]): number => {
      const f = join(dir, 'GATES.md');
      writeFileSync(f, gates);
      try {
        execFileSync(process.execPath, [tool, f, ...args], { stdio: 'pipe' });
        return 0;
      } catch (e) {
        return (e as { status: number }).status;
      }
    };
    try {
      expect(run(doc('NOT SIGNED'), '--delegated=cosign,slsa')).toBe(0);
      expect(run(doc('SIGNED-OFF'), '--delegated=cosign,slsa')).toBe(1);
      expect(run(doc(`SIGNED-OFF. release-sign run ${RUN}`), '--delegated=cosign,slsa')).toBe(0);
      expect(run(doc('SIGNED-OFF'))).toBe(1);
      expect(run(doc(`SIGNED-OFF. release-sign run ${RUN}`))).toBe(0);
      expect(run(doc(`SIGNED-OFF. release-sign run ${RUN}`), 'cosign', 'slsa')).toBe(1);
      expect(run(doc('NOT SIGNED'), '--bogus')).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the real docs/GATES.md has exactly one G2 row (structure only)', () => {
    const real = readFileSync(new URL('../../docs/GATES.md', import.meta.url), 'utf8');
    expect(g2Problems(real, [])).toEqual([]);
  });
});
