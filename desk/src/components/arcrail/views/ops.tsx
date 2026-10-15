'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Chip, Mono, Panel, SectionTitle, SimpleTable, Bullets, StatusBadge } from '../bits'
import { CASE_KINDS, OP_ACTIONS, NOT_SENT_PROOFS, OPS_RULES, D1_NAME_MAP } from '@/lib/arcrail/data/ops'
import { TOUR_REFRESH } from '../tour'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CaseOption { id: string; label: string; proof: boolean }
interface CaseRow { id: string; kind: string; reason: string; paymentId: string | null; status: string; options: CaseOption[]; closedAt: string | null; closedBy: string | null; decision: string | null; createdAt: string }
interface AuditRow { id: string; seq: number; prevHash: string; hash: string; actor: string; action: string; detail: string; createdAt: string }

export function OpsView() {
  const [cases, setCases] = useState<CaseRow[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [active, setActive] = useState<CaseRow | null>(null)
  const [action, setAction] = useState<string>('')
  const [a1, setA1] = useState('khumo')
  const [a2, setA2] = useState('ops-two')
  const [proof, setProof] = useState<string>('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch('/api/cases')
    const j = await r.json()
    setCases(j.cases ?? [])
    setAudit(j.audit ?? [])
    if (!active && j.cases?.length) {
      const open = j.cases.find((c: CaseRow) => c.status === 'OPEN')
      if (open) { setActive(open); setAction(open.options[0]?.id ?? '') }
    }
  }, [active])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const h = () => { load() }
    window.addEventListener(TOUR_REFRESH, h)
    return () => window.removeEventListener(TOUR_REFRESH, h)
  }, [load])

  function selectCase(c: CaseRow) {
    setActive(c)
    setAction(c.options[0]?.id ?? '')
    setProof('')
  }

  async function apply() {
    if (!active || !action) return
    setBusy(true)
    try {
      const r = await fetch('/api/cases', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: active.id, action, approver1: a1, approver2: a2, proofId: proof || undefined }),
      })
      const j = await r.json()
      if (!r.ok) {
        toast.error(j.error)
        return
      }
      toast.success(`${action} applied — audit seq ${j.auditSeq}${j.postings?.length ? `, postings: ${j.postings.join(' · ')}` : ''}`)
      setActive(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const opt = active?.options.find((o) => o.id === action)
  const needsProof = opt?.proof

  return (
    <div>
      <SectionTitle
        id="ops"
        title="Ops console — case queue & audit"
        sub="Cases open when the rail refuses to guess: quarantines, pauses, partner failures, unresolved submits, pay-in mismatches. Options are built server-side; operators never type an amount."
        right={<Chip tone={cases.some((c) => c.status === 'OPEN') ? 'amber' : 'emerald'}>{cases.filter((c) => c.status === 'OPEN').length} open</Chip>}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <Panel title={`cases (${cases.length})`}>
            <div className="max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
              {cases.length === 0 && <div className="py-8 text-center text-xs text-muted-foreground">No cases — trigger a payout failure or a DFNS timeout in the Payments view, or inject drift in Reconciliation.</div>}
              {cases.map((c) => (
                <button key={c.id} onClick={() => selectCase(c)} disabled={c.status !== 'OPEN'}
                  className={cn('w-full rounded-lg border px-3 py-2 text-left transition-colors', active?.id === c.id ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5', c.status !== 'OPEN' && 'opacity-55')}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Mono className="text-emerald-300">{c.id}</Mono>
                      <Chip tone={c.kind === 'PAUSE' ? 'rose' : 'amber'}>{c.kind}</Chip>
                    </div>
                    <StatusBadge value={c.status} />
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Chip tone="slate">{c.reason}</Chip>
                    {c.paymentId && <Mono className="text-muted-foreground">{c.paymentId}</Mono>}
                    {c.decision && <Mono className="text-teal-400">→ {c.decision}</Mono>}
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="case kinds (13) — closed reason codes & allowed actions">
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {CASE_KINDS.map((k) => (
                <div key={k.kind} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Mono className="font-bold text-amber-300">{k.kind}</Mono>
                    <span className="text-[11px] text-muted-foreground">{k.note}</span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="mr-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">reasons</span>
                      {k.reasons.map((r) => <Chip key={r} tone="slate">{r}</Chip>)}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="mr-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">actions</span>
                      {k.actions.map((a) => <Chip key={a} tone="emerald">{a}</Chip>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="resolve a case — maker / checker" right={active && <Mono className="text-muted-foreground">{active.id}</Mono>}>
            {active ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone="amber">{active.kind}</Chip>
                  <Chip>{active.reason}</Chip>
                  {active.paymentId && <Mono className="text-muted-foreground">{active.paymentId}</Mono>}
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">server-side option (never operator-typed)</div>
                  <Select value={action} onValueChange={setAction}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {active.options.map((o) => <SelectItem key={o.id} value={o.id} className="text-xs">{o.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {opt && <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{opt.label}</p>}
                </div>
                {needsProof && (
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">D-6 not-sent proof (required for refunds & retries)</div>
                    <Select value={proof} onValueChange={setProof}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="select a proof…" /></SelectTrigger>
                      <SelectContent>
                        {NOT_SENT_PROOFS.map((p) => <SelectItem key={p.id} value={p.id} className="text-xs">{p.id}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-[10px] text-rose-300/80">An externalId lookup finding nothing is NOT a proof.</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">maker</div>
                    <Input value={a1} onChange={(e) => setA1(e.target.value)} className="h-8 font-mono text-xs" />
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">checker (must differ)</div>
                    <Input value={a2} onChange={(e) => setA2(e.target.value)} className="h-8 font-mono text-xs" />
                  </div>
                </div>
                <Button onClick={apply} disabled={busy} className="w-full bg-emerald-600 text-black hover:bg-emerald-500" size="sm">
                  Apply decision (two-person)
                </Button>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">Select an open case to resolve it.</div>
            )}
          </Panel>

          <Panel title="operator actions (10)">
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {OP_ACTIONS.map((a) => (
                <div key={a.id} className="border-b border-white/5 pb-1.5 last:border-0">
                  <div className="flex items-center gap-1.5">
                    <Chip tone="emerald">{a.id}</Chip>
                  </div>
                  <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{a.note}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="D-6 not-sent proofs">
            <div className="space-y-1.5">
              {NOT_SENT_PROOFS.map((p) => (
                <div key={p.id} className="border-b border-white/5 pb-1.5 last:border-0">
                  <Mono className="text-teal-300">{p.id}</Mono>
                  <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{p.note}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <SectionTitle id="audit" title="Audit log — append-only, hash-chained" sub="Every case opening and every action, applied or refused. seq · prevHash → hash = sha256(prev | seq | actor | action | detail)." />
      <Panel title={`audit chain (${audit.length} entries, newest first)`}>
        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {audit.length === 0 && <div className="py-6 text-center text-xs text-muted-foreground">No audit entries yet.</div>}
          {audit.map((a) => (
            <div key={a.id} className="flex items-start gap-2 border-b border-white/5 py-1.5">
              <Mono className="w-10 shrink-0 text-muted-foreground">#{a.seq}</Mono>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone={a.action.includes('PAUSED') ? 'rose' : a.action.includes('UNPAUSED') ? 'emerald' : 'teal'}>{a.action}</Chip>
                  <Mono className="text-muted-foreground">{a.actor}</Mono>
                </div>
                <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{a.detail}</div>
                <Mono className="block truncate text-[9px] text-muted-foreground/60" title={`${a.prevHash} → ${a.hash}`}>{a.prevHash.slice(0, 12)}… → {a.hash.slice(0, 12)}…</Mono>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <SectionTitle id="opsrules" title="Queue rules" />
      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="enforced by the queue">
          <Bullets items={OPS_RULES} />
        </Panel>
        <Panel title="D1 name mapping">
          <SimpleTable
            head={['Formal (delta 1)', 'D1 name']}
            rows={D1_NAME_MAP.map((m) => [<Mono key="f" className="text-amber-300">{m.formal}</Mono>, <Mono key="d" className="text-emerald-300">{m.d1}</Mono>])}
          />
        </Panel>
      </div>
    </div>
  )
}
