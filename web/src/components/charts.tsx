/**
 * Gráficos interactivos (Recharts + SVG propio) con alternativa tabular accesible.
 * Cada gráfico declara su resumen en `aria-label` y ofrece la tabla de datos.
 */
import { useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { Collapsible, DataTable, type Columna } from '@/components/ui'
import { formatCOPCompacto, formatNumero, formatPct } from '@/lib/format'
import { COLOR, colorMunicipio } from '@/lib/palette'
import type { Distribucion } from '@/types/domain'

const axisProps = {
  stroke: COLOR.line,
  tick: { fill: COLOR.slate, fontSize: 11 },
  tickLine: false,
} as const

function TooltipBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-line bg-white px-3 py-2 text-[0.78rem] shadow-[var(--shadow-pop)]">
      {children}
    </div>
  )
}

export function ChartFrame({
  title,
  note,
  summary,
  height = 280,
  children,
  table,
  actions,
}: {
  title: string
  note?: ReactNode
  summary: string
  height?: number
  children: ReactNode
  table?: ReactNode
  actions?: ReactNode
}) {
  return (
    <figure className="card card-pad m-0 space-y-2">
      <figcaption className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="h3 text-navy">{title}</h3>
          {note ? <p className="nota mt-0.5 max-w-2xl">{note}</p> : null}
        </div>
        {actions}
      </figcaption>
      <div role="img" aria-label={summary} style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
      {table ? <Collapsible title="Ver tabla de datos">{table}</Collapsible> : null}
    </figure>
  )
}

/* ------------------------------------------------------- series anuales */

export interface PuntoSerie {
  anio: number
  [serie: string]: number | null
}

