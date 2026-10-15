import type {
  PayInMethod, PayoutMethod, JourneyCombo, StageRow, FailureReason,
  GlAccount, PostingTemplate,
} from './types'

// src/status/journey.ts · NOVA_ARC_DESIGN §4.1
export const PAY_IN_METHODS: PayInMethod[] = [
  { id: 'STABLECOIN_BALANCE', label: 'Stablecoin balance', note: "USDC balance in Nova (payer's own stablecoin balance)", flag: 'live in D1', liveIn: 'D1' },
  { id: 'STABLECOIN_DEPOSIT', label: 'Stablecoin deposit', note: 'Payer sends USDC from an external wallet', flag: 'stablecoinDepositEnabled = false', liveIn: 'D2' },
  { id: 'FIAT', label: 'Fiat', note: "Payer's fiat balance in Nova (e.g. ZAR)", flag: 'fiatEnabled = false', liveIn: 'D5' },
]

export const PAYOUT_METHODS: PayoutMethod[] = [
  { id: 'STABLECOIN_WALLET', label: 'Stablecoin wallet', note: "USDC to the receiver's wallet on a network (carries beneficiaryRef)", liveIn: 'D1' },
  { id: 'FIAT_BANK', label: 'Fiat bank', note: 'Fiat to a bank account via PayoutPartnerPort (CPN-shaped stub), carries beneficiaryRef', liveIn: 'D5 + partner' },
]

export const JOURNEY_FLAGS = [
  { id: 'fiatEnabled', default: 'false', note: 'D1_FLAGS: both flags default false; a closed flag → METHOD_NOT_ENABLED before anything is reserved. A method is never silently switched.' },
  { id: 'stablecoinDepositEnabled', default: 'false', note: 'Cross-border flag lives elsewhere and stays OFF until a legal opinion is recorded.' },
]

export const JOURNEY_MATRIX: JourneyCombo[] = [
  { payIn: 'STABLECOIN_BALANCE', payout: 'STABLECOIN_WALLET', legs: ['RESERVE', 'ARC_TRANSFER'], liveIn: 'D1 (live)' },
  { payIn: 'STABLECOIN_DEPOSIT', payout: 'STABLECOIN_WALLET', legs: ['AWAIT_DEPOSIT', 'RESERVE', 'ARC_TRANSFER'], liveIn: 'D2' },
  { payIn: 'FIAT', payout: 'STABLECOIN_WALLET', legs: ['RESERVE (fiat)', 'CONVERT_IN', 'ARC_TRANSFER'], liveIn: 'D5' },
  { payIn: 'STABLECOIN_BALANCE', payout: 'FIAT_BANK', legs: ['RESERVE', 'ARC_TRANSFER (to partner)', 'PAYOUT'], liveIn: 'D5 + partner' },
  { payIn: 'STABLECOIN_DEPOSIT', payout: 'FIAT_BANK', legs: ['RESERVE', 'ARC_TRANSFER (to partner)', 'PAYOUT'], liveIn: 'D5 + partner' },
  { payIn: 'FIAT', payout: 'FIAT_BANK', legs: ['RESERVE (fiat)', 'CONVERT_IN', 'ARC_TRANSFER (to partner)', 'PAYOUT'], liveIn: 'D5 + partner (K-56: whether via Arc at all)' },
]

export const JOURNEY_RULES = [
  "The payer's create request carries only the pay-in choice; the payout method is read server-side via ReceiverPort.resolvePayout. A request containing a payout method is refused PAYOUT_NOT_PAYER_CHOICE (HTTP 400) with nothing reserved.",
  'The resolved payout, destination and preferenceVersion are frozen into the payment binding at creation.',
  'A payment is COMPLETED only when its last leg completes: indexer confirmation for STABLECOIN_WALLET; the partner\'s authenticated final confirmation ("ARRIVED") for FIAT_BANK.',
  'The fill desk (JQUOTE) issues one pricing code per (payment, quote request) key; a requote guard refuses a second code while an outcome is unknown, a conversion is booked, or a refused booked fill is unresolved.',
]

