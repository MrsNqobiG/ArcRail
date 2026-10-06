export interface MoneyPathListed {
  readonly path: string;
  readonly item: number;
  readonly unit: string;
}
export interface MoneyPathPart {
  readonly item: number;
  readonly part: string;
  readonly path: string;
  readonly anchor: string;
}
export interface MoneyPathExcluded {
  readonly path: string;
  readonly reachedFrom: string;
  readonly reason: string;
}
export interface MoneyPathNumberAllow {
  readonly path: string;
  /** Declaration identity: `Name`, `Outer.member` or `fn(i)` (tools/lint-money-floats.mjs header). */
  readonly decl: string;
  readonly meaning: string;
}
export interface MoneyPath {
  readonly listed: readonly MoneyPathListed[];
  readonly parts: readonly MoneyPathPart[];
  readonly excluded: readonly MoneyPathExcluded[];
  readonly numberAllow: readonly MoneyPathNumberAllow[];
  readonly paths: readonly string[];
}
export function readMoneyPath(root?: string): MoneyPath;