export function TrendChart({
  data,
  series,
  title,
  note,
  summary,
  height = 280,
  formato = 'numero',
  yLabel,
}: {
  data: PuntoSerie[]
  series: Array<{ id: string; label: string; color?: string }>
  title: string
  note?: ReactNode
  summary: string
  height?: number
  formato?: 'numero' | 'cop' | 'pct'
  yLabel?: string
}) {
  const fmt = formato === 'cop' ? formatCOPCompacto : formato === 'pct' ? (v: number) => formatPct(v) : (v: number) => formatNumero(v)
  const columnas: Array<Columna<PuntoSerie>> = [
    { id: 'anio', header: 'Año', cell: (r) => r.anio, align: 'left' },
    ...series.map((s) => ({
      id: s.id,
      header: s.label,
      align: 'right' as const,
      cell: (r: PuntoSerie) => (r[s.id] == null ? 'n.d.' : fmt(r[s.id] as number)),
    })),
  ]
  return (
    <ChartFrame
      title={title}
      note={note}
      summary={summary}
      height={height}
      table={<DataTable columns={columnas} rows={data} rowKey={(r) => String(r.anio)} dense caption="Los valores n.d. corresponden a años sin datos (serie parcial)." />}
    >
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={COLOR.line} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="anio" {...axisProps} />
        <YAxis {...axisProps} width={64} tickFormatter={(v: number) => fmt(v)} label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: COLOR.slate, fontSize: 11 } : undefined} />
        <Tooltip
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox>
                <p className="font-bold text-navy">{label}</p>
                {payload.map((p) => (
                  <p key={String(p.dataKey)} className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-slate-mock">{p.name}:</span>
                    <span className="font-semibold tabular-nums">{p.value == null ? 'n.d.' : fmt(Number(p.value))}</span>
                  </p>
                ))}
              </TooltipBox>
            ) : null
          }
        />
        <Legend wrapperStyle={{ fontSize: 12, color: COLOR.navy }} />
        {series.map((s) => (
          <Line
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.label}
            stroke={s.color ?? colorMunicipio(s.id)}
            strokeWidth={2.2}
            dot={{ r: 2.5 }}
            activeDot={{ r: 4.5 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartFrame>
  )
}

/* ------------------------------------------------------ barras de actividad */

export function ActivityBars({
  data,
  series,
  title,
  note,
  summary,
  height = 280,
  apiladas = false,
}: {
  data: PuntoSerie[]
  series: Array<{ id: string; label: string; color?: string }>
  title: string
  note?: ReactNode
  summary: string
  height?: number
  apiladas?: boolean
}) {
  const columnas: Array<Columna<PuntoSerie>> = [
    { id: 'anio', header: 'Año', cell: (r) => r.anio },
    ...series.map((s) => ({
      id: s.id,
      header: s.label,
      align: 'right' as const,
      cell: (r: PuntoSerie) => (r[s.id] == null ? 'n.d.' : formatNumero(r[s.id] as number)),
    })),
  ]
  return (
    <ChartFrame
      title={title}
      note={note}
      summary={summary}
      height={height}
      table={<DataTable columns={columnas} rows={data} rowKey={(r) => String(r.anio)} dense />}
    >
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={COLOR.line} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="anio" {...axisProps} />
        <YAxis {...axisProps} width={58} tickFormatter={(v: number) => formatNumero(v)} />
        <Tooltip
          cursor={{ fill: 'rgba(191,212,231,0.25)' }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox>
                <p className="font-bold text-navy">{label}</p>
                {payload.map((p) => (
                  <p key={String(p.dataKey)} className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-slate-mock">{p.name}:</span>
                    <span className="font-semibold tabular-nums">{formatNumero(Number(p.value))}</span>
                  </p>
                ))}
              </TooltipBox>
            ) : null
          }
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Bar
            key={s.id}
            dataKey={s.id}
            name={s.label}
            fill={s.color ?? colorMunicipio(s.id)}
            stackId={apiladas ? 'total' : undefined}
            radius={apiladas ? 0 : [4, 4, 0, 0]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ChartFrame>
  )
}

/* ----------------------------------------------------------- distribución */

export function DistributionChart({
  distribucion,
  title,
  note,
  summary,
  height = 280,
}: {
  distribucion: Distribucion
  title: string
  note?: ReactNode
  summary: string
  height?: number
}) {
  const data = distribucion.conteo.map((c, i) => ({
    etiqueta: etiquetaBin(distribucion.bins[i], distribucion.bins[i + 1]),
    desde: distribucion.bins[i],
    hasta: distribucion.bins[i + 1],
    conteo: c,
  }))
  const { q1, mediana, q3 } = distribucion.marcadores
  const columnas: Array<Columna<(typeof data)[number]>> = [
    { id: 'rango', header: 'Rango (COP dic-2023)', cell: (r) => `${formatCOPCompacto(r.desde)} – ${formatCOPCompacto(r.hasta)}` },
    { id: 'conteo', header: 'Registros', align: 'right', cell: (r) => formatNumero(r.conteo) },
  ]
  return (
    <ChartFrame
      title={title}
      note={note}
      summary={summary}
      height={height}
      table={
        <div className="space-y-2">
          <DataTable columns={columnas} rows={data} rowKey={(r) => r.etiqueta} dense caption={`Q1 ${formatCOPCompacto(q1)} · mediana ${formatCOPCompacto(mediana)} · Q3 ${formatCOPCompacto(q3)}`} />
        </div>
      }
    >
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={COLOR.line} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="etiqueta" {...axisProps} interval={1} angle={-32} textAnchor="end" height={58} />
        <YAxis {...axisProps} width={54} tickFormatter={(v: number) => formatNumero(v)} />
        <Tooltip
          cursor={{ fill: 'rgba(191,212,231,0.25)' }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox>
                <p className="font-bold text-navy">{payload[0].payload.etiqueta}</p>
                <p>
                  <span className="text-slate-mock">Registros: </span>
                  <span className="font-semibold tabular-nums">{formatNumero(Number(payload[0].value))}</span>
                </p>
              </TooltipBox>
            ) : null
          }
        />
        <Bar dataKey="conteo" name="Registros" radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {data.map((d, i) => {
            const contieneMediana = mediana >= d.desde && mediana < d.hasta
            const contieneQ = (q1 >= d.desde && q1 < d.hasta) || (q3 >= d.desde && q3 < d.hasta)
            return <Cell key={i} fill={contieneMediana ? COLOR.green : contieneQ ? COLOR.blue : COLOR.lightblue} />
          })}
        </Bar>
      </BarChart>
    </ChartFrame>
  )
}

function etiquetaBin(desde: number, hasta: number): string {
  if (desde === 0) return '< 1 M'
  return `${formatCOPCompacto(desde, 0)}–${formatCOPCompacto(hasta, 0)}`
}

/* ------------------------------------------------------ barras comparativas */

export function ComparisonBars({
  data,
  title,
  note,
  summary,
  formato = 'numero',
  height = 260,
}: {
  data: Array<{ slug: string; label: string; valor: number | null }>
  title: string
  note?: ReactNode
  summary: string
  formato?: 'numero' | 'cop' | 'pct' | 'ratio'
  height?: number
}) {
  const fmt =
    formato === 'cop' ? formatCOPCompacto : formato === 'pct' ? (v: number) => formatPct(v) : (v: number) => formatNumero(v, formato === 'ratio' ? 2 : 0)
  const filas = data.map((d) => ({ ...d, valor: d.valor ?? 0, nd: d.valor == null }))
  const columnas: Array<Columna<(typeof filas)[number]>> = [
    { id: 'muni', header: 'Municipio', cell: (r) => r.label },
    { id: 'valor', header: 'Valor', align: 'right', cell: (r) => (r.nd ? 'n.d.' : fmt(r.valor)) },
  ]
  return (
    <ChartFrame
      title={title}
      note={note}
      summary={summary}
      height={height}
      table={<DataTable columns={columnas} rows={filas} rowKey={(r) => r.slug} dense />}
    >
      <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={COLOR.line} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={(v: number) => fmt(v)} />
        <YAxis type="category" dataKey="label" {...axisProps} width={128} />
        <Tooltip
          cursor={{ fill: 'rgba(191,212,231,0.25)' }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox>
                <p className="font-bold text-navy">{payload[0].payload.label}</p>
                <p className="font-semibold tabular-nums">{payload[0].payload.nd ? 'n.d.' : fmt(Number(payload[0].value))}</p>
              </TooltipBox>
            ) : null
          }
        />
        <Bar dataKey="valor" name="Valor" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {filas.map((d, i) => (
            <Cell key={i} fill={d.nd ? COLOR.line : colorMunicipio(d.slug)} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  )
}

/* -------------------------------------------------------- real vs nominal */

export function RealVsNominal({
  data,
  title,
  note,
  summary,
  height = 280,
}: {
  data: Array<{ anio: number; real: number | null; nominal: number | null }>
  title: string
  note?: ReactNode
  summary: string
  height?: number
}) {
  const columnas: Array<Columna<(typeof data)[number]>> = [
    { id: 'anio', header: 'Año', cell: (r) => r.anio },
    { id: 'real', header: 'Mediana real (COP dic-2023)', align: 'right', cell: (r) => (r.real == null ? 'n.d.' : formatCOPCompacto(r.real)) },
    { id: 'nominal', header: 'Mediana nominal', align: 'right', cell: (r) => (r.nominal == null ? 'n.d.' : formatCOPCompacto(r.nominal)) },
  ]
  return (
    <ChartFrame
      title={title}
      note={note}
      summary={summary}
      height={height}
      table={<DataTable columns={columnas} rows={data} rowKey={(r) => String(r.anio)} dense />}
    >
      <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={COLOR.line} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="anio" {...axisProps} />
        <YAxis {...axisProps} width={64} tickFormatter={(v: number) => formatCOPCompacto(v, 0)} />
        <Tooltip
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox>
                <p className="font-bold text-navy">{label}</p>
                {payload.map((p) => (
                  <p key={String(p.dataKey)}>
                    <span className="text-slate-mock">{p.name}: </span>
                    <span className="font-semibold tabular-nums">{p.value == null ? 'n.d.' : formatCOPCompacto(Number(p.value))}</span>
                  </p>
                ))}
              </TooltipBox>
            ) : null
          }
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="real" name="Real (COP dic-2023)" stroke={COLOR.green} strokeWidth={2.6} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="nominal" name="Nominal" stroke={COLOR.orange} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5 }} connectNulls={false} isAnimationActive={false} />
      </ComposedChart>
    </ChartFrame>
  )
}

