/**
 * Metodología y fuentes (ruta /metodologia).
 * Transparencia analítica: qué estima el modelo, qué no, y con qué evidencia.
 */
import {
  Accordion,
  Badge,
  Banner,
  Card,
  DataTable,
  DefinitionList,
  ErrorState,
  Loading,
  Section,
  type Columna,
} from '@/components/ui'
import { PageHeader, PreguntaRectora } from '@/components/PageHeader'
import { CHECKLIST_CAMPO, COPY, DISCLAIMER_LARGO, LIMITACIONES, PREGUNTA_RECTORA } from '@/content/es'
import { useCalidad, useGam, useManifest } from '@/lib/data'
import { formatCOP, formatCOPCompacto, formatFechaLarga, formatNumero, formatPct } from '@/lib/format'
import type { MunicipioNombre } from '@/types/domain'

const NOMBRE_UI: Record<MunicipioNombre, string> = {
  ARMENIA: 'Armenia',
  CALARCÁ: 'Calarcá',
  DOSQUEBRADAS: 'Dosquebradas',
  MANIZALES: 'Manizales',
  PEREIRA: 'Pereira',
  'SANTA ROSA DE CABAL': 'Santa Rosa de Cabal',
}

export default function MetodologiaPage() {
  const { data: calidad, isPending, isError, error, refetch } = useCalidad()
  const { data: gam } = useGam()
  const { data: manifest } = useManifest()

  if (isPending) return <Loading label="Cargando metodología…" />
  if (isError || !calidad) return <ErrorState detail={error?.message} onRetry={() => refetch()} />

  const m = calidad.metodologia.modelo

  const filasMuni = gam
    ? (Object.keys(gam.municipios) as MunicipioNombre[])
        .map((mun) => ({
          municipio: NOMBRE_UI[mun],
          n: gam.metricas.por_municipio_2023[mun]?.n ?? 0,
          mae23: gam.metricas.por_municipio_2023[mun]?.mae_modelo ?? 0,
          base23: gam.metricas.por_municipio_2023[mun]?.mae_mediana ?? 0,
          mej23: gam.municipios[mun].mejora_2023_pct,
          mej22: gam.municipios[mun].mejora_2022_pct,
          habilitado: gam.municipios[mun].habilitado,
        }))
        .sort((a, b) => b.mej23 - a.mej23)
    : []

  const columnasMuni: Array<Columna<(typeof filasMuni)[number]>> = [
    { id: 'm', header: 'Municipio', cell: (r) => <span className="font-semibold">{r.municipio}</span> },
    { id: 'n', header: 'Registros 2023', align: 'right', cell: (r) => formatNumero(r.n) },
    { id: 'mae', header: 'MAE del GAM', align: 'right', cell: (r) => formatCOPCompacto(r.mae23) },
    { id: 'base', header: 'MAE de la mediana', align: 'right', cell: (r) => formatCOPCompacto(r.base23) },
    {
      id: 'm23',
      header: 'Mejora 2023',
      align: 'right',
      cell: (r) => <span className={r.mej23 > 0 ? 'font-semibold text-green-mock' : 'font-semibold text-red-mock'}>{r.mej23 > 0 ? '+' : '−'}{formatPct(Math.abs(r.mej23), 2)}</span>,
    },
    {
      id: 'm22',
      header: 'Mejora 2022',
      align: 'right',
      cell: (r) => <span className={r.mej22 > 0 ? 'text-green-mock' : 'text-red-mock'}>{r.mej22 > 0 ? '+' : '−'}{formatPct(Math.abs(r.mej22), 2)}</span>,
    },
    {
      id: 'gate',
      header: 'Compuerta',
      cell: (r) => <Badge tone={r.habilitado ? (r.mej23 < 1 ? 'warning' : 'success') : 'danger'} icon={r.habilitado ? 'check' : 'lock'}>{r.habilitado ? (r.mej23 < 1 ? 'marginal' : 'habilitado') : 'sin mejora demostrada'}</Badge>,
    },
  ]

  const filasIpc = Object.entries(calidad.metodologia.ipc)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([anio, factor]) => ({ anio, factor }))

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Metodología y fuentes"
        title="Cómo se construye este observatorio"
        lead="Reglas de negocio, tratamiento de los datos, semántica del modelo y límites explícitos. Todo es reproducible a partir del CSV y del modelo verificado."
        badges={
          <>
            <Badge tone="method" icon="spark">sin backend</Badge>
            <Badge tone="info">2015–2023 · 6 municipios</Badge>
            {manifest ? <Badge tone="neutral">{manifest.data_version}</Badge> : null}
          </>
        }
      />

      <PreguntaRectora>{PREGUNTA_RECTORA}</PreguntaRectora>

      <Section title="1 · Alcance del producto" level={2}>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="space-y-2">
            <h3 className="h3 text-navy">Qué incluye</h3>
            <ul className="nota list-disc space-y-1 pl-4">
              <li>6 municipios: Armenia, Manizales, Pereira, Dosquebradas, Santa Rosa de Cabal y Calarcá.</li>
              <li>2015–2023, compraventa urbana, valores nominales y reales.</li>
              <li>Comparación multivariable con cinco preguntas del inversionista.</li>
              <li>Alertas explicables como señales de investigación.</li>
              <li>Simulador GAM experimental con compuerta por municipio.</li>
              <li>Asistente de estudio con reporte PDF y Markdown.</li>
            </ul>
          </Card>
          <Card className="space-y-2">
            <h3 className="h3 text-navy">Qué excluye explícitamente</h3>
            <ul className="nota list-disc space-y-1 pl-4">
              <li>Avalúos individuales y precios por m².</li>
              <li>Rentabilidad proyectada o garantizada.</li>
              <li>Segmentación por tipo de inmueble: la fuente no trae esa variable.</li>
              <li>Índice compuesto o ranking de inversión.</li>
              <li>Datos de oferta actual, arriendos, vacancia y costos (se piden en el checklist de campo).</li>
            </ul>
            <Badge tone="warning" icon="warning">BR-04 · BR-06 · BR-09</Badge>
          </Card>
        </div>
      </Section>

      <Section title="2 · Pesos constantes de diciembre de 2023" description="La unidad canónica del sitio. El valor nominal es una vista secundaria con advertencia.">
        <Card className="space-y-3">
          <p className="text-[0.9rem]">
            <code className="rounded bg-navy-50 px-1.5 py-0.5">{calidad.metodologia.formula}</code>
          </p>
          <p className="nota">{calidad.metodologia.fuente_ipc}. {COPY.moneda}</p>
          <DataTable
            columns={[
              { id: 'a', header: 'Año', cell: (r: { anio: string; factor: number }) => r.anio },
              { id: 'f', header: 'Factor multiplicador a dic-2023', align: 'right', cell: (r: { anio: string; factor: number }) => r.factor.toLocaleString('es-CO', { maximumFractionDigits: 10 }) },
            ]}
            rows={filasIpc}
            rowKey={(r) => r.anio}
            dense
            caption="El factor de 2023 es 1,0 porque es el año de referencia. Los factores se importan del módulo del modelo, no se copian."
          />
          <Banner tone="warning" title="Por qué el nominal engaña">
            Entre 2015 y 2023 la mediana <strong>nominal</strong> sube 75,9 % mientras la mediana <strong>real</strong> sube 12,5 %.
            La diferencia es inflación, no valorización. {COPY.nominal}
          </Banner>
        </Card>
      </Section>

      <Section title="3 · Qué es un registro" description="La unidad de observación es el acto registral, no el inmueble.">
        <Card className="space-y-2">
          <DefinitionList
            items={[
              { term: 'Registros de la base', detail: formatNumero(calidad.universo.filas_analiticas) },
              { term: 'Identificador único (pk)', detail: `${formatNumero(calidad.duplicados.pk_duplicados)} duplicados` },
              { term: 'Filas con matrícula repetida', detail: formatNumero(calidad.duplicados.matriculas_repetidas_filas) },
              { term: 'Matrículas distintas', detail: formatNumero(calidad.duplicados.matriculas_distintas) },
            ]}
          />
          <p className="nota">{calidad.duplicados.nota} {COPY.registros}</p>
          <Banner tone="info" compact>{COPY.sumas}</Banner>
        </Card>
      </Section>

      <Section title="4 · El modelo GAM cuantílico" description="Qué estima, con qué variables y con qué desempeño real.">
        <Card className="space-y-3">
          <Banner tone="method" title="Semántica exacta">{COPY.gam}</Banner>
          <DefinitionList
            items={[
              { term: 'Identificador', detail: m.id },
              { term: 'Objetivo', detail: 'valor_cop_dic2023 (mediana condicional, q = 0,5)' },
              { term: 'Pérdida', detail: `L1 con regularización alpha = ${m.alpha}` },
              { term: 'Splines', detail: `grado ${m.grado_spline} con ${m.n_knots} nudos, extrapolación lineal` },
              { term: 'Entrenamiento', detail: m.entrenamiento },
              { term: 'Evaluación', detail: `${m.evaluacion} · retrospectiva` },
              { term: 'Extremos', detail: m.sin_recortar_extremos ? 'No se recortan: se conservan todas las operaciones' : 'Recortados' },
              { term: 'Variables excluidas', detail: 'área, estado físico, antigüedad, fecha de apertura, monto, identificadores, indicador de extremos' },
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="space-y-1">
              <span className="label">MAE 2023 (comprobación)</span>
              <p className="text-[1.2rem] font-bold text-navy">{formatCOP(m.mae_2023)}</p>
              <p className="nota">Mediana municipal: {formatCOP(m.mae_mediana_2023)}</p>
              <Badge tone="warning">mejora {formatPct(m.reduccion_2023_pct, 2)}</Badge>
            </Card>
            <Card className="space-y-1">
              <span className="label">MAE 2022 (validación)</span>
              <p className="text-[1.2rem] font-bold text-navy">{formatCOP(m.mae_2022)}</p>
              <p className="nota">Mediana municipal: {formatCOP(m.mae_mediana_2022)}</p>
              <Badge tone="warning">mejora {formatPct(m.reduccion_2022_pct, 2)}</Badge>
            </Card>
          </div>
          <Banner tone="warning" title="Honestidad analítica">
            La mejora es marginal y el error es del orden de la mediana municipal. {COPY.retrospectiva} {m.nota_r2}
            {' '}R² observado en 2023: {m.r2_2023.toLocaleString('es-CO', { maximumFractionDigits: 4 })}. {COPY.experimental}
          </Banner>
        </Card>

        {gam ? (
          <>
            <DataTable
              columns={columnasMuni}
              rows={filasMuni}
              rowKey={(r) => r.municipio}
              caption="Reducción del MAE frente a la mediana municipal del entrenamiento. Un valor negativo significa que el GAM es peor que la mediana en ese municipio: la compuerta lo bloquea (BR-07)."
              highlight={(r) => !r.habilitado}
            />
            <Banner tone="danger" title="Compuerta por municipio">
              En Manizales y Santa Rosa de Cabal el GAM no supera la mediana municipal en ninguno de los dos cortes. El simulador
              los bloquea por defecto y exige reconocer la limitación para verlos de forma experimental.
            </Banner>
          </>
        ) : null}
      </Section>

      <Section title="5 · Cómo se exporta el modelo al navegador" description="Decisión ADR-02: modelo aditivo evaluable en el cliente, sin backend.">
        <Card className="space-y-3">
          <p className="text-[0.88rem] leading-relaxed">
            El GAM es aditivo. El pipeline descompone la predicción en intercepto, offset por municipio, términos lineales
            (variables transformadas con <code className="rounded bg-navy-50 px-1">log1p</code> donde aplica, centradas y escaladas)
            y <strong>curvas de spline precalculadas</strong> para cada valor entero del rango observado:
            número de anotación 1–329, conteo A 0–44 y conteo D 0–54. El navegador solo suma términos y busca en tres arreglos.
          </p>
          <pre className="scroll-x rounded-[10px] border border-line bg-navy-50 p-3 text-[0.74rem] leading-relaxed text-navy">
{`predicción = clip(0, (intercepto
  + offset_municipio
  + Σ coef_i × (x_i − media_i) / escala_i
  + Σ coef_indicador_j × (indicador_j − media_j) / escala_j
  + curva_num_anotacion[n]
  + curva_count_a[a]
  + curva_count_de[d]) × 1e8)`}
          </pre>
          <p className="nota">
            Los indicadores de faltantes también se exportan con su media y escala. La oficina registral se exporta por
            completitud pero sus 24 coeficientes son 0 en 2022 y 2023, así que el simulador no la solicita.
          </p>
          {manifest ? (
            <Banner tone={manifest.model.parity.passed ? 'success' : 'danger'} title="Paridad verificada">
              {formatNumero(manifest.model.parity.n)} casos dorados evaluados contra <code className="rounded bg-white/60 px-1">joblib</code>:
              diferencia máxima {manifest.model.parity.max_abs_diff.toExponential(3)} COP, tolerancia {manifest.model.parity.tolerancia_cop} COP.
              La prueba corre en CI con Vitest y rompe el build si se supera la tolerancia.
            </Banner>
          ) : null}
        </Card>
      </Section>

      <Section title="6 · Método de alertas" description="Señales explicables para investigación, no acusaciones.">
        <Card className="space-y-3">
          <DefinitionList
            items={[
              { term: 'Grupo comparable', detail: calidad.metodologia.alertas.grupo },
              { term: 'Tramos de anotación', detail: '1-5, 6-10, 11-20, 21-40, 41+' },
              { term: 'Estadístico', detail: calidad.metodologia.alertas.estadistico },
              { term: 'Umbral', detail: `|z| > ${calidad.metodologia.alertas.umbral}` },
              { term: 'Mínimo por grupo', detail: `${calidad.metodologia.alertas.min_grupo} registros (los grupos menores se suprimen)` },
              { term: 'Factor MAD', detail: String(calidad.metodologia.alertas.mad_factor) },
            ]}
          />
          <pre className="scroll-x rounded-[10px] border border-line bg-navy-50 p-3 text-[0.74rem] text-navy">
{`z = (log(valor_real) − mediana_log_grupo) / (1,4826 × MAD_grupo)`}
          </pre>
          <p className="nota">
            La mayoría de las señales son valores anormalmente bajos, compatibles con registros en millones o unidades
            inconsistentes. Se reportan como señal de calidad para verificar la fuente, nunca como irregularidad.
          </p>
          <Banner tone="warning" compact>{COPY.alertas}</Banner>
        </Card>
      </Section>

      <Section title="7 · Limitaciones y verificación en campo" description="La fuente no describe el inmueble físico. El checklist es obligatorio para generar un reporte.">
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="space-y-2">
            <h3 className="h3 text-navy">Limitaciones reconocidas</h3>
            <ul className="nota list-disc space-y-1 pl-4">
              {LIMITACIONES.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </Card>
          <Card className="space-y-2">
            <h3 className="h3 text-navy">Checklist de campo (BR-11)</h3>
            <ul className="nota space-y-1.5">
              {CHECKLIST_CAMPO.map((c) => (
                <li key={c.id}>
                  <strong className="text-navy">{c.label}.</strong> {c.ayuda}
                </li>
              ))}
            </ul>
            <Banner tone="info" compact>{COPY.campo}</Banner>
          </Card>
        </div>
      </Section>

      <Section title="8 · Fuentes, hashes y versiones">
        <Accordion
          items={[
            {
              id: 'fuentes',
              title: 'Fuentes de datos',
              content: (
                <ul className="nota list-disc space-y-1 pl-4">
                  <li>Registros públicos de compraventa urbana (Oficinas de Registro de Instrumentos Públicos).</li>
                  <li>IPC DANE 2015–2023 para los factores de pesos constantes.</li>
                  <li>Población y estructura de edad: proyecciones DANE.</li>
                  <li>Licencias de construcción: ELIC (rezago de un año).</li>
                  <li>Valor agregado municipal (rezago de dos años).</li>
                  <li>Prototipo de referencia: Mockup_Prototipo_DSA.pptx (7 vistas y embudo de 3 municipios).</li>
                  <li>Modelo y protocolo: modelo_gam_cuantilico.py y resultados_gam/2022, resultados_gam/2023.</li>
                </ul>
              ),
            },
            {
              id: 'hashes',
              title: 'Hashes y versión de datos',
              content: (
                <div className="space-y-2">
                  <div>
                    <span className="label block">SHA-256 del CSV</span>
                    <code className="block break-all rounded bg-navy-50 px-2 py-1 text-[0.74rem]">{calidad.hashes.csv}</code>
                  </div>
                  <div>
                    <span className="label block">SHA-256 del modelo joblib</span>
                    <code className="block break-all rounded bg-navy-50 px-2 py-1 text-[0.74rem]">{manifest?.model.joblib_sha256 ?? calidad.hashes.modelo}</code>
                  </div>
                  <DefinitionList
                    items={[
                      { term: 'Versión de datos', detail: manifest?.data_version ?? 'n.d.' },
                      { term: 'Generado (UTC)', detail: manifest ? formatFechaLarga(manifest.generated_at) : 'n.d.' },
                      { term: 'Esquema', detail: calidad.schema_version },
                      { term: 'Ruta pública', detail: '/data/v1/ (inmutable por versión)' },
                    ]}
                  />
                </div>
              ),
            },
            {
              id: 'versiones',
              title: 'Versiones del entorno',
              content: (
                <DefinitionList
                  items={Object.entries({ ...calidad.versiones, ...(manifest?.versions ?? {}) }).map(([k, v]) => ({ term: k, detail: String(v) }))}
                />
              ),
            },
            {
              id: 'reproducir',
              title: 'Cómo reproducir los datos',
              content: (
                <div className="space-y-2">
                  <pre className="scroll-x rounded-[10px] border border-line bg-navy-50 p-3 text-[0.74rem] text-navy">
{`python pipeline/preprocess.py \\
  --datos datos_modelos_enriquecido_nuevo.csv \\
  --modelo resultados_gam/2023/modelo.joblib \\
  --metricas resultados_gam \\
  --salida web/public/data/v1 \\
  --anio 2023 --top-alertas 500

python -m pytest pipeline/tests      # filtros, derivadas, agregados, paridad
python pipeline/preprocess.py --check # determinismo byte a byte
cd web && npm test                    # paridad del motor TypeScript`}
                  </pre>
                  <p className="nota">
                    El pipeline aborta si la base no cumple los filtros, si un invariante del contrato falla o si la paridad
                    del GAM supera 1 COP. No publica datos inconsistentes.
                  </p>
                </div>
              ),
            },
          ]}
        />
      </Section>

      <Card className="space-y-2">
        <h2 className="h3 text-navy">Descargo de responsabilidad</h2>
        <p className="nota leading-relaxed">{DISCLAIMER_LARGO}</p>
        <p className="nota">{COPY.profundizar}</p>
      </Card>
    </div>
  )
}
