import type { ConstantRow, FailurePath, RiskRow, ModuleRow } from './types'

export const ARC_CONSTANTS: ConstantRow[] = [
  { id: 'C-01', value: 'Testnet chain ID 5042002', note: 'Live-verified against rpc.testnet.arc.io' },
  { id: 'C-02', value: 'Mainnet chain ID 5042', note: 'Gated — never queried; disabled in code' },
  { id: 'C-05', value: 'Native currency symbol USDC', note: 'USDC is the gas token' },
  { id: 'C-10', value: 'Native USDC decimals: 18', note: 'NativeWei view' },
  { id: 'C-11', value: 'ERC-20 USDC decimals: 6', note: 'UsdcUnits view' },
  { id: 'C-12', value: 'ERC-20 address 0x3600…0000', note: 'Same address on testnet and mainnet' },
  { id: 'C-13', value: 'Native→display factor 10^12', note: 'Drives the dust policy' },
  { id: 'C-20', value: 'System emitter 0xffffFFFfFF…fFFfE', note: 'EIP-7708 native log — the canonical credit source' },
  { id: 'C-22', value: 'One ERC-20 transfer() emits two logs', note: 'System (18 dp) + ERC-20 (6 dp); system log first (C-23)' },
  { id: 'C-25', value: 'gas = gasUsed × effectiveGasPrice', note: 'From the receipt, not a Transfer log' },
  { id: 'C-27', value: 'Attribution uses log from, not tx.from', note: 'Relayed transfers' },
  { id: 'C-30', value: 'Fee floor: min maxFeePerGas 20 gwei', note: 'Below the floor the tx may be silently dropped (M-4)' },
  { id: 'C-31', value: 'Max base fee 20,000 gwei', note: '' },
  { id: 'C-32', value: 'Block gas limit 30,000,000', note: '' },
  { id: 'C-40', value: 'eth_getLogs block-range cap 10,000', note: 'Page ≤ 9,999 blocks; error −32012' },
  { id: 'C-41', value: 'Undocumented result cap 2,000', note: 'Error −32602; bisection' },
  { id: 'C-42', value: 'Head-lag error −32014', note: 'Retry with backoff' },
  { id: 'C-50', value: 'Deterministic finality, no reorgs', note: 'BFT; liveness needs >⅔ validators (C-51)' },
  { id: 'C-52', value: '~0.5 s block time', note: '' },
  { id: 'C-53', value: 'Blocklisted transfer reverts; gas consumed', note: 'Design for both receipt shapes (M-1, Q-A1)' },
  { id: 'C-55', value: 'Testnet blocklisted address 0x7099…79C8', note: 'Known test address' },
  { id: 'C-57', value: 'eth_call to blocklisted → −32603 "Blocked address"', note: 'Undocumented, live-verified' },
  { id: 'C-58', value: 'Blocklisted sender rejected pre-mempool', note: 'No gas, no receipt; not yet reproduced on testnet (Q-A13)' },
  { id: 'C-56', value: 'secp256k1, EIP-155 required', note: 'HD path m/44\'/60\'/0\'/0/x' },
  { id: 'C-60', value: 'CCTP domain for Arc: 26', note: '' },
  { id: 'C-62', value: 'Memo contract 0x5294…e505', note: 'Attach a non-PII reference hash to a transfer' },
  { id: 'C-63', value: 'Multicall3From 0x522f…47D0', note: 'Batches but keeps our wallet as msg.sender; verify every inner transfer' },
  { id: 'C-64', value: 'Privacy (APS) not live', note: 'Everything on-chain is public — no PII on-chain, ever' },
  { id: 'C-66', value: 'EIP-7702 supported', note: 'Off-chain signature drain risk — refused by the signer shape rule' },
  { id: 'C-67', value: 'EIP-3009 on USDC', note: 'Same refusal rationale' },
]

export const CONSTANTS_META = {
  rows: 49, ids: 'C-01…C-68', accessed: '2026-10-02',
  mismatches: 'M-1…M-10 documented contradictions between Arc docs (receipt shape for blocklist reverts, the 2,000-result cap, fee-floor behaviour…)',
  note: 'Every Arc fact the repo relies on is cited in docs/constants.md with source URL, access date and quote; live-checked where possible.',
}