/* ------------------------------------------------------------- scatter alertas */

export interface PuntoAlerta {
  id: string
  x: number
  y: number
  label: string
  alerted: boolean
  z?: number
}

export function AlertScatter({
  puntos,
  medianaGrupo,
  title,
  note,
  summary,
  height = 320,
  onSelect,
}: {
  puntos: PuntoAlerta[]
  medianaGrupo?: number | null
  title: string
  note?: ReactNode
  summary: string
  height?: number
  onSelect?: (id: string) => void
}) {
  const normales = puntos.filter((p) => !p.alerted)
  const alertados = puntos.filter((p) => p.alerted)
  return (
    <ChartFrame
      title={title}
      note={note}
      summary={summary}
      height={height}
      table={
        <DataTable
          columns={[
            { id: 'id', header: 'Registro', cell: (r: PuntoAlerta) => r.label },
            { id: 'x', header: 'N.º de anotación', align: 'right', cell: (r: PuntoAlerta) => formatNumero(r.x) },
            { id: 'y', header: 'Valor real', align: 'right', cell: (r: PuntoAlerta) => formatCOPCompacto(r.y) },
            { id: 'z', header: 'z robusto', align: 'right', cell: (r: PuntoAlerta) => (r.z == null ? '—' : r.z.toLocaleString('es-CO', { maximumFractionDigits: 2 })) },
          ]}
          rows={puntos}
          rowKey={(r) => r.id}
          dense
        />
      }
    >
      <ScatterChart margin={{ top: 8, right: 20, bottom: 8, left: 4 }}>
        <CartesianGrid stroke={COLOR.line} strokeDasharray="3 3" />
        <XAxis type="number" dataKey="x" name="N.º de anotación" {...axisProps} />
        <YAxis
          type="number"
          dataKey="y"
          name="Valor real"
          scale="log"
          domain={['auto', 'auto']}
          {...axisProps}
          width={64}
          tickFormatter={(v: number) => formatCOPCompacto(v, 0)}
        />
        <ZAxis type="number" range={[28, 28]} />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox>
                <p className="font-bold text-navy">{payload[0].payload.label}</p>
                <p>
                  <span className="text-slate-mock">Anotación: </span>
                  {formatNumero(Number(payload[0].payload.x))}
                </p>
                <p>
                  <span className="text-slate-mock">Valor real: </span>
                  <span className="font-semibold">{formatCOPCompacto(Number(payload[0].payload.y))}</span>
                </p>
                {payload[0].payload.z != null ? (
                  <p>
                    <span className="text-slate-mock">z robusto: </span>
                    {Number(payload[0].payload.z).toLocaleString('es-CO', { maximumFractionDigits: 2 })}
                  </p>
                ) : null}
              </TooltipBox>
            ) : null
          }
        />
        {medianaGrupo != null ? (
          <ReferenceLine
            y={medianaGrupo}
            stroke={COLOR.green}
            strokeDasharray="6 4"
            label={{ value: 'mediana del grupo', fill: COLOR.green, fontSize: 11, position: 'insideTopRight' }}
          />
        ) : null}
        <Scatter name="Registros del grupo" data={normales} fill={COLOR.lightblue} isAnimationActive={false} />
        <Scatter
          name="Señalados"
          data={alertados}
          fill={COLOR.orange}
          isAnimationActive={false}
          onClick={(p: { payload?: PuntoAlerta }) => {
            if (onSelect && p?.payload?.id) onSelect(p.payload.id)
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </ScatterChart>
    </ChartFrame>
  )
}

