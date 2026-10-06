/**
 * m5: signing G2 while cosign or SLSA is still SKIPPED fails CI. Synthetic
 * gates fixtures only; the real docs/GATES.md is never edited.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { g2Problems } from '../../tools/g2-precondition.mjs';

const doc = (status: string, extra = ''): string =>
  ['| Gate | Meaning | Status | Name | Role | Date |', '|---|---|---|---|---|---|', `| G1 | p1 | SIGNED-OFF | A | B | 2026-01-01 |`, `| G2 | Phase 2 skeleton | ${status} | | | |`, extra].join('\n');

describe('G2 precondition (cosign and SLSA before G2)', () => {
  it('passes while G2 is NOT SIGNED, even with both stages skipped', () => {
    expect(g2Problems(doc('NOT SIGNED'), ['cosign', 'slsa'])).toEqual([]);
    expect(g2Problems(doc('NOT SIGNED. Precondition: cosign and SLSA in hosted CI (MC-33)'), ['cosign'])).toEqual([]);
  });

  it.each(['SIGNED-OFF', 'signed-off', 'Signed off by A. Person', 'APPROVED', ''])('fails when G2 status is "%s" and a stage was skipped', (status) => {
    expect(g2Problems(doc(status), ['cosign', 'slsa'])[0]).toMatch(/G2-precondition stages were SKIPPED: cosign, slsa/);
  });

  it('passes a signed G2 once no stage is skipped', () => {
    expect(g2Problems(doc('SIGNED-OFF'), [])).toEqual([]);
  });

  it('fails closed on a missing or duplicated G2 row', () => {
    expect(g2Problems('| G1 | x | NOT SIGNED |', [])).toEqual(['G2: expected exactly one row in the gates file, found 0']);
    expect(g2Problems(doc('NOT SIGNED', '| G2 | dup | NOT SIGNED | | | |'), [])[0]).toMatch(/found 2/);
  });

  it('the real docs/GATES.md has exactly one G2 row (structure only)', () => {
    const real = readFileSync(new URL('../../docs/GATES.md', import.meta.url), 'utf8');
    expect(g2Problems(real, [])).toEqual([]);
  });
});
