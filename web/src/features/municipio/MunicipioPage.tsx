/**
 * Vista 3 — Ficha profunda municipal (ruta /municipio/:slug).
 * Actividad, valores típicos, distribución, contexto territorial y señales
 * para investigar. No afirma causalidad ni recomienda comprar.
 */
import { useParams } from 'react-router-dom'
import { NotaMetodo, PageHeader } from '@/components/PageHeader'
import { AgregarEstudio } from '@/components/AgregarEstudio'
import { ActivityBars, DistributionChart, TrendChart, type PuntoSerie } from '@/components/charts'
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  InfoTip,
  KpiCard,
  LinkButton,
  Loading,
  Section,
  Sparkline,
} from '@/components/ui'
import { AYUDAS, COPY, ETIQUETAS, GATE } from '@/content/es'
import { ANIOS, useFiltros } from '@/hooks/useFiltros'
import { SLUGS, useComparacion, useFicha, useGam } from '@/lib/data'
import { formatCOPCompacto, formatDelta, formatNumero, formatPct, formatRatio, ND } from '@/lib/format'
import { COLOR } from '@/lib/palette'
import type { ContextoAnio, Slug } from '@/types/domain'

export default function MunicipioPage() {
  const { slug: slugParam } = useParams<{ slug: string }>()
  const slug: Slug | undefined = SLUGS.includes(slugParam as Slug) ? (slugParam as Slug) : undefined
  const { anio, setAnio, moneda } = useFiltros()
  const fichaQ = useFicha(slug)
  const comparacionQ = useComparacion()
  const gamQ = useGam()

  if (!slug) {
    return (
      <div className="space-y-3">
        <ErrorState
          title="Municipio no encontrado"
          detail={`«${slugParam ?? ''}» no hace parte de los 6 municipios del observatorio.`}
        />
        <LinkButton to="/municipio" variant="primary" icon="arrowRight">
          Volver al índice de municipios
        </LinkButton>
      </div>
    )
  }
  if (fichaQ.isPending) return <Loading label="Cargando ficha municipal…" />
  if (fichaQ.isError || !fichaQ.data) {
    return <ErrorState detail={fichaQ.error?.message} onRetry={() => fichaQ.refetch()} />
  }

  const ficha = fichaQ.data
  const muni = ficha.municipio
  const gamMuni = gamQ.data?.municipios[muni.nombre]
  const bloqueado = gamMuni != null && !gamMuni.habilitado
  const estimarLink = (
    <LinkButton to={`/estimaciones?m=${slug}`} icon="spark">
      {bloqueado ? 'Estimación experimental' : 'Estimaciones GAM'}
      {bloqueado ? <Badge tone="warning" icon="warning">exploratorio</Badge> : null}
    </LinkButton>
  )

  const cabecera = (
    <PageHeader
      eyebrow="Por municipio · Ficha profunda"
      title={muni.nombre_ui}
      lead={`${muni.departamento} · DIVIPOLA ${muni.divipola}. ¿Qué tan activo es este municipio, qué valores típicos registra y qué contexto lo acompaña?`}
      badges={
        <>
          <Badge tone="neutral">
            Años con datos: {muni.primer_anio}–{muni.ultimo_anio} ({ficha.anios.length})
          </Badge>
          {muni.serie_parcial ? <Badge tone="warning" icon="warning">serie parcial</Badge> : null}
          <Badge tone={moneda === 'real' ? 'success' : 'warning'} icon={moneda === 'real' ? 'check' : 'warning'}>
            {moneda === 'real' ? 'COP dic-2023' : 'Pesos nominales'}
          </Badge>
        </>
      }
      actions={
        <>
          <AgregarEstudio municipio={muni.nombre} size="md" />
          <LinkButton to={`/comparar?m=${slug}&anio=${anio}`} icon="chart">
            Comparar
          </LinkButton>
          {estimarLink}
        </>
      }
    />
  )

  const porAnio = ficha.por_anio[String(anio)]
  if (!ficha.anios.includes(anio) || !porAnio) {
    return (
      <div className="space-y-4">
        {cabecera}
        {muni.serie_parcial ? <Banner tone="warning" compact>{COPY.serieParcial}</Banner> : null}
        <EmptyState title="Sin datos para este año">
          {muni.nombre_ui} no tiene registros en {anio}. Los años disponibles van de {muni.primer_anio} a{' '}
          {muni.ultimo_anio}; no se muestran indicadores para años sin datos.
        </EmptyState>
        <div className="flex justify-center">
          <Button variant="primary" icon="arrowRight" onClick={() => setAnio(ficha.anio_default)}>
            Ir a {ficha.anio_default} (año con datos)
          </Button>
        </div>
      </div>
    )
  }

  const k = porAnio.kpis
  const mediana = moneda === 'real' ? k.mediana_real : k.mediana_nominal
  const histPorAnio = new Map(ficha.historico.map((h) => [h.anio, h]))
  // Los años sin datos quedan en null para que el gráfico muestre el hueco (Calarcá).
  const puntosN: PuntoSerie[] = ANIOS.map((a) => ({ anio: a, [slug]: histPorAnio.get(a)?.n ?? null }))
  const puntosMediana: PuntoSerie[] = ANIOS.map((a) => {
    const h = histPorAnio.get(a)
    return { anio: a, mediana_real: h?.mediana_real ?? null, mediana_nominal: h?.mediana_nominal ?? null }
  })
  const ctx = ficha.contexto.find((c) => c.anio === anio)
  const serieCtx = (pick: (c: ContextoAnio) => number | null): Array<number | null> =>
    ANIOS.map((a) => {
      const c = ficha.contexto.find((x) => x.anio === a)
      return c ? pick(c) : null
    })
  const filaComp = comparacionQ.data?.por_anio[String(anio)]?.matriz.find((f) => f.slug === slug)

  return (
    <div className="space-y-6">
      {cabecera}

      {muni.serie_parcial ? <Banner tone="warning" compact>{COPY.serieParcial}</Banner> : null}
      {moneda === 'nominal' ? (
        <Banner tone="warning" compact title="Estás viendo pesos nominales">
          La mediana se muestra en pesos nominales del año de cada registro; los cuartiles y la distribución se mantienen
          en COP dic-2023. Para comparar entre años, usa pesos constantes.
        </Banner>
      ) : null}

      {/* KPIs del año de corte */}
      <section aria-label={`Indicadores de ${muni.nombre_ui} en ${anio}`} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label={`${ETIQUETAS.registros} ${anio}`} value={formatNumero(k.registros)} help={COPY.registros} />
        <KpiCard
          label={moneda === 'real' ? ETIQUETAS.medianaReal : ETIQUETAS.medianaNominal}
          value={formatCOPCompacto(mediana)}
          delta={moneda === 'real' ? k.var_mediana_real_pct : undefined}
          deltaLabel={moneda === 'real' ? 'mediana real vs. año anterior' : undefined}
          help={`${COPY.mediana} ${COPY.moneda}`}
        />
        <KpiCard
          label={ETIQUETAS.q1q3}
          value={`${formatCOPCompacto(k.q1)} – ${formatCOPCompacto(k.q3)}`}
          help="Cuartiles en pesos constantes dic-2023, incluso cuando la mediana se muestra en nominal. La mitad central de los registros cae en este rango."
        />
        <KpiCard
          label={ETIQUETAS.share}
          value={formatPct(k.share_6_pct, 2)}
          help="Participación en el total de registros del año de los 6 municipios del observatorio."
          footer={k.share_3_pct != null ? `${formatPct(k.share_3_pct, 2)} del alcance de 3 ciudades capitales` : undefined}
        />
        <KpiCard
          label={ETIQUETAS.iqrRatio}
          value={formatRatio(k.iqr_ratio)}
          help="Dispersión: rango intercuartílico dividido por la mediana. A mayor valor, menos comparables equivalentes sin área, ubicación y estado."
          footer={`P90/P10: ${formatRatio(k.p90_p10, 1)}`}
        />
        <KpiCard
          label={ETIQUETAS.varAnual}
          value={formatDelta(k.var_registros_pct)}
          help="Variación del número de registros frente al año anterior. n.d. en el primer año de la serie."
        />
      </section>

      <Section
        title="Actividad y valores típicos por año"
        description={
          muni.serie_parcial
            ? COPY.serieParcial
            : 'Evolución anual del municipio. Los años sin datos se muestran como hueco, no como cero.'
        }
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <ActivityBars
            data={puntosN}
            series={[{ id: slug, label: muni.nombre_ui }]}
            title={`Registros por año · ${muni.nombre_ui}`}
            note={COPY.registros}
            summary={`Barras del número de registros de compraventa urbana de ${muni.nombre_ui} entre ${muni.primer_anio} y ${muni.ultimo_anio}.`}
            height={260}
          />
          <TrendChart
            data={puntosMediana}
            series={[
              { id: 'mediana_real', label: 'Real (COP dic-2023)', color: COLOR.green },
              { id: 'mediana_nominal', label: 'Nominal', color: COLOR.orange },
            ]}
            title={`Mediana por año · ${muni.nombre_ui}`}
            note={COPY.mediana}
            summary={`Líneas de la mediana real y nominal de ${muni.nombre_ui} entre ${muni.primer_anio} y ${muni.ultimo_anio}.`}
            formato="cop"
            height={260}
          />
        </div>
      </Section>

      <Section title={`Distribución de valores · ${anio}`}>
        <DistributionChart
          distribucion={porAnio.distribucion}
          title={`Distribución de valores reales · ${anio}`}
          note={`Primer bin lineal (< $1 M); los demás en escala logarítmica. Verde: bin que contiene la mediana; azul: bins que contienen Q1 o Q3. Siempre en COP dic-2023. ${COPY.sumas}`}
          summary={`Histograma de ${formatNumero(k.registros)} registros de ${muni.nombre_ui} en ${anio}, con mediana ${formatCOPCompacto(k.mediana_real)} y rango Q1–Q3 de ${formatCOPCompacto(k.q1)} a ${formatCOPCompacto(k.q3)}.`}
          height={300}
        />
      </Section>

      <Section
        title="Contexto territorial"
        description="Indicadores del año de corte con rezagos (lag1 = año anterior, lag2 = dos años atrás). «n.d.» = dato no disponible. Son contexto: no establecen causalidad sobre los valores de compraventa."
      >
        {ctx ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ContextoItem
              label={`${ETIQUETAS.poblacion} ${anio}`}
              value={formatNumero(ctx.poblacion_total)}
              values={serieCtx((c) => c.poblacion_total)}
            />
            <ContextoItem
              label={ETIQUETAS.crecimiento}
              value={formatPct(ctx.crecimiento_poblacion * 100, 2)}
              help={AYUDAS.crecimiento}
              values={serieCtx((c) => c.crecimiento_poblacion * 100)}
            />
            <ContextoItem
              label={ETIQUETAS.cabecera}
              value={formatPct(ctx.proporcion_cabecera * 100, 1)}
              help={AYUDAS.proporcionCabecera}
              values={serieCtx((c) => c.proporcion_cabecera * 100)}
            />
            <ContextoItem
              label={ETIQUETAS.vaRealPc}
              value={formatCOPCompacto(ctx.va_real_pc)}
              help={AYUDAS.vaRealPc}
              color={COLOR.green}
              values={serieCtx((c) => c.va_real_pc)}
              nota={ctx.va_real_pc == null ? 'Sin dato: 2015–2016 no tienen VA con rezago de 2 años (lag2).' : undefined}
            />
            <ContextoItem
              label={ETIQUETAS.licencias}
              value={formatNumero(ctx.elic_unidades_vivienda_nueva_lag1)}
              help="Unidades de vivienda nueva licenciadas el año anterior (lag1), según ELIC."
              values={serieCtx((c) => c.elic_unidades_vivienda_nueva_lag1)}
            />
            <ContextoItem
              label={ETIQUETAS.areaLicencias}
              value={formatNumero(ctx.elic_area_vivienda_nueva_m2_lag1)}
              unit="m²"
              help="Área de vivienda nueva licenciada el año anterior (lag1), según ELIC."
              values={serieCtx((c) => c.elic_area_vivienda_nueva_m2_lag1)}
            />
            <ContextoItem
              label="Viviendas nuevas por 1.000 hab."
              value={formatRatio(ctx.viviendas_por_1000, 2)}
              help={AYUDAS.viviendasPor1000}
              values={serieCtx((c) => c.viviendas_por_1000)}
              nota={ctx.viviendas_por_1000 == null ? 'Requiere población del año anterior (lag1); no disponible en el primer año.' : undefined}
            />
            <ContextoItem
              label={ETIQUETAS.prediosNuevos}
              value={formatPct(ctx.predios_nuevos_pct, 2)}
              help="Porcentaje de registros del año asociados a predios nuevos (ya viene en escala 0–100)."
              color={COLOR.purple}
              values={serieCtx((c) => c.predios_nuevos_pct)}
            />
          </div>
        ) : (
          <EmptyState title="Sin contexto para este año">
            No hay indicadores territoriales de {muni.nombre_ui} para {anio}.
          </EmptyState>
        )}
      </Section>

      <Section title="¿Qué puedo interpretar?" description="Frases descriptivas generadas por el pipeline a partir de los datos del año; no afirman causalidad.">
        <Card className="space-y-3">
          <ul className="list-disc space-y-1.5 pl-5 text-[0.85rem] leading-relaxed text-navy">
            {porAnio.notas.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <div className="space-y-1.5 border-t border-line pt-2">
            <NotaMetodo>{COPY.campo}</NotaMetodo>
            <NotaMetodo>{COPY.mediana}</NotaMetodo>
          </div>
        </Card>
      </Section>

      <Section title="Alertas del municipio" description={COPY.alertas}>
        {comparacionQ.isPending ? (
          <Loading label="Cargando conteo de alertas…" />
        ) : comparacionQ.isError ? (
          <ErrorState
            title="No se pudo cargar el conteo de alertas"
            detail={comparacionQ.error?.message}
            onRetry={() => comparacionQ.refetch()}
          />
        ) : filaComp && filaComp.tiene_datos ? (
          <Card className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className="label block">Operaciones señaladas en {anio}</span>
                <span className="text-[1.35rem] font-bold tabular-nums text-navy">{formatNumero(filaComp.alertas)}</span>
              </div>
              <div>
                <span className="label block">Tasa sobre registros del año</span>
                <span className="text-[1.35rem] font-bold tabular-nums text-navy">
                  {filaComp.registros > 0 ? formatPct((filaComp.alertas / filaComp.registros) * 100, 2) : ND}
                </span>
              </div>
            </div>
            <Banner tone="info" compact>
              {COPY.alertas} Este es el conteo completo del municipio/año; la vista de alertas lista el top-500 por
              severidad.
            </Banner>
            <LinkButton to={`/alertas?m=${slug}&anio=${anio}`} variant="primary" icon="arrowRight">
              Ver alertas de {muni.nombre_ui}
            </LinkButton>
          </Card>
        ) : (
          <EmptyState title="Sin datos para este año">
            No hay conteo de alertas para {muni.nombre_ui} en {anio}.
          </EmptyState>
        )}
      </Section>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 max-w-xl">
          <h2 className="h3 text-navy">Siguiente paso</h2>
          <p className="nota mt-0.5">{COPY.profundizar}</p>
          {bloqueado ? <p className="nota mt-1 text-orange-mock">{GATE.titulo}: el enlace abre el simulador en modo experimental.</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AgregarEstudio municipio={muni.nombre} size="md" />
          <LinkButton to={`/comparar?m=${slug}&anio=${anio}`} variant="primary" icon="arrowRight">
            Comparar municipios
          </LinkButton>
          {estimarLink}
        </div>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------- tarjeta de contexto */

function ContextoItem({
  label,
  value,
  unit,
  help,
  nota,
  values,
  color = COLOR.blue,
}: {
  label: string
  value: string
  unit?: string
  help?: string
  nota?: string
  values?: Array<number | null>
  color?: string
}) {
  return (
    <Card className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="label">{label}</span>
        {help ? <InfoTip text={help} /> : null}
      </div>
      <span className="text-[1.1rem] font-bold leading-tight tabular-nums text-navy">
        {value}
        {unit ? <span className="ml-1 text-[0.75rem] font-medium text-slate-mock">{unit}</span> : null}
      </span>
      {values ? <Sparkline values={values} color={color} label={`Evolución anual de ${label}`} /> : null}
      {nota ? <span className="nota">{nota}</span> : null}
    </Card>
  )
}