export const FAILURE_PATHS: FailurePath[] = [
  { id: 'F-1', title: 'Approval rejected', detail: 'REJECTED / APPROVAL_DENIED; P6 releases the reservation.', pause: false },
  { id: 'F-2', title: 'Approval expired', detail: 'autoRejectTimeout + own A_approval timer backstop → EXPIRED / APPROVAL_EXPIRED, P6 (proof a1). Operator abort while unsigned → proof (a2) gives CANCELLED_BY_OPERATOR.', pause: false },
  { id: 'F-3a', title: 'Blocklisted party — precheck', detail: 'Caught by our own precheck → REJECTED / BLOCKLISTED_PRECHECK; Compliance case; no submit marker.', pause: false },
  { id: 'F-3b', title: 'Blocklisted sender — pre-mempool', detail: 'Hash-less Failed: QUARANTINE + wallet nonce hold + 5-step nonce-burn procedure (read nonce from DFNS → check account nonce → DFNS Cancel burn → locate the nonce-n tx incl. binary search and case analysis → post gas). Ends REJECTED / BLOCKLISTED_PRE_MEMPOOL or DFNS_FAILED, or two-person hash link → COMPLETED.', pause: true },
  { id: 'F-3c', title: 'Included but reverted', detail: 'Status 0, gas consumed → REJECTED / ONCHAIN_REVERTED; P4 gas + P6; page a human.', pause: false },
  { id: 'F-4', title: 'Under-floor drop / no receipt', detail: 'EXPIRED / UNDER_FEE_FLOOR_DROPPED only after proof (b); QUARANTINE until proven. No resubmission ever — a retry is a new payment. Nonce consumed by a recorded cancel → CANCELLED / CANCELLED_ONCHAIN_REPLACED (F-18).', pause: true },
  { id: 'F-5', title: 'Stuck confirming', detail: 'CONFIRMING older than A_stuck → QUARANTINE; operator chooses wait or DFNS cancel (0-value same-nonce replacement). POL-2/POL-3 may block 0-value cancels (Q-N15).', pause: false },
  { id: 'F-6', title: 'DFNS 4xx/5xx/timeout after markSubmit', detail: 'CREATED, UNRESOLVED: no terminal stage, no P6, no timer release. Resolve only via externalId: re-POST same bytes (DFNS idempotency), webhook confirmed by GET, or listing. 409 → QUARANTINE. After A_ambiguous → UNRESOLVED_SUBMIT case.', pause: false },
  { id: 'F-7', title: 'RPC disagreement', detail: 'PAUSE outbound; freeze the cursor; two-person resolution.', pause: true },
  { id: 'F-8', title: 'Chain stall', detail: 'PAUSE new submissions; timeouts suspended.', pause: true },
  { id: 'F-9', title: 'DFNS Confirmed but no indexer log', detail: 'After A_xcheck → QUARANTINE + page.', pause: false },
  { id: 'F-10', title: 'Log amount/recipient ≠ binding', detail: 'PAUSE — binding breach.', pause: true },
  { id: 'F-11', title: 'Unknown outbound log from our wallet', detail: 'PAUSE.', pause: true },
  { id: 'F-12', title: 'Two open payments with identical (to, amount)', detail: 'Wait for the DFNS hash — by design.', pause: false },
  { id: 'F-13', title: 'Webhook forged', detail: 'HMAC mismatch / bad header / stale ts / bad IP → 401 + alert; repeated → page Security.', pause: false },
  { id: 'F-14', title: 'Webhook duplicated or out of order', detail: 'Entity dedupe key; illegal transition → STALE.', pause: false },
  { id: 'F-15', title: 'Ledger AMBIGUOUS', detail: 'Resolve by key; after A_ambiguous → QUARANTINE.', pause: false },
  { id: 'F-16', title: 'Quote expired', detail: 'EXPIRED / QUOTE_EXPIRED only while ARC_TRANSFER has no submit marker. With a marker nothing ends: resolve via externalId, then approver denial (a1) or abort (a2); page Ops.', pause: false },
  { id: 'F-17', title: 'Payout partner fails after Arc leg confirmed', detail: 'PAYOUT / REJECTED / PAYOUT_FAILED. USDC stays in GL-2 partner.<id>; payer A+F stays in GL-5. PARTNER_RETURN case (two-person): branch 1 partner returns → P2R then P6; branch 2 CLOSE_PARTNER_UNRETURNED → P6 + P11 claim, payer refunded at once. Never an on-chain reversal. A return of a different value → P9, case stays open.', pause: false },
  { id: 'F-18', title: 'DFNS speed-up / cancel replacement', detail: 'QUARANTINE. Speed-up delivered → link hash, COMPLETED. Cancel → proof (b), CANCELLED / CANCELLED_ONCHAIN_REPLACED + P6. Replacement gas posted by P4; the rail stays PAUSED until gas is posted.', pause: true },
  { id: 'F-19', title: 'Unsolicited inbound to company wallet', detail: 'P9/P9D to GL-4 arc.unidentified; no PAUSE; Ops case; return/attribution only by a two-person decision.', pause: false },
]

