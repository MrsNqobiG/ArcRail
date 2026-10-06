/**
 * m10: the SCA gate's threshold (MC-33 "0 high or critical") on crafted
 * osv-scanner JSON. A gate that let HIGH, CVSS 7.0–8.9, unknown severity,
 * MAL- records or bad input through fails here.
 */
import { describe, expect, it } from 'vitest';
import { evaluateOsvReport } from '../../tools/osv-gate.mjs';

function report(label: string | null, score: string | null, id = 'GHSA-xxxx-yyyy-zzzz'): string {
  return JSON.stringify({
    results: [
      {
        packages: [
          {
            package: { name: 'pkg', version: '1.0.0' },
            vulnerabilities: [{ id, summary: 's', ...(label === null ? {} : { database_specific: { severity: label } }) }],
            groups: score === null ? [{ ids: [id] }] : [{ ids: [id], max_severity: score }],
          },
        ],
      },
    ],
  });
}

describe('osv-gate threshold', () => {
  it.each([
    ['HIGH label, CVSS 7.1', 'HIGH', '7.1'],
    ['HIGH label, no score', 'HIGH', null],
    ['CRITICAL label', 'CRITICAL', '9.8'],
    ['MODERATE label but CVSS 7.0', 'MODERATE', '7.0'],
    ['LOW label but CVSS 8.9', 'LOW', '8.9'],
    ['no label, CVSS 7.5', null, '7.5'],
    ['unknown severity (no label, no score)', null, null],
    ['unparseable score', 'MODERATE', 'n/a'],
  ])('blocks: %s', (_n, label, score) => {
    const r = evaluateOsvReport(report(label, score));
    expect(r.ok).toBe(false);
    expect(r.blocking).toBe(1);
  });

  it('blocks a malicious-package record without severity', () => {
    expect(evaluateOsvReport(report(null, null, 'MAL-2026-1234')).ok).toBe(false);
  });

  it.each([
    ['MODERATE, CVSS 6.9', 'MODERATE', '6.9'],
    ['LOW, CVSS 3.1', 'LOW', '3.1'],
    ['MODERATE, no score', 'MODERATE', null],
    ['no label, CVSS 6.9', null, '6.9'],
  ])('reports only: %s', (_n, label, score) => {
    const r = evaluateOsvReport(report(label, score));
    expect(r.ok).toBe(true);
    expect(r.reported).toBe(1);
  });

  it.each([['not JSON', '{'], ['empty', ''], ['no results array', '{"results":null}']])('fails closed on bad input: %s', (_n, input) => {
    expect(evaluateOsvReport(input).ok).toBe(false);
  });

  // m18: real scans hold many results, packages and vulnerabilities. The blocking
  // finding is never first, so a gate that read only the first result, package or
  // vulnerability (mutants O12, O13) passes it and fails here.
  type V = { id: string; label: string | null; score: string | null };
  const vuln = (v: V) => ({ id: v.id, summary: 's', ...(v.label === null ? {} : { database_specific: { severity: v.label } }) });
  const group = (v: V) => (v.score === null ? { ids: [v.id] } : { ids: [v.id], max_severity: v.score });
  const pkg = (name: string, vs: V[]) => ({ package: { name, version: '1.0.0' }, vulnerabilities: vs.map(vuln), groups: vs.map(group) });
  const low = (id: string): V => ({ id, label: 'LOW', score: '3.1' });
  const moderate = (id: string): V => ({ id, label: 'MODERATE', score: '5.3' });
  const high: V = { id: 'GHSA-high-high-high', label: 'HIGH', score: '7.5' };

  it.each([
    ['second vulnerability of the only package', [{ packages: [pkg('a', [low('GHSA-a1'), high])] }]],
    ['second package of the only result', [{ packages: [pkg('a', [low('GHSA-a1')]), pkg('b', [high])] }]],
    ['second vulnerability of the second package', [{ packages: [pkg('a', [low('GHSA-a1'), moderate('GHSA-a2')]), pkg('b', [low('GHSA-b1'), high, low('GHSA-b3')])] }]],
    ['second result (lockfile)', [{ packages: [pkg('a', [low('GHSA-a1')])] }, { packages: [pkg('c', [moderate('GHSA-c1'), high])] }]],
  ])('blocks a HIGH that is not first: %s', (_n, results) => {
    const r = evaluateOsvReport(JSON.stringify({ results }));
    expect(r.ok).toBe(false);
    expect(r.blocking).toBe(1);
    expect(r.lines.filter((l) => l.startsWith('BLOCKING')).join('\n')).toContain('GHSA-high-high-high');
  });

  it('counts every finding across results, packages and vulnerabilities', () => {
    const results = [
      { packages: [pkg('a', [low('GHSA-a1'), moderate('GHSA-a2')]), pkg('b', [low('GHSA-b1'), high])] },
      { packages: [pkg('c', [moderate('GHSA-c1'), { id: 'MAL-2026-1', label: null, score: null }])] },
    ];
    expect(evaluateOsvReport(JSON.stringify({ results }))).toMatchObject({ ok: false, blocking: 2, reported: 4 });
  });

  it('passes many report-only findings across packages', () => {
    const results = [{ packages: [pkg('a', [low('GHSA-a1'), moderate('GHSA-a2')]), pkg('b', [low('GHSA-b1'), moderate('GHSA-b2')])] }];
    expect(evaluateOsvReport(JSON.stringify({ results }))).toMatchObject({ ok: true, blocking: 0, reported: 4 });
  });

  it('passes an empty result set', () => {
    expect(evaluateOsvReport('{"results":[]}')).toMatchObject({ ok: true, blocking: 0, reported: 0 });
  });
});