/* --------------------------------------------------------------- waterfall */

export interface BloqueWaterfall {
  id: string
  label: string
  valor: number
}

export function Waterfall({
  bloques,
  total,
  title,
  note,
  summary,
  height = 300,
}: {
  bloques: BloqueWaterfall[]
  total: number
  title: string
  note?: ReactNode
  summary: string
  height?: number
}) {
  let acumulado = 0
  const data = bloques.map((b) => {
    const base = b.valor >= 0 ? acumulado : acumulado + b.valor
    acumulado += b.valor
    return { id: b.id, label: b.label, base: Math.max(0, base), aporte: Math.abs(b.valor), valor: b.valor, signo: b.valor >= 0 ? '+' : '−' }
  })
  const columnas: Array<Columna<(typeof data)[number]>> = [
    { id: 'bloque', header: 'Bloque', cell: (r) => r.label },
    { id: 'valor', header: 'Aporte (COP dic-2023)', align: 'right', cell: (r) => `${r.signo}${formatCOPCompacto(Math.abs(r.valor))}` },
  ]
  return (
    <ChartFrame
      title={title}
      note={note}
      summary={summary}
      height={height}
      table={
        <DataTable
          columns={columnas}
          rows={data}
          rowKey={(r) => r.label}
          dense
          caption={`Suma de aportes: ${formatCOPCompacto(acumulado)} · valor estimado con clip en 0: ${formatCOPCompacto(total)}`}
        />
      }
    >
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={COLOR.line} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...axisProps} interval={0} angle={-28} textAnchor="end" height={72} />
        <YAxis {...axisProps} width={64} tickFormatter={(v: number) => formatCOPCompacto(v, 0)} />
        <Tooltip
          cursor={{ fill: 'rgba(191,212,231,0.2)' }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox>
                <p className="font-bold text-navy">{payload[0].payload.label}</p>
                <p className="font-semibold tabular-nums">
                  {payload[0].payload.signo}
                  {formatCOPCompacto(Math.abs(Number(payload[0].payload.valor)))}
                </p>
              </TooltipBox>
            ) : null
          }
        />
        <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="aporte" stackId="w" name="Aporte" radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.id === 'base' ? COLOR.navy : d.valor >= 0 ? COLOR.green : COLOR.orange} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  )
}