export const RISKS: RiskRow[] = [
  { id: 'RR-1', title: 'Unit or precision error mis-states money', severity: 'High → Critical', owner: 'Engineering', note: 'Adapter precision ≠ CBS precision; wrong conversion within k; 6/18-dp mix; floats. Controls: branded types (MC-02), one conversion module (MC-03), mutation ≥ 90 (MC-08).' },
  { id: 'RR-2', title: 'Ingestion / attribution error', severity: 'Medium → Critical', owner: 'Engineering', note: 'Missed, double-counted or misattributed transfer (paging caps, two emitters, misclassification, hard fork, wrong-customer credit, relayer attribution). Controls: canonical source (MC-15), dedupe, two-source agreement.' },
  { id: 'RR-3', title: 'Unauthorised outflow', severity: 'Low → Critical', owner: 'Security', note: 'Compromised adapter fabricating instructions; approval replay; key theft; off-chain signature drain (EIP-3009/permit/7702); wrong-account binding. Controls: gateway checks, signer duties, independent monitor.' },
  { id: 'RR-4', title: 'Ambiguous or duplicated CBS outcomes', severity: 'Medium → High', owner: 'CBS owner + Engineering', note: 'Duplicate T2/T8/T11/T5/T6; unresolved ambiguity; CBS contract drift. Controls: deterministic keys, AMBIGUOUS resolution, contract tests with drift self-tests.' },
  { id: 'RR-5', title: 'Regulatory controls on unverified requirements', severity: 'Medium → High', owner: 'Compliance', note: 'Directive 9 misread; TFS/reporting/POPIA/Schedule 1; SARB policy direction against foreign-pegged stablecoins for domestic payments (Joint Comm ¶4.5.2). Controls: MC-43 primary-source quotes; open questions.' },
  { id: 'RR-6', title: 'Personal information leaks', severity: 'Medium → High', owner: 'Security + Privacy officer', note: 'PII or address↔account links in logs; bank address given to third-party RPC; memo-derived chain data; registry theft — irreversible on-chain. Controls: MC-30, encrypted registry, canary PII scanner (DR-19).' },
]

export const RISK_BLIND_SPOTS = [
  'RB-1 issuer/network acts against wallets', 'RB-2 public linkability', 'RB-3 tampered tooling (arc-node curl|bash; approved-digest DR-27)',
  'RB-4 chain stall', 'RB-5 doc drift', 'RB-6 travel-rule provider alters data',
  'RB-7 compromised adapter while monitor detections cannot run', 'RB-8 prompt injection into the build agent',
  'RB-9 simultaneous two-domain compromise', 'RB-10 registry theft without row-level audit', 'RB-12 duplicate T6',
  'RB-13 wrong-account binding (until Q-C19/DR-29)', 'RB-14 reference-artefact/key exposure', 'RB-16 hard-fork semantics (DR-10 mutant)',
]

