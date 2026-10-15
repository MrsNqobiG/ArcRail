'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Chip, Mono, Panel, SectionTitle, StatusBadge } from '../bits'
import { PAY_IN_METHODS, PAYOUT_METHODS, JOURNEY_MATRIX } from '@/lib/arcrail/data/core'
import { API_SURFACE, API_RULE } from '@/lib/arcrail/data/facts'
import { TOUR_REFRESH } from '../tour'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface PaymentRow {
  id: string; payIn: string; payout: string; amountText: string; fee: number
  status: string; stage: string; reason: string | null; dfnsState: string
  txHash: string | null; beneficiaryRef: string; createdAt: string
}

interface Leg { kind: string; seq: number; stage: string; status: string; reason: string | null }
interface Posting { id: string; template: string; debitAccount: string; creditAccount: string; amountText: string; memo: string }
interface HistEvent { eventId: string; body: Record<string, unknown>; createdAt: string }

interface PaymentDetail extends PaymentRow {
  amount: number; feeText: string; legs: Leg[]; postings: Posting[]
  history: HistEvent[]; cases: { id: string; kind: string; status: string }[]
  submitMarker: boolean; externalRef: string | null; explorerUrl: string | null; payerAccount: string
}

const EVENTS: { type: string; label: string; hint: string; tone: string }[] = [
  { type: 'submit', label: 'Submit to DFNS', hint: 'Set the submit marker, then one POST. Policy POL-1 approval starts.', tone: 'emerald' },
  { type: 'approve', label: 'Approval resolved ✓', hint: 'FIDO2 user-action approval; externalId becomes known', tone: 'emerald' },
  { type: 'deny', label: 'Approval denied ✗', hint: 'F-1 → REJECTED / APPROVAL_DENIED + P6 (proof a1)', tone: 'rose' },
  { type: 'approval_expire', label: 'Approval expires', hint: 'F-2 → EXPIRED / APPROVAL_EXPIRED + P6', tone: 'rose' },
  { type: 'broadcast', label: 'Rehearsal broadcast', hint: 'Local hash only — not submitted to any chain.', tone: 'amber' },
  { type: 'onchain', label: 'On chain (included)', hint: 'Block included → CONFIRMING; we still wait for our own indexer', tone: 'emerald' },
  { type: 'confirm', label: 'Confirm (own log)', hint: 'Canonical system-emitter log → COMPLETED; P2/P2I/P2P + P3 + P4 gas post', tone: 'emerald' },
  { type: 'payout_arrived', label: 'Partner ARRIVED', hint: 'FIAT_BANK only: authenticated final confirmation; P2 + P3 post', tone: 'emerald' },
  { type: 'fail_payout', label: 'Payout fails', hint: 'F-17 → PAYOUT_FAILED; USDC stays at the partner; a two-person case opens', tone: 'rose' },
  { type: 'partner_return', label: 'Partner returns', hint: 'F-17 branch 1: P2R then P6', tone: 'teal' },
  { type: 'quote_expire', label: 'Quote expires', hint: 'F-16 → EXPIRED / QUOTE_EXPIRED (only without a submit marker)', tone: 'rose' },
  { type: 'underfloor', label: 'Under-fee-floor drop', hint: 'F-4 → EXPIRED / UNDER_FEE_FLOOR_DROPPED after proof (b)', tone: 'rose' },
  { type: 'dfns_timeout', label: 'DFNS timeout', hint: 'F-6 → UNRESOLVED; a case opens; nothing can end the leg until externalId resolves', tone: 'rose' },
  { type: 'cancel', label: 'Operator cancel', hint: 'Only while unsigned → CANCELLED / CANCELLED_BY_OPERATOR + P6', tone: 'amber' },
]

