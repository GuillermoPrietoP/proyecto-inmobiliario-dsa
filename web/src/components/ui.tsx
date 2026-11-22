/**
 * Primitivas de UI del sistema de diseño DSA (tokens del mockup).
 * Accesibles por teclado, con etiquetas además de color (architecture.md §11.4/11.6).
 */
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import clsx from 'clsx'
import {
  createContext,
  useContext,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Link } from 'react-router-dom'

/* ------------------------------------------------------------------ iconos */

const PATHS: Record<string, string> = {
  info: 'M12 16v-4m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  warning: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  check: 'M20 6L9 17l-5-5',
  close: 'M18 6L6 18M6 6l12 12',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  arrowRight: 'M5 12h14M12 5l7 7-7 7',
  chevron: 'M6 9l6 6 6-6',
  external: 'M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  search: 'M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z',
  lock: 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4',
  chart: 'M3 3v18h18M7 14l4-4 4 4 5-6',
  doc: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  spark: 'M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z',
}

export function Icon({ name, className = 'h-4 w-4' }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  )
}

/* -------------------------------------------------------------------- card */

export function Card({
  children,
  className,
  pad = true,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  pad?: boolean
  as?: 'div' | 'article' | 'section' | 'li'
}) {
  return <Tag className={clsx('card', pad && 'card-pad', className)}>{children}</Tag>
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
  id,
  level = 2,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  id?: string
  level?: 2 | 3
}) {
  const auto = useId()
  const headingId = id ?? auto
  const H = level === 2 ? 'h2' : 'h3'
  return (
    <section aria-labelledby={headingId} className={clsx('space-y-3', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <H id={headingId} className={level === 2 ? 'h2 text-navy' : 'h3 text-navy'}>
            {title}
          </H>
          {description ? <p className="nota mt-1 max-w-3xl">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

/* ------------------------------------------------------------------- badge */

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'method'

const TONE_BADGE: Record<Tone, string> = {
  neutral: 'bg-navy-50 text-navy border-lightblue',
  info: 'bg-[#eaf3fc] text-[#1b5f9e] border-[#bcd9f2]',
  success: 'bg-[#e8f7f1] text-[#1c7a58] border-[#bfe6d6]',
  warning: 'bg-[#fff3e6] text-[#a35a12] border-[#ffd9b0]',
  danger: 'bg-[#fdeceb] text-[#a3352d] border-[#f4c7c3]',
  method: 'bg-[#f0eefb] text-[#4b4196] border-[#d6d1f0]',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
  icon,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
  icon?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[0.72rem] font-semibold whitespace-nowrap',
        TONE_BADGE[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} className="h-3 w-3" /> : null}
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'method'

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-navy text-white hover:bg-navy-700 border-navy',
  secondary: 'bg-white text-navy hover:bg-navy-50 border-lightblue',
  ghost: 'bg-transparent text-navy hover:bg-navy-50 border-transparent',
  danger: 'bg-[#c8453c] text-white hover:bg-[#a3352d] border-[#c8453c]',
  method: 'bg-purple-mock text-white hover:bg-[#5b50ad] border-purple-mock',
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  className,
  icon,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  icon?: string
}) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-[10px] border font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' ? 'px-2.5 py-1 text-[0.78rem]' : 'px-3.5 py-2 text-sm',
        BUTTON_VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {icon ? <Icon name={icon} className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> : null}
      {children}
    </button>
  )
}

export function LinkButton({
  to,
  children,
  variant = 'secondary',
  size = 'md',
  className,
  icon,
}: {
  to: string
  children: ReactNode
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  className?: string
  icon?: string
}) {
  return (
    <Link
      to={to}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-[10px] border font-semibold transition-colors',
        size === 'sm' ? 'px-2.5 py-1 text-[0.78rem]' : 'px-3.5 py-2 text-sm',
        BUTTON_VARIANT[variant],
        className,
      )}
    >
      {icon ? <Icon name={icon} className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> : null}
      {children}
    </Link>
  )
}

/* ------------------------------------------------------------------ banner */

const TONE_BANNER: Record<Tone, { box: string; icon: string; iconName: string }> = {
  neutral: { box: 'bg-navy-50 border-lightblue text-navy', icon: 'text-slate-mock', iconName: 'info' },
  info: { box: 'bg-[#eaf3fc] border-[#bcd9f2] text-[#17456f]', icon: 'text-blue-mock', iconName: 'info' },
  success: { box: 'bg-[#e8f7f1] border-[#bfe6d6] text-[#145c43]', icon: 'text-green-mock', iconName: 'check' },
  warning: { box: 'bg-[#fff3e6] border-[#ffd9b0] text-[#7d4409]', icon: 'text-orange-mock', iconName: 'warning' },
  danger: { box: 'bg-[#fdeceb] border-[#f4c7c3] text-[#7f2a24]', icon: 'text-red-mock', iconName: 'warning' },
  method: { box: 'bg-[#f0eefb] border-[#d6d1f0] text-[#3d3579]', icon: 'text-purple-mock', iconName: 'spark' },
}