export const THREAT_MODEL = {
  method: 'STRIDE (security) per trust boundary + LINDDUN (privacy)',
  categories: [
    'Spoofing T-S1…T-S5', 'Tampering T-T1…T-T7', 'Repudiation T-R1…T-R3', 'Information disclosure T-I1…I3',
    'Denial of service T-D1…D6', 'Elevation of privilege T-E1…E5', 'Issuer/network T-N1, T-N2',
    'Compliance providers T-B1, T-B2', 'Supply chain T-SC1…SC4', 'LINDDUN L-1…L-8',
  ],
  detections: '29 detections (DR-01…DR-29), each with an independent input and a concrete mutant — e.g. DR-01 monitor classification + content binding of every signing-log entry; DR-02 quorum block-hash/log compare; DR-06 three-way reconciliation residual 0; DR-11 zero-value blocklist probe (C-57); DR-17 screening canary; DR-19 canary PII scanner with two executors; DR-20 security egress proxy; DR-26 honeytoken registry rows; DR-27 approved-digest list at every start.',
  residuals: '15 G1 residuals for the human — issuer freeze, public flows, tooling, FIDO2 checkerAssertion, travel-rule detection, monitor-dependency windows, prompt injection, two-domain compromise, registry theft, xpub disclosure, fee-floor windows, provider compromise, duplicate T6, move-approval threshold gap.',
}

export const DFNS_FACTS = {
  networks: [
    { id: 'ArcTestnet', note: 'Arc testnet (chain 5042002) — Tier 1, 10-block confirmation/indexing delay; our own indexer is canonical, DFNS events are a cross-check' },
    { id: 'Arc', note: 'Arc mainnet — gated, never configured' },
  ],
  policies: [
    { id: 'POL-1', rule: 'AlwaysTrigger → RequestApproval', note: 'Named human approvers, quorum decided by Ops, autoRejectTimeout in minutes' },
    { id: 'POL-2', rule: 'TransactionAmountLimitNominal → Block', note: 'Per-tid entries for both native (18 dp) and ERC-20 (6 dp) tids (Q-N18)' },
    { id: 'POL-3', rule: 'TransactionRecipientWhitelist → Block', note: 'Testnet recipients; side effect: also blocks 0-value DFNS cancels (Q-N15)' },
    { id: 'POL-4', rule: 'Velocity (optional)', note: 'Ops decides' },
  ],
  serviceAccounts: [
    { id: 'SA-1 arc-rail-adapter', perms: 'Wallets:Read · Wallets:Transfers:Create · Wallets:Transfers:Read · Policies:Evaluations:Read', note: 'Transfers:Read also grants cancel/speed-up — recorded residual until Q-N15. Must NOT have wallet create/update, abort, or any write.' },
    { id: 'SA-2 arc-rail-monitor', perms: 'Wallets:Read · Policies:Evaluations:Read · Webhooks:Events:Read', note: 'Must NOT have Transfers:Read (it grants cancel/speed-up).' },
  ],
  webhooks: [
    'One webhook: POST /webhooks/dfns — HMAC-SHA256 over the raw body (X-DFNS-WEBHOOK-SIGNATURE); secret shown only once at creation.',
    'Timestamp tolerance ±300 s; deliveries are unordered; retries carry new event ids with deliveryAttempt/retryOf; 5 attempts / 24 h.',
    'Answer 200 only after the inbox commit; the handler re-reads via GET — the webhook is a hint, never the source of truth.',
    'Events: wallet.transfer.requested/failed/rejected/broadcasted/confirmed; policy.approval.pending/resolved; (D2) wallet.blockchainevent.detected.',
  ],
  transferBody: "kind: 'Native' | 'Erc20', to, amount (decimal string /^\\d+$/), priority: 'Standard', externalId — the user action travels in the X-DFNS-USERACTION header; no memo (C-64); fee ceiling pre-check via GET /networks/fees.",
  wallet: 'One org wallet arc-rail-testnet-hot, tag arc-rail-testnet, not delegated (delegated wallets bypass policies). Abort stays with named human operators.',
}

