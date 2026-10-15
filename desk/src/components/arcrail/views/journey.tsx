'use client'

import { useState } from 'react'
import { Chip, Mono, Panel, SectionTitle, Bullets } from '../bits'
import { PAY_IN_METHODS, PAYOUT_METHODS, JOURNEY_MATRIX, JOURNEY_FLAGS, JOURNEY_RULES } from '@/lib/arcrail/data/core'
import { cn } from '@/lib/utils'

const LEG_COLORS: Record<string, string> = {
  AWAIT_DEPOSIT: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  RESERVE: 'border-teal-500/40 bg-teal-500/10 text-teal-200',
  CONVERT_IN: 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200',
  ARC_TRANSFER: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  PAYOUT: 'border-violet-500/40 bg-violet-500/10 text-violet-200',
}

const LEG_NOTES: Record<string, string> = {
  AWAIT_DEPOSIT: 'Wait for the payer\'s USDC to land on a per-merchant address (ADR-006), detected per-transfer by our indexer; the balance poller is only a cross-check',
  RESERVE: 'P1 journal entry moves A + F from the customer liability account into clearing — before anything is sent',
  'RESERVE (fiat)': 'Reserve the fiat side (ZAR) into clearing before conversion',
  CONVERT_IN: 'Fiat → USDC through the ConversionPort (Nova FX/OTC engine); every quote leg is a separate balanced posting; exact integer quote with remainder bound',
  ARC_TRANSFER: 'DFNS transfer to the receiver\'s address (or the partner settlement address [A-52]); approval, sign, broadcast, then confirmation only from our own system-emitter log',
  PAYOUT: 'Partner pays fiat to the bank account; completes only on the partner\'s authenticated final confirmation (ARRIVED); F-17 covers partner failure',
}

export function JourneyView() {
  const [payIn, setPayIn] = useState('STABLECOIN_BALANCE')
  const [payout, setPayout] = useState('STABLECOIN_WALLET')
  const combo = JOURNEY_MATRIX.find((c) => c.payIn === payIn && c.payout === payout)!
  const isD1 = payIn === 'STABLECOIN_BALANCE' && payout === 'STABLECOIN_WALLET'

  return (
    <div>
      <SectionTitle
        id="journey"
        title="The journey model"
        sub="A payment is a journey of legs, driven by two independent choices (operator's binding correction). The payer's request carries only the pay-in choice; the payout method is read server-side via ReceiverPort.resolvePayout."
      />

      <Panel title="pick a combination — the legs follow" right={<Chip tone={isD1 ? 'emerald' : 'amber'}>{isD1 ? 'D1 live' : `target: ${combo.liveIn}`}</Chip>}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">payer pay-in choice</div>
            <div className="space-y-1.5">
              {PAY_IN_METHODS.map((m) => (
                <button key={m.id} onClick={() => setPayIn(m.id)}
                  className={cn('w-full rounded-lg border px-3 py-2 text-left transition-colors', payIn === m.id ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{m.label}</span>
                    <Chip tone={m.id === 'STABLECOIN_BALANCE' ? 'emerald' : 'slate'}>{m.liveIn}</Chip>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{m.note}</div>
                  {m.id !== 'STABLECOIN_BALANCE' && <Mono className="mt-1 block text-[10px] text-amber-400/80">{m.flag}</Mono>}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">receiver payout choice (server-side)</div>
            <div className="space-y-1.5">
              {PAYOUT_METHODS.map((m) => (
                <button key={m.id} onClick={() => setPayout(m.id)}
                  className={cn('w-full rounded-lg border px-3 py-2 text-left transition-colors', payout === m.id ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{m.label}</span>
                    <Chip tone={m.id === 'STABLECOIN_WALLET' ? 'emerald' : 'slate'}>{m.liveIn}</Chip>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{m.note}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-300">PAYOUT_NOT_PAYER_CHOICE</div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                A create request containing a payout method is refused with HTTP 400 and nothing is reserved.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">legs, in order</div>
            <Mono className="text-muted-foreground">journeyLegs(payIn, payout)</Mono>
          </div>
          <div className="flex flex-wrap items-stretch gap-2">
            {combo.legs.map((leg, i) => (
              <div key={i} className="flex items-stretch gap-2">
                <div className={cn('min-w-[130px] rounded-lg border p-3', LEG_COLORS[leg] ?? 'border-white/15 bg-white/5')}>
                  <div className="font-mono text-xs font-bold">{leg}</div>
                  <div className="mt-1 text-[10px] leading-snug opacity-80">{LEG_NOTES[leg]}</div>
                </div>
                {i < combo.legs.length - 1 && <div className="flex items-center text-muted-foreground">→</div>}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            A payment is <strong className="text-emerald-300">COMPLETED</strong> only when its <em>last</em> leg completes — indexer confirmation for STABLECOIN_WALLET, the partner&apos;s authenticated ARRIVED for FIAT_BANK.
          </p>
        </div>
      </Panel>

      <SectionTitle id="matrix" title="Full combinations matrix" sub="All six pay-in × payout combinations with the milestone where each goes live." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {JOURNEY_MATRIX.map((c, i) => {
          const active = c.payIn === payIn && c.payout === payout
          return (
            <button key={i} onClick={() => { setPayIn(c.payIn); setPayout(c.payout) }}
              className={cn('rounded-xl border p-4 text-left transition-colors', active ? 'border-emerald-500/50 bg-emerald-500/[0.07]' : 'border-white/10 bg-card/70 hover:bg-white/5')}>
              <div className="flex items-center justify-between gap-2">
                <Mono className="text-[10px] text-muted-foreground">{c.payIn.replace('STABLECOIN_', 'SC_')} → {c.payout.replace('STABLECOIN_', 'SC_')}</Mono>
                <Chip tone={c.liveIn.includes('D1 (live)') ? 'emerald' : 'slate'}>{c.liveIn}</Chip>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {c.legs.map((l, j) => (
                  <span key={j} className={cn('rounded border px-1.5 py-0.5 font-mono text-[10px]', LEG_COLORS[l] ?? 'border-white/15 bg-white/5 text-muted-foreground')}>{l}</span>
                ))}
              </div>
            </button>
          )
        })}
      </div>

      <SectionTitle id="flags" title="Feature flags & rules" sub="A closed flag is a refusal before anything is reserved — a method is never silently switched." />
      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="journey flags (JourneyFlags)">
          {JOURNEY_FLAGS.map((f) => (
            <div key={f.id} className="border-b border-white/5 py-2 last:border-0">
              <div className="flex items-center gap-2">
                <Mono className="text-emerald-300">{f.id}</Mono>
                <Chip tone="amber">= {f.default} (D1_FLAGS)</Chip>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{f.note}</p>
            </div>
          ))}
          <div className="mt-2 rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-rose-300">Cross-border is OFF by default</span> and stays off until a legal opinion on exchange control is recorded (G-M 3). The partner core refuses a cross-border payout without one; the demo flag only exists on chain ID 5042002.
          </div>
        </Panel>
        <Panel title="binding rules">
          <Bullets items={JOURNEY_RULES} />
        </Panel>
      </div>
    </div>
  )
}
