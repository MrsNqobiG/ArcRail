/** JPAYIN: the pay-in port, routed by the sender's chosen method. */
import { expectationProblem } from './types.js';
import type { PayInExpectation, PayInMethod, PayInPort, PayInResult } from './types.js';

export * from './types.js';
export { hold } from './cases.js';
export type { CaseOpener } from './cases.js';
export { FiatPayIn, eventDigest, parsePayInEvent, unconfiguredVerifier } from './fiat.js';
export type { BookedEntry, BookedEntryReader, FiatPayInDeps, IngestResult, PayInEvent, PayInEventVerifier } from './fiat.js';
export { StablecoinPayIn } from './stablecoin.js';
export type { ChainSource, StablecoinPayInDeps } from './stablecoin.js';

/** Routes by the server-side expectation's method. An unregistered method fails closed. */
export class PayIn {
  private readonly by = new Map<PayInMethod, PayInPort>();
  constructor(ports: readonly PayInPort[]) {
    for (const p of ports) this.by.set(p.method, p);
  }
  async settle(exp: PayInExpectation, nowMs: bigint): Promise<PayInResult> {
    const bad = expectationProblem(exp);
    if (bad !== null) return { kind: 'FAILED_CLOSED', code: 'EXPECTATION_INVALID', detail: bad };
    const port = this.by.get(exp.method);
    return port === undefined ? { kind: 'FAILED_CLOSED', code: 'METHOD_UNSUPPORTED', detail: exp.method } : port.settle(exp, nowMs);
  }
}
