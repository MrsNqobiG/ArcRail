/**
 * HTTP edge: decimal strings in, integer base units inside (CLAUDE.md "At an API edge amounts are decimal strings").
 * No floats: the text is split on '.', each side is checked by regex and joined as a bigint.
 */
import { cbsMinor } from '../amounts/index.js';
import type { CbsMinor, CbsPrecision } from '../amounts/index.js';

const DECIMAL_RE = /^(0|[1-9][0-9]*)(\.([0-9]+))?$/;

export type ParsedAmount = { readonly ok: true; readonly minor: CbsMinor } | { readonly ok: false; readonly reason: string };

/** `"2.50"` at p = 6 is 2_500_000. More places than `p` is refused (never rounded), zero is refused, and so is anything not plain decimal text. */
export function parseDecimalAmount(text: unknown, p: CbsPrecision): ParsedAmount {
  if (typeof text !== 'string') return { ok: false, reason: 'amount must be a decimal string' };
  const m = DECIMAL_RE.exec(text);
  if (m === null) return { ok: false, reason: 'amount must be plain decimal text such as "2.50"' };
  const whole = m[1] as string;
  const frac = m[3] ?? '';
  const places = BigInt(p);
  if (BigInt(frac.length) > places) return { ok: false, reason: `amount has more than ${places} decimal places` };
  const minor = BigInt(whole + frac.padEnd(Number(places), '0'));
  if (minor <= 0n) return { ok: false, reason: 'amount must be greater than zero' };
  try {
    return { ok: true, minor: cbsMinor(minor) };
  } catch {
    return { ok: false, reason: 'amount is too large' };
  }
}
