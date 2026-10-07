/**
 * Unit NET: `ArcNetworkAdapter`, the only place Arc rules meet the Network
 * port (NOVA_ARC_DESIGN §5.2). Reads go to the Arc event indexer
 * (`src/indexer`); this file adds the pre-submit checks only Arc can make
 * (§8.4 check 6), the exact amount conversion (U1) and the DFNS body (§8.5).
 *
 * Precheck, in order (each refusal is final for this intent):
 * 1. network is `ARC` and the params are the enabled testnet entry (C-01,
 *    DF:networks `ArcTestnet`), else CHAIN_ID_MISMATCH / NETWORK_DISABLED;
 * 2. asset is USDC;
 * 3. `from` and `to` are lower-case 20-byte addresses;
 * 4. amount > 0 (a zero-value transfer emits no log, C-24);
 * 5. destination is not the zero address (C-54), not the sender itself
 *    (a self-transfer emits no log, C-24), not a reserved system address
 *    (the system emitter C-20 or the USDC contract C-12; our own rule) and
 *    not in the precompile range 0x…0000–0x…ffff (our own rule, Q-A14);
 * 6. the local blocklist copy is no older than `blocklistMaxAgeMs` and not
 *    dated in the future (clock skew or a bad sync time; BLOCKLIST_STALE,
 *    fail closed) and lists neither party (C-28, C-53).
 *
 * Inbox, acknowledgement and halt/resume are the indexer's (§6.4).
 */
import { cbsMinorToNativeWei } from '../../amounts/index.js';
import type { CbsMinor, CbsPrecision, NativeWei } from '../../amounts/index.js';
import type { Hex32 } from '../../chain/config/index.js';
import type { ArcIndexer } from '../../indexer/indexer.js';
import { checkExternalId, dfnsAmount, toNetworkAddress } from '../types.js';
import type {
  AckResult,
  ConfirmedTransfer,
  DfnsNativeTransferBody,
  NetworkAdapter,
  NetworkAddress,
  NetworkHead,
  NetworkPrecheckCode,
  NetworkRead,
  NetworkTransferIntent,
  PrecheckResult,
  TxConfirmation,
} from '../types.js';
import type { ArcNetworkParams } from './params.js';

/** The local copy of the USDC blocklist (from `Blocklisted`/`UnBlocklisted` events, C-28, Q-A5). */
export interface BlocklistSnapshot {
  /** When the copy was last brought up to date, in ms on the adapter's clock. */
  readonly asOfMs: bigint;
  isBlocked(address: NetworkAddress): boolean;
}

export interface BlocklistView {
  snapshot(): Promise<BlocklistSnapshot>;
}

export interface ArcAdapterDeps {
  readonly params: ArcNetworkParams;
  readonly indexer: ArcIndexer;
  readonly blocklist: BlocklistView;
  readonly clock: { now(): bigint };
}

const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;
/** Our own rule (Q-A14): addresses whose first 18 bytes are zero are treated as precompiles. */
const PRECOMPILE_RE = /^0x0{36}[0-9a-f]{4}$/;

const reject = (code: NetworkPrecheckCode, detail: string): PrecheckResult => ({ kind: 'REJECTED', code, detail });

export class ArcNetworkAdapter implements NetworkAdapter {
  readonly network = 'ARC';
  readonly asset = 'USDC';
  readonly chainId: bigint;
  private readonly params: ArcNetworkParams;
  private readonly indexer: ArcIndexer;
  private readonly blocklist: BlocklistView;
  private readonly clock: { now(): bigint };

  constructor(deps: ArcAdapterDeps) {
    this.params = deps.params;
    this.indexer = deps.indexer;
    this.blocklist = deps.blocklist;
    this.clock = deps.clock;
    this.chainId = deps.params.chainId;
  }

  async precheck(intent: NetworkTransferIntent): Promise<PrecheckResult> {
    const p = this.params;
    if (intent.network !== 'ARC') return reject('CHAIN_ID_MISMATCH', `intent is for ${intent.network}`);
    if (p.enabled !== true || p.chainId !== 5042002n || p.dfnsNetwork !== 'ArcTestnet') {
      return reject('NETWORK_DISABLED', 'only Arc testnet (5042002, ArcTestnet) is enabled');
    }
    if (intent.asset !== 'USDC') return reject('ASSET_NOT_SUPPORTED', `asset ${intent.asset}`);
    if (toNetworkAddress(intent.from) !== intent.from) return reject('INVALID_SOURCE', 'sender is not a lower-case address');
    if (toNetworkAddress(intent.to) !== intent.to) return reject('INVALID_DESTINATION', 'recipient is not a lower-case address');
    if (intent.amount <= 0n) return reject('AMOUNT_NOT_POSITIVE', 'zero-value transfers emit no log (C-24)');
    if (intent.to === ZERO_ADDRESS) return reject('INVALID_DESTINATION', 'zero address (C-54)');
    if (intent.to === intent.from) return reject('INVALID_DESTINATION', 'self-transfer emits no log (C-24)');
    if (p.reservedDestinations.includes(intent.to)) return reject('INVALID_DESTINATION', 'reserved system address');
    if (PRECOMPILE_RE.test(intent.to)) return reject('INVALID_DESTINATION', 'precompile range (our rule, Q-A14)');
    const list = await this.blocklist.snapshot();
    const now = this.clock.now();
    if (list.asOfMs > now) return reject('BLOCKLIST_STALE', 'local blocklist copy is dated in the future');
    if (now - list.asOfMs > p.blocklistMaxAgeMs) return reject('BLOCKLIST_STALE', 'local blocklist copy is too old');
    if (list.isBlocked(intent.from)) return reject('SENDER_BLOCKLISTED', 'sender is on the local blocklist copy');
    if (list.isBlocked(intent.to)) return reject('RECIPIENT_BLOCKLISTED', 'recipient is on the local blocklist copy');
    return { kind: 'OK' };
  }

  /** `w = m × 10^(18 − p)`, exact (U1 `cbsMinorToNativeWei`). */
  toNetworkAmount(minor: CbsMinor, p: CbsPrecision): NativeWei {
    return cbsMinorToNativeWei(minor, p);
  }

  /** `kind: Native` only until Q-N1/Q-N2 are answered (§8.5). No memo (C-64). */
  dfnsTransferBody(intent: NetworkTransferIntent, externalId: string): DfnsNativeTransferBody {
    if (intent.network !== 'ARC') throw new RangeError(`intent is for ${intent.network}, not ARC`);
    return { kind: 'Native', to: intent.to, amount: dfnsAmount(intent.amount), priority: 'Standard', externalId: checkExternalId(externalId) };
  }

  poll(addresses: ReadonlySet<NetworkAddress>): Promise<NetworkRead<readonly ConfirmedTransfer[]>> {
    return this.indexer.poll(addresses);
  }

  confirmTx(txHash: Hex32): Promise<NetworkRead<TxConfirmation | null>> {
    return this.indexer.confirmTx(txHash);
  }

  head(): Promise<NetworkRead<NetworkHead>> {
    return this.indexer.head();
  }

  pending(): Promise<readonly ConfirmedTransfer[]> {
    return this.indexer.pending();
  }

  ack(dedupeKeys: readonly string[]): Promise<AckResult> {
    return this.indexer.ack(dedupeKeys);
  }

  resume(approverA: string, approverB: string): Promise<void> {
    return this.indexer.resume(approverA, approverB);
  }
}
