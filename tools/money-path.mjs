/**
 * Reads docs/MONEY_PATH.md (the single source of the money-path paths) for
 * vitest.config.ts (coverage include), the MC-01 float lint and the
 * money-path consistency test.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function table(md, heading) {
  const at = md.indexOf(`\n## ${heading}\n`);
  if (at < 0) throw new Error(`MONEY_PATH.md: section "## ${heading}" not found`);
  const rest = md.slice(at + heading.length + 5);
  const end = rest.search(/\n## /);
  const body = end < 0 ? rest : rest.slice(0, end);
  const rows = body.split('\n').filter((l) => l.startsWith('|'));
  // drop header and separator rows
  return rows.slice(2).map((l) =>
    l
      .replace(/^\|/, '')
      .replace(/\|\s*$/, '')
      .split('|')
      .map((c) => c.trim().replace(/^`(.*)`$/, '$1')),
  );
}

export function readMoneyPath(root = process.cwd()) {
  const md = readFileSync(join(root, 'docs/MONEY_PATH.md'), 'utf8');
  const listed = table(md, 'Listed paths').map(([path, item, unit]) => ({ path, item: Number.parseInt(item, 10), unit }));
  const parts = table(md, 'Named parts').map(([item, part, path, anchor]) => ({ item: Number.parseInt(item, 10), part, path, anchor }));
  const excluded = table(md, 'Excluded from the import-graph closure').map(([path, reachedFrom, reason]) => ({ path, reachedFrom, reason }));
  const numberAllow = table(md, 'Number allow-list').map(([path, decl, meaning]) => ({ path, decl, meaning }));
  for (const a of numberAllow) {
    if (!a.path || !a.decl || !a.meaning) throw new Error(`MONEY_PATH.md: incomplete Number allow-list row ${JSON.stringify(a)}`);
    // Declaration identity: Name, Outer.member (nested allowed) or fn(i) / Outer.m(i). Never a bare pattern.
    if (!/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*(\(\d+\))?$/.test(a.decl)) {
      throw new Error(`MONEY_PATH.md: Number allow-list row is not a declaration identity: ${JSON.stringify(a)}`);
    }
  }
  if (listed.length === 0) throw new Error('MONEY_PATH.md: no listed paths');
  for (const r of [...listed, ...parts]) {
    if (!Number.isInteger(r.item) || r.item < 1 || r.item > 10) throw new Error(`MONEY_PATH.md: bad item in ${JSON.stringify(r)}`);
  }
  return { listed, parts, excluded, numberAllow, paths: listed.map((l) => l.path) };
}