export function Banner({
  tone = 'info',
  title,
  children,
  className,
  compact = false,
}: {
  tone?: Tone
  title?: ReactNode
  children?: ReactNode
  className?: string
  compact?: boolean
}) {
  const t = TONE_BANNER[tone]
  return (
    <div
      className={clsx('flex gap-2.5 rounded-[12px] border', compact ? 'px-3 py-2' : 'px-3.5 py-3', t.box, className)}
      role={tone === 'danger' || tone === 'warning' ? 'note' : undefined}
    >
      <Icon name={t.iconName} className={clsx('mt-0.5 h-4 w-4 shrink-0', t.icon)} />
      <div className="min-w-0 text-[0.83rem] leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? 'mt-0.5' : undefined}>{children}</div> : null}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- tooltip */

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200} skipDelayDuration={400}>
      {children}
    </TooltipPrimitive.Provider>
  )
}

export function InfoTip({ text, label = 'Más información' }: { text: ReactNode; label?: string }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-lightblue text-slate-mock hover:bg-navy-50 hover:text-navy"
        >
          <span className="text-[0.62rem] font-bold leading-none">i</span>
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-50 max-w-xs rounded-[10px] border border-line bg-white px-3 py-2 text-[0.78rem] leading-snug text-navy shadow-[var(--shadow-pop)]"
        >
          {text}
          <TooltipPrimitive.Arrow className="fill-white" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

/* --------------------------------------------------------------------- kpi */

export function KpiCard({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  help,
  tone = 'neutral',
  footer,
}: {
  label: string
  value: ReactNode
  unit?: string
  delta?: number | null
  deltaLabel?: string
  help?: string
  tone?: Tone
  footer?: ReactNode
}) {
  const deltaTone = delta == null ? 'neutral' : delta > 0 ? 'success' : delta < 0 ? 'warning' : 'neutral'
  return (
    <Card className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="label">{label}</span>
        {help ? <InfoTip text={help} /> : null}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={clsx('text-[1.45rem] font-bold leading-tight tracking-tight', tone === 'danger' ? 'text-red-mock' : 'text-navy')}>
          {value}
        </span>
        {unit ? <span className="text-[0.78rem] font-medium text-slate-mock">{unit}</span> : null}
      </div>
      {delta !== undefined ? (
        <div className="flex items-center gap-1.5">
          <Badge tone={deltaTone as Tone}>
            {delta == null ? 'n.d.' : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`}
          </Badge>
          {deltaLabel ? <span className="nota">{deltaLabel}</span> : null}
        </div>
      ) : null}
      {footer ? <div className="nota mt-0.5">{footer}</div> : null}
    </Card>
  )
}

/* ------------------------------------------------------------------ campos */

export function Field({
  label,
  htmlFor,
  help,
  error,
  children,
  className,
  hint,
}: {
  label: ReactNode
  htmlFor?: string
  help?: ReactNode
  error?: string | null
  children: ReactNode
  className?: string
  hint?: ReactNode
}) {
  return (
    <div className={clsx('space-y-1', className)}>
      <div className="flex items-center gap-1.5">
        <label htmlFor={htmlFor} className="text-[0.8rem] font-semibold text-navy">
          {label}
        </label>
        {help ? <InfoTip text={help} /> : null}
        {hint ? <span className="nota ml-auto">{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <p className="text-[0.75rem] font-medium text-red-mock" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

const inputBase =
  'w-full rounded-[10px] border border-line bg-white px-2.5 py-1.5 text-sm text-navy placeholder:text-slate-mock/70 focus:border-blue-mock disabled:bg-navy-50 disabled:text-slate-mock'

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(inputBase, 'cursor-pointer pr-8', className)} {...rest}>
      {children}
    </select>
  )
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(inputBase, className)} {...rest} />
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(inputBase, 'min-h-[70px] resize-y', className)} {...rest} />
}

export function NumberInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="number" inputMode="decimal" className={clsx(inputBase, 'tabular-nums', className)} {...rest} />
}

export function Checkbox({
  label,
  description,
  className,
  id,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const auto = useId()
  const inputId = id ?? auto
  return (
    <div className={clsx('flex items-start gap-2', className)}>
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#2e86d1]"
        {...rest}
      />
      <label htmlFor={inputId} className="cursor-pointer text-[0.83rem] leading-snug text-navy">
        <span className="font-medium">{label}</span>
        {description ? <span className="nota block">{description}</span> : null}
      </label>
    </div>
  )
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  id,
  format,
  disabled,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  id?: string
  format?: (v: number) => string
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-pill bg-lightblue accent-[#2e86d1] disabled:cursor-not-allowed"
      />
      <span className="w-24 shrink-0 text-right text-[0.78rem] font-semibold tabular-nums text-navy">
        {format ? format(value) : value.toLocaleString('es-CO')}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------- chips */

export function Chip({
  active,
  onClick,
  children,
  disabled,
  title,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={title}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-[0.8rem] font-semibold transition-colors',
        active ? 'border-navy bg-navy text-white' : 'border-lightblue bg-white text-navy hover:bg-navy-50',
        disabled && 'cursor-not-allowed opacity-45',
      )}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ dialog */

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-navy/35 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className={clsx(
            'fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[16px] border border-line bg-white p-5 shadow-[var(--shadow-pop)]',
            wide ? 'max-w-3xl' : 'max-w-xl',
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="h3 text-navy">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="nota mt-1">{description}</DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="sm" icon="close" aria-label="Cerrar" className="shrink-0" />
            </DialogPrimitive.Close>
          </div>
          <div className="mt-4 space-y-3">{children}</div>
          {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/* --------------------------------------------------------------- accordion */

export function Accordion({
  items,
  className,
}: {
  items: Array<{ id: string; title: ReactNode; content: ReactNode; badge?: ReactNode }>
  className?: string
}) {
  return (
    <AccordionPrimitive.Root type="multiple" className={clsx('card divide-y divide-line', className)}>
      {items.map((it) => (
        <AccordionPrimitive.Item key={it.id} value={it.id}>
          <AccordionPrimitive.Header className="flex">
            <AccordionPrimitive.Trigger className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[0.9rem] font-semibold text-navy hover:bg-navy-50">
              <span className="flex items-center gap-2">
                {it.title}
                {it.badge}
              </span>
              <Icon name="chevron" className="h-4 w-4 shrink-0 text-slate-mock transition-transform group-data-[state=open]:rotate-180" />
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>
          <AccordionPrimitive.Content className="overflow-hidden px-4 pb-4 text-[0.85rem] leading-relaxed text-navy data-[state=closed]:animate-none">
            {it.content}
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      ))}
    </AccordionPrimitive.Root>
  )
}

/* -------------------------------------------------------------------- tabs */

export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Array<{ id: string; label: ReactNode; badge?: ReactNode }>
  value: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div role="tablist" aria-orientation="horizontal" className={clsx('flex flex-wrap gap-1 rounded-[12px] border border-line bg-white p-1', className)}>
      {tabs.map((t) => {
        const activo = t.id === value
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={activo}
            onClick={() => onChange(t.id)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[0.82rem] font-semibold transition-colors',
              activo ? 'bg-navy text-white' : 'text-navy hover:bg-navy-50',
            )}
          >
            {t.label}
            {t.badge}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------- tabla */

export interface Columna<T> {
  id: string
  header: ReactNode
  cell: (row: T, index: number) => ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
  help?: string
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  empty = 'Sin datos para esta selección.',
  dense = false,
  highlight,
}: {
  columns: Array<Columna<T>>
  rows: T[]
  rowKey: (row: T, index: number) => string
  caption?: string
  empty?: ReactNode
  dense?: boolean
  highlight?: (row: T) => boolean
}) {
  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>
  return (
    <div className="scroll-x card">
      <table className={clsx('w-full border-collapse text-[0.83rem]', dense && 'tabla-densa')}>
        {caption ? <caption className="nota px-3 py-2 text-left">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-line bg-navy-50">
            {columns.map((c) => (
              <th
                key={c.id}
                scope="col"
                className={clsx(
                  'px-3 py-2 text-[0.72rem] font-bold uppercase tracking-wide text-slate-mock',
                  c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                  c.className,
                )}
              >
                <span className="inline-flex items-center gap-1">
                  {c.header}
                  {c.help ? <InfoTip text={c.help} /> : null}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              className={clsx('border-b border-line/70 last:border-0', highlight?.(row) ? 'bg-[#f4f9ff]' : i % 2 ? 'bg-canvas/40' : 'bg-white')}
            >
              {columns.map((c) => (
                <td
                  key={c.id}
                  className={clsx(
                    'px-3 py-2 align-top text-navy',
                    c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : 'text-left',
                    c.className,
                  )}
                >
                  {c.cell(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ estados */

export function Loading({ label = 'Cargando datos…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-8 text-slate-mock" role="status" aria-live="polite">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-lightblue border-t-blue-mock" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-[10px] bg-lightblue/50', className)} aria-hidden="true" />
}

export function ErrorState({
  title = 'No se pudieron cargar los datos',
  detail,
  onRetry,
}: {
  title?: string
  detail?: ReactNode
  onRetry?: () => void
}) {
  return (
    <Card className="space-y-3">
      <Banner tone="danger" title={title}>
        {detail ?? 'Los JSON de /data/v1 no están disponibles o no cumplen el contrato.'}
      </Banner>
      <div className="flex flex-wrap gap-2">
        {onRetry ? (
          <Button variant="primary" onClick={onRetry} icon="arrowRight">
            Reintentar
          </Button>
        ) : null}
        <LinkButton to="/cobertura">Ver cobertura y metodología</LinkButton>
      </div>
      <p className="nota">
        Para regenerar los datos: <code className="rounded bg-navy-50 px-1">python pipeline/preprocess.py</code>
      </p>
    </Card>
  )
}

export function EmptyState({ children, title }: { children?: ReactNode; title?: string }) {
  return (
    <div className="card flex flex-col items-center gap-1 px-4 py-8 text-center">
      <Icon name="info" className="h-5 w-5 text-lightblue" />
      {title ? <p className="text-sm font-semibold text-navy">{title}</p> : null}
      <p className="nota max-w-md">{children ?? 'Sin datos para esta selección.'}</p>
    </div>
  )
}

/* --------------------------------------------------------------- sparkline */

export function Sparkline({
  values,
  width = 120,
  height = 30,
  color = '#2e86d1',
  label,
}: {
  values: Array<number | null>
  width?: number
  height?: number
  color?: string
  label?: string
}) {
  const validos = values.filter((v): v is number => v != null && Number.isFinite(v))
  if (validos.length < 2) {
    return <span className="nota">serie insuficiente</span>
  }
  const min = Math.min(...validos)
  const max = Math.max(...validos)
  const span = max - min || 1
  const paso = width / (values.length - 1)
  const puntos = values.map((v, i) =>
    v == null ? null : ([i * paso, height - 3 - ((v - min) / span) * (height - 6)] as const),
  )
  const segmentos: string[] = []
  let actual: string[] = []
  for (const p of puntos) {
    if (p == null) {
      if (actual.length > 1) segmentos.push(actual.join(' '))
      actual = []
    } else {
      actual.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    }
  }
  if (actual.length > 1) segmentos.push(actual.join(' '))
  const ultimo = [...puntos].reverse().find((p) => p != null)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label ?? 'Tendencia de la serie'} className="overflow-visible">
      {segmentos.map((s, i) => (
        <polyline key={i} points={s} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {ultimo ? <circle cx={ultimo[0]} cy={ultimo[1]} r={2.4} fill={color} /> : null}
    </svg>
  )
}

/* ------------------------------------------------------------------ varios */

export function ProgressBar({ value, max = 100, tone = 'info' }: { value: number; max?: number; tone?: Tone }) {
  const pctv = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const color = tone === 'success' ? '#2bb07f' : tone === 'warning' ? '#ff8a28' : tone === 'danger' ? '#c8453c' : '#2e86d1'
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-pill bg-lightblue/60" role="progressbar" aria-valuenow={Math.round(pctv)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-pill transition-[width]" style={{ width: `${pctv}%`, background: color }} />
    </div>
  )
}

export function DefinitionList({ items }: { items: Array<{ term: ReactNode; detail: ReactNode }> }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {items.map((it, i) => (
        <div key={i} className="flex flex-col border-b border-line/70 pb-1.5">
          <dt className="label">{it.term}</dt>
          <dd className="text-[0.88rem] font-medium text-navy">{it.detail}</dd>
        </div>
      ))}
    </dl>
  )
}

const ToggleCtx = createContext<{ open: boolean; toggle: () => void } | null>(null)

export function Collapsible({ title, children }: { title: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <ToggleCtx.Provider value={{ open, toggle: () => setOpen((v) => !v) }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="enlace inline-flex items-center gap-1 text-[0.8rem] font-semibold">
        <Icon name="chevron" className={clsx('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        {title}
      </button>
      {open ? <div className="mt-2">{children}</div> : null}
    </ToggleCtx.Provider>
  )
}

export function useCollapsible() {
  return useContext(ToggleCtx)
}
