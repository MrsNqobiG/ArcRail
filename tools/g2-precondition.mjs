#!/usr/bin/env node
/**
 * G2 precondition (RUBRIC MC-33, KICKOFF Phase 2): cosign-signed artefacts and
 * SLSA provenance must be produced and verified in hosted CI before gate G2 is
 * signed.
 *
 * Stages come in two kinds:
 *  - skipped:   the stage did not run here and nothing else runs it. Any
 *               skipped stage fails once G2 is signed.
 *  - delegated: the stage did not run here because it runs in
 *               .github/workflows/release-sign.yml (keyless, GitHub OIDC).
 *               scripts/ci.sh passes cosign and slsa this way. The
 *               release-sign run is the evidence, so it must be cited.
 *
 * A signed G2 row (any status not starting with `NOT SIGNED`) must cite, in
 * that same row, a release-sign run as a URL of the exact form
 *   https://github.com/MrsNqobiG/ArcRail/actions/runs/<run-id>
 * (run-id = digits; not followed by a further path such as /job/<id> or
 * /attempts/<n>). Without it CI fails, whatever stages were passed. The check
 * is offline: it proves a citation exists, not that the cited run passed; the
 * human who signs G2 cites a run whose g2-evidence artefact is all green
 * (docs/CI.md).
 *
 * Fail-closed parsing: the G2 row is the one table row whose first cell is
 * exactly `G2`, with status in the third cell (Gate | Meaning | Status | …).
 * A missing or duplicated G2 row fails. A status that doesn't start with
 * `NOT SIGNED` counts as signed, whatever its wording.
 *
 * Usage: node tools/g2-precondition.mjs <GATES.md> [--delegated=<stage>[,<stage>...]] [skipped-stage ...]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUN_URL = /https:\/\/github\.com\/MrsNqobiG\/ArcRail\/actions\/runs\/(\d+)(?![\w/.-]*[\w/-])/g;

/** Run IDs cited in `text` as release-sign run URLs (exact form only). */
export function citedRunIds(text) {
  return [...text.matchAll(RUN_URL)].map((m) => m[1]);
}

export function g2Problems(markdown, skipped, delegated = []) {
  const rows = markdown
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))
    .map((l) => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()))
    .filter((cells) => cells[0] === 'G2');
  if (rows.length !== 1) return [`G2: expected exactly one row in the gates file, found ${rows.length}`];
  const status = rows[0][2] ?? '';
  const unsigned = /^NOT SIGNED\b/.test(status);
  if (unsigned) return [];
  const problems = [];
  if (citedRunIds(rows[0].join(' | ')).length === 0) {
    problems.push(
      `G2 status is "${status}" but the G2 row cites no release-sign run ` +
        `(https://github.com/MrsNqobiG/ArcRail/actions/runs/<run-id>)` +
        `${delegated.length ? `, the evidence for the delegated stages: ${delegated.join(', ')}` : ''} (MC-33, docs/CI.md)`,
    );
  }
  if (skipped.length > 0) {
    problems.push(`G2 status is "${status}" but these G2-precondition stages were SKIPPED: ${skipped.join(', ')} (MC-33)`);
  }
  return problems;
}

/** Split the CLI arguments after the gates file. Unknown options throw. */
export function parseStageArgs(args) {
  const skipped = [];
  const delegated = [];
  for (const a of args) {
    if (a.startsWith('--delegated=')) {
      const list = a.slice('--delegated='.length).split(',');
      if (list.some((s) => s.length === 0)) throw new Error(`empty stage name in ${a}`);
      delegated.push(...list);
    } else if (a.startsWith('-')) {
      throw new Error(`unknown option: ${a}`);
    } else {
      skipped.push(a);
    }
  }
  return { skipped, delegated };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [file, ...rest] = process.argv.slice(2);
  if (!file || file.startsWith('-')) {
    console.error('usage: g2-precondition.mjs <GATES.md> [--delegated=<stage>[,<stage>...]] [skipped-stage ...]');
    process.exit(2);
  }
  let parsed;
  try {
    parsed = parseStageArgs(rest);
  } catch (e) {
    console.error(`FAIL: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }
  const { skipped, delegated } = parsed;
  let md;
  try {
    md = readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`FAIL: cannot read ${file}: ${String(e)}`);
    process.exit(1);
  }
  const problems = g2Problems(md, skipped, delegated);
  for (const p of problems) console.error(`FAIL: ${p}`);
  if (problems.length === 0) {
    const notes = [];
    if (delegated.length) notes.push(`delegated to .github/workflows/release-sign.yml: ${delegated.join(', ')}`);
    if (skipped.length) notes.push(`skipped stages still allowed: ${skipped.join(', ')}`);
    console.log(`G2 precondition ok${notes.length ? `; ${notes.join('; ')}` : ''}`);
  }
  process.exit(problems.length > 0 ? 1 : 0);
}
