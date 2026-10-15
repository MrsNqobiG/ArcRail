'use client'

import { Chip, Mono, Panel, SectionTitle, SimpleTable, Bullets } from '../bits'
import { RUBRIC, RUBRIC_META, VERIFICATION_LOOP, CI_STAGES, UNIT_LEDGER, GATES } from '@/lib/arcrail/data/governance'
import { DEMO_TESTS, GUARDRAILS } from '@/lib/arcrail/data/facts'

export function VerificationView() {
  const groups = [...new Set(RUBRIC.map((r) => r.group))]
  const frozen = UNIT_LEDGER.filter((u) => u.status.startsWith('FROZEN'))

  return (
    <div>
      <SectionTitle
        id="verification"
        title="Verification — rubric, lenses, ledger & CI"
        sub="Zero undetected money errors, not zero errors: every invariant is enforced by types or code, proven by tests (including property and mutation tests), and checked at runtime, failing closed."
      />

      <SectionTitle id="rubric" title="The rubric" sub={`${RUBRIC_META.mechanical}. Numbering gaps are intentional — the rubric can only grow, through a LEDGER entry.`} />
      <div className="space-y-3">
        {groups.map((g) => (
          <Panel key={g} title={g}>
            <div className="space-y-1.5">
              {RUBRIC.filter((r) => r.group === g).map((r) => (
                <div key={r.id} className="flex gap-3 border-b border-white/5 pb-1.5 last:border-0">
                  <Chip tone="emerald" className="shrink-0">{r.id}</Chip>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{r.text}</p>
                </div>
              ))}
            </div>
          </Panel>
        ))}
        <Panel title="judgment lenses">
          <div className="grid gap-2 md:grid-cols-2">
            {RUBRIC_META.lenses.map((l) => (
              <div key={l.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center gap-2">
                  <Chip tone="violet">{l.id}</Chip>
                  <div className="text-xs font-semibold">{l.name}</div>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{l.text}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <SectionTitle id="loop" title="The perfecting loop" sub="Lens R → Lens A → Lens H, one lens per response. Exit only after 3 consecutive POSITIVE passes; cap 10 rounds + 2 grace; regeneration budget 3; plateau ladder: reframe → regenerate → structural mark." />
      <div className="grid gap-3 lg:grid-cols-3">
        {VERIFICATION_LOOP.lenses.map((l) => (
          <div key={l.id} className="rounded-xl border border-white/10 bg-card/70 p-4">
            <div className="flex items-center justify-between">
              <Mono className="font-bold text-emerald-300">{l.id}</Mono>
              <Chip tone="teal">{l.verdicts}</Chip>
            </div>
            <div className="mt-1 text-xs font-medium">{l.who}</div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{l.what}</p>
          </div>
        ))}
      </div>

      <SectionTitle id="ledger" title={`Unit ledger — ${frozen.length} of ${UNIT_LEDGER.length} frozen`} sub="A unit freezes when a verifier pass finds zero blocking defects; minor defects go to the G1 packet for a human to accept. Units with blocking defects get at most two atomic fix blocks." />
      <SimpleTable
        head={['Unit', 'Status', 'Rounds / note']}
        rows={UNIT_LEDGER.map((u) => [
          <Mono key="u" className="text-emerald-300/90">{u.unit}</Mono>,
          <Chip key="s" tone={u.status.startsWith('FROZEN') ? 'emerald' : u.status === 'built' ? 'teal' : 'amber'}>{u.status}</Chip>,
          <span key="n" className="text-muted-foreground">{u.note}</span>,
        ])}
      />
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Every change also gets an independent, fresh-context verifier pass recorded in docs/LEDGER.md — roughly 90 Lens R reports live in docs/verification/.
        Only G0 and G2 carry chat records; every other gate is NOT SIGNED.
      </p>

      <SectionTitle id="ci" title="CI pipeline — scripts/ci.sh (13 stages)" sub="Runs locally and in hosted CI (.github/workflows). Network egress to the npm registry only; the Ubuntu container is pinned by digest; no caching." />
      <div className="grid gap-2 md:grid-cols-2">
        {CI_STAGES.map((s) => (
          <div key={s.n} className="flex gap-3 rounded-xl border border-white/10 bg-card/70 p-3.5">
            <Mono className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-xs font-bold text-emerald-300">{s.n}</Mono>
            <div className="min-w-0">
              <div className="text-xs font-semibold">{s.name}</div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{s.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <SectionTitle id="mutation" title={'What "zero undetected money errors" means'} sub="The measurable exit bars from the kickoff prompt." />
      <Panel>
        <Bullets items={[
          '100% branch coverage on money-path modules (MC-07)',
          'Mutation score ≥ 90% on money-path modules (MC-08, Stryker threshold 90)',
          'Reconciliation drift of exactly 0 base units across chain ↔ adapter ↔ CBS in every test scenario (MC-05)',
          '0 high or critical findings from SAST, SCA and secret scanning (MC-33)',
          'Every Arc and regulatory fact cited, or listed in OPEN_QUESTIONS (MC-43)',
          'Property-based tests (fast-check) for round-trips, boundaries and dust; deterministic fault injection: RPC lies or lags, duplicate and out-of-order events, CBS timeouts, nonce gaps, chain stall',
          'Consumer-driven contract tests against the CBS, with scripted diffs and self-tests proving the diff catches drift',
        ]} />
      </Panel>

      <SectionTitle id="demo" title="Demo evidence (demo/)" sub="All 8 demo tests green (re-verified 2026-10-13): the real status table and transition rules, the real signing gateway against the in-memory DFNS simulator (throwaway keys), and the journey orchestrator on fakes — postings balanced, replay deduped, ledger residual 0." />
      <div className="grid gap-3 lg:grid-cols-3">
        {DEMO_TESTS.map((d) => (
          <Panel key={d.file} title={<Mono className="text-[10px]">{d.file}</Mono>}>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{d.what}</p>
          </Panel>
        ))}
      </div>

      <SectionTitle id="guard" title="Guardrails (the .claude hook)" sub="Protections proven by self-test (22 in kit v1 / 32 in kit v3). If any attempt succeeds, the run stops." />
      <Panel>
        <div className="grid gap-2 md:grid-cols-2">
          {GUARDRAILS.map((g) => (
            <div key={g} className="flex items-start gap-2 text-[11px] leading-relaxed">
              <span className="mt-0.5 shrink-0 text-rose-400">✕</span>
              <span className="text-muted-foreground">{g}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
