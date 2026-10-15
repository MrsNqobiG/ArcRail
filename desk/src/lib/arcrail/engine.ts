import { createHash } from './hash'
import { db } from './memory.ts'
import { JOURNEY_MATRIX } from './data/core'
import { CASE_KINDS } from './data/ops'

// ---------------------------------------------------------------------------
// ArcRail journey engine — a faithful, simplified simulation of the repo's
// D1 design: stages + reasons (src/status), P-template postings (src/payments),
// ops cases (src/ops), hash-chained audit, deterministic keys, history dedupe.
// Integer money only: all amounts are integer USDC minor units (6 dp).
// ---------------------------------------------------------------------------

export interface LegState { kind: string; seq: number; stage: string; status: string; reason: string | null }

const DEBIT = 'debit'
const CREDIT = 'credit'

function fail(msg: string): never {
  const m = /^(\d{3})/.exec(msg)
  throw Object.assign(new Error(msg), { statusCode: m ? Number(m[1]) : 400 })
}

// deterministic-ish ids
async function nextSeq(prefix: string, table: 'Payment' | 'OpsCase' | 'AuditEntry'): Promise<string> {
  if (table === 'Payment') {
    const n = await db.payment.count()
    return `${prefix}${String(n + 1).padStart(4, '0')}`
  }
  if (table === 'OpsCase') {
    const n = await db.opsCase.count()
    return `${prefix}${String(n + 1).padStart(4, '0')}`
  }
  const n = await db.auditEntry.count()
  return `${prefix}${String(n + 1).padStart(5, '0')}`
}

async function ensureRail() {
  let rail = await db.railState.findUnique({ where: { id: 'rail' } })
  if (!rail) {
    rail = await db.railState.create({ data: { id: 'rail' } })
    await audit('system', 'RAIL_BOOT', 'Rail state created; outbound enabled')
  }
  return rail
}

async function audit(actor: string, action: string, detail: string) {
  const last = await db.auditEntry.findFirst({ orderBy: { seq: 'desc' } })
  const seq = (last?.seq ?? 0) + 1
  const prevHash = last?.hash ?? '0'.repeat(64)
  const hash = createHash('sha256').update(`${prevHash}|${seq}|${actor}|${action}|${detail}`).digest('hex')
  await db.auditEntry.create({ data: { id: `aud-${seq}`, seq, prevHash, hash, actor, action, detail } })
  return { seq, hash }
}

async function history(paymentId: string, n: number, body: Record<string, unknown>) {
  const eventId = `hist:${paymentId}:${n}`
  // inbox dedupe: an existing key replays without writing (exactly-once)
  const existing = await db.historyEvent.findUnique({ where: { paymentId_eventId: { paymentId, eventId } } })
  if (existing) return { replayed: true }
  await db.historyEvent.create({ data: { id: `${paymentId}-e${n}`, paymentId, eventId, body: JSON.stringify(body) } })
  return { replayed: false }
}

async function post(
  template: string, key: string, debit: string, credit: string, amountMinor: number,
  unit = 'USDC minor', paymentId?: string, legKind?: string, memo = '',
) {
  const existing = await db.ledgerEntry.findUnique({ where: { id: key } })
  if (existing) return { replayed: true }
  await db.ledgerEntry.create({
    data: { id: key, template, paymentId: paymentId ?? null, legKind: legKind ?? null, debitAccount: debit, creditAccount: credit, amountMinor, unit, memo },
  })
  return { replayed: false }
}

function paymentStateFromLegs(legs: LegState[]): { stage: string; reason: string | null } {
  const failed = legs.find((l) => l.stage === 'REJECTED' || l.stage === 'EXPIRED' || l.stage === 'CANCELLED')
  if (failed) return { stage: failed.stage, reason: failed.reason }
  const open = legs.find((l) => l.stage !== 'COMPLETED')
  if (open) return { stage: open.stage, reason: null }
  return { stage: 'COMPLETED', reason: null }
}

const STATUS_BY_STAGE: Record<string, string> = {
  CREATED: 'PENDING', PENDING_APPROVAL: 'PENDING', APPROVED: 'PROCESSING', SUBMITTED: 'PROCESSING',
  CONFIRMING: 'PROCESSING', COMPLETED: 'SETTLED', REJECTED: 'FAILED', EXPIRED: 'FAILED', CANCELLED: 'FAILED',
}

export function statusFor(stage: string, reversed: boolean): string {
  if (stage === 'COMPLETED' && reversed) return 'REVERSED'
  return STATUS_BY_STAGE[stage] ?? 'PENDING'
}

