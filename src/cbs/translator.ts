/**
 * ACL posting translator (RUBRIC money-path item 10): CONTRACT §3
 * `postJournal`, the hold operations and `getResultByKey`, the §1.4
 * AMBIGUOUS resolution, and the §5.1 templates. SKELETON: types and stubs only.
 *
 * Templates are balanced by construction and omit zero-amount legs (CONTRACT §5.1).
 */
import type { CbsMinor } from '../amounts/index.js';
import type { CallMeta, CbsPort, JournalLeg } from './port.js';
import type { CbsResult, ResolvedResult } from './result.js';

export type TemplateId =
  | 'T1'
  | 'T2'
  | 'T3'
  | 'T4'
  | 'T5'
  | 'T6'
  | 'T8'
  | 'T9'
  | 'T10'
  | 'T11'
  | 'unid'
  | 'gas'
  | 'dust';

export interface TemplateInput {
  readonly template: TemplateId;
  readonly amount: CbsMinor;
  readonly fee: CbsMinor;
}

export function buildLegs(_input: TemplateInput): readonly JournalLeg[] {
  throw new Error('not implemented: CBS translator');
}

type Req<Op extends keyof CbsPort> = Parameters<CbsPort[Op]>[0];
type Ok<Op extends keyof CbsPort> = Extract<Awaited<ReturnType<CbsPort[Op]>>, { readonly kind: 'OK' }>['value'];

/**
 * Every keyed CBS write the money path makes goes through here, so that each
 * one comes back resolved (CONTRACT §1.4): never AMBIGUOUS.
 */
export interface PostingTranslator {
  /** CONTRACT §3 `postJournal` for one §5.1 template. */
  postJournal(req: Req<'postJournal'>, meta: CallMeta): Promise<ResolvedResult<Ok<'postJournal'>>>;
  /** CONTRACT §3 `placeHold` (T3). */
  placeHold(req: Req<'placeHold'>, meta: CallMeta): Promise<ResolvedResult<Ok<'placeHold'>>>;
  /** CONTRACT §3 `settleHold` (T4). */
  settleHold(req: Req<'settleHold'>, meta: CallMeta): Promise<ResolvedResult<Ok<'settleHold'>>>;
  /** CONTRACT §3 `releaseHold` (T5). */
  releaseHold(req: Req<'releaseHold'>, meta: CallMeta): Promise<ResolvedResult<Ok<'releaseHold'>>>;
  /**
   * CONTRACT §1.4 "Resolving AMBIGUOUS": retry `call` with the same key and
   * payload for at most `H_retry`, then `getResultByKey(key)`; APPLIED → OK,
   * REJECTED → REJECTED, NOT_FOUND → one final call, anything else → UNRESOLVED.
   */
  resolveAmbiguous<T>(req: Req<'getResultByKey'>, call: () => Promise<CbsResult<T>>, meta: CallMeta): Promise<ResolvedResult<T>>;
}

export function createPostingTranslator(_port: CbsPort): PostingTranslator {
  throw new Error('not implemented: CBS translator');
}
