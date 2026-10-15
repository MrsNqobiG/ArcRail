'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Chip, Mono, Panel, SectionTitle, SimpleTable, Bullets } from '../bits'
import { TOUR_REFRESH } from '../tour'
import { toast } from 'sonner'

interface CheckRow { paymentId: string; p1: number; settle: number; released: number; residual: number; verdict: string }
interface ReconState {
  checks: CheckRow[]; totalResidual: number; chainBalance: number; gl2Hot: number
  chainInvariant: boolean; verdict: string; paused: boolean; pausedReason: string | null
  need?: string; caseId?: string
}

export function ReconView({ onGoToCases }: { onGoToCases: () => void }) {
  const [state, setState] = useState<ReconState | null>(null)
  const [a1, setA1] = useState('khumo')
  const [a2, setA2] = useState('ops-two')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch('/api/recon')
    setState(await r.json())
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const h = () => { load() }
    window.addEventListener(TOUR_REFRESH, h)
    return () => window.removeEventListener(TOUR_REFRESH, h)
  }, [load])

  async function run(mode: string) {
    setBusy(true)
    try {
      const r = await fetch('/api/recon', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, approver1: a1, approver2: a2 }),
      })
      const j = await r.json()
      if (!r.ok) {
        toast.error(j.error)
        return
      }
      if (mode === 'inject-drift') {
        toast.warning(`Drift injected → rail PAUSED. Case ${j.caseId} opened. Outbound is stopped (fail closed).`)
        await load()
        return
      }
      if (mode === 'unpause') {
        if (j.need) { toast.error(j.need); return }
        toast.success(`Rail unpaused by ${j.approvals.join(' + ')} (two-person rule)`)
        await load()
        return
      }
      toast[j.totalResidual === 0 ? 'success' : 'warning'](j.verdict)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const paused = state?.paused ?? false

  return (
    <div>
      <SectionTitle
        id="recon"
        title="Three-way reconciliation & circuit breaker (U12)"
        sub="Chain ↔ adapter ↔ CBS at a fixed cadence and on demand. Zero tolerance: any drift → automatic PAUSE; the manual unpause requires two distinct humans (MC-19)."
        right={<Chip tone={paused ? 'rose' : 'emerald'}>{paused ? (state?.pausedReason ?? 'PAUSED') : 'ALL CLEAR'}</Chip>}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Panel title="reconciliation checks — P1 = P2-family + P3, or P1 = P6" right={<Button size="sm" variant="outline" onClick={() => run('run')} disabled={busy} className="h-7 text-[11px]">run now</Button>}>
          <div className="max-h-[420px] overflow-y-auto pr-1">
            <table className="w-full min-w-[520px] border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-2 py-1.5 font-semibold text-muted-foreground">payment</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-muted-foreground">P1 (A+F)</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-muted-foreground">settled</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-muted-foreground">released</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-muted-foreground">residual</th>
                  <th className="px-2 py-1.5 font-semibold text-muted-foreground">verdict</th>
                </tr>
              </thead>
              <tbody>
                {(state?.checks ?? []).map((c) => (
                  <tr key={c.paymentId} className="border-b border-white/5">
                    <td className="px-2 py-1.5 font-mono text-emerald-400/80">{c.paymentId}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{c.p1}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{c.settle}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{c.released}</td>
                    <td className={`px-2 py-1.5 text-right font-mono font-bold ${c.residual === 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{c.residual}</td>
                    <td className="px-2 py-1.5"><Chip tone={c.residual === 0 ? 'emerald' : 'rose'}>{c.verdict}</Chip></td>
                  </tr>
                ))}
                {(state?.checks ?? []).length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">No payments to reconcile yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {state && (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                <Mono className="text-muted-foreground">total residual</Mono>
                <div className={`font-mono text-lg font-bold ${state.totalResidual === 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{state.totalResidual}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                <Mono className="text-muted-foreground">chain = GL-2 arc.hot</Mono>
                <div className={`font-mono text-lg font-bold ${state.chainInvariant ? 'text-emerald-300' : 'text-rose-300'}`}>{state.chainInvariant ? 'match' : 'drift'}</div>
                <Mono className="text-muted-foreground">{state.chainBalance} = {state.gl2Hot} (demo minor)</Mono>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                <Mono className="text-muted-foreground">verdict</Mono>
                <div className={`text-xs font-bold ${state.totalResidual === 0 && state.chainInvariant ? 'text-emerald-300' : 'text-rose-300'}`}>{state.verdict.split('—')[0]}</div>
              </div>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="circuit breaker" right={<Chip tone={paused ? 'rose' : 'emerald'}>{paused ? 'PAUSED' : 'closed'}</Chip>}>
            <div className="space-y-3">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Drift, RPC disagreement, indexer stall or a monitor that is not ALL_CLEAR opens the breaker.
                While paused, the payment engine refuses new payments and outbound events (fail closed) — try creating one.
              </p>
              <Button variant="destructive" size="sm" className="w-full" onClick={() => run('inject-drift')} disabled={busy || paused}>
                Inject drift → automatic PAUSE
              </Button>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">manual unpause — two distinct humans (MC-19)</div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={a1} onChange={(e) => setA1(e.target.value)} className="h-8 font-mono text-xs" placeholder="approver 1" />
                  <Input value={a2} onChange={(e) => setA2(e.target.value)} className="h-8 font-mono text-xs" placeholder="approver 2" />
                </div>
                <Button size="sm" variant="outline" className="mt-2 w-full border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10" onClick={() => run('unpause')} disabled={busy || !paused}>
                  Unpause the rail
                </Button>
                <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">The same person twice is refused; the audit log records both names.</p>
              </div>
              {paused && (
                <button onClick={onGoToCases} className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-xs hover:bg-amber-500/15">
                  A PAUSE case is open — resolve it in the Ops console →
                </button>
              )}
            </div>
          </Panel>

          <Panel title="what reconciliation checks">
            <Bullets items={[
              'P1 = P2 + P3 or P1 = P6 for every payment, including every F1–F7 failure cell (MC-05: drift cells must assert non-zero + PAUSE)',
              'Per-wallet chain invariant: on-chain wei(w) = GL-2 arc.<w> × k − GL-4 gasDust(w) + GL-2 subminor(w)',
              'Expense identity (GL-3) and unidentified-receipt identity (GL-4)',
              'Reconciliation drift of exactly 0 base units across chain ↔ adapter ↔ CBS in every test scenario',
            ]} />
          </Panel>
        </div>
      </div>

      <SectionTitle id="pausepath" title="Fail-closed responses" sub="The circuit breaker is the last line: money stops and a human is paged before anything else moves." />
      <SimpleTable
        head={['Trigger', 'Response']}
        rows={[
          [<Chip key="1" tone="rose">PAUSE — whole rail</Chip>, <span key="a" className="text-muted-foreground">RPC disagreement (F-7) · chain stall (F-8) · recon drift · indexer stall · monitor not ALL_CLEAR. Freeze the cursor; two-person resolution.</span>],
          [<Chip key="2" tone="amber">QUARANTINE — one item</Chip>, <span key="b" className="text-muted-foreground">ILLEGAL transition · invariant failed · unknown event · authenticity failed · hash-less Failed (F-3b) · stuck confirming (F-5) · replacement (F-18). The rail keeps moving.</span>],
          [<Chip key="3" tone="emerald">Ops case — no stop</Chip>, <span key="c" className="text-muted-foreground">Unsolicited inbound (F-19) → P9 to suspense · under/overpayment · late pay-in · partner failures (F-17) → PARTNER_RETURN.</span>],
        ]}
      />
    </div>
  )
}
