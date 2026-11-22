/** Tarjeta municipal del panorama: actividad, participación, mediana y sparkline. */
import { Link } from 'react-router-dom'
import { Badge, Card, Sparkline } from '@/components/ui'
import { formatCOPCompacto, formatDelta, formatNumero, formatPct } from '@/lib/format'
import { colorMunicipio } from '@/lib/palette'
import type { Moneda, MunicipioResumen, SerieMunicipio } from '@/types/domain'

export function MunicipalityCard({
  resumen,
  serie,
  moneda = 'real',
  anio,
}: {
  resumen: MunicipioResumen
  serie?: SerieMunicipio
  moneda?: Moneda
  anio: number
}) {
  const mediana = moneda === 'real' ? resumen.mediana_real : resumen.mediana_nominal
  const share = resumen.share_6_pct
  const color = colorMunicipio(resumen.slug)

  if (!resumen.tiene_datos) {
    return (
      <Card className="flex flex-col gap-2 opacity-90">
        <div className="flex items-start justify-between gap-2">
          <h3 className="h3 text-navy">{resumen.nombre_ui}</h3>
          <Badge tone="neutral">sin datos</Badge>
        </div>
        <p className="nota">
          Sin registros en {anio}. {resumen.serie_parcial ? `Serie disponible desde ${resumen.primer_anio}.` : ''}
        </p>
        <Link to={`/municipio/${resumen.slug}?anio=${resumen.ultimo_anio}`} className="enlace text-[0.8rem] font-semibold">
          Ver ficha ({resumen.primer_anio}–{resumen.ultimo_anio}) →
        </Link>
      </Card>
    )
  }

  return (
    <Card as="li" className="flex list-none flex-col gap-2.5 transition-shadow hover:shadow-[var(--shadow-pop)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/municipio/${resumen.slug}?anio=${anio}&moneda=${moneda}`} className="h3 block truncate text-navy hover:text-blue-mock">
            {resumen.nombre_ui}
          </Link>
          <span className="nota">{resumen.departamento}</span>
        </div>
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          <span className="label block">Registros {anio}</span>
          <span className="text-[1.35rem] font-bold leading-tight tabular-nums text-navy">{formatNumero(resumen.n)}</span>
        </div>
        <div className="text-right">
          <span className="label block">Participación</span>
          <span className="text-[1.05rem] font-bold tabular-nums text-navy">{formatPct(share, 2)}</span>
        </div>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-pill bg-lightblue/50">
        <div className="h-full rounded-pill" style={{ width: `${Math.min(100, share)}%`, background: color }} />
      </div>

      <div className="flex items-end justify-between gap-2 border-t border-line pt-2">
        <div>
          <span className="label block">{moneda === 'real' ? 'Mediana real' : 'Mediana nominal'}</span>
          <span className="text-[1.05rem] font-bold tabular-nums text-navy">{formatCOPCompacto(mediana)}</span>
        </div>
        <div className="text-right">
          <span className="label block">Var. anual</span>
          <Badge tone={resumen.var_registros_pct == null ? 'neutral' : resumen.var_registros_pct >= 0 ? 'success' : 'warning'}>
            {formatDelta(resumen.var_registros_pct)}
          </Badge>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {serie ? (
          <Sparkline
            values={serie.n}
            color={color}
            label={`Registros de ${resumen.nombre_ui} por año, ${resumen.primer_anio} a ${resumen.ultimo_anio}`}
          />
        ) : (
          <span className="nota">serie no disponible</span>
        )}
        {resumen.serie_parcial ? <Badge tone="warning" icon="warning">serie parcial</Badge> : <span className="nota">{resumen.primer_anio}–{resumen.ultimo_anio}</span>}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line pt-2 text-[0.78rem]">
        <Link to={`/municipio/${resumen.slug}?anio=${anio}`} className="enlace font-semibold">Ficha profunda</Link>
        <Link to={`/comparar?m=${resumen.slug}&anio=${anio}`} className="enlace font-semibold">Comparar</Link>
        <Link to={`/alertas?m=${resumen.slug}&anio=${anio}`} className="enlace font-semibold">Alertas</Link>
      </div>
    </Card>
  )
}
