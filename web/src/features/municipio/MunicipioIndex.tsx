/**
 * Vista 2 — Índice de municipios (ruta /municipio).
 * Listado de tarjetas + tabla resumen del año de corte, respetando el alcance.
 */
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Badge, DataTable, ErrorState, LinkButton, Loading, Section, type Columna } from '@/components/ui'
import { MunicipalityGrid } from '@/features/municipio/MunicipalityGrid'
import { COPY, ETIQUETAS } from '@/content/es'
import { useFiltros } from '@/hooks/useFiltros'
import { usePanorama } from '@/lib/data'
import { formatCOPCompacto, formatNumero, formatPct, ND } from '@/lib/format'
import { colorMunicipio } from '@/lib/palette'
import type { MunicipioResumen } from '@/types/domain'

export default function MunicipioIndex() {
  const { anio, moneda, alcance, seleccionEfectiva } = useFiltros()
  const panoramaQ = usePanorama()

  if (panoramaQ.isPending) return <Loading label="Cargando municipios…" />
  if (panoramaQ.isError || !panoramaQ.data) {
    return <ErrorState detail={panoramaQ.error?.message} onRetry={() => panoramaQ.refetch()} />
  }
  const panorama = panoramaQ.data
  const visibles = panorama.por_anio[String(anio)].municipios
    .filter((m) => seleccionEfectiva.includes(m.slug))
    .sort((a, b) => b.n - a.n)

  const columnas: Array<Columna<MunicipioResumen>> = [
    {
      id: 'municipio',
      header: 'Municipio',
      cell: (r) => (
        <Link to={`/municipio/${r.slug}?anio=${anio}`} className="enlace inline-flex items-center gap-1.5 font-semibold">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorMunicipio(r.slug) }} aria-hidden="true" />
          {r.nombre_ui}
        </Link>
      ),
    },
    { id: 'departamento', header: 'Departamento', cell: (r) => r.departamento },
    {
      id: 'registros',
      header: `${ETIQUETAS.registros} ${anio}`,
      align: 'right',
      help: COPY.registros,
      cell: (r) => (r.tiene_datos ? formatNumero(r.n) : <Badge tone="neutral">sin datos</Badge>),
    },
    {
      id: 'mediana',
      header: moneda === 'real' ? ETIQUETAS.medianaReal : ETIQUETAS.medianaNominal,
      align: 'right',
      help: `${COPY.mediana} ${COPY.moneda}`,
      cell: (r) => (r.tiene_datos ? formatCOPCompacto(moneda === 'real' ? r.mediana_real : r.mediana_nominal) : ND),
    },
    {
      id: 'share',
      header: ETIQUETAS.share,
      align: 'right',
      help:
        alcance === '3'
          ? 'Participación en el total de registros de las 3 ciudades capitales del año.'
          : 'Participación en el total de registros de los 6 municipios del año.',
      cell: (r) => {
        if (!r.tiene_datos) return ND
        const share = alcance === '3' && r.share_3_pct != null ? r.share_3_pct : r.share_6_pct
        return formatPct(share, 2)
      },
    },
    {
      id: 'anios',
      header: 'Años con datos',
      help: 'Rango de años con registros en la base. Calarcá tiene serie parcial (2021–2023).',
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5">
          {r.primer_anio}–{r.ultimo_anio}
          {r.serie_parcial ? <Badge tone="warning" icon="warning">serie parcial</Badge> : null}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Por municipio · Fichas profundas"
        title="Municipios del observatorio"
        lead="Elige un municipio para ver su ficha profunda: actividad, valores típicos, distribución, contexto territorial y señales para investigar."
        actions={
          <LinkButton to={`/comparar?m=${seleccionEfectiva.join(',')}&anio=${anio}`} variant="primary" icon="arrowRight">
            Comparar municipios
          </LinkButton>
        }
      />

      <Section
        title={`Tarjetas del año ${anio}`}
        description={`${COPY.registros} Ordenadas por número de registros; el enlace de cada tarjeta abre la ficha profunda.`}
      >
        <MunicipalityGrid resumenes={visibles} series={panorama.series.por_municipio} moneda={moneda} anio={anio} />
      </Section>

      <Section
        title={`Tabla resumen ${anio}`}
        description={`${COPY.registros} «n.d.» indica año sin datos para ese municipio; nunca se muestra 0 como si fuera un dato real.`}
      >
        <DataTable
          columns={columnas}
          rows={visibles}
          rowKey={(r) => r.slug}
          caption={`Resumen municipal del año ${anio}. ${moneda === 'real' ? COPY.moneda : 'Montos nominales del año de cada registro; usa COP dic-2023 para comparar.'}`}
        />
        <p className="nota mt-2">{COPY.mediana}</p>
      </Section>
    </div>
  )
}