// src/status/index.ts · design §13
export const STAGES: StageRow[] = [
  { stage: 'CREATED', rank: 0, terminal: false, status: 'PENDING', note: 'Payment accepted, P1 reserved, nothing sent' },
  { stage: 'PENDING_APPROVAL', rank: 1, terminal: false, status: 'PENDING', note: 'DFNS policy POL-1 approval pending (autoRejectTimeout backstopped by own timer)' },
  { stage: 'APPROVED', rank: 2, terminal: false, status: 'PROCESSING', note: 'Policy approval resolved; not yet broadcast' },
  { stage: 'SUBMITTED', rank: 3, terminal: false, status: 'PROCESSING', note: 'DFNS Broadcasted; submit marker set' },
  { stage: 'CONFIRMING', rank: 4, terminal: false, status: 'PROCESSING', note: 'On chain, awaiting our own indexer confirmation' },
  { stage: 'COMPLETED', rank: 5, terminal: true, status: 'SETTLED', note: 'Last leg confirmed by our own system-emitter log' },
  { stage: 'REJECTED', rank: 6, terminal: true, status: 'FAILED', note: 'A leg was refused — reason is mandatory' },
  { stage: 'EXPIRED', rank: 6, terminal: true, status: 'FAILED', note: 'A wait state exceeded its maximum age — reason mandatory' },
  { stage: 'CANCELLED', rank: 6, terminal: true, status: 'FAILED', note: 'Cancelled by operator or on-chain replacement' },
]

export const STATUS_RULES = [
  "Nova's public TransactionStatus is unchanged [A-31]; lifecycle detail lives in the stage field with an explicit, tested mapping (STATUS_BY_STAGE is the single source).",
  'No FAILED stage exists — failure is a stage (REJECTED / EXPIRED / CANCELLED) plus a reason. A failure stage without a reason is unrepresentable (LegState type + runtime isLegalState check, fail closed).',
  'REVERSED is never a stage. It is only the status of a COMPLETED payment after a P7 compensating journal entry. Nothing on Arc can be reversed on-chain.',
  'Payment-level state = first failed leg\'s stage/reason, else first non-COMPLETED leg (paymentState).',
  'Transition verdicts: APPLIED / DUPLICATE / STALE / ILLEGAL. An ILLEGAL transition quarantines the item and pages a human.',
  'DFNS "Confirmed" and webhooks are a cross-check only: COMPLETED for the Arc leg comes from our own confirmed system-emitter log (§6.5).',
]

export const FAILURE_REASONS: FailureReason[] = [
  { code: 'APPROVAL_DENIED', stage: 'REJECTED', failure: 'F-1', note: 'DFNS policy approval rejected by human approvers' },
  { code: 'BLOCKLISTED_PRECHECK', stage: 'REJECTED', failure: 'F-3a', note: 'Blocklist caught by our own precheck before submit; Compliance case' },
  { code: 'BLOCKLISTED_PRE_MEMPOOL', stage: 'REJECTED', failure: 'F-3b', note: 'Blocklisted sender rejected before the mempool (hash-less Failed); nonce-burn procedure' },
  { code: 'ONCHAIN_REVERTED', stage: 'REJECTED', failure: 'F-3c', note: 'Included but reverted (status 0, gas consumed); gas posted by P4' },
  { code: 'DFNS_FAILED', stage: 'REJECTED', failure: 'F-3b/F-6', note: 'DFNS reports Failed without a hash' },
  { code: 'INSUFFICIENT_FUNDS', stage: 'REJECTED', failure: '—', note: 'Not enough funds for amount + fee' },
  { code: 'PAYOUT_FAILED', stage: 'REJECTED', failure: 'F-17', note: 'Payout partner failed after the Arc leg confirmed; USDC stays at partner' },
  { code: 'METHOD_NOT_ENABLED', stage: 'REJECTED', failure: 'J1', note: 'Journey flag closed for this pay-in method' },
  { code: 'DESTINATION_NOT_ALLOWED', stage: 'REJECTED', failure: 'U7', note: 'Policy engine allow-list refused the destination' },
  { code: 'APPROVAL_EXPIRED', stage: 'EXPIRED', failure: 'F-2', note: 'autoRejectTimeout elapsed; P6 with proof (a1)' },
  { code: 'QUOTE_EXPIRED', stage: 'EXPIRED', failure: 'F-16', note: 'Only while ARC_TRANSFER has no submit marker' },
  { code: 'UNDER_FEE_FLOOR_DROPPED', stage: 'EXPIRED', failure: 'F-4', note: 'Under-floor drop, only after proof (b); a retry is a new payment' },
  { code: 'CANCELLED_BY_OPERATOR', stage: 'CANCELLED', failure: 'F-2', note: 'Operator abort while unsigned; proof (a2)' },
  { code: 'CANCELLED_ONCHAIN_REPLACED', stage: 'CANCELLED', failure: 'F-18', note: 'Nonce consumed by a recorded DFNS cancel/speed-up' },
]

export const SIGNAL_SOURCES = [
  'ARC_LOG', 'DFNS_WEBHOOK', 'DFNS_POLL', 'CONVERSION', 'PAYOUT_CALLBACK', 'OPERATOR_DECISION', 'LEDGER', 'INTERNAL',
]