export const MODULES: ModuleRow[] = [
  { domain: 'amounts', label: 'AMOUNTS', paths: 'src/amounts', exports: 40, role: 'U1: branded CbsMinor, UsdcUnits, NativeWei, FiatMinor<CCY>, CbsPrecision; the ONLY conversion module (FLOOR_REMAINDER_RETURNED)', unit: 'U1', moneyPath: true },
  { domain: 'chain', label: 'CHAIN', paths: 'src/chain/config · src/chain/client', exports: 18, role: 'U2 config (testnet from constants; mainnet disabled behind REQUIRED_MAINNET_GATES) + U3 client skeleton (quorum/disagreement, paging, stall)', unit: 'U2/U3', moneyPath: true },
  { domain: 'network', label: 'NET', paths: 'src/network', exports: 42, role: 'NetworkAdapter port, ArcNetworkAdapter (precheck codes), FAKENET second adapter, blocklist fakes', unit: 'NET', moneyPath: true },
  { domain: 'indexer', label: 'INDEXER', paths: 'src/indexer', exports: 53, role: 'Canonical system-emitter decode, ERC-20 cross-check, dedupe keys, paging (−32012/−32602/−32014), two-source agreement, exactly-once page commit, confirmTx, stall', unit: 'NET', moneyPath: true },
  { domain: 'ingestion', label: 'INGESTION', paths: 'src/ingestion', exports: 6, role: 'U4 credit decision logic: LogClass, LogId, CanonicalTransfer', unit: 'U4', moneyPath: true },
  { domain: 'registry', label: 'REGISTRY', paths: 'src/registry', exports: 5, role: 'U5 address registry — address↔customer map is PII: encrypted, access-logged, never on-chain', unit: 'U5', moneyPath: false },
  { domain: 'inbound', label: 'INBOUND', paths: 'src/inbound', exports: 6, role: 'U6 inbound flow → CBS (CONTRACT §5.3: T1/T2/T8/T11/unid)', unit: 'U6', moneyPath: true },
  { domain: 'policy', label: 'POLICY', paths: 'src/policy', exports: 5, role: 'U7 deterministic ALLOW/DENY, limits, velocity, allow-lists, CROSS_BORDER_DISABLED', unit: 'U7', moneyPath: true },
  { domain: 'compliance', label: 'COMPLIANCE', paths: 'src/compliance', exports: 6, role: 'U8 screening / monitoring / case / FIC reporting hooks', unit: 'U8', moneyPath: false },
  { domain: 'signer', label: 'SIGNER', paths: 'src/signer', exports: 10, role: 'U9 every ADR-001 duty: ApprovalEvidence, Eip1559ValueSend, FEE_CEILING, APPROVAL_REPLAYED, MonitorAttestation, MOVE_NOT_ON_TREASURY_LIST, CONFIG_UNSIGNED, SigningLogEntry', unit: 'U9', moneyPath: true },
  { domain: 'dfns', label: 'DFNS (F0–F3)', paths: 'src/dfns', exports: 112, role: 'Money-safe JSON, thin client with closed request allow-list, decoders + status→stage map, webhook HMAC verifier + simulator/recorded fakes', unit: 'DFNS', moneyPath: true },
  { domain: 'gateway', label: 'GATEWAY (F2)', paths: 'src/gateway', exports: 37, role: 'Thin signing gateway (checks before every DFNS transfer) + wrapper-call rule (allow-list, inner-call decoding)', unit: 'F2', moneyPath: true },
  { domain: 'outbound', label: 'OUTBOUND', paths: 'src/outbound', exports: 8, role: 'U10 outbound/case-return orchestrator + nonce writer (OutboundOrchestrator, CaseReturnState, NonceWriter)', unit: 'U10', moneyPath: true },
  { domain: 'gas', label: 'GAS', paths: 'src/gas', exports: 5, role: 'U11 gas/dust accumulators + fee calculation (Accumulators, receiptFeeWei)', unit: 'U11', moneyPath: true },
  { domain: 'recon', label: 'RECON', paths: 'src/recon', exports: 6, role: 'U12 reconciliation + circuit breaker (Reconciler, CircuitBreaker)', unit: 'U12', moneyPath: true },
  { domain: 'audit', label: 'AUDIT', paths: 'src/audit', exports: 3, role: 'U13 append-only hash-chained audit, no PII', unit: 'U13', moneyPath: false },
  { domain: 'cbs', label: 'CBS (ACL)', paths: 'src/cbs', exports: 52, role: 'Anti-corruption layer: port (§3 ops), events (§4), result model (§1.4), keys (§1.3), translator (T-templates, holds, resolveAmbiguous)', unit: 'CBS', moneyPath: true },
  { domain: 'nova-ports', label: 'PORTS', paths: 'src/nova-ports', exports: 199, role: 'ids (PortResult OK/REJECTED/AMBIGUOUS), ledger (journal decision incl. P2/P2I/P2P/P6/P7/P11/P2R), payment-store (decideSignal, decideMarkSubmit, decideClosePayout), wallet-registry, receiver, conversion, payout, gas-dust + 7 fake pairs + fault injection', unit: 'PORTS', moneyPath: true },
  { domain: 'status', label: 'STATUS', paths: 'src/status', exports: 41, role: 'STATUS_BY_STAGE, decideTransition, paymentState + journey (journeyLegs, journeyEnabled)', unit: 'PORTS', moneyPath: true },
  { domain: 'payments', label: 'PAY', paths: 'src/payments', exports: 41, role: 'D1 payment unit: network-agnostic orchestrator (every step idempotent), postings P1/P2/P3/P4/P6, deterministic keys, reconcile hooks, gateway-store', unit: 'PAY', moneyPath: true },
  { domain: 'journey', label: 'JOURNEY', paths: 'src/journey', exports: 285, role: 'JQUOTE (quote/fiat/ports/compose/fill: all-in quote, conservation re-check, fill desk), JPARTNER (partner port/tracker/core/fake/cpn-stub + recipients: BankRecipient encryption, WalletRecipient screening), JPAYIN, JTIME (timeline), JORCH (journey orchestrator)', unit: 'JORCH', moneyPath: true },
  { domain: 'ops', label: 'OPS', paths: 'src/ops', exports: 79, role: 'Case kinds, closed reason codes, server-side options, consent binding, two-human queue, hash-chained audit', unit: 'OPS', moneyPath: true },
  { domain: 'history', label: 'HIST', paths: 'src/history', exports: 26, role: 'Append-only client transaction history under the client UID (hist:<paymentId>:<eventId>), corrections, document references only', unit: 'HIST', moneyPath: true },
  { domain: 'http', label: 'HTTP', paths: 'src/http', exports: 10, role: 'POST /payments + GET /payments/:id handlers (framework-agnostic) + decimal-string amount parsing', unit: 'HTTP', moneyPath: false },
]

