/**
 * Vista 1 — Panorama territorial (ruta /).
 * Pregunta: ¿cómo se ve el mercado urbano en el año de corte y qué municipios
 * merecen una mirada más profunda? No recomienda comprar: prioriza el estudio.
 */
import { useState } from 'react'
import { PageHeader, PreguntaRectora } from '@/components/PageHeader'
import { ActivityBars, RealVsNominal, type PuntoSerie } from '@/components/charts'
import { Banner, Card, ErrorState, KpiCard, LinkButton, Loading, Section, Tabs } from '@/components/ui'
import { MunicipalityGrid } from '@/features/municipio/MunicipalityGrid'
import { COPY, ETIQUETAS, PREGUNTA_RECTORA } from '@/content/es'
import { useFiltros } from '@/hooks/useFiltros'
import { useManifest, usePanorama } from '@/lib/data'
import { formatCOPCompacto, formatDelta, formatFechaLarga, formatNumero, formatPct } from '@/lib/format'

export default function PanoramaPage() {
  const { anio, moneda, seleccionEfectiva, municipiosDisponibles } = useFiltros()
  const panoramaQ = usePanorama()
  const manifestQ = useManifest()
  const [modoBarras, setModoBarras] = useState<'agrupadas' | 'apiladas'>('agrupadas')

  if (panoramaQ.isPending) return <Loading label="Cargando panorama territorial…" />
  if (panoramaQ.isError || !panoramaQ.data) {
    return <ErrorState detail={panoramaQ.error?.message} onRetry={() => panoramaQ.refetch()} />
  }
  const panorama = panoramaQ.data
  const porAnio = panorama.por_anio[String(anio)]
  const kpis = porAnio.kpis
  const manifest = manifestQ.data

  const visibles = porAnio.municipios.filter((m) => seleccionEfectiva.includes(m.slug))
  const nombreUi = new Map(porAnio.municipios.map((m) => [m.slug as string, m.nombre_ui]))
  const seleccionParcial = seleccionEfectiva.length < municipiosDisponibles.length

  // Evolución de registros por municipio (null = año sin datos; Calarcá antes de 2021).
  const puntosActividad: PuntoSerie[] = panorama.series.anios.map((a, i) => {
    const punto: PuntoSerie = { anio: a }
    for (const slug of seleccionEfectiva) {
      punto[slug] = panorama.series.por_municipio[slug]?.n[i] ?? null
    }
    return punto
  })

  // Mediana del TOTAL por año: se toma de los KPIs ya calculados por el pipeline.
  const puntosRealVsNominal = panorama.anios.map((a) => {
    const k = panorama.por_anio[String(a)]?.kpis
    return { anio: a, real: k?.mediana_real ?? null, nominal: k?.mediana_nominal ?? null }
  })

  const notas = Array.from(new Set([...panorama.notas, COPY.registros, COPY.sumas, COPY.mediana]))
  const queryComparar = `/comparar?m=${seleccionEfectiva.join(',')}&anio=${anio}${moneda === 'nominal' ? '&moneda=nominal' : ''}`

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inicio · Panorama territorial"
        title={`Panorama territorial ${anio}`}
        lead="¿Cómo se ve el mercado urbano de compraventa en el año de corte y qué municipios merecen una mirada más profunda? Esta vista prioriza dónde profundizar un estudio; no recomienda comprar."
        actions={
          <>
            <LinkButton to={queryComparar} variant="primary" icon="arrowRight">
              Ver comparación
            </LinkButton>
            <LinkButton to="/mi-estudio" icon="doc">
              Mi estudio
            </LinkButton>
          </>
        }
      />
      <PreguntaRectora>{PREGUNTA_RECTORA}</PreguntaRectora>

      {moneda === 'nominal' ? (
        <Banner tone="warning" compact title="Estás viendo pesos nominales">
          Los montos de esta vista son nominales del año de cada registro. Para comparar entre años, usa COP dic-2023.
        </Banner>
      ) : null}

      {/* Franja de KPIs del año de corte (sobre la base completa de 6 municipios). */}
      <section aria-label={`Indicadores del año ${anio}`} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label={`${ETIQUETAS.registros} ${anio}`}
          value={formatNumero(kpis.registros)}
          help={`${COPY.registros} Total de la base analítica (6 municipios), independiente del alcance seleccionado.`}
        />
        <KpiCard
          label="Municipios con datos"
          value={`${kpis.municipios_con_datos}/6`}
          help="Municipios con registros en el año de corte, sobre los 6 del observatorio. Calarcá solo tiene datos desde 2021."
        />
        <KpiCard
          label={moneda === 'real' ? ETIQUETAS.medianaReal : ETIQUETAS.medianaNominal}
          value={formatCOPCompacto(moneda === 'real' ? kpis.mediana_real : kpis.mediana_nominal)}
          delta={moneda === 'real' ? kpis.var_mediana_real_pct : undefined}
          deltaLabel={moneda === 'real' ? 'mediana real vs. año anterior' : undefined}
          help={`${COPY.mediana} ${COPY.moneda}`}
        />
        <KpiCard
          label="Variación anual de actividad"
          value={formatDelta(kpis.var_registros_pct)}
          help="Variación del número de registros frente al año anterior. n.d. en 2015 (primer año de la base)."
        />
        <KpiCard
          label="Variación de la mediana real"
          value={formatDelta(kpis.var_mediana_real_pct)}
          help="Variación de la mediana en pesos constantes dic-2023 frente al año anterior: descuenta la inflación."
        />
        <KpiCard
          label="Cobertura de la base"
          value={formatPct(kpis.cobertura_pct, 0)}
          help="Cobertura sobre la base analítica entregada (ya filtrada), no sobre el universo de registros previo a los filtros. Ver la vista de cobertura para el embudo completo."
        />
      </section>
      {seleccionParcial ? (
        <p className="nota">
          Los KPIs corresponden al total de la base (6 municipios); las tarjetas y el gráfico de actividad respetan tu
          selección de municipios.
        </p>
      ) : null}

      <Section
        title="Municipios del observatorio"
        description={`${COPY.registros} Ordenadas por número de registros de ${anio}. Entra a la ficha profunda para priorizar tu estudio.`}
      >
        <MunicipalityGrid resumenes={visibles} series={panorama.series.por_municipio} moneda={moneda} anio={anio} />
      </Section>

      <Section
        title="Evolución de la actividad"
        description="Registros de compraventa urbana por año y municipio. Calarcá tiene serie parcial: el hueco antes de 2021 indica años sin datos, no actividad cero."
        actions={
          <Tabs
            tabs={[
              { id: 'agrupadas', label: 'Barras agrupadas' },
              { id: 'apiladas', label: 'Barras apiladas' },
            ]}
            value={modoBarras}
            onChange={(id) => setModoBarras(id as 'agrupadas' | 'apiladas')}
          />
        }
      >
        <ActivityBars
          data={puntosActividad}
          series={seleccionEfectiva.map((slug) => ({ id: slug, label: nombreUi.get(slug) ?? slug }))}
          title={`Registros por municipio, 2015–2023`}
          note={COPY.registros}
          summary={`Barras ${modoBarras} de registros anuales de compraventa urbana entre 2015 y 2023 para ${seleccionEfectiva.length} municipios. Calarcá sin datos antes de 2021.`}
          apiladas={modoBarras === 'apiladas'}
          height={320}
        />
      </Section>

      <Section title="Mediana del total: real vs. nominal">
        <RealVsNominal
          data={puntosRealVsNominal}
          title="Mediana real (COP dic-2023) vs. mediana nominal"
          note={COPY.nominal}
          summary="Líneas de la mediana real en pesos constantes de diciembre de 2023 y de la mediana nominal del total de la base, 2015 a 2023. Entre 2015 y 2023 la nominal sube 75,9 % y la real 12,5 %."
          height={300}
        />
      </Section>

      <Section title="Cómo leer este panorama">
        <Card className="space-y-3">
          <ul className="list-disc space-y-1.5 pl-5 text-[0.85rem] leading-relaxed text-navy">
            {notas.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <p className="nota">{COPY.profundizar}</p>
          {manifest ? (
            <p className="nota border-t border-line pt-2">
              Fuente: {manifest.source.csv} ({formatNumero(manifest.source.rows)} filas entregadas) · Deflactor:{' '}
              {manifest.currency.ipc_source} · Versión de datos: {manifest.data_version} · Generado:{' '}
              {formatFechaLarga(manifest.generated_at)}.
            </p>
          ) : (
            <p className="nota border-t border-line pt-2">Cargando metadatos del manifest…</p>
          )}
          <div className="flex flex-wrap gap-2">
            <LinkButton to="/cobertura" size="sm" icon="chart">
              Cobertura y calidad
            </LinkButton>
            <LinkButton to="/metodologia" size="sm" icon="doc">
              Metodología
            </LinkButton>
          </div>
        </Card>
      </Section>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 max-w-xl">
          <h2 className="h3 text-navy">¿Listo para profundizar?</h2>
          <p className="nota mt-0.5">{COPY.profundizar}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton to={queryComparar} variant="primary" icon="arrowRight">
            Comparar municipios
          </LinkButton>
          <LinkButton to="/mi-estudio" icon="doc">
            Armar mi estudio
          </LinkButton>
        </div>
      </Card>
    </div>
  )
}
