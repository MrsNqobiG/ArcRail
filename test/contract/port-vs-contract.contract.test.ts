/**
 * Contract project (CBS contract tests). Phase 2 placeholder: the in-memory
 * CBS stub and its behavioural contract tests come in a later block. For now
 * this project runs the scripted port-vs-CONTRACT diff (§3 operations and
 * fields, §4 call and events), and proves the diff catches drift.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTRACT_PATH, EVENTS_PATH, PORT_PATH, checkPortAgainstContract, parseContract } from './port-contract-check.js';

const contract = readFileSync(CONTRACT_PATH, 'utf8');
const port = readFileSync(PORT_PATH, 'utf8');
const events = readFileSync(EVENTS_PATH, 'utf8');

function replaceOnce(text: string, from: string, to: string): string {
  const at = text.indexOf(from);
  if (at < 0 || text.indexOf(from, at + 1) >= 0) throw new Error(`fixture: "${from}" must occur exactly once`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}

describe('CBS port vs CONTRACT §3/§4 (scripted diff)', () => {
  it('the contract parses into 16 §3 operations and 7 §4 rows', () => {
    const model = parseContract(contract);
    expect(model.ops.size).toBe(16);
    expect(model.s4.size).toBe(7);
    expect(model.caseReasons).toHaveLength(21);
    expect(model.rejectedCodes).toHaveLength(13);
    expect(model.payoutRejectedCodes).toHaveLength(5);
    const refs = model.ops.get('postJournal')?.request.get('refs')?.child;
    expect([...(refs?.keys() ?? [])]).toEqual(['subjectRef', 'caseId', 'dispositionSeq', 'instructionId', 'address', 'txHash', 'assignRef']);
  });

  it('the port matches CONTRACT exactly (no missing, extra or re-marked field)', () => {
    expect(checkPortAgainstContract()).toEqual([]);
  });
});

describe('the diff catches drift (in-memory edits; nothing is written)', () => {
  it.each([
    [
      'D1 regression: refs without dispositionSeq',
      { overrides: new Map([[PORT_PATH, replaceOnce(port, '  readonly dispositionSeq?: DecimalString;\n  readonly instructionId?: Id;', '  readonly instructionId?: Id;')]]) },
      /postJournal request\.refs: field "dispositionSeq" is in CONTRACT but missing/,
    ],
    [
      'm8 regression: legs[].account',
      { overrides: new Map([[PORT_PATH, replaceOnce(port, 'readonly glOrAccountRef: GlRole;', 'readonly account: GlRole;')]]) },
      /legs: field "glOrAccountRef" is in CONTRACT but missing/,
    ],
    [
      'm8 regression: payout amount of any unit',
      { overrides: new Map([[EVENTS_PATH, replaceOnce(events, 'readonly amount: CbsMinorWireAmount;', 'readonly amount: WireAmount;')]]) },
      /§4 submitPayoutInstruction\.amount: CONTRACT says CBS_MINOR/,
    ],
    [
      'm11 P4: postJournal legs not an array',
      { overrides: new Map([[PORT_PATH, replaceOnce(port, "      readonly legs: readonly JournalLeg[];\n      readonly narrative: string;", "      readonly legs: JournalLeg;\n      readonly narrative: string;")]]) },
      /postJournal request\.legs: CONTRACT kind array, port kind object/,
    ],
    [
      'm11 P6: CaseDisposition.returnAmount of any unit',
      { overrides: new Map([[EVENTS_PATH, replaceOnce(events, 'readonly returnAmount?: CbsMinorWireAmount;', 'readonly returnAmount?: WireAmount;')]]) },
      /§4 CaseDisposition\.returnAmount: CONTRACT says CBS_MINOR/,
    ],
    [
      'm11 P12: refs.txHash typed as a number',
      { overrides: new Map([[PORT_PATH, replaceOnce(port, '  readonly txHash?: TxHashString;\n  readonly assignRef?: AssignRef;', '  readonly txHash?: number;\n  readonly assignRef?: AssignRef;')]]) },
      /postJournal request\.refs\.txHash: CONTRACT kind string, port kind other \(number\)/,
    ],
    [
      'm11 P2: refs.dispositionSeq typed never',
      { overrides: new Map([[PORT_PATH, replaceOnce(port, '  readonly dispositionSeq?: DecimalString;\n  readonly instructionId?: Id;', '  readonly dispositionSeq?: never;\n  readonly instructionId?: Id;')]]) },
      /refs\.dispositionSeq: CONTRACT kind string, port kind other/,
    ],
    [
      'a boolean field typed as a string',
      { overrides: new Map([[EVENTS_PATH, replaceOnce(events, '  readonly frozen: boolean;', '  readonly frozen: string;')]]) },
      /§4 AccountStatusChanged\.frozen: CONTRACT kind boolean, port kind string/,
    ],
    [
      'an amount typed as a bigint (not a wire object)',
      { overrides: new Map([[PORT_PATH, replaceOnce(port, "      readonly direction: 'inbound' | 'outbound';\n      readonly amount: WireAmount;", "      readonly direction: 'inbound' | 'outbound';\n      readonly amount: bigint;")]]) },
      /§3 screen request\.amount: CONTRACT kind amount, port kind other \(bigint\)/,
    ],
    [
      'an extra port method',
      { overrides: new Map([[PORT_PATH, replaceOnce(port, 'export interface CbsPort {', 'export interface CbsPort {\n  extraOp(req: { readonly a: string }, meta: CallMeta): Promise<CbsResult<Record<string, never>>>;')]]) },
      /CbsPort\.extraOp is not a CONTRACT operation/,
    ],
    [
      'm17 P13: placeHold request gains an index signature',
      { overrides: new Map([[PORT_PATH, replaceOnce(port, 'req: { readonly key: IdempotencyKey; readonly instructionId: Id },', 'req: { readonly key: IdempotencyKey; readonly instructionId: Id; readonly [k: string]: unknown },')]]) },
      /§3 placeHold request: index signature/,
    ],
    [
      'm17 P14: placeHold gains a third parameter accountRef?',
      { overrides: new Map([[PORT_PATH, replaceOnce(port, '    req: { readonly key: IdempotencyKey; readonly instructionId: Id },\n    meta: CallMeta,\n', '    req: { readonly key: IdempotencyKey; readonly instructionId: Id },\n    meta: CallMeta,\n    accountRef?: AccountRef,\n')]]) },
      /§3 op placeHold: parameters must be exactly \(req, meta\)/,
    ],
    [
      'm17 P14b: placeHold gains a rest parameter',
      { overrides: new Map([[PORT_PATH, replaceOnce(port, '    req: { readonly key: IdempotencyKey; readonly instructionId: Id },\n    meta: CallMeta,\n', '    req: { readonly key: IdempotencyKey; readonly instructionId: Id },\n    meta: CallMeta,\n    ...extra: readonly unknown[]\n')]]) },
      /§3 op placeHold: parameters must be exactly \(req, meta\)/,
    ],
    [
      'm17 P15: required refs.subjectRef admits undefined',
      { overrides: new Map([[PORT_PATH, replaceOnce(port, '  readonly subjectRef: SubjectRef;\n  readonly caseId?: Id;', '  readonly subjectRef: SubjectRef | undefined;\n  readonly caseId?: Id;')]]) },
      /refs\.subjectRef: CONTRACT says required, but the port type .* admits undefined/,
    ],
    [
      'm17 P28: a second placeHold overload (after the first) carrying accountRef and amount',
      {
        overrides: new Map([
          [
            PORT_PATH,
            replaceOnce(
              port,
              '  ): Promise<CbsResult<{ readonly holdId: string; readonly accountRef: AccountRef; readonly amount: WireAmount }>>;\n',
              '  ): Promise<CbsResult<{ readonly holdId: string; readonly accountRef: AccountRef; readonly amount: WireAmount }>>;\n  placeHold(\n    req: { readonly key: IdempotencyKey; readonly instructionId: Id; readonly accountRef: AccountRef; readonly amount: WireAmount },\n    meta: CallMeta,\n  ): Promise<CbsResult<{ readonly holdId: string; readonly accountRef: AccountRef; readonly amount: WireAmount }>>;\n',
            ),
          ],
        ]),
      },
      /§3 op placeHold: 2 call signatures \(overloads\)/,
    ],
    [
      'm17 P28b: an overload placed first is compared too',
      { overrides: new Map([[PORT_PATH, replaceOnce(port, '  placeHold(\n', '  placeHold(\n    req: { readonly key: IdempotencyKey; readonly instructionId: Id; readonly accountRef: AccountRef },\n    meta: CallMeta,\n  ): Promise<CbsResult<{ readonly holdId: string; readonly accountRef: AccountRef; readonly amount: WireAmount }>>;\n  placeHold(\n')]]) },
      /§3 placeHold (overload \d+ )?request: field "accountRef" is in the port but not in CONTRACT/,
    ],
    [
      'm17 P30: settleHold OK response gains an index signature',
      { overrides: new Map([[PORT_PATH, replaceOnce(port, '): Promise<CbsResult<{ readonly journalId: string }>>;\n\n  screen(', '): Promise<CbsResult<{ readonly journalId: string; readonly [k: string]: string }>>;\n\n  screen(')]]) },
      /§3 settleHold OK: index signature/,
    ],
    [
      'm17: a second parameter that is not CallMeta',
      { overrides: new Map([[PORT_PATH, replaceOnce(port, '    req: { readonly key: IdempotencyKey; readonly instructionId: Id },\n    meta: CallMeta,\n', '    req: { readonly key: IdempotencyKey; readonly instructionId: Id },\n    meta: CallMeta & { readonly accountRef: AccountRef },\n')]]) },
      /§3 op placeHold: second parameter must be CallMeta/,
    ],
    [
      'an optional marker dropped in CONTRACT',
      { contractText: replaceOnce(contract, '{fromCutoff, toCutoff, keys?}', '{fromCutoff, toCutoff, keys}') },
      /listJournals request\.keys: CONTRACT says required, port says optional/,
    ],
    [
      'a literal changed in CONTRACT',
      { contractText: replaceOnce(contract, 'side:"DR"\\|"CR"', 'side:"DEBIT"\\|"CR"') },
      /legs\.side: CONTRACT literals/,
    ],
    [
      'a field added to a CONTRACT event',
      { contractText: replaceOnce(contract, '`{eventId, seq, holdId, key, state, at}`', '`{eventId, seq, holdId, key, state, reason, at}`') },
      /§4 HoldChanged: field "reason" is in CONTRACT but missing/,
    ],
    [
      'a createCase reason added in CONTRACT',
      { contractText: replaceOnce(contract, '`QUARANTINE`, `PAUSE`. Every', '`QUARANTINE`, `PAUSE`, `NEW_REASON`. Every') },
      /§3 createCase reasons/,
    ],
  ] as const)('%s', (_name, opts, expected) => {
    const problems = checkPortAgainstContract(opts);
    expect(problems.some((p) => expected.test(p)), problems.join('\n')).toBe(true);
  });
});
