'use client'

import { useState } from 'react'
import { Chip, Mono, Panel, SectionTitle, RefTabs } from '../bits'
import { MODULES } from '@/lib/arcrail/data/facts'
import { BUILD_UNITS, NOVA_UNITS } from '@/lib/arcrail/data/governance'
import { cn } from '@/lib/utils'

export function ModulesView() {
  const [tab, setTab] = useState('map')
  const moneyPath = MODULES.filter((m) => m.moneyPath)
  const totalExports = MODULES.reduce((s, m) => s + m.exports, 0)

  return (
    <div>
      <SectionTitle
        id="modules"
        title={`Module map — ${MODULES.length} domains, 109 files`}
        sub="Everything Arc-specific lives behind the network abstraction (network = ARC, asset = USDC), inside the Arc adapter only, so other networks can be added later. A second, fake network adapter passes the same tests."
        right={<Chip tone="emerald">{moneyPath.length} money-path · {totalExports} exports</Chip>}
      />
      <RefTabs
        tabs={[
          { id: 'map', label: 'src/ map' },
          { id: 'mp', label: 'Money path (MONEY_PATH.md)' },
          { id: 'ladder', label: 'Build ladder U1–U20' },
          { id: 'nova', label: 'NOVA code units' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'map' && (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((m) => (
            <div key={m.domain} className={cn('rounded-xl border p-4', m.moneyPath ? 'border-emerald-500/25 bg-emerald-500/[0.04]' : 'border-white/10 bg-card/70')}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Mono className="font-bold text-sm text-emerald-300">{m.label}</Mono>
                  {m.moneyPath && <Chip tone="emerald">money-path</Chip>}
                </div>
                <Chip tone="slate">{m.exports} exports</Chip>
              </div>
              <Mono className="mt-1 block text-[10px] text-muted-foreground">{m.paths}</Mono>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{m.role}</p>
              <Chip tone="teal" className="mt-2">{m.unit}</Chip>
            </div>
          ))}
        </div>
      )}

      {tab === 'mp' && (
        <div className="mt-4 space-y-3">
          <Panel title={'what "money-path" means'}>
            <p className="text-xs leading-relaxed text-muted-foreground">
              MC-01 (float lint), MC-07 (100% reachable-branch coverage) and MC-08 (mutation ≥ 90) apply to exactly the listed paths.
              A test parses MONEY_PATH.md and fails CI if a listed path or anchor is missing, if an item has no path, or if the Stryker/coverage/lint
              configuration does not cover exactly the listed paths. The import-graph closure of the listed paths may not reach an unlisted module at runtime.
            </p>
          </Panel>
          <div className="grid gap-3 md:grid-cols-2">
            {moneyPath.map((m) => (
              <div key={m.domain} className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-4">
                <div className="flex items-center justify-between gap-2">
                  <Mono className="font-bold text-sm text-emerald-300">{m.label}</Mono>
                  <Chip tone="emerald">money-path</Chip>
                </div>
                <Mono className="mt-1 block text-[10px] text-muted-foreground">{m.paths}</Mono>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{m.role}</p>
              </div>
            ))}
          </div>
          <Panel title="Number allow-list (MC-01)">
            <Mono className="block leading-relaxed text-muted-foreground">
              {'On a money path, `number` may appear only on:\n  CbsPrecision (the brand) · cbsPrecision() constructor + its raw argument\n  Eip1559ValueSend.chainId (the 5042002 pin, C-01/C-56)\n  ChainReader.chainId · ReadResult.code (JSON-RPC error codes, C-40…C-42)\nNo amount is ever a number operand. Amounts are branded integers.'}
            </Mono>
          </Panel>
        </div>
      )}

      {tab === 'ladder' && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {BUILD_UNITS.map((u, i) => (
            <div key={u} className="flex items-center gap-2 rounded-lg border border-white/10 bg-card/70 px-3 py-2">
              <Mono className={cn('shrink-0 rounded px-1.5 py-0.5', i === 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-muted-foreground')}>{i === 0 ? 'U1 ✓' : `U${i + 1}`}</Mono>
              <span className="text-xs">{u.replace(/^U\d+ /, '')}</span>
            </div>
          ))}
          <Panel className="sm:col-span-2 lg:col-span-4" title="PoC slice order">
            <Mono className="text-emerald-300">U1 → U2 → U3 → U17 → U18 → U9 → U19 (USDC) → U10 → U16 → U12</Mono>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">U20 (pilot profile) is built disabled. P3-U1 (src/amounts) is frozen — the only code unit that has completed its verifier pass so far.</p>
          </Panel>
        </div>
      )}

      {tab === 'nova' && (
        <div className="mt-4 space-y-2">
          {NOVA_UNITS.map((n) => (
            <div key={n.unit} className="rounded-xl border border-white/10 bg-card/70 p-4">
              <Mono className="font-bold text-sm text-emerald-300">{n.unit}</Mono>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{n.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