export const API_SURFACE = [
  {
    method: 'POST', path: '/payments',
    auth: 'Idempotency-Key header (1–255 printable ASCII, else 400 IDEMPOTENCY_KEY_INVALID)',
    body: '{ beneficiaryRef, amount } — amount is a decimal string, parsed to integer minor units. Only these two fields are read; payer/account/wallet/destination/fee come from the authenticated principal + receiver port + wallet registry.',
    codes: '201 new · 200 replay of the same request · 409 KEY_CONFLICT (same key, different request) · 503 TRY_AGAIN (outcome unknown — repeat the same key) · 404 BENEFICIARY_UNKNOWN · 422 BENEFICIARY_INACTIVE / NO_PAYOUT_PREFERENCE / PREFERENCE_INVALID / METHOD_NOT_ENABLED · 503 NO_HOT_WALLET · 400 AMOUNT_NOT_REPRESENTABLE',
  },
  {
    method: 'GET', path: '/payments/:id',
    auth: 'PAYER {owner, account} or STAFF',
    body: '→ { id, status, stage, reason, payIn, payout, amount, fee, legs[{kind, stage, reason, status, txHash, explorerUrl}], network, version }',
    codes: '403 UNAUTHENTICATED · 404 NOT_FOUND for non-existent or not owned (existence is not disclosed) · 503 TRY_AGAIN when the store is unavailable',
  },
  {
    method: 'POST', path: '/webhooks/dfns',
    auth: 'HMAC-SHA256 (X-DFNS-WEBHOOK-SIGNATURE) over the raw body; ±300 s timestamp tolerance',
    body: 'DFNS webhook events — a hint only: the handler re-reads via GET before applying anything.',
    codes: '200 only after the inbox commit · 401 on any authenticity failure (F-13)',
  },
  {
    method: 'GET', path: '/journeys/:id',
    auth: 'JTIME timeline handler',
    body: 'Client-visible timeline of a journey (405 for non-GET).',
    codes: '405 METHOD_NOT_ALLOWED for non-GET',
  },
]

export const API_RULE = 'Decimal strings at the API edge, integer base units inside. Account, amount, recipient and route are always taken from the server-side transfer record — never echoed from client input (Binding).'

