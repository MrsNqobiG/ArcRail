export interface MoneyFloatFinding {
  readonly file: string;
  readonly line: number;
  readonly col: number;
  readonly rule: string;
  readonly text: string;
}
export function lintMoneyFloats(root?: string): { readonly files: number; readonly findings: readonly MoneyFloatFinding[] };
/** Declaration identity used by the Number allow-list: `Name`, `Outer.member` or `fn(i)`; null if none. */
export function declId(node: import('typescript').Node): string | null;
