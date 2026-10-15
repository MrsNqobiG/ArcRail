'use client'

import { Chip, Mono, Panel, SectionTitle, SimpleTable, Bullets } from '../bits'
import { ARC_CONSTANTS, CONSTANTS_META, DFNS_FACTS, OPEN_QUESTIONS, API_RULE } from '@/lib/arcrail/data/facts'

export function FactsView() {
  return (
    <div>
      <SectionTitle
        id="facts"
        title="Arc facts — constants, DFNS & open questions"
        sub="Never guess: any fact about Arc, Circle, DFNS, VALR, Raayl, the CBS or South African regulation is verified from a primary source and cited with URL and date, or it becomes an open question."
      />

      <SectionTitle id="constants" title={`Arc constants (${CONSTANTS_META.rows} rows, ${CONSTANTS_META.ids})`} sub={`All accessed ${CONSTANTS_META.accessed} and cited with source URL and quote. ${CONSTANTS_META.mismatches}`} />
      <SimpleTable
        head={['ID', 'Value', 'Why it matters']}
        rows={ARC_CONSTANTS.map((c) => [
          <Chip key="id" tone="emerald">{c.id}</Chip>,
          <Mono key="v" className="text-foreground">{c.value}</Mono>,
          <span key="n" className="text-muted-foreground">{c.note}</span>,
        ])}
      />

      <SectionTitle id="dfns" title="DFNS — custody, policies & webhooks" sub="The company's existing DFNS organisation. No second wallet, custody or approval system is built; read-only on the DFNS org until G1b." />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="networks">
          {DFNS_FACTS.networks.map((n) => (
            <div key={n.id} className="border-b border-white/5 py-2 last:border-0">
              <Mono className="font-bold text-emerald-300">{n.id}</Mono>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{n.note}</p>
            </div>
          ))}
        </Panel>
        <Panel title="wallet & transfer body">
          <p className="text-[11px] leading-relaxed text-muted-foreground">{DFNS_FACTS.wallet}</p>
          <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2.5">
            <Mono className="text-[10px] leading-relaxed text-muted-foreground">{DFNS_FACTS.transferBody}</Mono>
          </div>
        </Panel>
        <Panel title="policies (POL-1…POL-4)">
          {DFNS_FACTS.policies.map((p) => (
            <div key={p.id} className="border-b border-white/5 py-2 last:border-0">
              <div className="flex items-center gap-2">
                <Chip tone="amber">{p.id}</Chip>
                <Mono className="text-[10px]">{p.rule}</Mono>
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{p.note}</p>
            </div>
          ))}
        </Panel>
        <Panel title="service accounts (least privilege)">
          {DFNS_FACTS.serviceAccounts.map((s) => (
            <div key={s.id} className="border-b border-white/5 py-2 last:border-0">
              <Mono className="font-bold text-emerald-300">{s.id}</Mono>
              <div className="mt-0.5 font-mono text-[10px] leading-relaxed text-muted-foreground">{s.perms}</div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{s.note}</p>
            </div>
          ))}
        </Panel>
      </div>
      <Panel className="mt-3" title="webhooks">
        <Bullets items={DFNS_FACTS.webhooks} />
      </Panel>

      <SectionTitle id="questions" title={`Open questions — ${OPEN_QUESTIONS.open} open of ${OPEN_QUESTIONS.total}`} sub="Any gap a plausible value could fill becomes a question instead. Notable: Q-N1 blocks the live slice; Q-N20/Q-N21 define the nonce semantics after a hash-less Failed." />
      <div className="grid gap-3 md:grid-cols-2">
        {OPEN_QUESTIONS.categories.map((c) => (
          <div key={c.id} className="rounded-xl border border-white/10 bg-card/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <Chip tone="amber">{c.id}</Chip>
              <Mono className="text-lg font-bold text-amber-300">{c.n}</Mono>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{c.note}</p>
          </div>
        ))}
        <Panel title="statuses">
          <Bullets items={[
            'OPEN — waiting for a human or a primary source',
            'ANSWERED — with source and date recorded',
            'WITHDRAWN — no longer relevant',
            'Decisions deferred to G1 are tracked in a separate section',
          ]} />
        </Panel>
      </div>

      <SectionTitle id="money-safety" title="Money-safety in one paragraph" />
      <Panel>
        <p className="text-sm leading-relaxed text-foreground/90">
          Integer arithmetic only, with branded types — <Mono className="text-emerald-300">CbsMinor</Mono>, <Mono className="text-emerald-300">UsdcUnits</Mono>,
          <Mono className="text-emerald-300"> NativeWei</Mono>, one <Mono className="text-emerald-300">FiatMinor&lt;CCY&gt;</Mono> per payout currency; mixing them is a compile error.
          One conversion module with an explicit rounding policy; sub-unit dust goes to a named suspense account with a record, never silently dropped.
          Every quote leg is a separate, balanced posting; gas paid in USDC is posted too. {API_RULE}
        </p>
      </Panel>
    </div>
  )
}