export function PaymentsView({ onGoToCases }: { onGoToCases: () => void }) {
  const [list, setList] = useState<PaymentRow[]>([])
  const [paused, setPaused] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<PaymentDetail | null>(null)
  const [busy, setBusy] = useState(false)

  // form state
  const [payIn, setPayInF] = useState('STABLECOIN_BALANCE')
  const [payout, setPayoutF] = useState('STABLECOIN_WALLET')
  const [amount, setAmount] = useState('2.50')
  const [fee, setFee] = useState('0.25')
  const [beneficiary, setBeneficiary] = useState('nova:cust-042')

  const loadList = useCallback(async () => {
    const r = await fetch('/api/payments')
    const j = await r.json()
    setList(j.payments ?? [])
    setPaused(j.paused ?? false)
    if (!selected && j.payments?.length) setSelected(j.payments[0].id)
  }, [selected])

  const loadDetail = useCallback(async (id: string) => {
    const r = await fetch(`/api/payments/${id}`)
    if (r.ok) setDetail(await r.json())
  }, [])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { if (selected) loadDetail(selected) }, [selected, loadDetail])
  useEffect(() => {
    const h = (e: Event) => {
      const select = (e as CustomEvent<{ select?: string }>).detail?.select
      if (select) { setSelected(select); loadDetail(select) }
      loadList()
    }
    window.addEventListener(TOUR_REFRESH, h)
    return () => window.removeEventListener(TOUR_REFRESH, h)
  }, [loadList, loadDetail])

  async function create() {
    setBusy(true)
    try {
      const key = `demo-${Date.now()}`
      const r = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ payIn, payout, amount, fee, beneficiaryRef: beneficiary }),
      })
      const j = await r.json()
      if (!r.ok) {
        toast.error(j.error ?? 'Failed')
        return
      }
      toast.success(`${j.id} created — P1 reserved${j.note ? ` (${j.note})` : ''}`)
      setSelected(j.id)
      await loadList()
      await loadDetail(j.id)
    } finally {
      setBusy(false)
    }
  }

  async function fire(type: string) {
    if (!selected) return
    setBusy(true)
    try {
      const r = await fetch(`/api/payments/${selected}/events`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }),
      })
      const j = await r.json()
      if (!r.ok) {
        toast.error(j.error)
        return
      }
      const p = j.postings?.length ? ` · posted: ${j.postings.join(', ')}` : ''
      const c = j.caseOpened ? ` · case ${j.caseOpened} opened` : ''
      toast.success(`${type} applied → ${j.stage}${j.reason ? ` / ${j.reason}` : ''}${p}${c}`)
      await loadList()
      await loadDetail(selected)
    } finally {
      setBusy(false)
    }
  }

  const combo = JOURNEY_MATRIX.find((c) => c.payIn === payIn && c.payout === payout)!

  return (
    <div>
      <SectionTitle
        id="payments"
        title="Live payment engine"
        sub="The server walks payments through the real stage machine: deterministic posting keys, submit-marker-before-POST, history dedupe and ops cases — the D1 flow, simulated with integer minor units."
        right={<Chip tone={paused ? 'rose' : 'emerald'}>{paused ? 'RAIL PAUSED — fail closed' : 'rail operational'}</Chip>}
      />

      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Panel title="POST /payments" right={<Chip>Idempotency-Key</Chip>}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">pay-in</div>
                  <Select value={payIn} onValueChange={setPayInF}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAY_IN_METHODS.map((m) => <SelectItem key={m.id} value={m.id} className="text-xs">{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">payout (server-side)</div>
                  <Select value={payout} onValueChange={setPayoutF}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYOUT_METHODS.map((m) => <SelectItem key={m.id} value={m.id} className="text-xs">{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">amount (decimal string)</div>
                  <Input value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 font-mono text-xs" />
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">fee</div>
                  <Input value={fee} onChange={(e) => setFee(e.target.value)} className="h-8 font-mono text-xs" />
                </div>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">beneficiaryRef</div>
                <Input value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} className="h-8 font-mono text-xs" />
                <div className="mt-1 text-[10px] text-muted-foreground">prefix nova: = internal Nova customer (P2I); anything else = external receiver (P2)</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {combo.legs.map((l, i) => (
                  <Chip key={i} tone={l.includes('CONVERT') ? 'violet' : l.includes('PAYOUT') ? 'violet' : l.includes('AWAIT') ? 'amber' : 'emerald'}>{l}</Chip>
                ))}
              </div>
              <Button onClick={create} disabled={busy} className="w-full bg-emerald-600 text-black hover:bg-emerald-500" size="sm">
                Create payment (201)
              </Button>
              <p className="text-[10px] leading-relaxed text-muted-foreground">{API_RULE}</p>
            </div>
          </Panel>

          <Panel title={`payments (${list.length})`}>
            <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
              {list.length === 0 && <div className="px-2 py-6 text-center text-xs text-muted-foreground">No payments yet — create one above.</div>}
              {list.map((p) => (
                <button key={p.id} onClick={() => setSelected(p.id)}
                  className={cn('w-full rounded-lg border px-2.5 py-2 text-left transition-colors', selected === p.id ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5')}>
                  <div className="flex items-center justify-between gap-2">
                    <Mono className="text-emerald-300">{p.id}</Mono>
                    <StatusBadge value={p.status} />
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <Mono className="text-muted-foreground">{p.amountText} USDC · {p.beneficiaryRef}</Mono>
                    <Mono className="text-muted-foreground">{p.stage}</Mono>
                  </div>
                  {p.reason && <Mono className="mt-0.5 block text-rose-400">{p.reason}</Mono>}
                </button>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          {detail ? (
            <>
              <Panel title={`${detail.id} — GET /payments/:id`} right={<StatusBadge value={detail.status} />}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Mono className="text-muted-foreground">stage / reason</Mono>
                    <div className="flex items-center gap-1.5"><StatusBadge value={detail.stage} /> {detail.reason && <Chip tone="rose">{detail.reason}</Chip>}</div>
                    <Mono className="text-muted-foreground">dfnsState: <span className="text-foreground">{detail.dfnsState}</span> · marker: {String(detail.submitMarker)}</Mono>
                  </div>
                  <div className="space-y-1">
                    <Mono className="text-muted-foreground">amount / fee</Mono>
                    <div className="font-mono text-sm">{detail.amountText} / {detail.feeText} USDC</div>
                    <Mono className="text-muted-foreground">payer: {detail.payerAccount}</Mono>
                  </div>
                  <div className="space-y-1">
                    <Mono className="text-muted-foreground">journey</Mono>
                    <div className="flex flex-wrap gap-1">
                      <Chip>{detail.payIn}</Chip><span className="text-muted-foreground">→</span><Chip>{detail.payout}</Chip>
                    </div>
                    {detail.txHash && (
                      detail.explorerUrl ? (
                        <a href={detail.explorerUrl} target="_blank" rel="noreferrer" className="block truncate font-mono text-[11px] text-emerald-400">on chain {detail.txHash}</a>
                      ) : (
                        <Mono className="block truncate text-amber-300/90" title={detail.txHash}>rehearsal tx {detail.txHash.slice(0, 18)}… not on chain</Mono>
                      )
                    )}
                  </div>
                </div>
              </Panel>

              <Panel title="legs — paymentState = first failed leg, else first non-COMPLETED">
                <div className="space-y-1.5">
                  {detail.legs.map((l, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                      <Mono className="w-40 shrink-0 font-bold text-emerald-300">{l.kind}</Mono>
                      <div className="flex items-center gap-1.5"><StatusBadge value={l.stage} /> {l.reason && <Chip tone="rose">{l.reason}</Chip>}</div>
                      <div className="ml-auto text-[10px] text-muted-foreground">{l.status}</div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="signal sources — rehearsal machine">
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {EVENTS.map((e) => (
                    <button key={e.type} onClick={() => fire(e.type)} disabled={busy}
                      className={cn('group rounded-lg border p-2.5 text-left transition-colors disabled:opacity-50',
                        e.tone === 'emerald' ? 'border-emerald-500/25 hover:bg-emerald-500/10' :
                        e.tone === 'rose' ? 'border-rose-500/25 hover:bg-rose-500/10' :
                        e.tone === 'teal' ? 'border-teal-500/25 hover:bg-teal-500/10' :
                        'border-amber-500/25 hover:bg-amber-500/10')}>
                      <div className="text-xs font-semibold">{e.label}</div>
                      <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{e.hint}</div>
                    </button>
                  ))}
                </div>
                {detail.cases?.length > 0 && (
                  <button onClick={onGoToCases} className="mt-3 flex w-full items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left hover:bg-amber-500/15">
                    <Chip tone="amber">{detail.cases.filter((c) => c.status === 'OPEN').length} open case(s)</Chip>
                    <span className="text-xs text-muted-foreground">This payment has ops cases — resolve them in the Ops console →</span>
                  </button>
                )}
              </Panel>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title={`journal postings (${detail.postings.length})`}>
                  <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                    {detail.postings.map((p) => (
                      <div key={p.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <Chip tone="teal">{p.template}</Chip>
                          <Mono className="text-emerald-300">{p.amountText}</Mono>
                        </div>
                        <div className="mt-1 font-mono text-[10px] leading-relaxed text-muted-foreground">
                          DR {p.debitAccount}<br />CR {p.creditAccount}
                        </div>
                        <Mono className="mt-0.5 block text-[9px] text-muted-foreground/70">key: {p.id} {p.memo ? `· ${p.memo}` : ''}</Mono>
                      </div>
                    ))}
                    {detail.postings.length === 0 && <div className="py-6 text-center text-xs text-muted-foreground">No postings yet.</div>}
                  </div>
                </Panel>
                <Panel title={`client history (${detail.history.length}) — hist:<paymentId>:<eventId>`}>
                  <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                    {detail.history.map((h) => {
                      const b = h.body as { step?: string; stage?: string; reason?: string; detail?: string; postings?: string[] }
                      return (
                        <div key={h.eventId} className="border-l-2 border-emerald-500/40 pl-2.5">
                          <div className="flex items-center gap-1.5">
                            <Chip tone="slate">{b.step ?? h.eventId}</Chip>
                            {b.stage && <StatusBadge value={b.stage} />}
                            {b.reason && <Chip tone="rose">{b.reason}</Chip>}
                          </div>
                          <Mono className="mt-0.5 block text-[9px] text-muted-foreground">{h.eventId}</Mono>
                          {b.detail && <div className="text-[10px] leading-snug text-muted-foreground">{b.detail}</div>}
                          {b.postings && <Mono className="text-[9px] text-teal-400">posted: {b.postings.join(' · ')}</Mono>}                        </div>
                      )
                    })}
                    {detail.history.length === 0 && <div className="py-6 text-center text-xs text-muted-foreground">No history yet.</div>}
                  </div>
                </Panel>
              </div>
            </>
          ) : (
            <Panel><div className="py-16 text-center text-sm text-muted-foreground">Create a payment to start the journey engine.</div></Panel>
          )}
        </div>
      </div>

      <SectionTitle id="api" title="HTTP API surface (src/http)" sub="Framework-agnostic handlers; decimal strings at the edge, integer base units inside." />
      <div className="grid gap-3 lg:grid-cols-2">
        {API_SURFACE.map((a) => (
          <Panel key={a.path} title={<span className="font-mono">{a.method} {a.path}</span>}>
            <div className="space-y-2 text-[11px] leading-relaxed">
              <div><span className="font-semibold text-emerald-300">auth:</span> <span className="text-muted-foreground">{a.auth}</span></div>
              <div><span className="font-semibold text-emerald-300">body:</span> <span className="text-muted-foreground">{a.body}</span></div>
              <div><span className="font-semibold text-emerald-300">codes:</span> <Mono className="text-muted-foreground">{a.codes}</Mono></div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  )
}
