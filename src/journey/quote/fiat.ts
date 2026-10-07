/**
 * JQUOTE fiat amounts: `FiatMinor<CCY>`, one brand per currency (CLAUDE.md
 * "Money invariants": "plus one `FiatMinor<CCY>` per payout currency").
 *
 * Built on the U1 patterns (src/amounts/index.ts) without modifying U1:
 * - a `bigint` brand, never a `number` (MC-01);
 * - a checked constructor: non-negative, at most `CBS_MINOR_MAX` (the U1
 *   overflow bound, fail closed), so a fiat amount always fits the ledger;
 * - checked same-currency add and subtract; a negative difference throws.
 *
 * Mixing currencies is a compile error when the currency is a literal type
 * (`FiatAmount<'ZAR'>` vs `FiatAmount<'USD'>`): the second operand is typed
 * `NoInfer<C>`, so C is taken from the first operand only and never widened
 * to a union (compile-fail proof: test/types/fiat-mixing.typecheck.ts).
 * Currencies known only at run time are typed `FiatCode`, so every operation
 * here also checks the currency at run time and throws
 * `FiatCurrencyMismatchError` (fail closed).
 *
 * The minor unit of a currency is the one Nova's ledger uses for that asset
 * code [A-03]; this module never scales between precisions. There is no
 * conversion here: fiat↔USDC is Nova's engine (FxPort) and USDC→payout fiat
 * is the payout partner (PayoutQuotePort). This module only carries amounts.
 */
import { CBS_MINOR_MAX } from '../../amounts/index.js';
import type { CbsMinor } from '../../amounts/index.js';
import type { FiatCode } from '../../nova-ports/ids.js';

declare const fiatMinorUnit: unique symbol;

/** Minor units of fiat currency `C` at Nova's ledger precision for `C` [A-03]. */
export type FiatMinor<C extends string> = bigint & { readonly [fiatMinorUnit]: C };

/** A fiat amount with its currency carried at run time too. */
export interface FiatAmount<C extends string = FiatCode> {
  readonly currency: C;
  readonly minor: FiatMinor<C>;
}

/** Two fiat amounts in different currencies were combined. Fail closed. */
export class FiatCurrencyMismatchError extends TypeError {
  readonly code = 'FIAT_CURRENCY_MISMATCH';

  constructor(a: string, b: string) {
    super(`fiat currency mismatch: ${a} vs ${b}`);
    this.name = 'FiatCurrencyMismatchError';
  }
}

const ISO_4217 = /^[A-Z]{3}$/;

/**
 * Checked constructor. Throws TypeError on a non-bigint value or a malformed
 * ISO 4217 code, RangeError on a negative value or one above `CBS_MINOR_MAX`.
 */
export function fiatAmount<C extends string>(currency: C, minor: bigint): FiatAmount<C> {
  if (!ISO_4217.test(currency)) throw new TypeError(`invalid ISO 4217 code: ${JSON.stringify(currency)}`);
  if (typeof minor !== 'bigint') throw new TypeError(`FiatMinor requires a bigint, got ${typeof minor}`);
  if (minor < 0n) throw new RangeError('FiatMinor must not be negative');
  if (minor > CBS_MINOR_MAX) throw new RangeError(`FiatMinor ${minor} exceeds CBS_MINOR_MAX: reject and PAUSE`);
  return Object.freeze({ currency, minor: minor as FiatMinor<C> });
}

/**
 * The fiat view of a Nova ledger amount in that currency's own asset code
 * (the ConversionPort and PayoutQuotePort speak ledger `CbsMinor`) [A-03].
 * Same minor units, now carrying the currency.
 */
export function fiatFromLedger<C extends string>(currency: C, minor: CbsMinor): FiatAmount<C> {
  return fiatAmount(currency, minor);
}

function sameCurrency(a: FiatAmount<string>, b: FiatAmount<string>): void {
  if (a.currency !== b.currency) throw new FiatCurrencyMismatchError(a.currency, b.currency);
}

export function addFiat<C extends string>(a: FiatAmount<C>, b: FiatAmount<NoInfer<C>>): FiatAmount<C> {
  sameCurrency(a, b);
  return fiatAmount(a.currency, a.minor + b.minor);
}

export function subtractFiat<C extends string>(a: FiatAmount<C>, b: FiatAmount<NoInfer<C>>): FiatAmount<C> {
  sameCurrency(a, b);
  return fiatAmount(a.currency, a.minor - b.minor);
}

/** Canonical text for digests and logs: `<CCY>:<minor>` (integer, no scaling). */
export function fiatText(a: FiatAmount<string>): string {
  return `${a.currency}:${a.minor.toString()}`;
}
