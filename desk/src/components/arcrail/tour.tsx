'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chip, Mono } from './bits'
import { cn } from '@/lib/utils'
import { Play, Pause, SkipBack, SkipForward, X, Gauge, PartyPopper } from 'lucide-react'
import type { ViewId } from './shell'

/** Views that own live data listen for this event and reload. */
export const TOUR_REFRESH = 'arcrail:refresh'

interface TourCtx { id1: string | null; id2: string | null }

async function jpost(url: string, body?: unknown, headers?: Record<string, string>) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers ?? {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({} as Record<string, unknown>))
  if (!r.ok) {
    const err = j.error ?? j.need ?? `HTTP ${r.status}`
    throw new Error(typeof err === 'string' ? err : JSON.stringify(err))
  }
  return j as Record<string, unknown>
}

function notify(select?: string) {
  window.dispatchEvent(new CustomEvent(TOUR_REFRESH, { detail: select ? { select } : {} }))
}

async function createPayment(amount: string, fee: string, beneficiaryRef: string) {
  const j = await jpost('/api/payments',
    { payIn: 'STABLECOIN_BALANCE', payout: 'STABLECOIN_WALLET', amount, fee, beneficiaryRef },
    { 'Idempotency-Key': `tour-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })
  return String(j.id)
}

async function fireEvent(id: string, type: string) {
  const j = await jpost(`/api/payments/${id}/events`, { type })
  const postings = Array.isArray(j.postings) ? (j.postings as string[]).join(', ') : ''
  const stage = String(j.stage ?? '')
  const reason = j.reason ? ` / ${String(j.reason)}` : ''
  return `${type} → ${stage}${reason}${postings ? ` · posted: ${postings}` : ''}`
}

const STEPS: { view: ViewId; title: string; body: string; tone: 'emerald' | 'teal' | 'rose' | 'amber'; dwellMs: number; action?: (ctx: TourCtx) => Promise<string | void> }[] = [
  {
    view: 'overview', title: 'Welcome — what you are looking at', tone: 'emerald', dwellMs: 7000,
    body: 'The ArcRail GitHub repo is a library, not an app — so this Explorer runs its design live for you. A "rail" moves customer money from a banking ledger onto the Arc blockchain (USDC, testnet chain 5042002) through a custody partner (DFNS). I just reset the demo so the story starts clean. Sit back — everything from here happens by itself.',
    action: async () => {
      await jpost('/api/reset', {})
      notify()
    },
  },
  {
    view: 'overview', title: 'The mission, in one screen', tone: 'emerald', dwellMs: 6500,
    body: 'Five systems cooperate: the Customer, Raayl (the product & ledger — system of record), DFNS (custody & signing with FIDO2 approvals), Arc (settlement network), and the Recipient. The adapter you are touring is the piece between ledger and chain. Note the non-negotiables on the left of this page: testnet only, no secrets, no LLM in the money path, fail closed.',
  },
  {
    view: 'journey', title: 'Journey model — pay-in × payout', tone: 'emerald', dwellMs: 6500,
    body: 'A payment is a journey: the payer picks ONLY the pay-in, the receiver picks ONLY the payout. Each combination decides the legs. Today only one is live (D1): stablecoin balance → stablecoin wallet, two legs: RESERVE then ARC_TRANSFER. Hover the matrix cells to see which phases unlock the others.',
  },
  {
    view: 'payments', title: 'Step 1 — create a payment (P1 reserves the money)', tone: 'emerald', dwellMs: 6000,
    body: 'POST /payments with an Idempotency-Key. Watch the payments list: a 2.50 USDC payment appears, stage CREATED — but the engine already posted P1_RESERVE, debiting the customer and crediting the clearing account. Integer minor units only; the same request twice would replay, not double-post.',
    action: async (ctx) => {
      ctx.id1 = await createPayment('2.50', '0.25', 'nova:cust-042')
      notify(ctx.id1)
      return `pm created · P1_RESERVE posted (DR customer 2.75 · CR GL-5 arc.outbound)`
    },
  },
  {
    view: 'payments', title: 'Step 2 — submit to DFNS', tone: 'teal', dwellMs: 5000,
    body: 'The submit marker is written BEFORE the single outbound POST (so a timeout can never orphan a transfer). Policy POL-1 approval starts; dfnsState is UNRESOLVED until the externalId resolves. The Arc leg moves to PENDING_APPROVAL.',
    action: async (ctx) => {
      if (!ctx.id1) return
      const r = await fireEvent(ctx.id1, 'submit')
      notify(ctx.id1)
      return r
    },
  },
  {
    view: 'payments', title: 'Step 3 — approval resolved (FIDO2)', tone: 'teal', dwellMs: 5000,
    body: 'The customer taps a hardware-key approval inside DFNS. dfnsState becomes KNOWN and the leg is APPROVED. If this had failed it would be F-1: REJECTED, and P6 would hand the money straight back — you will see that path in a moment.',
    action: async (ctx) => {
      if (!ctx.id1) return
      const r = await fireEvent(ctx.id1, 'approve')
      notify(ctx.id1)
      return r
    },
  },
  {
    view: 'payments', title: 'Step 4 — broadcast, then included on chain', tone: 'teal', dwellMs: 5500,
    body: 'DFNS broadcasts: a tx hash appears and the nonce is consumed by the single writer (two writers would double-spend). The payment is SUBMITTED, then block inclusion makes it CONFIRMING. We still trust nothing but our own indexer — DFNS "Confirmed" is only a cross-check.',
    action: async (ctx) => {
      if (!ctx.id1) return
      const a = await fireEvent(ctx.id1, 'broadcast')
      const b = await fireEvent(ctx.id1, 'onchain')
      notify(ctx.id1)
      return `${a}\n${b}`
    },
  },
  {
    view: 'payments', title: 'Step 5 — our indexer confirms → SETTLED', tone: 'emerald', dwellMs: 7000,
    body: 'The canonical system-emitter log is seen: the payment is COMPLETED / SETTLED. Scroll the right-hand panels: P2I settles internally (this beneficiary is a Nova customer), P3 takes the fee, P4 books gas. Check the client history below — every step left an immutable hist:<paymentId>:<eventId> entry, in order.',
    action: async (ctx) => {
      if (!ctx.id1) return
      const r = await fireEvent(ctx.id1, 'confirm')
      notify(ctx.id1)
      return r
    },
  },
  {
    view: 'ledger', title: 'The ledger must always balance', tone: 'emerald', dwellMs: 6500,
    body: 'This is the whole journal: every posting is deterministic (same key → replay, never a duplicate) and debits always equal credits — the conservation invariant the repo tests with 100% branch coverage and mutation testing. GL-5 clears, GL-2 hot wallet holds the float, GL-6 takes fees, GL-3 books gas.',
  },
  {
    view: 'payments', title: 'Failure path — let an approval be denied', tone: 'rose', dwellMs: 5500,
    body: 'Money systems are judged by failure handling. Second payment: 1.25 USDC to an EXTERNAL wallet (so it settles via P2, not P2I). P1 reserves it exactly as before.',
    action: async (ctx) => {
      ctx.id2 = await createPayment('1.25', '0.25', 'ben-external-9')
      notify(ctx.id2)
      return `pm created · P1_RESERVE posted`
    },
  },
  {
    view: 'payments', title: 'Submit, then deny it (F-1)', tone: 'rose', dwellMs: 6000,
    body: 'Same submit path — but this time DFNS policy refuses the approval. Watch: the payment ends REJECTED / FAILED, and P6_RELEASE instantly returns the reserved 1.50 (amount + fee) to the customer. No orphaned reservations, ever.',
    action: async (ctx) => {
      if (!ctx.id2) return
      const a = await fireEvent(ctx.id2, 'submit')
      const b = await fireEvent(ctx.id2, 'deny')
      notify(ctx.id2)
      return `${a}\n${b}`
    },
  },
  {
    view: 'recon', title: 'Reconciliation — now break it on purpose', tone: 'rose', dwellMs: 6500,
    body: 'Three-way reconciliation checks chain ↔ adapter ↔ CBS: for every payment P1 = P2-family + P3, or P1 = P6. Zero tolerance for drift. Injecting drift trips the circuit breaker: the whole rail PAUSES and outbound stops — fail closed, page a human.',
    action: async () => {
      const j = await jpost('/api/recon', { mode: 'inject-drift' })
      notify()
      return `drift injected · rail PAUSED · case ${String(j.caseId ?? '')} opened`
    },
  },
  {
    view: 'recon', title: 'Two humans are needed to unpause (MC-19)', tone: 'amber', dwellMs: 6000,
    body: 'One operator cannot resume the rail — the same person twice is refused, and both names land in the audit chain. khumo + ops-two now unpause it together. This rule exists so no single person can ever move money alone after an anomaly.',
    action: async () => {
      const j = await jpost('/api/recon', { mode: 'unpause', approver1: 'khumo', approver2: 'ops-two' })
      notify()
      return `rail unpaused by ${String((j.approvals as string[] | undefined)?.join(' + ') ?? 'two approvers')}`
    },
  },
  {
    view: 'ops', title: 'Ops console — cases and the audit chain', tone: 'amber', dwellMs: 6500,
    body: 'Everything an operator sees: cases (the PAUSE case from the drift is here, with its two-person resolution actions) and the hash-chained audit trail — every event you just fired is an entry, each one hash-linked to the previous, so tampering is detectable.',
  },
  {
    view: 'gates', title: 'Why testnet only? Gates.', tone: 'emerald', dwellMs: 6000,
    body: 'Mainnet (chain 5042) is disabled in code and assertMainnetAllowed() refuses until every G-M gate in docs/GATES.md is SIGNED-OFF by a named human — not "approved in chat". G0–G3 build gates, D1–D7 unit gates, G-P/G-M mainnet gates, and the 8 ADRs that froze the big design decisions.',
  },
  {
    view: 'overview', title: 'Tour complete — now it is yours', tone: 'emerald', dwellMs: 8000,
    body: 'You have seen the happy path, a failure path with instant refund, the circuit breaker and the two-person rule. Next: drive it yourself in the Payments tab (every button is real), explore the reference tabs — and compare with the source: github.com/MrsNqobiG/ArcRail. Press Explore to keep the state, or Exit to close.',
  },
]

const TONE_RING: Record<string, string> = {
  emerald: 'border-emerald-500/40 shadow-emerald-500/10',
  teal: 'border-teal-500/40 shadow-teal-500/10',
  rose: 'border-rose-500/40 shadow-rose-500/10',
  amber: 'border-amber-500/40 shadow-amber-500/10',
}

export function GuidedTour({ setView, onClose }: { setView: (v: ViewId) => void; onClose: () => void }) {
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dwellLeft, setDwellLeft] = useState(0)
  const [finished, setFinished] = useState(false)
  const ctx = useRef<TourCtx>({ id1: null, id2: null })
  const executed = useRef<Set<number>>(new Set())
  const leftRef = useRef(0)
  const busyRef = useRef(0)
  const step = STEPS[idx] ?? STEPS[STEPS.length - 1]!
  const total = STEPS.length
  const done = finished || idx >= total - 1 && dwellLeft <= 0

  const enter = useCallback(async (i: number) => {
    const s = STEPS[i]!
    setView(s.view)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setResult(null)
    setError(null)
    // Dwell is armed BEFORE the action so the countdown can never race ahead
    // of a slow (cold-compile) API call, and is frozen while the action runs.
    leftRef.current = s.dwellMs
    setDwellLeft(s.dwellMs)
    if (s.action && !executed.current.has(i)) {
      executed.current.add(i)
      busyRef.current += 1
      try {
        const out = await s.action(ctx.current)
        setResult(typeof out === 'string' && out ? out : null)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        busyRef.current -= 1
      }
    }
  }, [setView])

  // Deferred enter: avoids synchronous setState inside the effect body, and the
  // cleanup cancels a stale enter if the step index changed again before it ran.
  useEffect(() => {
    const t = setTimeout(() => { enter(idx) }, 0)
    return () => clearTimeout(t)
  }, [idx, enter])

  useEffect(() => {
    if (!playing || finished) return
    const t = setInterval(() => {
      if (busyRef.current > 0) return // action(s) in flight — hold the countdown
      leftRef.current = Math.max(0, leftRef.current - 250 * speed)
      setDwellLeft(leftRef.current)
      if (leftRef.current === 0) {
        if (idx >= total - 1) {
          setFinished(true)
          setPlaying(false)
        } else {
          setIdx((i) => i + 1)
        }
      }
    }, 250)
    return () => clearInterval(t)
  }, [playing, speed, idx, total, finished])

  const progress = Math.min(100, ((idx + (step.dwellMs ? 1 - dwellLeft / step.dwellMs : 1)) / total) * 100)

  function next() {
    if (idx >= total - 1) { setFinished(true); setPlaying(false); return }
    setIdx((i) => Math.min(total - 1, i + 1))
  }
  function prev() { setIdx((i) => Math.max(0, i - 1)) }

  return (
    <div role="region" aria-label="Guided tour" className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-6 sm:pb-5">
      <div className={cn('mx-auto max-w-3xl rounded-2xl border bg-card/95 p-4 shadow-2xl backdrop-blur-xl', TONE_RING[step.tone])}>
        {/* progress */}
        <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${Math.max(2, progress)}%` }} />
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Chip tone={step.tone}>step {idx + 1}/{total}</Chip>
            <div className="text-sm font-bold tracking-tight text-foreground">{step.title}</div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setSpeed((s) => (s === 1 ? 1.5 : s === 1.5 ? 2 : 1))}
              aria-label={`Tour speed ${speed}x`}
              title={`Speed: ${speed}x`}
            >
              <Gauge className="h-4 w-4" />
              <span className="ml-0.5 text-[10px] font-mono">{speed}x</span>
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose} aria-label="Close tour">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <p className="mt-2 max-h-32 overflow-y-auto text-[13px] leading-relaxed text-foreground/90">{step.body}</p>

        {(result || error) && (
          <div className="mt-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
            {error ? (
              <Mono className="text-rose-400">⚠ {error} — the demo state may have drifted; press reset demo and restart the tour.</Mono>
            ) : (
              <Mono className="whitespace-pre-line text-emerald-300">✓ {result}</Mono>
            )}
          </div>
        )}

        {finished && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
            <PartyPopper className="h-4 w-4 text-emerald-300" />
            <span className="text-xs text-emerald-200">Tour finished — the state you built is still live. Keep exploring, or reset the demo from the header.</span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="h-8" onClick={prev} disabled={idx === 0} aria-label="Previous step">
            <SkipBack className="mr-1 h-3.5 w-3.5" /> back
          </Button>
          <Button
            size="sm"
            className={cn('h-8', playing ? 'bg-amber-600 text-black hover:bg-amber-500' : 'bg-emerald-600 text-black hover:bg-emerald-500')}
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause tour' : 'Play tour'}
          >
            {playing ? <Pause className="mr-1 h-3.5 w-3.5" /> : <Play className="mr-1 h-3.5 w-3.5" />}
            {playing ? 'pause' : 'play'}
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={next} aria-label="Next step">
            next <SkipForward className="ml-1 h-3.5 w-3.5" />
          </Button>
          <Mono className="ml-auto text-muted-foreground">
            {finished ? 'done' : playing ? `auto-advancing in ${Math.ceil(dwellLeft / 1000)}s` : 'paused'}
          </Mono>
        </div>
      </div>
    </div>
  )
}
