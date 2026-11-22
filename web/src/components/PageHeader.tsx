import type { ReactNode } from 'react'
import { Badge } from '@/components/ui'

export function PageHeader({
  eyebrow,
  title,
  lead,
  badges,
  actions,
}: {
  eyebrow?: string
  title: ReactNode
  lead?: ReactNode
  badges?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? <p className="label mb-1">{eyebrow}</p> : null}
        <h1 className="h1 text-navy">{title}</h1>
        {lead ? <p className="mt-1.5 text-[0.92rem] leading-relaxed text-slate-mock">{lead}</p> : null}
        {badges ? <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function PreguntaRectora({ children }: { children?: ReactNode }) {
  return (
    <p className="rounded-[12px] border border-lightblue bg-navy-50 px-3.5 py-2.5 text-[0.88rem] font-medium leading-snug text-navy">
      {children}
    </p>
  )
}

export function NotaMetodo({ children }: { children: ReactNode }) {
  return (
    <p className="nota flex items-start gap-1.5">
      <Badge tone="method">método</Badge>
      <span>{children}</span>
    </p>
  )
}
