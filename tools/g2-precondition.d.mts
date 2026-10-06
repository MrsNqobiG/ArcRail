export function citedRunIds(text: string): string[];
export function g2Problems(markdown: string, skipped: readonly string[], delegated?: readonly string[]): string[];
export function parseStageArgs(args: readonly string[]): { skipped: string[]; delegated: string[] };
