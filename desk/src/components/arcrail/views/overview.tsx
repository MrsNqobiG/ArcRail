'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play } from 'lucide-react'
import { Chip, Mono, Panel, SectionTitle, SimpleTable, Bullets } from '../bits'
import { PHASES, REPO_META, VERIFICATION_LOOP, GATES, OPEN_QUESTIONS, UNIT_LEDGER, RUBRIC_META, CONSTANTS_META, THREAT_MODEL, MODULES, BUILD_STATUS } from '@/lib/arcrail/data'

const FLOW = [
  { node: 'Customer', sub: 'payer / receiver', note: 'Payer chooses only the pay-in method' },
  { node: 'Raayl (Nova)', sub: 'product & ledger', note: 'KYB/KYC, pricing, ledger, reconciliation — system of record' },
  { node: 'DFNS', sub: 'custody & signing', note: 'Wallets, policies, FIDO2 approvals — the company\'s existing org' },
  { node: 'Arc', sub: 'settlement network', note: 'USDC native L1; our own indexer is canonical' },
  { node: 'Recipient', sub: 'wallet or bank', note: 'Receiver\'s payout choice read server-side' },
]

const NON_NEGOTIABLES = [
  { id: '1', title: 'Testnet only', detail: 'Arc testnet chain ID 5042002, DFNS ArcTestnet. Mainnet (5042) stays disabled in code until G3 + every G-P + every G-M gate is signed by named humans; a CI test proves it.' },
  { id: '2', title: 'No secrets', detail: 'Never read, print or commit keys or tokens. Credentials are read only by the running service, at runtime. All signing goes through the Signer interface; tests use throwaway keys.' },
  { id: '3', title: 'Read-only on existing systems', detail: 'Raayl code and the CBS are read-only until G1b; changes after that go through human-reviewed PRs on a feature branch only.' },
  { id: '4', title: 'No LLM or agent in the money path', detail: 'Every money decision comes from deterministic, tested code.' },
  { id: '5', title: 'Never guess', detail: 'Any Arc, Circle, DFNS, VALR, Raayl, CBS or regulatory fact is verified from a primary source and cited, or it becomes an open question.' },
  { id: '6', title: 'Compliance status is human-owned', detail: 'The agent may set NOT STARTED / IMPLEMENTED / EVIDENCED. Only a named human sets SIGNED-OFF.' },
  { id: '7', title: 'Gates are recorded', detail: 'Every gate lives in docs/GATES.md with name, role, date, commit SHA and ADR options. "Approved in chat" is not a signature.' },
]

const MONEY_INVARIANTS = [
  'Integer arithmetic only — branded types CbsMinor, UsdcUnits, NativeWei, FiatMinor<CCY>; mixing is a compile error. Decimal strings at the API edge, integer base units inside.',
  'One conversion module; dust goes to a named suspense account with a record, never silently dropped; every quote leg is a separate balanced posting; gas paid in USDC is posted too.',
  'Conservation — debits equal credits in the CBS and the adapter sub-ledger, and the on-chain delta matches to the base unit.',
  'Exactly once — deterministic idempotency keys, transactional outbox/inbox, a single nonce writer per hot wallet.',
  'Authenticity and dedupe on every inbound signal — DFNS webhooks, partner callbacks and chain logs are each verified and deduplicated before use.',
  'Fail closed — any drift, RPC disagreement, unknown event or failed invariant pauses outbound and pages a human: PAUSE (rail) or QUARANTINE (item). Two humans unpause.',
  'Binding — account, amount, recipient and route always come from the server-side transfer record, never echoed from client input.',
  'REVERSED means a compensating ledger entry only — nothing on Arc can be reversed on-chain.',
]

