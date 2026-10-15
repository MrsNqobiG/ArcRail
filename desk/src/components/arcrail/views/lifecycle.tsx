'use client'

import { Chip, Mono, Panel, SectionTitle, SimpleTable, Bullets } from '../bits'
import { STAGES, STATUS_RULES, FAILURE_REASONS, SIGNAL_SOURCES, DFNS_REQUEST_STATES } from '@/lib/arcrail/data/core'

const RANKS = ['CREATED', 'PENDING_APPROVAL', 'APPROVED', 'SUBMITTED', 'CONFIRMING', 'COMPLETED']

export function LifecycleView() {
  return (
    <div>
      <SectionTitle
        id="lifecycle"
        title="Payment lifecycle — stages & statuses"
        sub="Nova's public TransactionStatus is unchanged; lifecycle detail lives in the stage field. STATUS_BY_STAGE is the single, tested source of the mapping (src/status/index.ts)."
      />

      <Panel title="stage → TransactionStatus (STATUS_BY_STAGE)">
        <div className="grid gap-2 sm:grid-cols-3">
          {STAGES.map((s) => {
            const tone = s.status === 'SETTLED' ? 'border-emerald-500/40' : s.status === 'FAILED' ? 'border-rose-500/40' : s.status === 'PROCESSING' ? 'border-teal-500/40' : 'border-amber-500/40'
            return (
              <div key={s.stage} className={`rounded-lg border bg-white/[0.02] p-3 ${tone}`}>
                <div className="flex items-center justify-between gap-2">
                  <Mono className="font-bold">{s.stage}</Mono>
                  <Chip tone={s.status === 'SETTLED' ? 'emerald' : s.status === 'FAILED' ? 'rose' : s.status === 'PROCESSING' ? 'teal' : 'amber'}>{s.status}</Chip>
                </div>
                <div className="mt-1 text-[10px] leading-snug text-muted-foreground">{s.note}</div>
                {s.terminal && <Chip tone="slate" className="mt-1.5">terminal</Chip>}
              </div>
            )
          })}
        </div>
        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
          <Mono className="text-muted-foreground">PENDING → PROCESSING → SETTLED → FAILED → REVERSED &nbsp;·&nbsp; COMPLETED + P7 ⇒ REVERSED (never a stage)</Mono>
        </div>
      </Panel>

      <SectionTitle id="machine" title="The state machine" sub="Forward jumps are allowed and recorded; skipped stages land in history. Transition verdicts: APPLIED · DUPLICATE · STALE · ILLEGAL (ILLEGAL → QUARANTINE + page)." />
      <Panel title="lifecycle order (ranks 0–4; no FAILED stage exists)">
        <div className="flex flex-wrap items-center gap-1.5">
          {RANKS.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold ${i === 5 ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-white/15 bg-white/5'}`}>{s}</div>
              {i < RANKS.length - 1 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
          <span className="ml-2 text-muted-foreground">or</span>
          <div className="flex items-center gap-1.5">
            {['REJECTED', 'EXPIRED', 'CANCELLED'].map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-muted-foreground">|</span>}
                <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-1.5 font-mono text-xs font-bold text-rose-300">{s}</div>
              </div>
            ))}
          </div>
          <Chip tone="amber" className="ml-2">+ a mandatory reason code</Chip>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          COMPLETED for the Arc leg comes only from our own confirmed system-emitter log (§6.5). DFNS Confirmed and DFNS webhooks are a cross-check —
          a DFNS Confirmed with no indexer log after A_xcheck is F-9: QUARANTINE + page.
        </p>
      </Panel>

      <SectionTitle id="reasons" title="Failure reasons — 14 codes, three stages" sub="A failure stage without a reason is unrepresentable: the LegState type plus a runtime isLegalState check enforce it, failing closed." />
      <SimpleTable
        head={['Reason', 'Stage', 'Failure path', 'What happens']}
        rows={FAILURE_REASONS.map((r) => [
          <Mono key="c" className="font-bold text-rose-300">{r.code}</Mono>,
          <Chip key="s" tone="rose">{r.stage}</Chip>,
          <Chip key="f" tone="amber">{r.failure}</Chip>,
          <span key="n" className="text-muted-foreground">{r.note}</span>,
        ])}
      />

      <SectionTitle id="sources" title="Signal sources & DFNS request states" sub="Every inbound signal is checked for authenticity and deduplicated before use — webhooks are a hint; the handler re-reads via GET." />
      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="signal sources (8)">
          <div className="flex flex-wrap gap-1.5">
            {SIGNAL_SOURCES.map((s) => <Chip key={s} tone="teal">{s}</Chip>)}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            FAILURE_RULES, COMPLETION_RULES and PROGRESS_RULES encode per-reason, per-source legality. A signal that arrives for the wrong state is STALE;
            an impossible one is ILLEGAL and quarantines the item.
          </p>
        </Panel>
        <Panel title="DFNS request states">
          <div className="space-y-2">
            {DFNS_REQUEST_STATES.map((d) => (
              <div key={d.id} className="border-b border-white/5 pb-2 last:border-0">
                <Mono className="font-bold text-amber-300">{d.id}</Mono>
                <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{d.note}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <SectionTitle id="rules" title="Status model rules" />
      <Panel>
        <Bullets items={STATUS_RULES} />
      </Panel>
    </div>
  )
}
