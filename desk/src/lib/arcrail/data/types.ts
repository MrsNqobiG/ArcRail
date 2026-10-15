// ArcRail Explorer — shared types for reference data extracted from the repo
// Source: https://github.com/MrsNqobiG/ArcRail (docs/ + src/)

export type StageName =
  | 'CREATED' | 'PENDING_APPROVAL' | 'APPROVED' | 'SUBMITTED' | 'CONFIRMING'
  | 'COMPLETED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED'

export type TransactionStatus = 'PENDING' | 'PROCESSING' | 'SETTLED' | 'FAILED' | 'REVERSED'

export interface StageRow {
  stage: StageName
  rank: number
  terminal: boolean
  status: TransactionStatus
  note: string
}

export interface FailureReason {
  code: string
  stage: 'REJECTED' | 'EXPIRED' | 'CANCELLED'
  failure: string
  note: string
}

export interface PayInMethod { id: string; label: string; note: string; flag: string; liveIn: string }
export interface PayoutMethod { id: string; label: string; note: string; liveIn: string }
export interface JourneyCombo { payIn: string; payout: string; legs: string[]; liveIn: string }

export interface GlAccount { role: string; name: string; side: 'Debit' | 'Credit'; subAccounts: string[]; note: string }

export interface PostingTemplate {
  id: string
  name: string
  fires: string
  debit: string
  credit: string
  amount: string
  family: 'P' | 'T'
}

export interface CaseKindRow { kind: string; reasons: string[]; actions: string[]; note: string }
export interface AdrRow { id: string; title: string; options: string[]; recommendation: string }
export interface RiskRow { id: string; title: string; severity: string; owner: string; note: string }
export interface ConstantRow { id: string; value: string; note: string }
export interface FailurePath { id: string; title: string; detail: string; pause: boolean }
export interface ModuleRow { domain: string; label: string; paths: string; exports: number; role: string; unit: string; moneyPath: boolean }
export interface GateRow {
  code: string
  group: 'G' | 'D' | 'GP' | 'GM'
  title: string
  requirement: string
  status: 'NOT SIGNED' | 'CHAT RECORD'
  detail: string
}
export interface RubricItem { id: string; group: string; text: string }
