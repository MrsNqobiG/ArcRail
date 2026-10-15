'use client'

import { Chip, Mono, Panel, SectionTitle, SimpleTable, Bullets } from '../bits'
import { GATES, GATE_RULES, ADRS, ADRS_PLANNED } from '@/lib/arcrail/data/governance'

const GROUPS: { id: 'G' | 'D' | 'GP' | 'GM'; label: string; sub: string }[] = [
  { id: 'G', label: 'Phase gates G0–G3', sub: 'Checkpoint mode "pause": the agent stops at every gate and waits for the operator\'s continue.' },
  { id: 'D', label: 'Demo gates D1–D7 (milestones M1–M7)', sub: 'Each milestone extends existing Raayl code and ends at its demo gate, with an evidence note. Everything testnet only.' },
  { id: 'GP', label: 'Pilot gates G-P 1–6 (proposed)', sub: 'Proposed for Compliance to confirm — bank\'s own funds, tiny caps, allow-listed recipients. The agent cannot clear them.' },
  { id: 'GM', label: 'Mainnet gates G-M 1–8', sub: 'Mainnet (chain 5042) stays disabled in code until all of these are SIGNED-OFF by named humans.' },
]

export function GatesView() {
  return (
    <div>
      <SectionTitle
        id="gates"
        title="Gates — the release ladder"
        sub="Gates are the repo's control flow: only a named human may sign, and the agent never writes SIGNED-OFF. Chat decisions are recorded but are not signatures."
      />

      <Panel className="mb-6" title="signature rules (MC-42 / CLAUDE.md rule 7)">
        <Bullets items={GATE_RULES} />
      </Panel>

      {GROUPS.map((g) => (
        <div key={g.id}>
          <SectionTitle id={g.id === 'G' ? 'phase-gates' : g.id === 'D' ? 'demo-gates' : g.id === 'GP' ? 'pilot-gates' : 'mainnet-gates'} title={g.label} sub={g.sub} />
          <div className="grid gap-3 md:grid-cols-2">
            {GATES.filter((x) => x.group === g.id).map((gate) => (
              <div key={gate.code} className="rounded-xl border border-white/10 bg-card/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Chip tone={gate.group === 'GM' ? 'rose' : gate.group === 'GP' ? 'violet' : gate.group === 'D' ? 'teal' : 'emerald'}>{gate.code}</Chip>
                    <div className="text-sm font-semibold leading-tight">{gate.title}</div>
                  </div>
                  <Chip tone={gate.status === 'CHAT RECORD' ? 'amber' : 'slate'}>{gate.status}</Chip>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{gate.requirement}</p>
                {gate.detail && (
                  <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2.5">
                    <p className="text-[10px] leading-relaxed text-muted-foreground">{gate.detail}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <SectionTitle id="mainnet-gate-code" title="The mainnet gate in code" sub="src/chain/config holds a disabled mainnet entry; resolveChain refuses chain 5042 unconditionally while ARC_MAINNET_DISABLED.enabled is false." />
      <Panel title="REQUIRED_MAINNET_GATES (G-M 1–8)">
        <Mono className="block leading-relaxed text-muted-foreground">
          {'assertMainnetAllowed() →\n  every G-M row in docs/GATES.md must be SIGNED-OFF (name, role, date)\n  a CI test fails if mainnet configuration is reachable while any gate is unsigned (MC-20)\n\nTODO before mainnet is ever enabled:\n  add every G-P row (and G3) to the required set and fail closed on any missing one'}
        </Mono>
        <div className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
          Until then mainnet cannot be reached anyway: <Mono className="text-rose-300">resolveChain refuses chain 5042</Mono> because the mainnet entry&apos;s <Mono>enabled</Mono> flag is <Mono className="text-rose-300">false</Mono>.
        </div>
      </Panel>

      <SectionTitle id="adr" title="Architecture decisions (ADR-001…008)" sub="Do not decide — the human decides at G1. The repo records options, trade-offs and a recommendation; G1_PACKET §2a records the sandbox options chosen for testnet." />
      <div className="grid gap-3 lg:grid-cols-2">
        {ADRS.map((a) => (
          <div key={a.id} className="rounded-xl border border-white/10 bg-card/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Chip tone="emerald">{a.id}</Chip>
                <div className="text-sm font-semibold">{a.title}</div>
              </div>
            </div>
            <ul className="mt-2 space-y-1">
              {a.options.map((o) => (
                <li key={o} className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-white/30" />
                  {o}
                </li>
              ))}
            </ul>
            <div className="mt-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">recommendation</span>
              <p className="mt-0.5 text-[11px] leading-relaxed text-foreground/90">{a.recommendation}</p>
            </div>
          </div>
        ))}
      </div>
      <Panel className="mt-3" title="planned, not yet written">
        <div className="flex flex-wrap gap-1.5">
          {ADRS_PLANNED.map((p) => <Chip key={p} tone="slate">{p}</Chip>)}
        </div>
      </Panel>

      <SectionTitle id="records" title="Gate records format" sub="One record per gate, added when it is decided — the exact decider's words are quoted." />
      <SimpleTable
        head={['Field', 'Content']}
        rows={[
          ['Gate', 'The table name, e.g. G1b, D1, G-P 3'],
          ['Decision', 'PASSED IN CHAT / APPROVED IN CHAT / a signature written by the signer'],
          ['Name · Role', 'Of each human who decides — the agent never fills these in for someone else'],
          ['Date', 'ISO date (YYYY-MM-DD)'],
          ['Commit SHA', 'The reviewed commit; for signatures, the signer\'s own signed commit (MC-42)'],
          ['ADR options chosen', 'The chosen option per ADR the gate decides, or "none"'],
        ].map((r) => [<Mono key="f" className="text-emerald-300">{r[0]}</Mono>, <span key="v" className="text-muted-foreground">{r[1]}</span>])}
      />
    </div>
  )
}