export const DFNS_REQUEST_STATES = [
  { id: 'NONE', note: 'No DFNS transfer request for this leg yet' },
  { id: 'UNRESOLVED', note: 'Submit marker set but externalRef is null: no terminal stage, no P6, nothing can end the leg' },
  { id: 'KNOWN', note: 'externalId resolved — replay-safe by DFNS idempotency' },
]

// NOVA_ARC_DESIGN §9.1
export const GL_ACCOUNTS: GlAccount[] = [
  { role: 'GL-1', name: 'Customer USDC liability', side: 'Credit', subAccounts: ['one per Nova account [A-02]'], note: 'Nova customer balance' },
  { role: 'GL-2', name: 'Company USDC asset', side: 'Debit', subAccounts: ['arc.<w> (one per DFNS wallet)', 'arc.hot (sending wallet)', 'partner.<partnerId>', 'partnerClaim.<partnerId>', 'arc.<w>.subminor (18-dp, P9D)'], note: 'One sub-account per holding location' },
  { role: 'GL-3', name: 'Network fee (gas) expense', side: 'Debit', subAccounts: ['arc', 'arc.unrecognised (18-dp sub-ledger)'], note: 'Gas paid in USDC is posted too' },
  { role: 'GL-4', name: 'Suspense', side: 'Credit', subAccounts: ['arc.gasDust.<w>', 'arc.unidentified', 'arc.receiptDust (18-dp)'], note: 'Dust is never silently dropped' },
  { role: 'GL-5', name: 'Clearing / in-flight', side: 'Credit', subAccounts: ['arc.outbound'], note: 'Reservation sits here until settle or release' },
  { role: 'GL-6', name: 'Fee income', side: 'Credit', subAccounts: ['payments'], note: 'Customer fee F' },
  { role: 'GL-7', name: 'Company-owned funding', side: 'Credit', subAccounts: [], note: 'USDC from outside the wallet registry; funds gas float & hot wallets' },
]