export const OPEN_QUESTIONS = {
  total: 94, open: 92, answered: 2,
  categories: [
    { id: 'Q-P', n: 2, note: 'Prompt contradictions (Memo contract, blocklist receipt wording)' },
    { id: 'Q-A', n: 17, note: 'Arc / Circle facts' },
    { id: 'Q-C', n: 19, note: 'CBS facts, vendor-specific' },
    { id: 'Q-R', n: 13, note: 'South African regulation' },
    { id: 'Q-D', n: 11, note: 'ADR-raised decisions' },
    { id: 'Q-T', n: 9, note: 'Tooling & sandbox' },
    { id: 'Q-N', n: 23, note: 'Nova × Arc D1 design (added 2026-10-06)' },
  ],
  notable: 'Q-N1 (Erc20 vs Native transfer kind — blocks the live slice), Q-N2 (native decimals at DFNS), Q-N20/Q-N21 (nonce & idempotency semantics after a hash-less Failed).',
}

export const DEMO_TESTS = [
  { file: 'payment-with-history.demo.test.ts', what: 'A 2.5 USDC payment (6-dp integer units, chain 5042002) walks CREATED → PENDING_APPROVAL → APPROVED → SUBMITTED → CONFIRMING → COMPLETED; prints stage/status, ledger postings (reserve/settlement/USDC gas) and client-history keys. Asserts postings balance, ordered history, replay dedupe and KEY_CONFLICT on a changed body. A second case ends FAILED with the failure recorded in history.' },
  { file: 'payment-history.demo.test.ts', what: '1 USDC through the real signing gateway to the in-memory DFNS simulator (throwaway keys): P1 reserve → gateway submit (marker before POST, exactly one POST) → Broadcasted/Confirmed → history at each step. Failure case: rail PAUSED so nothing is sent; operator cancels; P6 releases and the clearing account nets to zero.' },
  { file: 'journey-walkthrough.demo.test.ts', what: 'Narrated journey-orchestrator walkthrough on fakes (ScriptedPayIn/Conversion/Arc/Payout, FakeFunds, CaptureCases, EmailNotifier, ManualClock): fiat→bank journey, USDC→USDC wallet journey (ARRIVED, COMPLETED, SETTLED, arc.calls = 1, ledger residual 0) and a failure case (pricing code expires before the desk fills → EXPIRED/QUOTE_EXPIRED, refunded, FAILED).' },
]

export const GUARDRAILS = [
  'Reading .env — blocked by the guard hook',
  'Any command referencing chain ID 5042 (mainnet) — blocked',
  'A broadcast without a testnet RPC — blocked',
  'Direct calls to DFNS/Circle/VALR production APIs — blocked by the sandbox network allowlist',
  'A fake DFNS token — blocked',
  '22 (kit v1) / 32 (kit v3) guard self-tests pass in .claude/hooks/test-guard.sh',
]

export const REPO_META = {
  repo: 'github.com/MrsNqobiG/ArcRail',
  package: 'arc-rail-adapter v0.0.0',
  language: 'TypeScript (strict, ESM), Node >=22.23.3 <23',
  runtimeDeps: 'viem 2.56.9 — the only runtime dependency',
  devDeps: 'typescript 6.0.3 · vitest 4.1.11 · fast-check 4.10.2 · Stryker 10.0.0 · CycloneDX 6.0.1',
  tests: '109 TS files in src/ across 24 module dirs; 69 unit files / 2,328 tests + 24 property + 480 contract + 8 demo = 2,840 green (2026-10-15); + 139 rebrand-pinning (full 2026-10-12, unchanged lint; repo-clean invariant re-run 2026-10-15) = 2,979; test/types + test/e2e (ARC_E2E=1); Stryker mutation runs in hosted CI',
  build: 'U1–U13 D1 build committed 2026-10-13 (2edde2f) + the D2–D6 adapter-side decision cores committed 2026-10-15 (035e950) — branch co1-v3/units-u4-u13, all local gates green',
  flow: 'Customer → Raeyl (Nova) → DFNS → Arc → Recipient',
  custody: 'DFNS organisation (dfns.co) — no second wallet or approval system is built',
  liquidity: 'VALR / OTC providers for fiat↔USDC; StableFX later',
  license: 'UNLICENSED (private)',
}
