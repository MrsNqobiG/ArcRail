'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chip, Mono, Panel, SectionTitle, SimpleTable, Bullets } from '../bits'
import { GL_ACCOUNTS, POSTING_TEMPLATES, LEDGER_KEYS, RECON_HOOKS } from '@/lib/arcrail/data/core'
import { TOUR_REFRESH } from '../tour'

interface Entry { id: string; template: string; paymentId: string | null; debitAccount: string; creditAccount: string; amountText: string; memo: string; createdAt: string }
interface Balance { account: string; minor: number; text: string }

export function LedgerView() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [conservation, setConservation] = useState<{ balanced: boolean; totalDr: number; totalCr: number } | null>(null)
  const [filter, setFilter] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    fetch('/api/journal')
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return
        setEntries(j.entries ?? [])
        setBalances(j.balances ?? [])
        setConservation(j.conservation ?? null)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [tick])

  useEffect(() => {
    const h = () => setTick((t) => t + 1)
    window.addEventListener(TOUR_REFRESH, h)
    return () => window.removeEventListener(TOUR_REFRESH, h)
  }, [])

  const shown = filter ? entries.filter((e) => `${e.id} ${e.template} ${e.debitAccount} ${e.creditAccount}`.toLowerCase().includes(filter.toLowerCase())) : entries
  const pTemplates = POSTING_TEMPLATES.filter((t) => t.family === 'P')

  return (
    <div>
      <SectionTitle
        id="ledger"
        title="The double-entry ledger"
        sub="Every business event is balanced postings with deterministic keys — exactly once by construction. The journal below is live: entries appear as you drive payments in the Payments view."
        right={conservation && <Chip tone={conservation.balanced ? 'emerald' : 'rose'}>{conservation.balanced ? 'Σ DR = Σ CR — conservation holds' : 'IMBALANCE'}</Chip>}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Panel title={`journal (${shown.length} entries)`} right={
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="filter…"
            className="h-6 w-32 rounded border border-white/10 bg-black/30 px-2 font-mono text-[10px] outline-none focus:border-emerald-500/50" />
        }>
          <div className="max-h-[480px] overflow-y-auto pr-1">
            <table className="w-full border-collapse text-left text-[11px]">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-white/10">
                  <th className="px-2 py-1.5 font-semibold text-muted-foreground">key</th>
                  <th className="px-2 py-1.5 font-semibold text-muted-foreground">template</th>
                  <th className="px-2 py-1.5 font-semibold text-muted-foreground">DR</th>
                  <th className="px-2 py-1.5 font-semibold text-muted-foreground">CR</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-muted-foreground">amount</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => (
                  <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-2 py-1.5 font-mono text-[10px] text-emerald-400/80" title={e.id + (e.memo ? ` · ${e.memo}` : '')}>{e.id}</td>
                    <td className="px-2 py-1.5"><Chip tone="teal">{e.template}</Chip></td>
                    <td className="px-2 py-1.5 font-mono text-[10px]">{e.debitAccount}</td>
                    <td className="px-2 py-1.5 font-mono text-[10px]">{e.creditAccount}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-emerald-300">{e.amountText}</td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr><td colSpan={5} className="py-10 text-center text-xs text-muted-foreground">No entries yet — create and confirm a payment.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="account balances (live)" right={<Button size="sm" variant="ghost" onClick={() => setTick((t) => t + 1)} className="h-6 text-[10px]">refresh</Button>}>
          <div className="max-h-[480px] space-y-1 overflow-y-auto pr-1">
            {balances.map((b) => {
              const isGl = b.account.startsWith('GL-')
              const tone = !isGl ? 'text-amber-300' : b.minor === 0 ? 'text-muted-foreground' : b.minor > 0 ? 'text-emerald-300' : 'text-rose-300'
              return (
                <div key={b.account} className="flex items-center justify-between gap-2 border-b border-white/5 py-1.5">
                  <Mono className={cn2('text-[10px]', !isGl && 'text-amber-400/90')}>{b.account}</Mono>
                  <Mono className={tone}>{b.text}</Mono>
                </div>
              )
            })}
            {balances.length === 0 && <div className="py-10 text-center text-xs text-muted-foreground">No balances yet.</div>}
          </div>
          {conservation && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2.5">
              <Mono className="text-muted-foreground">Σ entries DR {conservation.totalDr / 1e6} = CR {conservation.totalCr / 1e6} USDC</Mono>
              <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">Per payment: P1 = P2-family + P3, or P1 = P6. On-chain delta matches to the base unit.</div>
            </div>
          )}
        </Panel>
      </div>

      <SectionTitle id="gl" title="GL accounts — GL-1…GL-7" sub="Named roles, never G1… (to avoid clashing with gate names). GL-2 has one sub-account per holding location; 18-dp dust lives in sub-ledgers." />
      <div className="grid gap-3 md:grid-cols-2">
        {GL_ACCOUNTS.map((g) => (
          <div key={g.role} className="rounded-xl border border-white/10 bg-card/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Chip tone="emerald">{g.role}</Chip>
                <div className="text-sm font-semibold">{g.name}</div>
              </div>
              <Chip>{g.side}-normal</Chip>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{g.note}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {g.subAccounts.map((s) => <Mono key={s} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">{s}</Mono>)}
            </div>
          </div>
        ))}
      </div>

      <SectionTitle id="templates" title="Posting templates P1–P15" sub="A = amount to receiver, F = fee, G = gas, (g,d) = the 18-dp split, k = 10^(18−p). Dust is never silently dropped; gas paid in USDC is posted too." />
      <SimpleTable
        head={['ID', 'Fires when', 'Debit', 'Credit', 'Amount']}
        rows={pTemplates.map((t) => [
          <Chip key="id" tone="teal">{t.id}</Chip>,
          <span key="f" className="text-muted-foreground">{t.fires}</span>,
          <Mono key="d" className="text-emerald-300/90">{t.debit}</Mono>,
          <Mono key="c" className="text-rose-300/90">{t.credit}</Mono>,
          <Mono key="a" className="text-foreground">{t.amount}</Mono>,
        ])}
      />

      <SectionTitle id="keys" title="Deterministic keys & reconciliation hooks" sub="Exactly once by key construction; reconciliation is zero-tolerance — any drift pauses the rail." />
      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="keys (§10.2)">
          <div className="space-y-2">
            {LEDGER_KEYS.map((k) => (
              <div key={k.pattern} className="border-b border-white/5 pb-2 last:border-0">
                <Mono className="text-emerald-300/90">{k.pattern}</Mono>
                <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{k.note}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="reconciliation hooks (§9.3)">
          <Bullets items={RECON_HOOKS} />
          <div className="mt-3 rounded-lg border border-teal-500/25 bg-teal-500/5 p-3">
            <div className="text-xs font-semibold text-teal-300">Per-wallet chain invariant</div>
            <Mono className="mt-1 block text-[10px] leading-relaxed text-muted-foreground">on-chain wei(w) = GL-2 arc.&lt;w&gt; × k − GL-4 gasDust(w) + GL-2 subminor(w)</Mono>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function cn2(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(' ')
}
