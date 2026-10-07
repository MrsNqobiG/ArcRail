/**
 * TEST SUPPORT (not a money path). Fake DFNS #2: a strict recorded-exchange
 * replayer behind the `DfnsHttpClient` port. Structurally unlike the simulator:
 * it holds no state model at all, only an ordered script of
 * (method, path, body check) → recorded response, built from the archived
 * documentation examples (./fixtures.ts). Any request that is not the next
 * scripted one is a test failure, so it also pins the exact call sequence.
 */
import type { DfnsHttpClient, DfnsHttpOutcome, DfnsHttpRequest } from '../client.js';

export interface RecordedExchange {
  readonly method: 'GET' | 'POST';
  /** Path and query, without the base URL. */
  readonly path: string;
  /** Optional check of the request (headers, body). */
  readonly check?: (req: DfnsHttpRequest) => void;
  /** The response, or a function of the request (to echo generated values). */
  readonly respond: DfnsHttpOutcome | ((req: DfnsHttpRequest) => DfnsHttpOutcome);
}

export class UnexpectedDfnsRequest extends Error {
  override readonly name = 'UnexpectedDfnsRequest';
}

export class RecordedDfns implements DfnsHttpClient {
  readonly seen: DfnsHttpRequest[] = [];
  private readonly script: RecordedExchange[];

  constructor(
    script: readonly RecordedExchange[],
    private readonly baseUrl = 'https://api.dfns.io',
  ) {
    this.script = [...script];
  }

  /** Scripted exchanges not yet consumed. */
  remaining(): number {
    return this.script.length;
  }

  async send(req: DfnsHttpRequest): Promise<DfnsHttpOutcome> {
    this.seen.push(req);
    const next = this.script.shift();
    const path = req.url.startsWith(this.baseUrl) ? req.url.slice(this.baseUrl.length) : req.url;
    if (next === undefined) throw new UnexpectedDfnsRequest(`unscripted ${req.method} ${path}`);
    if (next.method !== req.method || next.path !== path) {
      throw new UnexpectedDfnsRequest(`expected ${next.method} ${next.path}, got ${req.method} ${path}`);
    }
    next.check?.(req);
    return typeof next.respond === 'function' ? next.respond(req) : next.respond;
  }
}

/** A 200 response with a JSON body. */
export function ok200(body: unknown): DfnsHttpOutcome {
  return { kind: 'RESPONSE', status: 200n, headers: {}, body: JSON.stringify(body) };
}
