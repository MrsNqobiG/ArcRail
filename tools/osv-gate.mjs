#!/usr/bin/env node
/**
 * SCA gate (RUBRIC MC-33: 0 high or critical findings). Reads osv-scanner
 * JSON output on stdin and exits non-zero on a finding at or above the
 * threshold.
 *
 * Threshold (fail closed):
 * - FAIL: GHSA severity label HIGH or CRITICAL, or a CVSS score ≥ 7.0
 *   (osv-scanner `groups[].max_severity`);
 * - FAIL: severity unknown (no label and no score), which includes malicious-package
 *   (MAL-) records, because "unrated" is not "low";
 * - FAIL: a score that is present but not a number;
 * - FAIL: input that is not osv-scanner JSON with a `results` array;
 * - REPORT ONLY: MODERATE or LOW with a CVSS score below 7.0 (or no score). These
 *   are printed on every run and recorded in docs/verification/tooling-phase2.md.
 * Unit tests: test/unit/osv-gate.test.ts. CI self-tests: scripts/sca.sh
 * (a CRITICAL and a HIGH-only fixture lockfile must both fail).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BLOCKING_LABELS = new Set(['HIGH', 'CRITICAL']);
const REPORT_LABELS = new Set(['MODERATE', 'MEDIUM', 'LOW']);

/** @returns {{ ok: boolean, blocking: number, reported: number, lines: string[] }} */
export function evaluateOsvReport(input) {
  let report;
  try {
    report = JSON.parse(input);
  } catch {
    return { ok: false, blocking: 1, reported: 0, lines: ['FAIL: osv-scanner output is not JSON'] };
  }
  if (!report || !Array.isArray(report.results)) {
    return { ok: false, blocking: 1, reported: 0, lines: ['FAIL: osv-scanner output has no results array'] };
  }
  let blocking = 0;
  let reported = 0;
  const lines = [];
  for (const result of report.results) {
    for (const pkg of result.packages ?? []) {
      const name = `${pkg.package?.name}@${pkg.package?.version}`;
      const groups = pkg.groups ?? [];
      for (const vuln of pkg.vulnerabilities ?? []) {
        const label = String(vuln.database_specific?.severity ?? '').toUpperCase();
        const group = groups.find((g) => (g.ids ?? []).includes(vuln.id) || (g.aliases ?? []).includes(vuln.id));
        const scoreText = String(group?.max_severity ?? '').trim();
        // CVSS base score (a severity, not money): decimal text such as "7.5".
        const scoreValid = /^\d+(\.\d+)?$/.test(scoreText);
        const score = scoreValid ? Number.parseFloat(scoreText) : null;
        let verdict;
        if (scoreText !== '' && !scoreValid) verdict = 'BLOCKING (unparseable score)';
        else if (BLOCKING_LABELS.has(label) || (score !== null && score >= 7)) verdict = 'BLOCKING';
        else if (REPORT_LABELS.has(label)) verdict = 'report-only';
        else if (label === '' && score !== null) verdict = 'report-only';
        else verdict = 'BLOCKING (severity unknown)';
        if (verdict.startsWith('BLOCKING')) blocking += 1;
        else reported += 1;
        lines.push(`${verdict}: ${name} ${vuln.id} label=${label || '-'} cvss=${scoreText || '-'} ${vuln.summary ?? ''}`);
      }
    }
  }
  lines.push(`SCA: ${blocking} blocking (HIGH/CRITICAL/unknown), ${reported} report-only (MODERATE/LOW)`);
  return { ok: blocking === 0, blocking, reported, lines };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = evaluateOsvReport(readFileSync(0, 'utf8'));
  for (const l of r.lines) console.log(l);
  process.exit(r.ok ? 0 : 1);
}