// A = amount to receiver, F = fee, G = gas, (g,d) = split, k = 10^(18−p)
export const POSTING_TEMPLATES: PostingTemplate[] = [
  { id: 'P1_RESERVE', name: 'Reserve', fires: 'Payment accepted, before the DFNS call', debit: 'GL-1 payer', credit: 'GL-5 arc.outbound', amount: 'A + F', family: 'P' },
  { id: 'P2_SETTLE_EXTERNAL', name: 'Settle external', fires: 'Arc leg COMPLETED (external receiver); PAYOUT PAID for FIAT_BANK', debit: 'GL-5', credit: 'GL-2 arc.hot / partner.<id>', amount: 'A', family: 'P' },
  { id: 'P2I_SETTLE_INTERNAL', name: 'Settle internal', fires: 'Arc leg COMPLETED, receiver is a Nova customer with our wallet', debit: 'GL-5 + GL-2 arc.<recv>', credit: 'GL-1 receiver + GL-2 arc.hot', amount: 'A / A', family: 'P' },
  { id: 'P2P_PARTNER_FUNDED', name: 'Partner funded', fires: 'Arc leg COMPLETED, receiver chose FIAT_BANK', debit: 'GL-2 partner.<id>', credit: 'GL-2 arc.hot', amount: 'A', family: 'P' },
  { id: 'P2R_PARTNER_RETURN', name: 'Partner return', fires: 'F-17: partner returns USDC (exact-matching INBOUND log on an approved two-person case)', debit: 'GL-2 arc.<to>', credit: 'GL-2 partner.<id> (or partnerClaim.<id> after P11)', amount: 'A', family: 'P' },
  { id: 'P3_FEE', name: 'Fee', fires: 'With P2/P2I', debit: 'GL-5', credit: 'GL-6 payments', amount: 'F (omitted if 0)', family: 'P' },
  { id: 'P4_GAS', name: 'Gas', fires: 'Receipt of any tx our wallet sent (status 1 or 0)', debit: 'GL-3 arc', credit: 'GL-2 arc.<from>', amount: 'g', family: 'P' },
  { id: 'P4D_GAS_DUST', name: 'Gas dust', fires: 'Same receipt, 18-dp sub-ledger [A-11]', debit: 'GL-3 arc.unrecognised (wei)', credit: 'GL-4 arc.gasDust.<from>', amount: 'd', family: 'P' },
  { id: 'P5_DUST_SWEEP', name: 'Dust sweep', fires: 'Wallet dust ≥ k wei', debit: 'GL-3 arc · GL-4 arc.gasDust.<w>', credit: 'GL-2 arc.<w> · GL-3 arc.unrecognised', amount: 'j = ⌊dust/k⌋ minor', family: 'P' },
  { id: 'P6_RELEASE', name: 'Release', fires: 'Leg terminal without funds leaving, only with proof (a)/(b)/(c) or a status-0 receipt; ends the payment', debit: 'GL-5', credit: 'GL-1 payer', amount: 'A + F', family: 'P' },
  { id: 'P7_COMPENSATE', name: 'Compensate', fires: 'Business reversal of a SETTLED payment → status REVERSED', debit: 'mirror of original P2/P3 (sides swapped)', credit: 'refs.compensates = original journal', amount: 'same amounts', family: 'P' },
  { id: 'P8_EXTERNAL_FUNDING', name: 'External funding', fires: 'INBOUND log matching an approved funding record (outside the registry); never for INTERNAL logs', debit: 'GL-2 arc.<to>', credit: 'GL-7', amount: 'M', family: 'P' },
  { id: 'P9_UNIDENTIFIED_RECEIPT', name: 'Unidentified receipt', fires: 'INBOUND log to company wallet matching no approved record/case (no PAUSE; Ops case)', debit: 'GL-2 arc.<to>', credit: 'GL-4 arc.unidentified', amount: 'm', family: 'P' },
  { id: 'P9D_RECEIPT_DUST', name: 'Receipt dust', fires: 'Same log, 18-dp sub-ledger', debit: 'GL-2 arc.<to>.subminor (r wei)', credit: 'GL-4 arc.receiptDust', amount: 'r', family: 'P' },
  { id: 'P10_INTERNAL_MOVE', name: 'Internal move', fires: 'INTERNAL log (both wallets ours) linked by DFNS hash to an approved move record; gas via P4/P4D to source', debit: 'GL-2 arc.<dest>', credit: 'GL-2 arc.<source>', amount: 'X', family: 'P' },
  { id: 'P11_PARTNER_CLAIM', name: 'Partner claim', fires: 'F-17 branch 2: two-person CLOSE_PARTNER_UNRETURNED, posted with the payment\'s P6 under the same decision', debit: 'GL-2 partnerClaim.<id>', credit: 'GL-2 partner.<id>', amount: 'A', family: 'P' },
  { id: 'P12_FILL_REVERSAL', name: 'Fill reversal (ops)', fires: 'UNMATCHED_FILL → REVERSE (delta D-1): unwinds the booked conversion exactly', debit: 'built from booked entry', credit: '—', amount: '—', family: 'P' },
  { id: 'P13_PAYIN_REFUND', name: 'Pay-in refund (ops)', fires: 'Refund of a confirmed pay-in', debit: '—', credit: '—', amount: '—', family: 'P' },
  { id: 'P14_REQUOTE_REPRICE', name: 'Requote reprice (ops)', fires: 'REQUOTE option: moves exactly the requoted amount old reservation → new; legs must total the requoted amount', debit: '—', credit: '—', amount: '—', family: 'P' },
  { id: 'P15_WRITE_OFF', name: 'Write-off (ops)', fires: 'WRITE_OFF: loss side is the configured loss account, never defaulted; credit = client liability or suspense', debit: '—', credit: '—', amount: '—', family: 'P' },
]

export const LEDGER_KEYS = [
  { pattern: 'pay:<paymentId>:p1 | :p2 | :p2i | :p2p | :p2r | :p3 | :p6 | :p7 | :p11', note: 'Deterministic per-payment posting keys (§10.2) — exactly once by construction' },
  { pattern: 'gas:<chainId>:<txHash>', note: 'Gas posted once per receipt, whatever kind of tx our wallet sent' },
  { pattern: 'dust:<chainId>:<w>:<sweepSeq>', note: 'Dust sweep sequence per wallet' },
  { pattern: 'fund: / unid:<chainId>:<txHash>:<logIndex>', note: 'External funding and unidentified receipts' },
  { pattern: 'move:<moveId>', note: 'Approved internal moves' },
]

export const RECON_HOOKS = [
  'P1 = P2 + P3 or P1 = P6 for every payment (or the P2-family equivalents per payout path)',
  'Per-wallet chain invariant: on-chain wei(w) = GL-2 arc.<w> × k − GL-4 gasDust(w) + GL-2 subminor(w)',
  'Expense identity and unidentified-receipt identity (GL-3 / GL-4 sub-ledgers)',
  'Any drift → PAUSE (whole rail) or QUARANTINE (one item); two humans must approve the unpause',
]