export function OverviewView({ onStartTour, onOpenDesk }: { onStartTour: () => void; onOpenDesk: () => void }) {
  const gmSigned = GATES.filter((g) => g.group === 'GM' && g.status === 'NOT SIGNED').length
  const frozen = UNIT_LEDGER.filter((u) => u.status.startsWith('FROZEN')).length
  const moneyPathModules = MODULES.filter((m) => m.moneyPath).length

  const stats = [
    { label: 'Tests', value: '2,979', note: 'green: 2,328 unit + 24 property + 480 contract + 8 demo (2026-10-15) + 139 pinning' },
    { label: 'Blocking defects', value: '0', note: 'verifier pass at the commit; 139 pinning behaviours green' },
    { label: 'Frozen units', value: `${frozen}/${UNIT_LEDGER.length}`, note: 'zero blocking defects — P0 operator-stopped, P2 awaits hosted CI' },
    { label: 'Gates tracked', value: String(GATES.length), note: `${gmSigned} mainnet gates unsigned — human sign-off, by design` },
    { label: 'Open questions', value: String(OPEN_QUESTIONS.open), note: `of ${OPEN_QUESTIONS.total} — facts reserved for humans, 7 categories` },
    { label: 'Rubric', value: '38 MC + 6 JL', note: RUBRIC_META.mechanical },
    { label: 'Money-path modules', value: String(moneyPathModules), note: `of ${MODULES.length} modules touch money — MC-07 demands 100% branch coverage on each` },
    { label: 'Arc constants', value: `${CONSTANTS_META.rows}`, note: `cited, ${CONSTANTS_META.accessed}` },
  ]

  return (
    <div>
      <Panel className="mb-6 border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.07] to-transparent">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Chip tone="emerald">mission</Chip>
              <Chip>docs/MISSION.md</Chip>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Enable Arc Network as an additional settlement rail
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">
              The bank and its merchant clients can receive, hold, send and settle in USD stablecoins (USDC first) on Arc.
              The existing core banking system stays the system of record; this repo builds an <strong className="text-emerald-300">Arc Rail Adapter</strong> —
              a bounded context that talks to Arc on one side and to the CBS through an anti-corruption layer on the other.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Testnet settle signs a real Arc testnet transfer from a wallet created in your browser (valueless testnet USDC, chain 5042002 only, two independent providers must agree). The Payments desk and the Guided tour rehearse the ledger and send nothing by themselves. This is not a bank, not a crypto-asset service, and not advice.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={onOpenDesk}
                size="lg"
                className="h-auto min-h-11 w-full gap-2 bg-emerald-600 px-4 py-3 text-sm font-bold text-black hover:bg-emerald-500 sm:w-auto"
              >
                Send a real testnet transfer
              </Button>
              <Button
                onClick={onStartTour}
                size="lg"
                variant="outline"
                className="h-auto min-h-11 w-full gap-2 border-white/15 px-4 py-3 text-sm font-semibold sm:w-auto"
              >
                <Play className="h-4 w-4" /> Guided tour
              </Button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              16 steps, ~90 seconds, hands-free: happy path, a failure refund, the circuit breaker and the two-person rule — all on the real engine.
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 md:w-64">
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
              <Mono className="text-muted-foreground">chain</Mono>
              <div className="font-mono text-sm font-bold text-emerald-300">5042002</div>
              <Mono className="text-muted-foreground">Arc testnet</Mono>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
              <Mono className="text-muted-foreground">mainnet</Mono>
              <div className="font-mono text-sm font-bold text-rose-300">disabled</div>
              <Mono className="text-muted-foreground">5042 · G-M gated</Mono>
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="mb-6 border-emerald-500/30 bg-emerald-500/[0.05]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Chip tone="emerald">build status</Chip>
              <Chip>{BUILD_STATUS.changeOrder} · D1</Chip>
              <Mono className="text-muted-foreground">{BUILD_STATUS.date}</Mono>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-emerald-300">
              {BUILD_STATUS.state} · <Mono className="text-base">{BUILD_STATUS.commit}</Mono>
            </h2>
            <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-foreground/80">
              {BUILD_STATUS.milestone}. Delivered: {BUILD_STATUS.scope} — {BUILD_STATUS.diff} on{' '}
              <Mono>{BUILD_STATUS.branch}</Mono>.
            </p>
            <p className="mt-2 border-t border-white/5 pt-2 text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground/70">Remains, deliberately outside this change order:</span>{' '}
              {BUILD_STATUS.remains}
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 lg:w-80">
            {[
              { k: 'tests green', v: '2,979' },
              { k: 'blocking defects', v: '0' },
              { k: 'MC-01 lint findings', v: '0' },
              { k: 'typecheck + build', v: 'clean' },
            ].map((b) => (
              <div key={b.k} className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2.5">
                <div className="font-mono text-lg font-bold leading-tight text-emerald-300">{b.v}</div>
                <div className="text-[10px] font-medium text-muted-foreground">{b.k}</div>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <SectionTitle id="flow" title="The settlement flow" sub="Customer → Raayl → DFNS → Arc → Recipient. Each hop is a trust boundary in the threat model." />
      <div className="grid gap-3 md:grid-cols-5">
        {FLOW.map((f, i) => (
          <div key={f.node} className="relative rounded-xl border border-white/10 bg-card/70 p-4">
            <Mono className="text-emerald-400/70">{String(i + 1).padStart(2, '0')}</Mono>
            <div className="mt-1 text-sm font-semibold">{f.node}</div>
            <div className="text-xs text-muted-foreground">{f.sub}</div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">{f.note}</p>
            {i < FLOW.length - 1 && (
              <div className="absolute -right-2.5 top-1/2 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-emerald-500/40 bg-background text-[10px] text-emerald-400 md:flex">→</div>
            )}
          </div>
        ))}
      </div>

      <SectionTitle id="stats" title="Repo at a glance" sub="Extracted from the repository's own documentation and code. None of these are to-do lists: unsigned gates and open questions are reserved for named humans by design, and the money-path count is an architecture fact, not progress." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-card/70 p-4">
            <div className="text-2xl font-bold tracking-tight text-emerald-300">{s.value}</div>
            <div className="text-xs font-medium text-foreground/90">{s.label}</div>
            <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{s.note}</div>
          </div>
        ))}
      </div>

      <SectionTitle id="phases" title="Build phases" sub="One phase chunk per response, stopping at every gate for the operator's continue (checkpoint mode: pause)." />
      <SimpleTable
        head={['Phase', 'Scope', 'Status']}
        rows={PHASES.map((p) => [
          <span key="p" className="font-mono font-semibold text-emerald-300">{p.id}</span>,
          <span key="s"><strong>{p.name}</strong> — {p.scope}</span>,
          <Chip key="st" tone={p.color === 'emerald' ? 'emerald' : p.color === 'amber' ? 'amber' : 'slate'}>{p.status}</Chip>,
        ])}
      />

      <SectionTitle id="rules" title="Non-negotiables" sub="CLAUDE.md standing rules, loaded every session. The guard hook enforces the first three mechanically (22/32 self-tests pass)." />
      <div className="grid gap-3 md:grid-cols-2">
        {NON_NEGOTIABLES.map((n) => (
          <div key={n.id} className="rounded-xl border border-white/10 bg-card/70 p-4">
            <div className="flex items-center gap-2">
              <Mono className="rounded bg-white/5 px-1.5 py-0.5 text-emerald-300">{n.id}</Mono>
              <div className="text-sm font-semibold">{n.title}</div>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{n.detail}</p>
          </div>
        ))}
      </div>

      <SectionTitle id="money" title="Money invariants" sub="Zero tolerance, enforced in code, tests and at runtime. The adapter in the repo enforces them; this demo simulates them with integer minor units." />
      <Panel title="CLAUDE.md — money invariants">
        <Bullets items={MONEY_INVARIANTS} />
      </Panel>

      <SectionTitle id="verify" title="How the build is verified" sub="Generation and verification blocks are separate; a fresh-context verifier never sees the author's reasoning." />
      <div className="grid gap-3 lg:grid-cols-3">
        {VERIFICATION_LOOP.lenses.map((l) => (
          <div key={l.id} className="rounded-xl border border-white/10 bg-card/70 p-4">
            <div className="flex items-center justify-between">
              <div className="font-mono text-sm font-semibold text-emerald-300">{l.id}</div>
              <Chip tone="teal">{l.verdicts}</Chip>
            </div>
            <div className="mt-1 text-xs font-medium">{l.who}</div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{l.what}</p>
          </div>
        ))}
      </div>
      <Panel className="mt-3" title="loop rules">
        <Bullets items={VERIFICATION_LOOP.rules} />
      </Panel>

      <SectionTitle id="repo" title="Repository" sub="Testnet only (chain ID 5042002) until every G-M gate in docs/GATES.md is signed. The sole runtime dependency is viem." />
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Stack</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <div><span className="text-foreground">Repo:</span> <Mono>{REPO_META.repo}</Mono></div>
            <div><span className="text-foreground">Package:</span> <Mono>{REPO_META.package}</Mono></div>
            <div><span className="text-foreground">Language:</span> {REPO_META.language}</div>
            <div><span className="text-foreground">Runtime deps:</span> <Mono>{REPO_META.runtimeDeps}</Mono></div>
            <div><span className="text-foreground">Dev deps:</span> {REPO_META.devDeps}</div>
            <div><span className="text-foreground">Code:</span> {REPO_META.tests}</div>
            <div><span className="text-foreground">Build:</span> <span className="text-emerald-400">{REPO_META.build}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Parties</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <div><span className="text-foreground">Product (CBS):</span> {REPO_META.flow} — Raayl is the system of record</div>
            <div><span className="text-foreground">Custody:</span> {REPO_META.custody}</div>
            <div><span className="text-foreground">Liquidity:</span> {REPO_META.liquidity}</div>
            <div><span className="text-foreground">Threat model:</span> {THREAT_MODEL.method}; {THREAT_MODEL.detections.slice(0, 60)}…</div>
            <div><span className="text-foreground">License:</span> {REPO_META.license}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