/* ------------------------------------------------------------------ heatmap */

export function HeatmapCobertura({
  anios,
  filas,
  title,
  note,
}: {
  anios: number[]
  filas: Array<{ label: string; slug: string; valores: Array<number | null>; parcial: boolean }>
  title: string
  note?: ReactNode
}) {
  const max = Math.max(1, ...filas.flatMap((f) => f.valores.filter((v): v is number => v != null)))
  const [hover, setHover] = useState<string | null>(null)
  return (
    <figure className="card card-pad m-0 space-y-2">
      <figcaption>
        <h3 className="h3 text-navy">{title}</h3>
        {note ? <p className="nota mt-0.5">{note}</p> : null}
      </figcaption>
      <div className="scroll-x">
        <table className="w-full border-collapse text-[0.78rem]">
          <thead>
            <tr>
              <th scope="col" className="px-2 py-1 text-left label">Municipio</th>
              {anios.map((a) => (
                <th key={a} scope="col" className="px-1 py-1 text-center label">{a}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.slug}>
                <th scope="row" className="whitespace-nowrap px-2 py-1 text-left font-semibold text-navy">
                  {f.label}
                  {f.parcial ? <span className="nota ml-1">(parcial)</span> : null}
                </th>
                {f.valores.map((v, i) => {
                  const key = `${f.slug}-${anios[i]}`
                  const intensidad = v == null ? 0 : Math.round(18 + 72 * Math.sqrt(v / max))
                  return (
                    <td
                      key={key}
                      className="px-0.5 py-0.5 text-center"
                      onMouseEnter={() => setHover(key)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(key)}
                      onBlur={() => setHover(null)}
                      tabIndex={0}
                      aria-label={`${f.label} ${anios[i]}: ${v == null ? 'sin datos' : `${formatNumero(v)} registros`}`}
                    >
                      <div
                        className="mx-auto flex h-8 w-full min-w-[42px] items-center justify-center rounded-[6px] text-[0.7rem] font-semibold tabular-nums"
                        style={{
                          background: v == null ? '#f1f4f8' : `rgba(46,134,209,${intensidad / 100})`,
                          color: v == null ? COLOR.slate : intensidad > 55 ? '#fff' : COLOR.navy,
                          outline: hover === key ? `2px solid ${COLOR.navy}` : undefined,
                        }}
                      >
                        {v == null ? '—' : formatNumero(v)}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="nota">«—» indica año sin datos. Calarcá solo tiene registros desde 2021 (serie parcial).</p>
    </figure>
  )
}