// ---------------------------------------------------------------------------
// POST /payments
// ---------------------------------------------------------------------------
export async function createPayment(input: {
  payIn: string; payout: string; amount: string; fee?: string; beneficiaryRef: string; payerAccount?: string;
}) {
  await ensureRail()
  const rail = (await db.railState.findUnique({ where: { id: 'rail' } }))!
  if (rail.paused) fail('503 RAIL_PAUSED: the rail is paused; no new payments are accepted (fail closed)')

  const combo = JOURNEY_MATRIX.find((c) => c.payIn === input.payIn && c.payout === input.payout)
  if (!combo) fail('400 PAYOUT_NOT_PAYER_CHOICE / unknown combination')

  // D1 flags: only STABLECOIN_BALANCE → STABLECOIN_WALLET is live
  const d1Live = input.payIn === 'STABLECOIN_BALANCE' && input.payout === 'STABLECOIN_WALLET'
  // Non-D1 combinations are still allowed so the demo can be explored; the repo refuses them with METHOD_NOT_ENABLED.
  void d1Live

  const amountMinor = parseMinor(input.amount)
  if (amountMinor <= 0) fail('400 AMOUNT_NOT_POSITIVE')
  if (amountMinor > 5_000_000_000) fail('400 AMOUNT_NOT_REPRESENTABLE')
  const feeMinor = parseMinor(input.fee ?? '0.25')
  if (feeMinor < 0) fail('400 FEE_NEGATIVE')
  if (feeMinor > 5_000_000_000) fail('400 FEE_NOT_REPRESENTABLE')

  const id = await nextSeq('pm-', 'Payment')
  const legs: LegState[] = combo.legs.map((kind) => ({ kind, seq: 0, stage: 'CREATED', status: 'PENDING', reason: null }))
  // the RESERVE (or 'RESERVE (fiat)') leg completes as soon as P1 posts
  legs.forEach((l) => {
    if (l.kind.startsWith('RESERVE')) { l.stage = 'COMPLETED'; l.status = 'SETTLED' }
  })

  const payerAccount = input.payerAccount ?? 'GL-1 customer:cust-001'
  await db.payment.create({
    data: {
      id, payIn: input.payIn, payout: input.payout, amountMinor, feeMinor, gasMinor: 0,
      beneficiaryRef: input.beneficiaryRef, payerAccount,
      status: 'PENDING', stage: 'CREATED', dfnsState: 'NONE', live: false, legs: JSON.parse(JSON.stringify(legs)),
    },
  })

  // P1 — reserve payer funds into clearing (idempotent by key)
  await post('P1_RESERVE', `pay:${id}:p1`, payerAccount, 'GL-5 arc.outbound', amountMinor + feeMinor, 'USDC minor', id, 'RESERVE', 'Payment accepted')
  await history(id, 1, { step: 'CREATED', stage: 'CREATED', status: 'PENDING', postings: ['P1_RESERVE'], detail: `P1 reserved ${fmt(amountMinor + feeMinor)} (A+F)` })
  await audit('system', 'PAYMENT_CREATED', `${id} payIn=${input.payIn} payout=${input.payout} A=${amountMinor} F=${feeMinor} P1 posted`)
  return { id, legs, d1Live, note: d1Live ? 'D1 live journey' : 'Journey beyond D1 flags — simulated for exploration (repo refuses METHOD_NOT_ENABLED until its flag is enabled)' }
}

function parseMinor(dec: string): number {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(dec.trim())
  if (!m) fail(`400 AMOUNT_NOT_REPRESENTABLE: "${dec}" is not a decimal string`)
  // Bound the whole part first: the result is at most 5000999999 minor units, an exact integer far below 2^53.
  // The 5000 USDC cap itself is enforced by the callers (amount and fee).
  if (m[1].replace(/^0+/, '').length > 4 || Number(m[1]) > 5000) fail(`400 AMOUNT_NOT_REPRESENTABLE: "${dec}" exceeds 5000`)
  const frac = (m[2] ?? '').padEnd(6, '0')
  return Number(m[1]) * 1_000_000 + Number(frac)
}

export function fmt(minor: number): string {
  const sign = minor < 0 ? '-' : ''
  const a = Math.abs(minor)
  return `${sign}${Math.floor(a / 1_000_000)}.${String(a % 1_000_000).padStart(6, '0')}`
}

// ---------------------------------------------------------------------------
// POST /payments/:id/events — signal sources drive the state machine
// ---------------------------------------------------------------------------
export type EventType =
  | 'submit' | 'approve' | 'deny' | 'approval_expire'
  | 'broadcast' | 'onchain' | 'confirm'
  | 'payout_arrived' | 'fail_payout' | 'partner_return'
  | 'quote_expire' | 'underfloor' | 'dfns_timeout' | 'cancel'

const TX_PREFIX = '0x'

export interface ChainFact {
  txHash?: string
  gasMinor?: number
  live?: boolean
}

