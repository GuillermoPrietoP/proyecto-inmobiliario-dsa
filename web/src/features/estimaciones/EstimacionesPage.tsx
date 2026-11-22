/**
 * Estimaciones GAM cuantílico — módulo activo (architecture.md §12.6).
 *
 * El valor se calcula en el navegador con el motor aditivo exportado por el
 * pipeline (paridad < 1 COP contra `joblib`). La compuerta por municipio
 * (BR-07) bloquea la estimación donde el GAM no supera la mediana municipal.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Accordion,
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  DefinitionList,
  ErrorState,
  Field,
  InfoTip,
  KpiCard,
  Loading,
  Section,
  Select,
  Slider,
  type Tone,
} from '@/components/ui'
import { Waterfall } from '@/components/charts'
import { PageHeader } from '@/components/PageHeader'
import { COPY, GATE, AYUDAS, ETIQUETAS, MESES } from '@/content/es'
import { useFiltros } from '@/hooks/useFiltros'
import { NOMBRE_POR_SLUG, SLUGS, useGam, useManifest } from '@/lib/data'
import { formatCOP, formatCOPCompacto, formatNumero, formatPct, formatRatio } from '@/lib/format'
import { bloquesContribucion, evaluar, estadoGate, percentilDe } from '@/lib/gam/engine'
import { colorMunicipio } from '@/lib/palette'
import { MAX_MUNICIPIOS_ESTUDIO, useStudyStore } from '@/stores/study'
import type { GamModel, MunicipioNombre, Slug } from '@/types/domain'
import { PanelValidacion } from './PanelValidacion'
import { rangoDe, useSimulador, VARIABLES_SIN_EFECTO } from './useSimulador'

const NOMBRE_UI: Record<MunicipioNombre, string> = {
  ARMENIA: 'Armenia',
  CALARCÁ: 'Calarcá',
  DOSQUEBRADAS: 'Dosquebradas',
  MANIZALES: 'Manizales',
  PEREIRA: 'Pereira',
  'SANTA ROSA DE CABAL': 'Santa Rosa de Cabal',
}

const TONO_GATE: Record<string, Tone> = { habilitado: 'success', marginal: 'warning', sin_mejora: 'danger' }
const TEXTO_GATE: Record<string, string> = {
  habilitado: 'Reduce el MAE',
  marginal: 'Mejora marginal (< 1 %)',
  sin_mejora: 'Sin mejora demostrada',
}

export default function EstimacionesPage() {
  const { data: model, isPending, isError, error, refetch } = useGam()
  const { data: manifest } = useManifest()
  const sim = useSimulador(model)

  if (isPending) return <Loading label="Cargando el modelo GAM exportado…" />
  if (isError || !model) {
    return <ErrorState detail={error?.message} onRetry={() => refetch()} />
  }
  return <Simulador model={model} sim={sim} hash={manifest?.data_version ?? 'sin-manifest'} />
}

type Sim = ReturnType<typeof useSimulador>

function Simulador({ model, sim, hash }: { model: GamModel; sim: Sim; hash: string }) {
  const navigate = useNavigate()
  const { anio: anioGlobal } = useFiltros()
  const borrador = useStudyStore((s) => s.borrador)
  const iniciar = useStudyStore((s) => s.iniciar)
  const toggleMunicipio = useStudyStore((s) => s.toggleMunicipio)
  const setGam = useStudyStore((s) => s.setGam)
  const avisoStore = useStudyStore((s) => s.aviso)
  const [guardado, setGuardado] = useState(false)

  const { municipio, slug, ctx, anio } = sim
  const contrib = useMemo(() => (ctx ? evaluar(model, sim.input) : null), [model, sim.input, ctx])
  const estimado = contrib?.total ?? 0
  const medianaObservada = (ctx?.mediana_real as number | null) ?? null
  const diferencia = medianaObservada != null ? estimado - medianaObservada : null
  const diferenciaPct = medianaObservada ? (100 * (estimado - medianaObservada)) / medianaObservada : null
  const percentil = percentilDe(model, municipio, estimado)
  const estado = estadoGate(model, municipio)
  const metricasMuni23 = model.metricas.por_municipio_2023[municipio]
  const metricasMuni22 = model.metricas.por_municipio_2022[municipio]
  const bloques = useMemo(() => (contrib ? bloquesContribucion(contrib) : []), [contrib])
  const sinEfecto = (campo: string) => VARIABLES_SIN_EFECTO.has(campo) && !model.efectos_materiales.includes(campo)

  function guardarEstimacion() {
    if (!ctx) return
    if (!borrador) iniciar(anioGlobal, hash, [municipio])
    else if (!borrador.municipios.includes(municipio)) {
      if (borrador.municipios.length >= MAX_MUNICIPIOS_ESTUDIO) return
      toggleMunicipio(municipio)
    }
    setGam({
      municipio,
      estimado_cop: estimado,
      mediana_real: medianaObservada ?? 0,
      mae_cop: metricasMuni23?.mae_modelo ?? model.metricas['2023'].mae_modelo,
      mejora_pct: model.municipios[municipio].mejora_2023_pct,
      reconocio_limitacion: sim.reconocido,
      inputs: sim.features,
      mes: sim.mes,
      dia: sim.dia,
    })
    setGuardado(true)
    navigate('/mi-estudio')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Estimaciones · GAM cuantílico"
        title="Simulador de valor típico registrado"
        lead={COPY.gam}
        badges={
          <>
            <Badge tone="method" icon="spark">q = 0,5 · experimental</Badge>
            <Badge tone="info">Año de referencia {anio}</Badge>
            <Badge tone={model.paridad.passed ? 'success' : 'danger'}>
              Paridad {model.paridad.passed ? 'verificada' : 'no verificada'}
            </Badge>
            {model.municipios[municipio].serie_parcial ? <Badge tone="warning">serie parcial</Badge> : null}
          </>
        }
        actions={
          <Button variant="ghost" size="sm" icon="minus" onClick={sim.reset} disabled={!sim.modificado}>
            Restablecer defaults
          </Button>
        }
      />

      <Banner tone="warning" title="Esto no es un avalúo">
        {COPY.experimental} {COPY.mediana} El error típico del modelo es del orden de la mediana municipal
        ({formatCOPCompacto(model.metricas['2023'].mae_modelo)} en 2023), por lo que el resultado sirve para explorar
        sensibilidad, no para negociar un precio.
      </Banner>

      {/* ---------------------------------------------------------- municipio */}
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="h3 text-navy">1 · Municipio</h2>
          <span className="nota">La compuerta habilita el modelo solo donde reduce el MAE frente a la mediana municipal.</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SLUGS.map((s: Slug) => {
            const nombre = NOMBRE_POR_SLUG[s]
            const info = model.municipios[nombre]
            const est = estadoGate(model, nombre)
            return (
              <Chip key={s} active={s === slug} onClick={() => sim.setMunicipio(s)} title={`${NOMBRE_UI[nombre]}: ${TEXTO_GATE[est]}`}>
                <span className="h-2 w-2 rounded-full" style={{ background: colorMunicipio(s) }} aria-hidden="true" />
                {NOMBRE_UI[nombre]}
                <span className={`ml-0.5 text-[0.68rem] ${s === slug ? 'text-white/85' : est === 'sin_mejora' ? 'text-red-mock' : est === 'marginal' ? 'text-orange-mock' : 'text-green-mock'}`}>
                  {info.mejora_2023_pct > 0 ? '+' : '−'}
                  {Math.abs(info.mejora_2023_pct).toLocaleString('es-CO', { maximumFractionDigits: 2 })} %
                </span>
              </Chip>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={TONO_GATE[estado]} icon={estado === 'sin_mejora' ? 'lock' : 'check'}>
            {NOMBRE_UI[municipio]}: {TEXTO_GATE[estado]}
          </Badge>
          <span className="nota">
            Mejora del MAE 2023: {formatPct(model.municipios[municipio].mejora_2023_pct, 2)} · 2022: {formatPct(model.municipios[municipio].mejora_2022_pct, 2)}
          </span>
        </div>
      </Card>

      {/* ----------------------------------------------------------- compuerta */}
      {sim.bloqueado ? (
        <Card className="space-y-3 border-[#f4c7c3]">
          <Banner tone="danger" title={GATE.titulo}>
            {GATE.detalle
              .replace('{municipio}', NOMBRE_UI[municipio])
              .replace('{mejora}', model.municipios[municipio].mejora_2023_pct.toLocaleString('es-CO', { maximumFractionDigits: 2 }))}
          </Banner>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={sim.verExperimental ? 'primary' : 'secondary'}
              icon={sim.verExperimental ? 'check' : 'lock'}
              onClick={() => sim.setVerExperimental(!sim.verExperimental)}
            >
              {GATE.toggle}
            </Button>
            {sim.verExperimental ? (
              <Checkbox
                label={GATE.reconocer}
                checked={sim.reconocido}
                onChange={(e) => sim.setReconocido(e.target.checked)}
              />
            ) : null}
          </div>
          {!sim.visible ? <p className="nota">{GATE.bloqueado} El reporte registrará esta decisión si decides incluir la estimación.</p> : null}
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-12">
        {/* --------------------------------------------------------- inputs */}
        <div className="space-y-4 lg:col-span-7">
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="h3 text-navy">2 · Complejidad registral y estacionalidad</h2>
              <Badge tone="method">variables del modelo</Badge>
            </div>
            <p className="nota">
              Describen el folio y el momento del registro, no el inmueble físico. Los valores por defecto son la mediana
              observada en {NOMBRE_UI[municipio]} durante {anio}.
            </p>

            <Control
              label={ETIQUETAS.numAnotacion}
              help={AYUDAS.numAnotacion}
              min={model.rangos.num_anotacion[0]}
              max={model.rangos.num_anotacion[1]}
              step={1}
              value={sim.numAnotacion}
              onChange={sim.setNumAnotacion}
              format={(v) => formatNumero(v)}
              rango={`rango observado ${model.rangos.num_anotacion[0]}–${model.rangos.num_anotacion[1]}`}
              aporte={contrib?.curvas.num_anotacion}
            />
            <Control
              label={ETIQUETAS.countA}
              help={AYUDAS.countA}
              min={model.rangos.count_a[0]}
              max={model.rangos.count_a[1]}
              step={1}
              value={sim.countA}
              onChange={sim.setCountA}
              format={(v) => formatNumero(v)}
              rango={`rango observado ${model.rangos.count_a[0]}–${model.rangos.count_a[1]}`}
              aporte={contrib?.curvas.count_a}
            />
            <Control
              label={ETIQUETAS.countDe}
              help={AYUDAS.countDe}
              min={model.rangos.count_de[0]}
              max={model.rangos.count_de[1]}
              step={1}
              value={sim.countDe}
              onChange={sim.setCountDe}
              format={(v) => formatNumero(v)}
              rango={`rango observado ${model.rangos.count_de[0]}–${model.rangos.count_de[1]}`}
              sinEfecto={sinEfecto('count_de')}
              aporte={contrib?.curvas.count_de}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={ETIQUETAS.mes} htmlFor="sim-mes" help="El modelo usa mes_seno y mes_coseno (estacionalidad circular).">
                <Select id="sim-mes" value={sim.mes} onChange={(e) => sim.setMes(Number(e.target.value))}>
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </Select>
              </Field>
              <Control
                label={ETIQUETAS.dia}
                min={1}
                max={31}
                step={1}
                value={sim.dia}
                onChange={sim.setDia}
                format={(v) => formatNumero(v)}
                sinEfecto={sinEfecto('dia_mes')}
                aporte={contrib?.numericas.dia_mes}
                compact
              />
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="h3 text-navy">3 · Contexto territorial y económico</h2>
              <Badge tone="info">defaults de {NOMBRE_UI[municipio]} {anio}</Badge>
            </div>
            <p className="nota">
              Son variables del municipio, no del inmueble. Cambiarlas simula un contexto distinto; el modelo las aprendió
              en logaritmos, por eso el efecto es decreciente.
            </p>

            <Control
              label={ETIQUETAS.crecimiento}
              help={AYUDAS.crecimiento}
              min={model.rangos.crecimiento_poblacion[0]}
              max={model.rangos.crecimiento_poblacion[1]}
              step={0.00005}
              value={sim.valor('crecimiento_poblacion') ?? 0}
              onChange={(v) => sim.setOverride('crecimiento_poblacion', v)}
              format={(v) => formatPct(v * 100, 3)}
              rango={`rango observado ${formatPct(model.rangos.crecimiento_poblacion[0] * 100, 3)} – ${formatPct(model.rangos.crecimiento_poblacion[1] * 100, 3)}`}
              aporte={contrib?.numericas.crecimiento_poblacion}
            />
            <Control
              label={ETIQUETAS.licencias}
              help={AYUDAS.viviendasPor1000}
              min={model.rangos.viviendas_por_1000[0]}
              max={model.rangos.viviendas_por_1000[1]}
              step={0.01}
              value={sim.valor('viviendas_por_1000') ?? 0}
              onChange={(v) => sim.setOverride('viviendas_por_1000', v)}
              format={(v) => `${formatRatio(v, 2)} / 1.000 hab`}
              rango={`rango observado ${formatRatio(model.rangos.viviendas_por_1000[0], 2)}–${formatRatio(model.rangos.viviendas_por_1000[1], 2)}`}
              aporte={contrib?.numericas.viviendas_por_1000}
              nd={sim.valor('viviendas_por_1000') == null}
              onNd={(v) => sim.setOverride('viviendas_por_1000', v ? null : (ctx?.viviendas_por_1000 ?? 0))}
            />
            <Control
              label={ETIQUETAS.vaRealPc}
              help={AYUDAS.vaRealPc}
              min={model.rangos.va_real_pc[0]}
              max={model.rangos.va_real_pc[1]}
              step={10000}
              value={sim.valor('va_real_pc') ?? 0}
              onChange={(v) => sim.setOverride('va_real_pc', v)}
              format={(v) => formatCOPCompacto(v)}
              rango={`rango observado ${formatCOPCompacto(model.rangos.va_real_pc[0])} – ${formatCOPCompacto(model.rangos.va_real_pc[1])}`}
              sinEfecto={sinEfecto('va_real_pc')}
              aporte={contrib?.numericas.va_real_pc}
              nd={sim.valor('va_real_pc') == null}
              onNd={(v) => sim.setOverride('va_real_pc', v ? null : (ctx?.va_real_pc ?? 0))}
            />

            <DefinitionList
              items={[
                { term: ETIQUETAS.poblacion, detail: formatNumero(ctx?.poblacion_total) },
                { term: ETIQUETAS.cabecera, detail: formatPct((ctx?.proporcion_cabecera ?? 0) * 100, 2) },
                { term: 'Población lag1 / lag2', detail: `${formatNumero(ctx?.poblacion_lag1)} / ${formatNumero(ctx?.poblacion_lag2)}` },
                { term: ETIQUETAS.prediosNuevos, detail: `${formatPct(ctx?.predios_nuevos_pct ?? 0, 2)} de los registros` },
              ]}
            />
          </Card>

          <Accordion
            items={[
              {
                id: 'avanzado',
                title: 'Controles avanzados del contexto',
                badge: <Badge tone="neutral">opcional</Badge>,
                content: (
                  <div className="space-y-4 pt-1">
                    <p className="nota">
                      Variables con coeficiente distinto de cero pero efecto pequeño, o sin efecto material en este corte.
                      Se muestran por completitud y transparencia del modelo aditivo.
                    </p>
                    <Control
                      label={ETIQUETAS.poblacion}
                      min={rangoDe(model, 'poblacion_total')[0]}
                      max={rangoDe(model, 'poblacion_total')[1]}
                      step={1}
                      value={sim.valor('poblacion_total') ?? 0}
                      onChange={(v) => sim.setOverride('poblacion_total', v)}
                      format={(v) => formatNumero(v)}
                      aporte={contrib?.numericas.poblacion_total}
                    />
                    <Control
                      label={ETIQUETAS.cabecera}
                      help={AYUDAS.proporcionCabecera}
                      min={0}
                      max={1}
                      step={0.001}
                      value={sim.valor('proporcion_cabecera') ?? 0}
                      onChange={(v) => sim.setOverride('proporcion_cabecera', v)}
                      format={(v) => formatPct(v * 100, 2)}
                      aporte={contrib?.numericas.proporcion_cabecera}
                    />
                    {(['proporcion_0_17', 'proporcion_18_24', 'proporcion_25_44', 'proporcion_65_mas'] as const).map((c) => (
                      <Control
                        key={c}
                        label={`Proporción de población ${c.replace('proporcion_', '').replace('_', '–')} años`}
                        min={0}
                        max={0.6}
                        step={0.001}
                        value={sim.valor(c) ?? 0}
                        onChange={(v) => sim.setOverride(c, v)}
                        format={(v) => formatPct(v * 100, 2)}
                        sinEfecto={sinEfecto(c)}
                        aporte={contrib?.numericas[c]}
                      />
                    ))}
                    <Control
                      label={ETIQUETAS.areaLicencias}
                      min={rangoDe(model, 'elic_area_vivienda_nueva_m2_lag1')[0]}
                      max={rangoDe(model, 'elic_area_vivienda_nueva_m2_lag1')[1]}
                      step={100}
                      value={sim.valor('elic_area_vivienda_nueva_m2_lag1') ?? 0}
                      onChange={(v) => sim.setOverride('elic_area_vivienda_nueva_m2_lag1', v)}
                      format={(v) => `${formatNumero(v)} m²`}
                      sinEfecto={sinEfecto('elic_area_vivienda_nueva_m2_lag1')}
                      aporte={contrib?.numericas.elic_area_vivienda_nueva_m2_lag1}
                    />
                    {(['va_proporcion_secundaria_lag2', 'va_proporcion_terciaria_lag2'] as const).map((c) => (
                      <Control
                        key={c}
                        label={c.includes('secundaria') ? 'VA proporción secundaria (lag2)' : 'VA proporción terciaria (lag2)'}
                        min={0}
                        max={1}
                        step={0.001}
                        value={sim.valor(c) ?? 0}
                        onChange={(v) => sim.setOverride(c, v)}
                        format={(v) => formatPct(v * 100, 2)}
                        sinEfecto={sinEfecto(c)}
                        aporte={contrib?.numericas[c]}
                        nd={sim.valor(c) == null}
                        onNd={(v) => sim.setOverride(c, v ? null : (ctx?.[c] ?? 0))}
                      />
                    ))}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Checkbox
                        label="Predio nuevo en este registro"
                        description="Feature 0/1 del modelo. Sin efecto material en 2023."
                        checked={(sim.valor('predios_nuevos') ?? 0) === 1}
                        onChange={(e) => sim.setOverride('predios_nuevos', e.target.checked ? 1 : 0)}
                      />
                      <Checkbox
                        label="Cambio de serie en crecimiento poblacional"
                        description="Indicador 0/1. Sin efecto material en 2023."
                        checked={(sim.valor('crecimiento_poblacion_cambio_serie') ?? 0) === 1}
                        onChange={(e) => sim.setOverride('crecimiento_poblacion_cambio_serie', e.target.checked ? 1 : 0)}
                      />
                      <Checkbox
                        label="ELC en cobertura (lag1)"
                        checked={(sim.valor('elic_en_cobertura_lag1') ?? 0) === 1}
                        onChange={(e) => sim.setOverride('elic_en_cobertura_lag1', e.target.checked ? 1 : 0)}
                      />
                      <Checkbox
                        label="ELC con registros (lag1)"
                        checked={(sim.valor('elic_con_registros_lag1') ?? 0) === 1}
                        onChange={(e) => sim.setOverride('elic_con_registros_lag1', e.target.checked ? 1 : 0)}
                      />
                    </div>
                    <Banner tone="method" compact>
                      La oficina/notaría no se solicita: sus 24 coeficientes son 0 en 2022 y 2023. {model.oficinas.nota}
                    </Banner>
                  </div>
                ),
              },
            ]}
          />
        </div>

        {/* ------------------------------------------------------- resultado */}
        <div className="space-y-4 lg:col-span-5">
          {!sim.visible ? (
            <Card className="space-y-2">
              <h2 className="h3 text-navy">4 · Resultado</h2>
              <Banner tone="danger" title="Estimación no disponible">
                {GATE.bloqueado} Activa «{GATE.toggle}» y reconoce la limitación para ver el valor exploratorio.
              </Banner>
              <p className="nota">
                Alternativa recomendada: usa la mediana municipal observada como referencia descriptiva
                ({formatCOPCompacto(medianaObservada)}) y profundiza con datos de campo.
              </p>
            </Card>
          ) : (
            <>
              <Card className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="h3 text-navy">4 · Valor típico estimado</h2>
                  <Badge tone={TONO_GATE[estado]}>{TEXTO_GATE[estado]}</Badge>
                </div>
                <p className="text-[2rem] font-bold leading-none tracking-tight text-navy" aria-live="polite">
                  {formatCOP(estimado)}
                </p>
                <p className="nota">
                  {formatCOPCompacto(estimado)} en pesos constantes de diciembre de 2023 · mediana condicional (q=0,5) ·{' '}
                  {NOMBRE_UI[municipio]} · {MESES[sim.mes - 1]}, día {sim.dia}
                </p>

                <div className="grid gap-2 sm:grid-cols-2">
                  <KpiCard
                    label="Mediana observada"
                    value={formatCOPCompacto(medianaObservada)}
                    help={`Mediana real de los registros de ${NOMBRE_UI[municipio]} en ${anio}. Referencia descriptiva, no precio de negociación.`}
                  />
                  <KpiCard
                    label="Diferencia"
                    value={diferencia == null ? 'n.d.' : `${diferencia >= 0 ? '+' : '−'}${formatCOPCompacto(Math.abs(diferencia))}`}
                    delta={diferenciaPct}
                    deltaLabel="frente a la mediana"
                  />
                </div>

                {percentil != null ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="label flex items-center gap-1">
                        Percentil empírico <InfoTip text={AYUDAS.percentil} />
                      </span>
                      <span className="text-[0.85rem] font-bold tabular-nums text-navy">
                        {percentil.toLocaleString('es-CO', { maximumFractionDigits: 1 })}
                      </span>
                    </div>
                    <div className="relative h-2 w-full rounded-pill bg-lightblue/60">
                      <div
                        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
                        style={{ left: `${Math.max(0, Math.min(100, percentil))}%`, background: colorMunicipio(slug) }}
                        aria-hidden="true"
                      />
                    </div>
                    <p className="nota">
                      Posición dentro de la distribución de los {formatNumero(ctx?.n)} registros de {anio}. No es un intervalo de confianza.
                    </p>
                  </div>
                ) : null}

                <Banner tone="info" title={ETIQUETAS.errorTipico} compact>
                  MAE municipal 2023: <strong>{formatCOPCompacto(metricasMuni23?.mae_modelo)}</strong> · 2022:{' '}
                  <strong>{formatCOPCompacto(metricasMuni22?.mae_modelo)}</strong>. Esto es el error absoluto medio del modelo
                  en este municipio, no un intervalo de confianza ni una banda de precio. La mediana municipal de referencia
                  tiene un MAE de {formatCOPCompacto(metricasMuni23?.mae_mediana)}.
                </Banner>

                {sim.fueraDeRango.length > 0 ? (
                  <Banner tone="warning" title="Extrapolación">
                    {AYUDAS.extrapolacion} Variables fuera del rango observado:{' '}
                    <strong>{sim.fueraDeRango.map((v) => ETIQUETAS[v as keyof typeof ETIQUETAS] ?? v).join(', ')}</strong>.
                    Las curvas de spline se recortan al extremo más cercano; el resultado es exploratorio.
                  </Banner>
                ) : null}

                {model.municipios[municipio].serie_parcial ? (
                  <Banner tone="warning" compact>
                    {COPY.serieParcial} La comprobación de 2023 usa pocos registros en este municipio.
                  </Banner>
                ) : null}

                <Banner tone="method" compact>
                  {COPY.retrospectiva}
                </Banner>

                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  <Button variant="primary" icon="doc" onClick={guardarEstimacion}>
                    Guardar estimación en Mi Estudio
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/municipio/${slug}?anio=${anio}`)}>
                    Ver ficha del municipio
                  </Button>
                </div>
                {guardado ? <p className="nota text-green-mock">Estimación guardada en el borrador del estudio.</p> : null}
                {avisoStore ? <p className="nota text-orange-mock">{avisoStore}</p> : null}
              </Card>

              <Card className="space-y-2">
                <h3 className="h3 text-navy">¿Por qué este valor?</h3>
                <p className="nota">
                  El GAM es aditivo: cada bloque aporta una cantidad en pesos al valor base. La suma de aportes es la
                  estimación (con recorte en 0 si fuera negativa).
                </p>
                <DefinitionList
                  items={[
                    { term: 'Base + municipio', detail: formatCOPCompacto((contrib?.intercepto ?? 0) + (contrib?.municipio ?? 0)) },
                    { term: 'Suma de aportes', detail: formatCOPCompacto(bloques.reduce((a, b) => a + b.valor, 0)) },
                    { term: 'Variables con efecto material', detail: model.efectos_materiales.length.toString() },
                  ]}
                />
              </Card>
            </>
          )}

          <Card className="space-y-2">
            <h3 className="h3 text-navy">Qué no hace este modelo</h3>
            <ul className="nota list-disc space-y-1 pl-4">
              <li>No usa área física, estado, antigüedad ni fecha de apertura: {COPY.campo}</li>
              <li>No produce avalúos individuales ni precios por m².</li>
              <li>No proyecta rentabilidad ni garantiza ningún resultado.</li>
              <li>No segmenta por tipo de inmueble: la fuente no trae esa variable.</li>
              <li>No entrega intervalos de confianza: el MAE es una medida de error típico.</li>
            </ul>
          </Card>
        </div>
      </div>

      {sim.visible && contrib ? (
        <Section
          title="Descomposición aditiva"
          description="Aporte de cada bloque al valor estimado, en COP dic-2023. Verde = suma, naranja = resta. La base del modelo incluye el intercepto."
        >
          <Waterfall
            bloques={bloques.map((b) => ({ id: b.id, label: b.label, valor: b.valor }))}
            total={estimado}
            title="Contribuciones al valor típico estimado"
            note={`Suma de aportes: ${formatCOPCompacto(bloques.reduce((a, b) => a + b.valor, 0))} · valor con clip en 0: ${formatCOPCompacto(estimado)}`}
            summary={`Descomposición aditiva del GAM para ${NOMBRE_UI[municipio]}. Valor estimado ${formatCOPCompacto(estimado)}.`}
            height={320}
          />
        </Section>
      ) : null}

      <PanelValidacion model={model} />
    </div>
  )
}

/* ------------------------------------------------------------- control UI */

function Control({
  label,
  help,
  min,
  max,
  step,
  value,
  onChange,
  format,
  rango,
  aporte,
  sinEfecto,
  nd,
  onNd,
  compact = false,
}: {
  label: string
  help?: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  format: (v: number) => string
  rango?: string
  aporte?: number
  sinEfecto?: boolean
  nd?: boolean
  onNd?: (v: boolean) => void
  compact?: boolean
}) {
  const id = `ctl-${label.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`
  const fuera = value < min || value > max
  return (
    <Field
      label={
        <span className="flex flex-wrap items-center gap-1.5">
          {label}
          {sinEfecto ? <Badge tone="neutral">sin efecto material</Badge> : null}
          {fuera ? <Badge tone="warning">fuera de rango</Badge> : null}
        </span>
      }
      htmlFor={id}
      help={help}
      hint={aporte != null && Math.abs(aporte) >= 1 ? `aporte ${aporte >= 0 ? '+' : '−'}${formatCOPCompacto(Math.abs(aporte))}` : undefined}
    >
      {nd ? (
        <div className="flex items-center gap-2">
          <span className="nota flex-1 rounded-[10px] border border-dashed border-line bg-navy-50 px-2.5 py-1.5">
            n.d. — el modelo imputa la mediana de entrenamiento y activa el indicador de faltante.
          </span>
          {onNd ? (
            <Button size="sm" variant="ghost" onClick={() => onNd(false)}>
              Usar valor
            </Button>
          ) : null}
        </div>
      ) : (
        <Slider id={id} value={value} min={min} max={max} step={step} onChange={onChange} format={format} />
      )}
      {!compact ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {rango ? <span className="nota">{rango}</span> : <span />}
          {onNd && !nd ? (
            <button type="button" className="enlace text-[0.75rem]" onClick={() => onNd(true)}>
              Marcar como no disponible
            </button>
          ) : null}
        </div>
      ) : null}
    </Field>
  )
}
