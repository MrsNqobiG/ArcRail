'use client'

import { Chip, Mono, Panel, SectionTitle, SimpleTable, Bullets } from '../bits'
import { RISKS, RISK_BLIND_SPOTS, THREAT_MODEL, FAILURE_PATHS } from '@/lib/arcrail/data/facts'

export function RisksView() {
  return (
    <div>
      <SectionTitle
        id="risks"
        title="Risk register & threat model"
        sub="Top six risks with detection methods; blind-risk entries must use reconstruction or an external anchor. Every [R] detection names one concrete mutant, and its executor sits outside the compromise domain."
      />

      <div className="grid gap-3 md:grid-cols-2">
        {RISKS.map((r) => (
          <div key={r.id} className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Chip tone="rose">{r.id}</Chip>
                <div className="text-sm font-semibold leading-tight">{r.title}</div>
              </div>
              <Chip tone="amber">{r.severity}</Chip>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{r.note}</p>
            <Chip tone="teal" className="mt-2">owner: {r.owner}</Chip>
          </div>
        ))}
      </div>

      <SectionTitle id="blind" title="Below the cut-off — RB-1…RB-16" sub="Blind spots tracked even when no detection exists yet." />
      <Panel>
        <div className="flex flex-wrap gap-1.5">
          {RISK_BLIND_SPOTS.map((b) => <Chip key={b} tone="slate">{b}</Chip>)}
        </div>
      </Panel>

      <SectionTitle id="threat" title="Threat model — STRIDE + LINDDUN" sub={THREAT_MODEL.method + '. The independent monitor (ADR-008 option B) is woven throughout: a separate trust domain whose ALL_CLEAR attestation the signer requires.'} />
      <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
        <Panel title="categories covered">
          <div className="flex flex-wrap gap-1.5">
            {THREAT_MODEL.categories.map((c) => <Chip key={c} tone="teal">{c}</Chip>)}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Trust boundaries: the CBS boundary, the signer, own nodes, reference RPC providers, operators, and the supply chain.
            15 G1 residuals are listed for the human to accept.
          </p>
        </Panel>
        <Panel title="29 detections (DR-01…DR-29)">
          <p className="text-[11px] leading-relaxed text-muted-foreground">{THREAT_MODEL.detections}</p>
        </Panel>
      </div>

      <SectionTitle id="residuals" title="G1 residuals (15)" sub="What is left open for a human at the design gate." />
      <Panel>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{THREAT_MODEL.residuals}</p>
      </Panel>

      <SectionTitle id="failures" title="Failure paths F-1 … F-19" sub="Every failure and compensation path is designed, tested and posted: CBS timeout, RPC disagreement, stuck nonce, blocklist revert, screening hit, travel-rule data missing, chain stall." />
      <div className="space-y-2">
        {FAILURE_PATHS.map((f) => (
          <div key={f.id} className={`rounded-xl border p-4 ${f.pause ? 'border-rose-500/30 bg-rose-500/[0.04]' : 'border-white/10 bg-card/70'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Chip tone={f.pause ? 'rose' : 'teal'}>{f.id}</Chip>
                <div className="text-sm font-semibold">{f.title}</div>
              </div>
              {f.pause && <Chip tone="rose">PAUSE / QUARANTINE</Chip>}
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{f.detail}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