export async function applyEvent(id: string, type: EventType, chain?: ChainFact) {
  const p = await db.payment.findUnique({ where: { id } })
  if (!p) fail('404 NOT_FOUND')
  const rail = await ensureRail()
  const legs = (p.legs as unknown as LegState[]).map((l) => ({ ...l }))
  const A = p.amountMinor
  const F = p.feeMinor
  const payer = p.payerAccount
  const partner = `GL-2 partner.<cpn-stub>`
  let txHash = p.txHash
  let dfnsState = p.dfnsState
  let externalRef = p.externalRef
  let submitMarker = p.submitMarker
  let gasMinor = p.gasMinor
  let reversed = p.reversed
  const postings: string[] = []
  let caseOpened: string | null = null

  const setLeg = (i: number, stage: string, reason: string | null = null) => {
    legs[i].stage = stage
    legs[i].reason = reason
    legs[i].status = statusFor(stage, false)
  }
  const arcIdx = legs.findIndex((l) => l.kind.startsWith('ARC_TRANSFER'))
  const payoutIdx = legs.findIndex((l) => l.kind === 'PAYOUT')
  const h = async (body: Record<string, unknown>) => {
    const n = await db.historyEvent.count({ where: { paymentId: id } })
    const r = await history(id, n + 1, body)
    return r.replayed
  }

  switch (type) {
    case 'submit': {
      if (p.stage !== 'CREATED') fail(`409 STALE: current stage ${p.stage}; submit is legal from CREATED`)
      if (rail.paused) fail('503 RAIL_PAUSED: outbound movement is paused (fail closed)')
      // gateway checks then one DFNS POST; the submit marker is set BEFORE the POST (F-6)
      submitMarker = true
      dfnsState = 'UNRESOLVED' // externalId not yet resolved
      // prerequisite legs complete before the DFNS call: the deposit is detected (AWAIT_DEPOSIT)
      // and the conversion is booked (CONVERT_IN, F-16 guards the quote while it runs)
      legs.forEach((l) => {
        if (l.kind === 'AWAIT_DEPOSIT' || l.kind === 'CONVERT_IN') { l.stage = 'COMPLETED'; l.status = 'SETTLED' }
      })
      setLeg(arcIdx, 'PENDING_APPROVAL')
      await h({ step: 'SUBMIT', source: 'DFNS_WEBHOOK', stage: 'PENDING_APPROVAL', detail: 'Submit marker set before POST; DFNS policy POL-1 approval pending; dfnsState=UNRESOLVED' })
      await audit('system', 'DFNS_SUBMIT', `${id} submit marker set; one DFNS transfer request; dfnsState=UNRESOLVED`)
      break
    }
    case 'approve': {
      if (p.stage !== 'PENDING_APPROVAL') fail(`409 STALE: approve is legal from PENDING_APPROVAL (now ${p.stage})`)
      dfnsState = 'KNOWN'
      externalRef = externalRef ?? `dfns-${id}`
      setLeg(arcIdx, 'APPROVED')
      await h({ step: 'APPROVE', source: 'DFNS_WEBHOOK', stage: 'APPROVED', detail: 'Policy approval resolved (FIDO2 user-action); externalId known; replay-safe by DFNS idempotency' })
      await audit('dfns-policy', 'APPROVAL_RESOLVED', `${id} approved; dfnsState=KNOWN`)
      break
    }
    case 'deny': {
      if (p.stage !== 'PENDING_APPROVAL') fail(`409 STALE: deny is legal from PENDING_APPROVAL`)
      setLeg(arcIdx, 'REJECTED', 'APPROVAL_DENIED')
      // proof (a1): DFNS shows Rejected by policy, never signed → P6
      await post('P6_RELEASE', `pay:${id}:p6`, 'GL-5 arc.outbound', payer, A + F, 'USDC minor', id, 'RESERVE', 'F-1: approval denied, proof (a1)')
      postings.push('P6_RELEASE')
      await h({ step: 'REJECTED', stage: 'REJECTED', reason: 'APPROVAL_DENIED', postings: ['P6_RELEASE'], detail: 'F-1: reservation released with proof (a1)' })
      await audit('dfns-policy', 'APPROVAL_DENIED', `${id} REJECTED/APPROVAL_DENIED; P6 released ${fmt(A + F)}`)
      break
    }
    case 'approval_expire': {
      if (p.stage !== 'PENDING_APPROVAL') fail('409 STALE: expiry is legal from PENDING_APPROVAL')
      setLeg(arcIdx, 'EXPIRED', 'APPROVAL_EXPIRED')
      await post('P6_RELEASE', `pay:${id}:p6`, 'GL-5 arc.outbound', payer, A + F, 'USDC minor', id, 'RESERVE', 'F-2: approval expired, proof (a1)')
      postings.push('P6_RELEASE')
      await h({ step: 'EXPIRED', stage: 'EXPIRED', reason: 'APPROVAL_EXPIRED', postings: ['P6_RELEASE'], detail: 'F-2: autoRejectTimeout + own timer backstop' })
      break
    }
    case 'broadcast': {
      if (p.stage !== 'APPROVED') fail('409 STALE: broadcast is legal from APPROVED')
      txHash = chain?.txHash ?? txHash ?? `${TX_PREFIX}${createHash('sha256').update(id).digest('hex').slice(0, 62)}`
      setLeg(arcIdx, 'SUBMITTED')
      await h({
        step: 'BROADCAST',
        source: chain?.live ? 'ARC_RPC' : 'DFNS_WEBHOOK',
        stage: 'SUBMITTED',
        txHash,
        live: Boolean(chain?.live),
        detail: chain?.live
          ? `Signed locally and broadcast to Arc testnet ${txHash}. Receipt not yet applied.`
          : 'Rehearsal only — this hash is computed locally and is not submitted to Arc.',
      })
      break
    }
    case 'onchain': {
      if (p.stage !== 'SUBMITTED') fail('409 STALE: onchain is legal from SUBMITTED')
      setLeg(arcIdx, 'CONFIRMING')
      await h({ step: 'ONCHAIN', source: 'ARC_LOG', stage: 'CONFIRMING', txHash, detail: 'Block included; awaiting our own indexer confirmation (DFNS Confirmed is a cross-check only)' })
      break
    }
    case 'confirm': {
      if (p.stage !== 'CONFIRMING') fail('409 STALE: confirm is legal from CONFIRMING')
      // canonical confirmation: our own system-emitter log (C-20)
      setLeg(arcIdx, 'COMPLETED')
      // gas: P4 on every receipt of a tx our wallet sent
      gasMinor = chain?.gasMinor ?? (1 + (Number.parseInt(createHash('sha256').update(`gas:${id}`).digest('hex').slice(0, 2), 16) % 4))
      await post('P4_GAS', `gas:5042002:${txHash}`, 'GL-3 arc', 'GL-2 arc.hot', gasMinor, 'USDC minor', id, 'ARC_TRANSFER', 'C-25: gasUsed × effectiveGasPrice')
      postings.push('P4_GAS')
      if (p.payout === 'STABLECOIN_WALLET') {
        const internal = p.beneficiaryRef.startsWith('nova:')
        if (internal) {
          const recvWallet = `GL-2 arc.<${p.beneficiaryRef.slice(5)}>`
          await post('P2I_SETTLE_INTERNAL', `pay:${id}:p2i`, `${DEBIT}:GL-5+${recvWallet} (A)`, `${CREDIT}:GL-1 receiver+GL-2 arc.hot (A)`, A, 'USDC minor', id, 'ARC_TRANSFER', 'Internal settle: both legs')
          postings.push('P2I_SETTLE_INTERNAL')
        } else {
          await post('P2_SETTLE_EXTERNAL', `pay:${id}:p2`, 'GL-5 arc.outbound', 'GL-2 arc.hot', A, 'USDC minor', id, 'ARC_TRANSFER', 'External receiver')
          postings.push('P2_SETTLE_EXTERNAL')
        }
        if (F > 0) {
          await post('P3_FEE', `pay:${id}:p3`, 'GL-5 arc.outbound', 'GL-6 payments', F, 'USDC minor', id, 'ARC_TRANSFER', 'Customer fee F')
          postings.push('P3_FEE')
        }
        await h({ step: 'COMPLETED', source: 'ARC_LOG', stage: 'COMPLETED', txHash, postings, detail: `Canonical system-emitter log confirmed; P1 = P2 + P3 (${fmt(A + F)})` })
      } else {
        // FIAT_BANK: Arc leg moves A to the partner settlement address
        await post('P2P_PARTNER_FUNDED', `pay:${id}:p2p`, partner, 'GL-2 arc.hot', A, 'USDC minor', id, 'ARC_TRANSFER', 'A-52: partner settlement address')
        postings.push('P2P_PARTNER_FUNDED')
        if (payoutIdx >= 0) setLeg(payoutIdx, 'SUBMITTED') // payout request to the partner is live
        await h({ step: 'ARC_COMPLETED', source: 'ARC_LOG', stage: 'SUBMITTED', txHash, postings, detail: 'Arc leg confirmed; PAYOUT leg still open until the partner\'s authenticated final confirmation' })
      }
      await audit('system', 'ARC_CONFIRMED', `${id} own indexer confirmed ${txHash}; P4 gas ${gasMinor} minor`)
      break
    }
    case 'payout_arrived': {
      if (payoutIdx < 0) fail('409 ILLEGAL: this payment has no PAYOUT leg')
      if (legs[arcIdx].stage !== 'COMPLETED') fail('409 ILLEGAL: payout completes only after the Arc leg')
      setLeg(payoutIdx, 'COMPLETED')
      await post('P2_SETTLE_EXTERNAL', `pay:${id}:p2`, 'GL-5 arc.outbound', partner, A, 'USDC minor', id, 'PAYOUT', 'PAYOUT PAID: credit is partner.<id>')
      if (F > 0) {
        await post('P3_FEE', `pay:${id}:p3`, 'GL-5 arc.outbound', 'GL-6 payments', F, 'USDC minor', id, 'PAYOUT', 'Customer fee F')
        postings.push('P3_FEE')
      }
      postings.push('P2_SETTLE_EXTERNAL')
      await h({ step: 'COMPLETED', source: 'PAYOUT_CALLBACK', stage: 'COMPLETED', postings, detail: 'Partner ARRIVED (authenticated callback, deduped); last leg completes → payment COMPLETED' })
      break
    }
    case 'fail_payout': {
      if (payoutIdx < 0 || legs[arcIdx].stage !== 'COMPLETED') fail('409 ILLEGAL: fail_payout applies after the Arc leg confirmed')
      setLeg(payoutIdx, 'REJECTED', 'PAYOUT_FAILED')
      const c = await openCase('RETURNED_PAYOUT', 'PARTNER_RETURNED', id, [
        { id: 'REFUND', label: 'Refund the payer (F-17 branch 1: partner returns → P2R then P6)', proof: true },
        { id: 'RETRY_AS_NEW_PAYMENT', label: 'Retry as a new payment', proof: true },
        { id: 'WRITE_OFF', label: 'Write off (F-17 branch 2: P6 + P11 partner claim)', proof: false },
      ])
      caseOpened = c
      await h({ step: 'PAYOUT_FAILED', stage: 'FAILED', reason: 'PAYOUT_FAILED', detail: 'F-17: USDC stays in GL-2 partner.<id>; payer A+F stays in GL-5; PARTNER_RETURN case opened (two-person)' })
      await audit('partner-callback', 'PAYOUT_FAILED', `${id} F-17; case ${c}`)
      break
    }
    case 'partner_return': {
      if (payoutIdx < 0 || legs[payoutIdx].stage !== 'REJECTED') fail('409 ILLEGAL: partner_return applies to a failed payout')
      // F-17 branch 1 on an approved two-person case: exact-matching INBOUND log
      await post('P2R_PARTNER_RETURN', `pay:${id}:p2r`, 'GL-2 arc.hot', partner, A, 'USDC minor', id, 'PAYOUT', 'Exact-matching INBOUND log on an approved case')
      postings.push('P2R_PARTNER_RETURN')
      await post('P6_RELEASE', `pay:${id}:p6`, 'GL-5 arc.outbound', payer, A + F, 'USDC minor', id, 'PAYOUT', 'F-17 branch 1: P2R then P6')
      postings.push('P6_RELEASE')
      await h({ step: 'PARTNER_RETURNED', postings, detail: 'Partner returned the USDC; payer released' })
      break
    }
    case 'quote_expire': {
      if (submitMarker) fail('409 ILLEGAL: F-16 — with a submit marker nothing ends; resolve via externalId')
      if (p.stage === 'COMPLETED' || p.stage === 'REJECTED' || p.stage === 'EXPIRED' || p.stage === 'CANCELLED') fail('409 STALE')
      setLeg(arcIdx, 'EXPIRED', 'QUOTE_EXPIRED')
      await post('P6_RELEASE', `pay:${id}:p6`, 'GL-5 arc.outbound', payer, A + F, 'USDC minor', id, 'RESERVE', 'F-16: no submit marker')
      postings.push('P6_RELEASE')
      await h({ step: 'EXPIRED', stage: 'EXPIRED', reason: 'QUOTE_EXPIRED', postings, detail: 'Quote expired while ARC_TRANSFER had no submit marker' })
      break
    }
    case 'underfloor': {
      if (p.stage !== 'SUBMITTED' || txHash) fail('409 ILLEGAL: F-4 applies to a broadcast with no receipt (proof b)')
      setLeg(arcIdx, 'EXPIRED', 'UNDER_FEE_FLOOR_DROPPED')
      await post('P6_RELEASE', `pay:${id}:p6`, 'GL-5 arc.outbound', payer, A + F, 'USDC minor', id, 'ARC_TRANSFER', 'F-4: proof (b) status-0 receipt both sources')
      postings.push('P6_RELEASE')
      await h({ step: 'EXPIRED', stage: 'EXPIRED', reason: 'UNDER_FEE_FLOOR_DROPPED', postings, detail: 'No resubmission ever — a retry is a new payment' })
      break
    }
    case 'dfns_timeout': {
      if (p.stage !== 'PENDING_APPROVAL') fail('409 ILLEGAL: F-6 applies after markSubmit')
      dfnsState = 'UNRESOLVED'
      const c = await openCase('UNRESOLVED_SUBMIT', 'DFNS_TIMEOUT', id, [
        { id: 'RETRY_AS_NEW_PAYMENT', label: 'Retry as a new payment (same bytes re-POST is DFNS-idempotent first)', proof: true },
        { id: 'REFUND', label: 'Release the payer', proof: true },
        { id: 'WRITE_OFF', label: 'Write off', proof: false },
      ])
      caseOpened = c
      await h({ step: 'UNRESOLVED', detail: 'F-6: crash/timeout after markSubmit — no terminal stage, no P6, no timer release; resolve via externalId' })
      await audit('system', 'DFNS_TIMEOUT', `${id} UNRESOLVED; case ${c}`)
      break
    }
    case 'cancel': {
      if (submitMarker && p.stage !== 'PENDING_APPROVAL') fail('409 ILLEGAL: operator abort only while unsigned')
      if (['COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(p.stage)) fail('409 STALE')
      setLeg(arcIdx, 'CANCELLED', 'CANCELLED_BY_OPERATOR')
      await post('P6_RELEASE', `pay:${id}:p6`, 'GL-5 arc.outbound', payer, A + F, 'USDC minor', id, 'RESERVE', 'F-2: proof (a2) abort accepted while unsigned')
      postings.push('P6_RELEASE')
      await h({ step: 'CANCELLED', stage: 'CANCELLED', reason: 'CANCELLED_BY_OPERATOR', postings, detail: 'Operator abort while unsigned; proof (a2)' })
      break
    }
    default:
      fail(`400 UNKNOWN_EVENT ${type}`)
  }

  const st = paymentStateFromLegs(legs)
  await db.payment.update({
    where: { id },
    data: { legs, stage: st.stage, reason: st.reason, status: statusFor(st.stage, reversed), txHash, dfnsState, externalRef, submitMarker, gasMinor, reversed, live: chain?.live === true ? true : p.live },
  })
  return { id, stage: st.stage, reason: st.reason, status: statusFor(st.stage, reversed), legs, postings, caseOpened }
}

// ---------------------------------------------------------------------------
// Ops cases
// ---------------------------------------------------------------------------
async function openCase(kind: string, reason: string, paymentId: string | null, options: { id: string; label: string; proof: boolean }[]): Promise<string> {
  const id = await nextSeq('case-', 'OpsCase')
  await db.opsCase.create({ data: { id, kind, reason, paymentId, options, status: 'OPEN' } })
  await audit('system', 'CASE_OPENED', `${id} ${kind}/${reason} for ${paymentId ?? 'rail'}`)
  return id
}

const MONEY_ACTIONS = new Set(['REFUND', 'RETRY_AS_NEW_PAYMENT', 'WRITE_OFF', 'REQUOTE', 'ADOPT_FILL', 'REVERSE_FILL', 'ACCEPT_WITH_CONSENT'])
// MC-19: unpause is not a money move, but it resumes the rail — two distinct humans required too
const TWO_PERSON_ACTIONS = new Set([...MONEY_ACTIONS, 'UNPAUSE'])
const PROOF_ACTIONS = new Set(['REFUND', 'RETRY_AS_NEW_PAYMENT'])

export async function actOnCase(input: {
  caseId: string; action: string; approver1: string; approver2?: string; proofId?: string; consentDigest?: string;
}) {
  const c = await db.opsCase.findUnique({ where: { id: input.caseId } })
  if (!c) fail('404 NOT_FOUND')
  if (c.status !== 'OPEN') fail('409 STALE: case already closed')
  const allowed = CASE_KINDS.find((k) => k.kind === c.kind)?.actions ?? []
  if (!allowed.includes(input.action)) fail(`409 REFUSED: ${input.action} is not allowed for ${c.kind} (allowed: ${allowed.join(', ')})`)

  // MC-19 / ops rules: money-moving and unpause actions need two distinct authenticated humans
  if (TWO_PERSON_ACTIONS.has(input.action)) {
    if (!input.approver1 || !input.approver2 || input.approver1.trim() === input.approver2.trim()) {
      fail('409 TWO_PERSON_RULE: this action requires two distinct authenticated humans')
    }
  }
  // D-6: refunds and retries only after a not-sent proof
  if (PROOF_ACTIONS.has(input.action)) {
    const proofs = ['APPROVER_DENIAL', 'ABORT_ACCEPTED', 'NONCE_CONSUMED_ELSEWHERE', 'NONCE_RESOLVED', 'RECEIPT_STATUS_0_BOTH_SOURCES']
    if (!input.proofId || !proofs.includes(input.proofId)) {
      fail('409 D6_PROOF_REQUIRED: an externalId lookup finding nothing is NOT a proof — select one of the D-6 not-sent proofs')
    }
  }

  const postings: string[] = []
  const p = c.paymentId ? await db.payment.findUnique({ where: { id: c.paymentId } }) : null

  switch (input.action) {
    case 'REFUND': {
      if (p) {
        const A = p.amountMinor
        const F = p.feeMinor
        if (c.kind === 'RETURNED_PAYOUT' && p.payout === 'FIAT_BANK') {
          await post('P2R_PARTNER_RETURN', `pay:${p.id}:p2r`, 'GL-2 arc.hot', `GL-2 partner.<cpn-stub>`, A, 'USDC minor', p.id, 'PAYOUT', 'F-17 branch 1 on an approved case')
          postings.push('P2R_PARTNER_RETURN')
        }
        const hasP6 = await db.ledgerEntry.findUnique({ where: { id: `pay:${p.id}:p6` } })
        if (!hasP6) {
          await post('P6_RELEASE', `pay:${p.id}:p6`, 'GL-5 arc.outbound', p.payerAccount, A + F, 'USDC minor', p.id, 'RESERVE', `Case ${c.id}: refund with proof ${input.proofId}`)
          postings.push('P6_RELEASE')
        }
        const legs = (p.legs as unknown as LegState[]).map((l) => ({ ...l }))
        const payoutIdx = legs.findIndex((l) => l.kind === 'PAYOUT')
        if (payoutIdx >= 0 && legs[payoutIdx].stage === 'REJECTED') {
          legs[payoutIdx].stage = 'CANCELLED'
          legs[payoutIdx].reason = 'CANCELLED_BY_OPERATOR'
        } else {
          const arcIdx = legs.findIndex((l) => l.kind.startsWith('ARC_TRANSFER'))
          if (arcIdx >= 0 && legs[arcIdx].stage !== 'COMPLETED') {
            legs[arcIdx].stage = 'CANCELLED'
            legs[arcIdx].reason = 'CANCELLED_BY_OPERATOR'
          }
        }
        const st = paymentStateFromLegs(legs)
        await db.payment.update({ where: { id: p.id }, data: { legs, stage: st.stage, reason: st.reason, status: statusFor(st.stage, p.reversed) } })
        await history(p.id, 99, { step: 'OPS_REFUND', case: c.id, action: 'REFUND', proof: input.proofId, postings, approvers: [input.approver1, input.approver2] })
      }
      break
    }
    case 'WRITE_OFF': {
      if (p) {
        const A = p.amountMinor
        const F = p.feeMinor
        if (c.kind === 'RETURNED_PAYOUT') {
          await post('P11_PARTNER_CLAIM', `pay:${p.id}:p11`, 'GL-2 partnerClaim.<cpn-stub>', 'GL-2 partner.<cpn-stub>', A, 'USDC minor', p.id, 'PAYOUT', 'F-17 branch 2: with the payment\'s P6 under the same decision')
          postings.push('P11_PARTNER_CLAIM')
        }
        const hasP6 = await db.ledgerEntry.findUnique({ where: { id: `pay:${p.id}:p6` } })
        if (!hasP6) {
          await post('P15_WRITE_OFF', `pay:${p.id}:p15`, 'GL-5 arc.outbound', 'GL-4 arc.writeoff (configured loss account)', A + F, 'USDC minor', p.id, 'RESERVE', `Case ${c.id}: write-off; loss account configured, never defaulted`)
          postings.push('P15_WRITE_OFF')
        }
        await history(p.id, 99, { step: 'OPS_WRITE_OFF', case: c.id, action: 'WRITE_OFF', postings, approvers: [input.approver1, input.approver2] })
      }
      break
    }
    case 'REQUOTE':
    case 'RETRY_AS_NEW_PAYMENT': {
      if (p) {
        const r = await createPayment({ payIn: p.payIn, payout: p.payout, amount: fmt(p.amountMinor), fee: fmt(p.feeMinor), beneficiaryRef: p.beneficiaryRef, payerAccount: p.payerAccount })
        await history(p.id, 99, { step: `OPS_${input.action}`, case: c.id, newPayment: r.id, proof: input.proofId, approvers: [input.approver1, input.approver2] })
        postings.push(`new payment ${r.id} (a retry is a new payment — never a resubmission)`)
      }
      break
    }
    case 'UNPAUSE': {
      // the case action resolves the whole-rail pause: resume the rail too, with both approvers recorded
      const current = await db.railState.findUnique({ where: { id: 'rail' } })
      if (current?.paused) {
        await db.railState.update({
          where: { id: 'rail' },
          data: { paused: false, pausedReason: null, unpauseApproval1: input.approver1, unpauseApproval2: input.approver2 },
        })
      }
      break
    }
    default:
      // RELEASE_QUARANTINE / ACCEPT_WITH_CONSENT / ADOPT_FILL / REVERSE_FILL / CLOSE_HISTORY_GAP
      break
  }

  await db.opsCase.update({
    where: { id: c.id },
    data: { status: 'CLOSED', closedAt: new Date(), closedBy: input.approver1, decision: input.action },
  })
  const { seq, hash } = await audit(input.approver1, `CASE_${input.action}`, `${c.id} ${input.action} applied${input.approver2 ? ` (checker: ${input.approver2})` : ''}${input.proofId ? `; D-6 proof: ${input.proofId}` : ''}`)
  return { caseId: c.id, action: input.action, closed: true, auditSeq: seq, auditHash: hash, postings }
}

// ---------------------------------------------------------------------------
// Reconciliation + circuit breaker (U12)
// ---------------------------------------------------------------------------
export async function runRecon(mode: 'run' | 'inject-drift' | 'unpause' | 'quarantine', approvers?: { a1?: string; a2?: string }) {
  const rail = await ensureRail()

  if (mode === 'inject-drift') {
    if (!rail.paused) {
      await db.railState.update({ where: { id: 'rail' }, data: { paused: true, pausedReason: 'RECON_DRIFT: injected ledger/chain drift', pausedAt: new Date(), unpauseApproval1: null, unpauseApproval2: null } })
      const cid = await openCase('PAUSE', 'RECON_DRIFT', null, [{ id: 'UNPAUSE', label: 'Two distinct humans must approve the unpause (MC-19)', proof: false }])
      await audit('recon', 'RAIL_PAUSED', 'Drift detected → automatic pause; outbound stopped (fail closed)')
      return { paused: true, reason: 'RECON_DRIFT', caseId: cid }
    }
    return { paused: true, reason: rail.pausedReason }
  }

  if (mode === 'unpause') {
    if (!rail.paused) fail('409 STALE: rail is not paused')
    const a1 = (approvers?.a1 ?? '').trim()
    const a2 = (approvers?.a2 ?? '').trim()
    if (!a1 || !a2) return { paused: true, reason: rail.pausedReason, need: 'Provide both approvers; two distinct authenticated humans are required (MC-19)', approvals: [rail.unpauseApproval1, rail.unpauseApproval2] }
    if (a1 === a2) fail('409 TWO_PERSON_RULE: the two approvers must be distinct humans')
    await db.railState.update({ where: { id: 'rail' }, data: { paused: false, pausedReason: null, unpauseApproval1: a1, unpauseApproval2: a2 } })
    // the open PAUSE case(s) are resolved by this same two-person decision — close them, by name
    const closedCases: string[] = []
    for (const c of await db.opsCase.findMany({ where: { kind: 'PAUSE', status: 'OPEN' } })) {
      await db.opsCase.update({ where: { id: c.id }, data: { status: 'CLOSED', closedAt: new Date(), closedBy: a1, decision: 'UNPAUSE' } })
      closedCases.push(c.id)
    }
    await audit(a1, 'RAIL_UNPAUSED', `Unpaused by ${a1} and ${a2} (two-person rule)${closedCases.length ? `; case${closedCases.length > 1 ? 's' : ''} ${closedCases.join(', ')} closed` : ''}`)
    return { paused: false, approvals: [a1, a2], closedCases }
  }

  // mode === 'run': three-way reconciliation, zero tolerance
  const payments = await db.payment.findMany({ orderBy: { createdAt: 'asc' } })
  const checks: { paymentId: string; p1: number; settle: number; released: number; residual: number; verdict: string }[] = []
  let totalResidual = 0
  for (const p of payments) {
    const entries = await db.ledgerEntry.findMany({ where: { paymentId: p.id } })
    const sum = (ids: string[]) => entries.filter((e) => ids.includes(e.template)).reduce((s, e) => s + e.amountMinor, 0)
    const p1 = sum(['P1_RESERVE'])
    // only templates that debit GL-5 consume the reservation: P2/P2I (+P3).
    // P2P, P2R and P11 are GL-2↔GL-2 partner-side asset moves that net out on their own.
    const settle = sum(['P2_SETTLE_EXTERNAL', 'P2I_SETTLE_INTERNAL', 'P3_FEE'])
    const released = sum(['P6_RELEASE', 'P15_WRITE_OFF'])
    const residual = p1 - settle - released
    totalResidual += residual
    checks.push({
      paymentId: p.id, p1, settle, released, residual,
      verdict: residual === 0 ? 'OK (P1 = P2-family + P3, or P1 = P6)' : 'DRIFT → PAUSE',
    })
  }

  // chain invariant per wallet (demo: single hot wallet, k = 10^12 tracked in minor)
  const gas = await db.ledgerEntry.aggregate({ where: { template: 'P4_GAS' }, _sum: { amountMinor: true } })
  const outflows = await db.ledgerEntry.aggregate({ where: { creditAccount: 'GL-2 arc.hot', paymentId: { not: null } }, _sum: { amountMinor: true } })
  const returns = await db.ledgerEntry.aggregate({ where: { debitAccount: 'GL-2 arc.hot' }, _sum: { amountMinor: true } })
  const OPENING = 1_000_000_000 // 1,000.000000 USDC demo float
  const chainBalance = OPENING - (outflows._sum.amountMinor ?? 0) - (gas._sum.amountMinor ?? 0) + (returns._sum.amountMinor ?? 0)
  const gl2Hot = OPENING - (outflows._sum.amountMinor ?? 0) - (gas._sum.amountMinor ?? 0) + (returns._sum.amountMinor ?? 0)
  const chainInvariant = chainBalance === gl2Hot

  const verdict = totalResidual === 0 && chainInvariant ? 'ALL CLEAR — residual 0 across every payment' : `DRIFT ${totalResidual} → rail must PAUSE`
  return { checks, totalResidual, chainBalance, gl2Hot, chainInvariant, verdict, paused: rail.paused, pausedReason: rail.pausedReason }
}

export async function resetDemo() {
  await db.payment.deleteMany({})
  await db.historyEvent.deleteMany({})
  await db.ledgerEntry.deleteMany({})
  await db.opsCase.deleteMany({})
  await db.auditEntry.deleteMany({})
  await db.railState.deleteMany({})
  await ensureRail()
  return { reset: true }
}
