#!/usr/bin/env node
/**
 * G2 precondition (RUBRIC MC-33, KICKOFF Phase 2): cosign-signed artefacts and
 * SLSA provenance must be produced and verified in CI before gate G2 is
 * signed. scripts/ci.sh passes the stages it had to SKIP; this check fails
 * if any stage was skipped while the G2 row of docs/GATES.md is anything but
 * NOT SIGNED.
 *
 * Fail-closed parsing: the G2 row is the one table row whose first cell is
 * exactly `G2`, with status in the third cell (Gate | Meaning | Status | …).
 * A missing or duplicated G2 row fails. A status that doesn't start with
 * `NOT SIGNED` counts as signed, whatever its wording.
 *
 * Usage: node tools/g2-precondition.mjs <GATES.md> [skipped-stage ...]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function g2Problems(markdown, skipped) {
  const rows = markdown
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))
    .map((l) => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()))
    .filter((cells) => cells[0] === 'G2');
  if (rows.length !== 1) return [`G2: expected exactly one row in the gates file, found ${rows.length}`];
  const status = rows[0][2] ?? '';
  const unsigned = /^NOT SIGNED\b/.test(status);
  if (!unsigned && skipped.length > 0) {
    return [`G2 status is "${status}" but these G2-precondition stages were SKIPPED: ${skipped.join(', ')} (MC-33)`];
  }
  return [];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [file, ...skipped] = process.argv.slice(2);
  if (!file) {
    console.error('usage: g2-precondition.mjs <GATES.md> [skipped-stage ...]');
    process.exit(2);
  }
  let md;
  try {
    md = readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`FAIL: cannot read ${file}: ${String(e)}`);
    process.exit(1);
  }
  const problems = g2Problems(md, skipped);
  for (const p of problems) console.error(`FAIL: ${p}`);
  if (problems.length === 0) console.log(`G2 precondition ok: G2 not signed${skipped.length ? `; skipped stages still allowed: ${skipped.join(', ')}` : ''}`);
  process.exit(problems.length > 0 ? 1 : 0);
}
