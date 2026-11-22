/**
 * Cobertura y calidad de datos (architecture.md §12.4).
 * Distingue "verificación sobre la base entregada" de "universo previo documentado".
 */
import {
  Accordion,
  Badge,
  Banner,
  Card,
  DataTable,
  DefinitionList,
  ErrorState,
  KpiCard,
  Loading,
  ProgressBar,
  Section,
  type Columna,
} from '@/components/ui'
import { HeatmapCobertura } from '@/components/charts'
import { PageHeader } from '@/components/PageHeader'
import { COPY } from '@/content/es'
import { useAlertas, useCalidad, useManifest, urlAlertasCsv, urlManifest } from '@/lib/data'
import { formatBytes, formatCOP, formatFechaLarga, formatNumero, formatPct } from '@/lib/format'
import type { CoberturaMunicipio } from '@/types/domain'

export default function CoberturaPage() {
  const { data: calidad, isPending, isError, error, refetch } = useCalidad()
  const { data: manifest } = useManifest()
  const { data: alertas } = useAlertas()

  if (isPending) return <Loading label="Cargando cobertura y calidad…" />
  if (isError || !calidad) return <ErrorState detail={error?.message} onRetry={() => refetch()} />

  const excluidos = calidad.universo.filas_entregadas - calidad.universo.filas_analiticas
  const m = calidad.metodologia.modelo

  const columnasFaltantes: Array<Columna<(typeof calidad.faltantes)[number]>> = [
    { id: 'var', header: 'Variable', cell: (r) => <code className="rounded bg-navy-50 px-1 text-[0.78rem]">{r.variable}</code> },
    { id: 'nulos', header: 'Filas nulas', align: 'right', cell: (r) => formatNumero(r.nulos) },
    { id: 'pct', header: '% de la base', align: 'right', cell: (r) => formatPct(r.pct, 2) },
    { id: 'impacto', header: 'Impacto', cell: (r) => <span className="nota">{r.impacto}</span>, className: 'min-w-[280px]' },
  ]

  const columnasCobertura: Array<Columna<CoberturaMunicipio>> = [
    { id: 'muni', header: 'Municipio', cell: (r) => <span className="font-semibold">{r.nombre_ui}</span> },
    { id: 'primer', header: 'Primer año', align: 'right', cell: (r) => r.primer_anio },
    { id: 'anios', header: 'Años con datos', align: 'right', cell: (r) => `${r.anios_con_datos} / ${calidad.anios.length}` },
    { id: 'n', header: 'Registros del período', align: 'right', cell: (r) => formatNumero(r.n) },
    {
      id: 'estado',
      header: 'Serie',
      cell: (r) => (r.serie_parcial ? <Badge tone="warning" icon="warning">parcial</Badge> : <Badge tone="success" icon="check">completa</Badge>),
    },
  ]

  const columnasIpc: Array<Columna<{ anio: string; factor: number; ipc: number | null }>> = [
    { id: 'anio', header: 'Año', cell: (r) => r.anio },
    { id: 'factor', header: 'Factor a dic-2023', align: 'right', cell: (r) => r.factor.toLocaleString('es-CO', { maximumFractionDigits: 10 }) },
    { id: 'ipc', header: 'IPC anual del año siguiente', align: 'right', cell: (r) => (r.ipc == null ? '—' : formatPct(r.ipc, 2)) },
  ]
  const filasIpc = Object.entries(calidad.metodologia.ipc)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([anio, factor]) => ({ anio, factor, ipc: calidad.metodologia.ipc_pct_anual[String(Number(anio) + 1)] ?? null }))

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cobertura y calidad"
        title="¿Cuánta información se conserva y qué tan confiable es?"
        lead="Trazabilidad completa de la base analítica: filtros verificados, cobertura por municipio y año, faltantes, duplicados, extremos y metodología."
        badges={
          <>
            <Badge tone="success" icon="check">4 filtros verificados al 100 %</Badge>
            <Badge tone="info">{formatNumero(calidad.universo.filas_analiticas)} registros</Badge>
            {manifest ? <Badge tone="method">{manifest.data_version}</Badge> : null}
          </>
        }
        actions={
          <>
            <a
              href={urlManifest()}
              download="manifest.json"
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-lightblue bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-navy-50"
            >
              Descargar manifest
            </a>
            <a
              href={urlAlertasCsv()}
              download="alertas.csv"
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-navy bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-700"
            >
              Descargar alertas.csv
            </a>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Filas fuente entregadas" value={formatNumero(calidad.universo.filas_entregadas)} help="El CSV entregado ya es la base analítica filtrada; no contiene el universo previo de los 6 municipios." />
        <KpiCard label="Filas analíticas" value={formatNumero(calidad.universo.filas_analiticas)} help="Registros que cumplen los cuatro filtros del estudio y alimentan todas las vistas." />
        <KpiCard label="Retención" value={formatPct(calidad.universo.retencion_pct, 2)} help="Sobre la base entregada. No es la retención del universo previo, que no está disponible para los 6 municipios." />
        <KpiCard label="Registros excluidos" value={formatNumero(excluidos)} help="El pipeline no elimina filas silenciosamente: si la base no cumpliera los filtros, abortaría con conteos por criterio (BR-12)." />
      </div>

      <Section
        title="Embudo de datos"
        description="El CSV entregado ya cumple los filtros. El embudo de 3 municipios es un dato de referencia del prototipo, no una reconstrucción de esta base."
      >
        <Banner tone="warning" title="Qué se puede y qué no se puede afirmar">
          {calidad.universo.nota}
        </Banner>
        <div className="grid gap-3 lg:grid-cols-3">
          {calidad.embudo.map((paso, i) => (
            <Card key={i} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="label">Paso {i + 1}</span>
                <Badge tone={paso.alcance === '6_municipios' ? 'info' : 'neutral'}>
                  {paso.alcance === '6_municipios' ? '6 municipios' : '3 municipios'}
                </Badge>
              </div>
              <h3 className="h3 text-navy">{paso.paso}</h3>
              <p className="text-[1.4rem] font-bold tabular-nums text-navy">{formatNumero(paso.filas)}</p>
              {paso.retencion_pct != null ? (
                <div className="space-y-1">
                  <ProgressBar value={paso.retencion_pct} tone={paso.retencion_pct >= 99.9 ? 'success' : 'warning'} />
                  <p className="nota">
                    Retención {formatPct(paso.retencion_pct, 2)}
                    {paso.excluidos != null ? ` · ${formatNumero(paso.excluidos)} excluidos` : ''}
                  </p>
                </div>
              ) : null}
              {paso.fuente ? <p className="nota">Fuente: {paso.fuente}</p> : null}
              {paso.nota ? <p className="nota">{paso.nota}</p> : null}
            </Card>
          ))}
        </div>
        <Card className="space-y-1">
          <span className="label">Universo previo de los 6 municipios</span>
          <p className="text-[0.9rem] font-semibold text-navy">No disponible en el archivo entregado</p>
          <p className="nota">
            No se inventa ni se extrapola. Si el dueño de datos entrega el universo previo, el pipeline lo acepta con
            <code className="mx-1 rounded bg-navy-50 px-1">--universo universo.csv</code> y completa el embudo.
          </p>
        </Card>
      </Section>

      <Section title="Verificación de los filtros del estudio" description="Esto es una verificación sobre la base entregada, no un filtrado ejecutado en el sitio.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {calidad.verificacion_filtros.map((f) => (
            <Card key={f.filtro} className="space-y-1.5">
              <code className="block rounded bg-navy-50 px-2 py-1 text-[0.76rem] text-navy">{f.filtro}</code>
              <p className="text-[1.3rem] font-bold text-green-mock">{formatPct(f.pct, 2)}</p>
              <p className="nota">{formatNumero(f.filas)} de {formatNumero(calidad.universo.filas_analiticas)} registros cumplen.</p>
              <ProgressBar value={f.pct} tone="success" />
            </Card>
          ))}
        </div>
        <Banner tone="info" compact>
          BR-12: los filtros son trazables. Si alguna fila no los cumpliera, el pipeline aborta con conteos por criterio en lugar de eliminarla en silencio.
        </Banner>
      </Section>

      <Section title="Cobertura por municipio y año" description="Registros disponibles en cada combinación. Calarcá solo tiene datos desde 2021.">
        <HeatmapCobertura
          anios={calidad.anios}
          filas={calidad.cobertura_municipio.map((c) => ({ label: c.nombre_ui, slug: c.slug, valores: c.n_por_anio, parcial: c.serie_parcial }))}
          title="Mapa de calor de registros (municipio × año)"
          note="La intensidad refleja el volumen relativo de registros. «—» indica año sin datos, no cero registros."
        />
        <DataTable columns={columnasCobertura} rows={calidad.cobertura_municipio} rowKey={(r) => r.municipio} caption="Resumen de cobertura del período 2015–2023." />
      </Section>

      <Section title="Faltantes por variable" description="Porcentajes calculados sobre la base analítica completa. No se imputan valores en las vistas descriptivas.">
        <DataTable columns={columnasFaltantes} rows={calidad.faltantes} rowKey={(r) => r.variable} />
        <Banner tone="info" compact>
          En el modelo, los faltantes se imputan con la mediana del entrenamiento y activan un indicador de faltante. En las vistas descriptivas se muestran como «n.d.».
        </Banner>
      </Section>

      <Section title="Duplicados, extremos y valores bajos" description="Señales de calidad que condicionan la lectura de sumas y promedios.">
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="space-y-2">
            <h3 className="h3 text-navy">Duplicados</h3>
            <DefinitionList
              items={[
                { term: 'pk duplicados', detail: formatNumero(calidad.duplicados.pk_duplicados) },
                { term: 'Filas con matrícula repetida', detail: formatNumero(calidad.duplicados.matriculas_repetidas_filas) },
                { term: 'Matrículas distintas', detail: formatNumero(calidad.duplicados.matriculas_distintas) },
              ]}
            />
            <p className="nota">{calidad.duplicados.nota}</p>
            <Badge tone="info">{COPY.registros}</Badge>
          </Card>
          <Card className="space-y-2">
            <h3 className="h3 text-navy">Extremos IQR</h3>
            <p className="text-[1.5rem] font-bold text-navy">{formatNumero(calidad.extremos.es_extremo_iqr)}</p>
            <p className="nota">{formatPct(calidad.extremos.pct, 2)} de la base está marcada como extremo IQR.</p>
            <ProgressBar value={calidad.extremos.pct} tone="warning" />
            <p className="nota">{calidad.extremos.nota}</p>
          </Card>
          <Card className="space-y-2">
            <h3 className="h3 text-navy">Valores anormalmente bajos</h3>
            <DefinitionList
              items={[
                { term: 'Valor nominal < $1.000', detail: formatNumero(calidad.valores_bajos.valor_lt_1000) },
                { term: 'Valor nominal < $1 M', detail: formatNumero(calidad.valores_bajos.valor_lt_1m) },
              ]}
            />
            <p className="nota">{calidad.valores_bajos.nota}</p>
            <Badge tone="warning">señal de calidad, no irregularidad</Badge>
          </Card>
        </div>
      </Section>

      <Section title="Metodología" description="Fórmula de pesos constantes, protocolo del modelo y método de alertas.">
        <Accordion
          items={[
            {
              id: 'ipc',
              title: 'Pesos constantes de diciembre de 2023',
              badge: <Badge tone="method">BR-01</Badge>,
              content: (
                <div className="space-y-3">
                  <p>
                    <code className="rounded bg-navy-50 px-1.5 py-0.5">{calidad.metodologia.formula}</code>
                  </p>
                  <p className="nota">{calidad.metodologia.fuente_ipc}. {COPY.moneda}</p>
                  <DataTable columns={columnasIpc} rows={filasIpc} rowKey={(r) => r.anio} dense caption="El factor de 2023 es 1,0: es el año de referencia." />
                  <Banner tone="warning" compact>{COPY.nominal}</Banner>
                </div>
              ),
            },
            {
              id: 'modelo',
              title: 'Protocolo del modelo GAM cuantílico',
              badge: <Badge tone="method">experimental</Badge>,
              content: (
                <div className="space-y-3">
                  <DefinitionList
                    items={[
                      { term: 'Modelo', detail: m.id },
                      { term: 'Cuantil', detail: `q = ${m.cuantil} (mediana condicional)` },
                      { term: 'Regularización', detail: `alpha = ${m.alpha} (L1)` },
                      { term: 'Splines', detail: `grado ${m.grado_spline}, ${m.n_knots} nudos` },
                      { term: 'Entrenamiento', detail: m.entrenamiento },
                      { term: 'Evaluación', detail: `${m.evaluacion} (retrospectiva)` },
                      { term: 'Recorte de extremos', detail: m.sin_recortar_extremos ? 'No se recortan' : 'Sí se recortan' },
                      { term: 'MAE 2023', detail: formatCOP(m.mae_2023) },
                      { term: 'MAE mediana municipal 2023', detail: formatCOP(m.mae_mediana_2023) },
                      { term: 'Reducción de MAE 2023', detail: formatPct(m.reduccion_2023_pct, 2) },
                      { term: 'MAE 2022', detail: formatCOP(m.mae_2022) },
                      { term: 'Reducción de MAE 2022', detail: formatPct(m.reduccion_2022_pct, 2) },
                    ]}
                  />
                  <Banner tone="warning" title="Desempeño marginal y evaluación retrospectiva">
                    {COPY.retrospectiva} {m.nota_r2} R² observado en 2023: {m.r2_2023.toLocaleString('es-CO', { maximumFractionDigits: 4 })}.
                  </Banner>
                  <p className="nota">{COPY.experimental}</p>
                </div>
              ),
            },
            {
              id: 'alertas',
              title: 'Método de alertas',
              badge: <Badge tone="method">BR-08</Badge>,
              content: (
                <div className="space-y-2">
                  <DefinitionList
                    items={[
                      { term: 'Grupo comparable', detail: calidad.metodologia.alertas.grupo },
                      { term: 'Estadístico', detail: calidad.metodologia.alertas.estadistico },
                      { term: 'Umbral', detail: `|z| > ${calidad.metodologia.alertas.umbral}` },
                      { term: 'Mínimo por grupo', detail: `${calidad.metodologia.alertas.min_grupo} registros` },
                      { term: 'Factor MAD', detail: String(calidad.metodologia.alertas.mad_factor) },
                    ]}
                  />
                  <p className="nota">{COPY.alertas} Los grupos con menos de 30 registros o MAD nulo se suprimen.</p>
                </div>
              ),
            },
            {
              id: 'versiones',
              title: 'Versiones y entorno de ejecución',
              content: (
                <DefinitionList
                  items={Object.entries({ ...calidad.versiones, ...(manifest?.versions ?? {}) }).map(([k, v]) => ({ term: k, detail: String(v) }))}
                />
              ),
            },
          ]}
        />
      </Section>

      <Section title="Trazabilidad y reproducibilidad" description="Hashes criptográficos, versión de datos y paridad de la exportación del modelo al navegador.">
        {manifest ? (
          <Card className="space-y-3">
            <DefinitionList
              items={[
                { term: 'Versión de datos', detail: <code className="rounded bg-navy-50 px-1">{manifest.data_version}</code> },
                { term: 'Generado (UTC)', detail: formatFechaLarga(manifest.generated_at) },
                { term: 'Archivo fuente', detail: manifest.source.csv },
                { term: 'Filas / columnas', detail: `${formatNumero(manifest.source.rows)} / ${manifest.source.columns}` },
                { term: 'Paridad del GAM', detail: `${manifest.model.parity.passed ? 'aprobada' : 'NO aprobada'} · ${manifest.model.parity.n} casos · Δ máx ${manifest.model.parity.max_abs_diff.toExponential(3)} COP` },
                { term: 'Presupuesto JSON', detail: `${formatBytes(manifest.budget.total_bytes)} (${formatBytes(manifest.budget.total_gzip_bytes)} gzip) · ${manifest.budget.within_budget ? 'dentro del límite' : 'EXCEDIDO'}` },
                { term: 'Commit de git', detail: manifest.git_commit ?? 'no disponible (fuera de un repositorio)' },
              ]}
            />
            <div className="space-y-2">
              <div>
                <span className="label block">SHA-256 del CSV</span>
                <code className="block break-all rounded bg-navy-50 px-2 py-1 text-[0.74rem] text-navy">{manifest.source.csv_sha256}</code>
              </div>
              <div>
                <span className="label block">SHA-256 del modelo (joblib)</span>
                <code className="block break-all rounded bg-navy-50 px-2 py-1 text-[0.74rem] text-navy">{manifest.model.joblib_sha256}</code>
              </div>
            </div>
            <Banner tone="method" compact>
              El pipeline es determinista: <code className="rounded bg-white/60 px-1">python pipeline/preprocess.py --check</code> regenera en memoria y compara hashes byte a byte.
            </Banner>
          </Card>
        ) : (
          <Card>
            <p className="nota">Manifest no disponible. Los hashes del CSV y del modelo están en calidad.json:</p>
            <code className="mt-1 block break-all rounded bg-navy-50 px-2 py-1 text-[0.74rem]">{calidad.hashes.csv}</code>
          </Card>
        )}
      </Section>

      <Section title="Descargas" description="Los datos son públicos y agregados. El CSV de alertas conserva el identificador registral completo para trazabilidad.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="space-y-2">
            <h3 className="h3 text-navy">alertas.csv</h3>
            <p className="nota">
              Las {formatNumero(alertas?.resumen.total ?? 0)} señales completas con grupo comparable, mediana, z robusto, dirección y razón explicable.
              La vista de Alertas publica solo las {formatNumero(alertas?.mostrados ?? 500)} de mayor |z|.
            </p>
            <a href={urlAlertasCsv()} download="alertas.csv" className="inline-flex items-center gap-1.5 rounded-[10px] border border-navy bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-700">
              Descargar CSV completo
            </a>
          </Card>
          <Card className="space-y-2">
            <h3 className="h3 text-navy">manifest.json</h3>
            <p className="nota">Linaje, hashes, versiones, presupuesto de tamaño y resultado de la prueba de paridad del GAM.</p>
            <a href={urlManifest()} download="manifest.json" className="inline-flex items-center gap-1.5 rounded-[10px] border border-lightblue bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-navy-50">
              Descargar manifest
            </a>
          </Card>
        </div>
      </Section>
    </div>
  )
}
