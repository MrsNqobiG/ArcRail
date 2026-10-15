'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Play } from 'lucide-react'
import { Chip, Mono } from './bits'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export type ViewId =
  | 'overview' | 'journey' | 'settle' | 'payments' | 'ledger' | 'recon' | 'ops'
  | 'lifecycle' | 'gates' | 'modules' | 'verification' | 'risks' | 'facts'

export const NAV: { group: string; items: { id: ViewId; label: string; hint: string }[] }[] = [
  {
    group: 'start',
    items: [
      { id: 'overview', label: 'Overview', hint: 'mission, flow, phases, rules' },
      { id: 'journey', label: 'Journey model', hint: 'pay-in × payout → legs' },
    ],
  },
  {
    group: 'live rail',
    items: [
      { id: 'settle', label: 'Testnet settle', hint: 'real Arc testnet transfer, proven on-chain' },
      { id: 'payments', label: 'Payments', hint: 'drive the stage machine' },
      { id: 'ledger', label: 'Ledger', hint: 'journal, GL, P-templates' },
      { id: 'recon', label: 'Reconciliation', hint: 'three-way + circuit breaker' },
      { id: 'ops', label: 'Ops console', hint: 'cases, actions, audit' },
    ],
  },
  {
    group: 'reference',
    items: [
      { id: 'lifecycle', label: 'Lifecycle', hint: 'stages, statuses, reasons' },
      { id: 'gates', label: 'Gates & ADRs', hint: 'G0–G3 · D1–D7 · G-P · G-M' },
      { id: 'modules', label: 'Modules', hint: '24 domains, money path' },
      { id: 'verification', label: 'Verification', hint: 'rubric, lenses, CI' },
      { id: 'risks', label: 'Risks & threats', hint: 'STRIDE, failures F-1…F-19' },
      { id: 'facts', label: 'Arc facts', hint: 'constants, DFNS, questions' },
    ],
  },
]

interface Meta { payments: number; settled: number; openCases: number; paused: boolean; pausedReason: string | null }

export function Shell({ view, setView, onStartTour, children }: { view: ViewId; setView: (v: ViewId) => void; onStartTour: () => void; children: React.ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [resetting, setResetting] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/meta')
      if (r.ok) setMeta(await r.json())
    } catch { /* server warming up */ }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [load, view])

  async function reset() {
    setResetting(true)
    try {
      const r = await fetch('/api/reset', { method: 'POST' })
      if (r.ok) { toast.success('Demo state reset — rail rebooted, audit chain empty'); await load() }
    } finally { setResetting(false) }
  }

  return (
    <div className="flex min-h-screen w-full max-w-[100vw] flex-col overflow-x-clip bg-background">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10">
              {/* rail glyph */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                <path d="M8 3v18M16 3v18" strokeLinecap="round" />
                <path d="M8 8h8M8 13h8M8 18h8" strokeLinecap="round" opacity="0.55" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold leading-tight tracking-tight">ArcRail <span className="text-emerald-400">Explorer</span></div>
              <Mono className="text-muted-foreground">Arc testnet settlement desk · chain 5042002</Mono>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Chip tone="emerald" className="hidden sm:inline-flex">testnet · no value</Chip>
            <Chip tone="rose">mainnet refused</Chip>
            {meta && (
              <Chip tone={meta.paused ? 'rose' : 'emerald'}>
                {meta.paused ? 'RAIL PAUSED' : `rail live · ${meta.payments} payments`}
              </Chip>
            )}
            {meta && meta.openCases > 0 && <Chip tone="amber">{meta.openCases} open case{meta.openCases > 1 ? 's' : ''}</Chip>}
            <Button
              size="sm"
              onClick={onStartTour}
              className="h-7 gap-1.5 bg-emerald-600 px-3 text-[11px] font-semibold text-black hover:bg-emerald-500"
            >
              <Play className="h-3 w-3" /> guided tour
            </Button>
            <Button size="sm" variant="outline" onClick={reset} disabled={resetting} className="h-7 border-white/15 text-[11px] hover:bg-white/5">
              {resetting ? 'resetting…' : 'reset demo'}
            </Button>
          </div>
        </div>
        {/* mobile nav: inside the sticky header so it never hides behind a wrapped header */}
        <div className="max-w-[100vw] border-t border-white/10 px-3 py-1.5 lg:hidden">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {NAV.flatMap((g) => g.items).map((it) => (
              <button key={it.id} onClick={() => setView(it.id)}
                className={cn('whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-medium transition-colors',
                  view === it.id ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300' : 'border-white/10 text-muted-foreground')}>
                {it.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-6 px-4 py-6">
        <nav className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20 space-y-4">
            {NAV.map((g) => (
              <div key={g.group}>
                <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{g.group}</div>
                <div className="space-y-0.5">
                  {g.items.map((it) => (
                    <button key={it.id} onClick={() => setView(it.id)}
                      className={cn('w-full rounded-lg px-2.5 py-1.5 text-left transition-colors',
                        view === it.id ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30' : 'text-foreground/75 hover:bg-white/5 hover:text-foreground')}>
                      <div className="text-xs font-medium">{it.label}</div>
                      {view === it.id && <div className="text-[10px] leading-tight text-muted-foreground">{it.hint}</div>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <footer className="mt-auto border-t border-white/10 bg-background/85">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
          <Mono className="text-muted-foreground">Testnet settle signs real Arc testnet transfers in your browser. The payments desk rehearses until a receipt is attached.</Mono>
          <Mono className="text-muted-foreground/80">Not a financial service · testnet USDC has no value · not legal advice</Mono>
          <Mono className="ml-auto text-muted-foreground/60">mainnet stays off</Mono>
        </div>
      </footer>
    </div>
  )
}
