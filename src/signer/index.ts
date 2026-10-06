/**
 * U9 Signer. Money path (RUBRIC item 4: every ADR-001 signer duty, the
 * signed-configuration load and the signing-log writer). SKELETON: types and stubs only.
 *
 * The signer must not trust the orchestrator (THREAT_MODEL T-T1, T-E2). Duties
 * (ADR-001 Context, items 1–6):
 *   1 approval verification: recompute payloadHash, verify the checker's
 *     WebAuthn assertion over the 32 raw bytes of payloadDigest (CONTRACT §1.3);
 *   2 shape allow-list: EIP-1559 type-2 only, empty data, `to` bound per kind
 *     (RUBRIC MC-23);
 *   3 limits: per-tx and daily value caps, fee ceilings, chain ID pinned to 5042002;
 *   4 consumed-approval replay record (RUBRIC MC-24);
 *   5 monitor attestation: sign only under a fresh, in-sequence ALL_CLEAR (ADR-008, MC-25a);
 *   6 internal-move rule (Treasury's list, per-move and daily move caps, threshold).
 * No real keys anywhere in this repo (CLAUDE.md rule 2). `MockSigner` generates
 * a throwaway key at test time (ADR-001 testnet choice, G1_PACKET §2a).
 */
import type { NativeWei } from '../amounts/index.js';
import type { Address, Hex32 } from '../chain/config/index.js';

export type SignKind = 'PAYOUT' | 'CASE_RETURN' | 'INTERNAL_MOVE' | 'CANCEL';

/** The only transaction shape the signer will consider (ADR-001 item 2). */
export interface Eip1559ValueSend {
  readonly type: 'eip1559';
  readonly chainId: 5042002;
  readonly nonce: bigint;
  readonly from: Address;
  readonly to: Address;
  readonly value: NativeWei;
  /** Must be empty: native value sends only. */
  readonly data: '0x';
  readonly gasLimit: bigint;
  readonly maxFeePerGas: NativeWei;
  readonly maxPriorityFeePerGas: NativeWei;
}

export interface ApprovalEvidence {
  readonly approvalId: string;
  readonly payloadHash: string;
  readonly checkerId: string;
  /** WebAuthn assertion whose challenge is the 32 raw bytes of payloadDigest (CONTRACT §1.3). */
  readonly checkerAssertion: string;
}

export interface SignRequest {
  readonly kind: SignKind;
  readonly instructionId: string;
  readonly tx: Eip1559ValueSend;
  readonly approval: ApprovalEvidence | null;
}

export type SignRefusal =
  | 'APPROVAL_INVALID'
  | 'APPROVAL_MISMATCH'
  | 'APPROVAL_REPLAYED'
  | 'SHAPE_NOT_ALLOWED'
  | 'CHAIN_ID'
  | 'PER_TX_CAP'
  | 'DAILY_CAP'
  | 'FEE_CEILING'
  | 'MOVE_CAP'
  | 'MOVE_NOT_ON_TREASURY_LIST'
  | 'CHECKER_REQUIRED'
  | 'NO_ALL_CLEAR'
  | 'MONITOR_PAUSE'
  | 'CONFIG_UNSIGNED';

export type SignResult =
  | { readonly kind: 'SIGNED'; readonly rawTx: `0x${string}`; readonly txHash: Hex32 }
  | { readonly kind: 'REFUSED'; readonly reason: SignRefusal };

/** Signing-log entry, written by the signer itself and pushed to the monitor (ADR-001 "Signing log"). */
export interface SigningLogEntry {
  readonly payloadHash: string;
  readonly nonce: bigint;
  readonly txHash: Hex32;
  readonly instructionId: string;
}

/** Monitor attestation (ADR-008). */
export interface MonitorAttestation {
  readonly kind: 'ALL_CLEAR' | 'PAUSE';
  readonly sequence: bigint;
  readonly issuedAtMs: bigint;
  readonly signature: `0x${string}`;
}

/** Signer interface (KICKOFF U9). Every outbound signature goes through this. */
export interface Signer {
  acceptAttestation(attestation: MonitorAttestation): void;
  sign(request: SignRequest): Promise<SignResult>;
  /** Derive an address (ADR-006 collection branch); never exposes key material. */
  deriveAddress(role: 'hot' | 'gas' | 'collection', index: bigint): Promise<Address>;
}

/** Test-only signer. Its key is generated at construction time and never persisted. */
export class MockSigner implements Signer {
  constructor() {
    throw new Error('not implemented: U9');
  }
  acceptAttestation(_attestation: MonitorAttestation): void {
    throw new Error('not implemented: U9');
  }
  sign(_request: SignRequest): Promise<SignResult> {
    throw new Error('not implemented: U9');
  }
  deriveAddress(_role: 'hot' | 'gas' | 'collection', _index: bigint): Promise<Address> {
    throw new Error('not implemented: U9');
  }
}
