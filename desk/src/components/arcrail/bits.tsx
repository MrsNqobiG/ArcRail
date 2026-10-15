'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { ReactNode } from 'react'

export function Mono({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return <span title={title} className={cn('font-mono text-[11px] leading-relaxed tracking-tight', className)}>{children}</span>
}

export function Chip({ children, tone = 'slate', className }: { children: ReactNode; tone?: 'slate' | 'emerald' | 'amber' | 'rose' | 'teal' | 'violet'; className?: string }) {
  const tones: Record<string, string> = {
    slate: 'bg-white/5 text-muted-foreground border-white/10',
    emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    rose: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    teal: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
    violet: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium', tones[tone], className)}>
      {children}
    </span>
  )
}

const STATUS_TONES: Record<string, 'emerald' | 'amber' | 'teal' | 'rose' | 'violet' | 'slate'> = {
  PENDING: 'amber', PROCESSING: 'teal', SETTLED: 'emerald', FAILED: 'rose', REVERSED: 'violet',
  COMPLETED: 'emerald', CREATED: 'slate', PENDING_APPROVAL: 'amber', APPROVED: 'teal', SUBMITTED: 'teal',
  CONFIRMING: 'teal', REJECTED: 'rose', EXPIRED: 'rose', CANCELLED: 'rose', OPEN: 'amber', CLOSED: 'slate',
}

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  const tone = STATUS_TONES[value] ?? 'slate'
  return <Chip tone={tone} className={className}>{value.replace(/_/g, ' ')}</Chip>
}

export function SectionTitle({ id, title, sub, right }: { id?: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 mt-10 first:mt-0 scroll-mt-24" id={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-emerald-500/80" />
          {title}
        </h2>
        {right}
      </div>
      {sub ? <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{sub}</p> : null}
    </div>
  )
}

export function Panel({ children, className, title, right }: { children: ReactNode; className?: string; title?: ReactNode; right?: ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-white/10 bg-card/70 backdrop-blur-sm', className)}>
      {title ? (
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
          {right}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </div>
  )
}

export function KV({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/5 py-1.5 last:border-0">
      <span className="shrink-0 text-xs text-muted-foreground">{k}</span>
      <span className={cn('text-right text-xs', mono && 'font-mono')}>{v}</span>
    </div>
  )
}

export function RefTabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            active === t.id ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40' : 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Bullets({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn('space-y-1.5', className)}>
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground/90">
          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-500/70" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

export function SimpleTable({ head, rows, className }: { head: string[]; rows: ReactNode[][]; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-xl border border-white/10', className)}>
      <table className="w-full min-w-[560px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top leading-relaxed">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export { Badge }
