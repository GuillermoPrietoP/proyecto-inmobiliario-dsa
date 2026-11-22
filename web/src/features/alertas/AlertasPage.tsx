/**
 * Vista /alertas — Alertas y operaciones atípicas (architecture.md §12.5).
 * Publica las 500 señales de mayor |z| de un total de 9.218 (2015–2023).
 * Las alertas son señales para investigar; no implican irregularidad (COPY.alertas).
 */
import { useEffect, useMemo, useState } from 'react'
import { AlertScatter, type PuntoAlerta } from '@/components/charts'
import { nombreCorto } from '@/components/GlobalFilters'
import { NotaMetodo, PageHeader } from '@/components/PageHeader'
import {
  Accordion,
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  KpiCard,
  Loading,
  ProgressBar,
  Section,
  Select,
  TextInput,
  type Columna,
} from '@/components/ui'
import { AYUDAS, COPY } from '@/content/es'
import { ANIOS, useFiltros } from '@/hooks/useFiltros'
import { SLUG_POR_NOMBRE, urlAlertasCsv, useAlertas } from '@/lib/data'
import { formatCOP, formatCOPCompacto, formatFecha, formatNumero, formatPct, formatRatio } from '@/lib/format'
import type { Alerta, CategoriaRazon, Slug } from '@/types/domain'
import { AlertaDetalle } from './AlertaDetalle'
import { CATEGORIA_INFO, DIRECCION_INFO, formatZ, pkEnmascarado, TRAMOS } from './etiquetas'
import { useFiltrosAlertas } from './useFiltrosAlertas'

const PAGINA_TAM = 25
const TOTAL_HISTORICO = 273586

interface FilaMunicipio {
  slug: Slug
  nombre: string
  alertas: number
  n: number
  tasa_pct: number
}

export default function AlertasPage() {
  const { data, isLoading, isError, error, refetch } = useAlertas()
  const { seleccionEfectiva, toggleMunicipio, municipiosDisponibles, setSeleccion } = useFiltros()
  const items = useMemo(() => data?.items ?? [], [data])
  const f = useFiltrosAlertas(items)
  const [pagina, setPagina] = useState(1)
  const [detalleId, setDetalleId] = useState<string | null>(null)

  const firmaFiltros = `${f.anio}|${seleccionEfectiva.join(',')}|${f.tramo}|${f.direccion}|${f.categoria}|${f.q}|${f.orden}`
  useEffect(() => {
    setPagina(1)
  }, [firmaFiltros])

  if (isLoading) return <Loading label="Cargando señales…" />
  if (isError || !data) return <ErrorState detail={error?.message} onRetry={() => refetch()} />

  const { resumen, metodo } = data
  const totalPaginas = Math.max(1, Math.ceil(f.filtrados.length / PAGINA_TAM))
  const pag = Math.min(pagina, totalPaginas)
  const desde = (pag - 1) * PAGINA_TAM
  const visibles = f.filtrados.slice(desde, desde + PAGINA_TAM)
  const detalle = detalleId ? (items.find((i) => i.id === detalleId) ?? null) : null
  const pctBaja = resumen.total > 0 ? (resumen.por_direccion.baja / resumen.total) * 100 : 0

  /* ------------------------------------------------------- scatter (señales) */
  const puntos: PuntoAlerta[] = f.filtrados.map((it) => ({
    id: it.id,
    x: it.num_anotacion,
    y: it.valor_real,
    label: `${nombreCorto(SLUG_POR_NOMBRE[it.municipio])} · ${formatFecha(it.fecha)} · ${pkEnmascarado(it.pk)}`,
    alerted: true,
    z: it.z_robusto,
  }))

  // Grupo dominante entre los items filtrados: su mediana sirve de referencia.
  const grupos = new Map<string, { n: number; medianas: number[]; etiqueta: string }>()
  for (const it of f.filtrados) {
    const clave = `${it.municipio}|${it.anio}|${it.tramo}`
    const g =
      grupos.get(clave) ??
      {
        n: 0,
        medianas: [],
        etiqueta: `${nombreCorto(SLUG_POR_NOMBRE[it.municipio])} × ${it.anio} × tramo ${it.tramo}`,
      }
    g.n += 1
    g.medianas.push(it.grupo_mediana_real)
    grupos.set(clave, g)
  }
  let dominante: { n: number; medianas: number[]; etiqueta: string } | null = null
  for (const g of grupos.values()) if (!dominante || g.n > dominante.n) dominante = g
  const medianaGrupo = dominante
    ? [...dominante.medianas].sort((a, b) => a - b)[Math.floor(dominante.medianas.length / 2)]
    : null

  /* --------------------------------------------------------- resumen municipal */
  const filasMunicipio: FilaMunicipio[] = resumen.por_municipio
    .map((m) => {
      const slug = SLUG_POR_NOMBRE[m.municipio]
      return { slug, nombre: nombreCorto(slug), alertas: m.alertas, n: m.n, tasa_pct: m.tasa_pct }
    })
    .filter((m) => municipiosDisponibles.includes(m.slug))
    .sort((a, b) => b.alertas - a.alertas)

  const columnasMunicipio: Array<Columna<FilaMunicipio>> = [
    { id: 'muni', header: 'Municipio', cell: (r) => <span className="font-semibold">{r.nombre}</span> },
    { id: 'alertas', header: 'Señales', align: 'right', cell: (r) => formatNumero(r.alertas) },
    {
      id: 'n',
      header: 'n elegible',
      align: 'right',
      cell: (r) => formatNumero(r.n),
      help: 'Registros en grupos comparables elegibles (≥ 30 observaciones y MAD > 0); no es el total histórico del municipio.',
    },
    {
      id: 'tasa',
      header: 'Tasa',
      align: 'right',
      cell: (r) => formatPct(r.tasa_pct, 2),
      help: 'Señales / n elegible del municipio. La tasa global usa el total histórico de 273.586 registros.',
    },
    {
      id: 'accion',
      header: 'Acción',
      cell: (r) => (
        <Button
          size="sm"
          variant="ghost"
          icon="search"
          onClick={() => setSeleccion([r.slug])}
          aria-label={`Filtrar las señales publicadas por ${r.nombre}`}
        >
          Filtrar
        </Button>
      ),
    },
  ]

  /* ------------------------------------------------------------- tabla señales */
  const columnas: Array<Columna<Alerta>> = [
    {
      id: 'pk',
      header: 'pk',
      help: 'Identificador del registro, enmascarado por defecto (últimos 6 caracteres). Abre el detalle para verlo completo.',
      cell: (r) => (
        <button
          type="button"
          onClick={() => setDetalleId(r.id)}
          className="enlace font-mono text-[0.78rem] font-semibold underline-offset-2 hover:underline"
          aria-label={`Ver detalle completo de la señal ${r.id}, pk terminado en ${r.pk.slice(-6)}`}
        >
          {pkEnmascarado(r.pk)}
        </button>
      ),
    },
    { id: 'municipio', header: 'Municipio', cell: (r) => nombreCorto(SLUG_POR_NOMBRE[r.municipio]) },
    { id: 'anio', header: 'Año', align: 'right', cell: (r) => r.anio },
    { id: 'fecha', header: 'Fecha', cell: (r) => formatFecha(r.fecha) },
    {
      id: 'real',
      header: 'Valor real',
      align: 'right',
      cell: (r) => formatCOPCompacto(r.valor_real),
      help: 'Moneda canónica: pesos constantes de diciembre de 2023.',
    },
    {
      id: 'nominal',
      header: 'Valor nominal',
      align: 'right',
      cell: (r) => formatCOP(r.valor_nominal),
      help: 'Monto tal como quedó registrado, sin ajuste por inflación.',
    },
    { id: 'anot', header: 'N.º anot.', align: 'right', cell: (r) => formatNumero(r.num_anotacion), help: AYUDAS.numAnotacion },
    { id: 'tramo', header: 'Tramo', cell: (r) => r.tramo },
    {
      id: 'grupon',
      header: 'n grupo',
      align: 'right',
      cell: (r) => formatNumero(r.grupo_n),
      help: 'Registros del grupo comparable: municipio × año × tramo de anotación.',
    },
    { id: 'mediana', header: 'Mediana grupo', align: 'right', cell: (r) => formatCOPCompacto(r.grupo_mediana_real) },
    {
      id: 'z',
      header: 'z robusto',
      align: 'right',
      help: 'Distancia robusta del log(valor real) frente a la mediana del grupo. Se señala si |z| > 3,5.',
      cell: (r) => <span className="font-semibold tabular-nums">{formatZ(r.z_robusto)}</span>,
    },
    {
      id: 'direccion',
      header: 'Dirección',
      cell: (r) => <Badge tone={DIRECCION_INFO[r.direccion].tono}>{DIRECCION_INFO[r.direccion].etiqueta}</Badge>,
    },
    {
      id: 'categoria',
      header: 'Categoría',
      cell: (r) => <Badge tone={CATEGORIA_INFO[r.categoria_razon].tono}>{CATEGORIA_INFO[r.categoria_razon].corta}</Badge>,
    },
    {
      id: 'dup',
      header: 'Duplicado',
      cell: (r) =>
        r.duplicado_valor ? (
          <Badge tone="warning" icon="warning">
            monto repetido
          </Badge>
        ) : (
          <span className="nota">no</span>
        ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Señales de investigación"
        title="Alertas y operaciones atípicas"
        lead={`Operaciones cuyo valor real se aleja de su grupo comparable (municipio × año × tramo de anotación). Aquí se publican las ${formatNumero(data.mostrados)} de mayor |z|; el total del periodo 2015–2023 es ${formatNumero(resumen.total)} señales (${formatPct(resumen.tasa_pct, 2)} de ${formatNumero(TOTAL_HISTORICO)} registros).`}
        badges={
          <>
            <Badge tone="warning" icon="warning">
              Señal para investigar
            </Badge>
            <Badge tone="method" icon="spark">
              |z| &gt; {formatRatio(metodo.umbral, 1)} · grupo ≥ {metodo.min_grupo}
            </Badge>
            <Badge tone="neutral" icon="doc">
              Top {formatNumero(data.mostrados)} publicadas de {formatNumero(resumen.total)}
            </Badge>
          </>
        }
      />

      <Banner tone="warning" title="Señal para investigar, no una conclusión">
        {COPY.alertas}
      </Banner>

      {/* ------------------------------------------------------------- KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Señales totales"
          value={formatNumero(resumen.total)}
          help={`Sobre ${formatNumero(TOTAL_HISTORICO)} registros del periodo 2015–2023; la tabla muestra las ${data.mostrados} de mayor |z|.`}
          footer="Periodo 2015–2023 · 6 municipios"
        />
        <KpiCard
          label="Tasa global"
          value={formatPct(resumen.tasa_pct, 2)}
          help={`Señales sobre el total histórico de ${formatNumero(TOTAL_HISTORICO)} registros (no solo los elegibles).`}
        />
        <KpiCard
          label="Señales de valor bajo"
          value={formatNumero(resumen.por_direccion.baja)}
          help="Valores anormalmente bajos frente a su grupo. Incluyen posibles registros en millones o con unidad inconsistente: señal de calidad."
        />
        <KpiCard
          label="Señales de valor alto"
          value={formatNumero(resumen.por_direccion.alta)}
          help="Valores anormalmente altos frente a la mediana de su grupo comparable."
        />
        <KpiCard
          label="Registros en grupos elegibles"
          value={formatNumero(resumen.n_elegible)}
          help="Registros en grupos con ≥ 30 observaciones y MAD > 0. La tasa global usa el total histórico (273.586), no este denominador."
        />
      </div>
      <NotaMetodo>
        Los KPIs y resúmenes cubren todo el periodo 2015–2023. La tabla y el scatter aplican el año de corte global
        ({f.anio}) y los municipios seleccionados; el detalle de cada señal conserva su año original.
      </NotaMetodo>

      {/* ------------------------------------------- resumen por municipio */}
      <Section
        title="Señales por municipio"
        description={`Totales del periodo 2015–2023 dentro del alcance seleccionado. «n elegible» son los registros en grupos comparables con ≥ 30 observaciones y MAD > 0 (${formatNumero(resumen.n_elegible)} en total): la tasa por municipio usa ese denominador, mientras que la tasa global (${formatPct(resumen.tasa_pct, 2)}) usa el total histórico de ${formatNumero(TOTAL_HISTORICO)} registros.`}
      >
        <DataTable
          columns={columnasMunicipio}
          rows={filasMunicipio}
          rowKey={(r) => r.slug}
          dense
          caption="«Filtrar» deja solo ese municipio en la selección (se refleja en la URL y en la tabla de señales)."
          highlight={(r) => seleccionEfectiva.length === 1 && seleccionEfectiva[0] === r.slug}
        />
      </Section>

      {/* ------------------------------------------ distribución por categoría */}
      <Section
        title="Distribución por categoría"
        description="Conteos del periodo completo 2015–2023 (no solo las 500 publicadas). El botón de cada categoría filtra la tabla de señales publicadas."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(Object.keys(CATEGORIA_INFO) as CategoriaRazon[]).map((cat) => {
            const info = CATEGORIA_INFO[cat]
            const n = resumen.por_categoria[cat] ?? 0
            return (
              <Card key={cat} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone={info.tono}>{info.etiqueta}</Badge>
                  <span className="text-[1.2rem] font-bold tabular-nums text-navy">{formatNumero(n)}</span>
                </div>
                <ProgressBar value={n} max={resumen.total} tone={info.tono} />
                <p className="nota">{info.descripcion}</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="nota">{formatPct(resumen.total > 0 ? (n / resumen.total) * 100 : 0, 1)} del total de señales</span>
                  <Button size="sm" variant="ghost" icon="search" onClick={() => f.setCategoria(cat)}>
                    Filtrar señales publicadas
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
        <Banner tone="info" compact>
          Los valores bajos incluyen registros nominales de $5 o $35: posible registro en millones o unidad
          inconsistente. Es una señal de calidad de los datos; conviene verificar la fuente antes de usar el registro.
        </Banner>
      </Section>

      {/* ----------------------------------------------------------- filtros */}
      <Section
        title="Filtros de las señales publicadas"
        description={`La tabla y el scatter trabajan sobre las ${formatNumero(data.mostrados)} señales de mayor |z| publicadas en alertas.json. El año de corte, el alcance y la moneda se controlan en los filtros globales de arriba.`}
        actions={
          f.hayFiltrosLocales ? (
            <Button size="sm" variant="ghost" icon="close" onClick={f.limpiar}>
              Limpiar filtros
            </Button>
          ) : undefined
        }
      >
        <Card className="space-y-3">
          <div>
            <span className="label mb-1.5 block">Municipios</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar señales por municipio">
              {municipiosDisponibles.map((slug) => (
                <Chip
                  key={slug}
                  active={seleccionEfectiva.includes(slug)}
                  onClick={() => toggleMunicipio(slug)}
                  title={NOMBRE_COMPLETO(slug)}
                >
                  {nombreCorto(slug)}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Field label="Tramo de anotación" htmlFor="f-tramo" help={AYUDAS.numAnotacion}>
              <Select id="f-tramo" value={f.tramo} onChange={(e) => f.setTramo(e.target.value)}>
                <option value="todos">Todos</option>
                {TRAMOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Dirección" htmlFor="f-direccion">
              <Select id="f-direccion" value={f.direccion} onChange={(e) => f.setDireccion(e.target.value)}>
                <option value="todas">Todas</option>
                <option value="alta">Valor alto (alta)</option>
                <option value="baja">Valor bajo (baja)</option>
              </Select>
            </Field>
            <Field label="Categoría" htmlFor="f-categoria">
              <Select id="f-categoria" value={f.categoria} onChange={(e) => f.setCategoria(e.target.value)}>
                <option value="todas">Todas</option>
                {(Object.keys(CATEGORIA_INFO) as CategoriaRazon[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORIA_INFO[cat].etiqueta}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Buscar pk o matrícula" htmlFor="f-q">
              <div className="relative">
                <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-mock" />
                <TextInput
                  id="f-q"
                  type="search"
                  value={f.q}
                  onChange={(e) => f.setQ(e.target.value)}
                  placeholder="p. ej. 294-67083"
                  className="pl-8"
                />
              </div>
            </Field>
            <Field label="Orden" htmlFor="f-orden">
              <Select id="f-orden" value={f.orden} onChange={(e) => f.setOrden(e.target.value)}>
                <option value="z">|z| descendente</option>
                <option value="real_asc">Valor real ascendente</option>
                <option value="real_desc">Valor real descendente</option>
              </Select>
            </Field>
          </div>

          <p className="nota" aria-live="polite">
            {formatNumero(f.filtrados.length)} de {formatNumero(data.mostrados)} señales publicadas coinciden con los
            filtros (año {f.anio}). El total del periodo es {formatNumero(resumen.total)} y está en el CSV completo.
          </p>
          <p className="nota">
            Distribución de las {formatNumero(data.mostrados)} publicadas por año:{' '}
            {ANIOS.map((a) => `${a} (${f.porAnioPublicadas.get(a) ?? 0})`).join(' · ')}. Cambia el año de corte global
            para explorar otros años.
          </p>
        </Card>

        {f.filtrados.length === 0 ? (
          <Banner tone="info" title="Sin coincidencias en las señales publicadas">
            Ninguna de las {formatNumero(data.mostrados)} señales publicadas coincide con los filtros actuales; descarga
            el CSV completo para revisar las {formatNumero(resumen.total)} señales del periodo.
          </Banner>
        ) : null}
      </Section>

      {/* ----------------------------------------------------------- scatter */}
      {puntos.length > 0 ? (
        <AlertScatter
          puntos={puntos}
          medianaGrupo={medianaGrupo}
          title="Valor real vs. complejidad registral (señales publicadas)"
          note={
            <>
              La nube de puntos corresponde únicamente a las señales publicadas (top {formatNumero(data.mostrados)} por
              |z|), no a todos los registros del grupo. La línea verde es la mediana del grupo comparable
              {dominante ? ` dominante: ${dominante.etiqueta} (${dominante.n} señales)` : ''}. Selecciona un solo
              municipio y un tramo para una lectura más precisa. Haz clic en un punto para abrir el detalle.
            </>
          }
          summary={`Dispersión de ${puntos.length} señales: valor real en escala logarítmica frente al número de anotación, con la mediana del grupo comparable como referencia.`}
          onSelect={(id) => setDetalleId(id)}
        />
      ) : (
        <EmptyState title="Sin señales que graficar">
          Ninguna señal publicada coincide con los filtros actuales. Ajusta el año o los filtros, o descarga el CSV
          completo.
        </EmptyState>
      )}

      {/* ------------------------------------------------------------- tabla */}
      <Section
        title={`Señales publicadas · top ${formatNumero(data.mostrados)} por |z|`}
        description="Cada fila abre el detalle con el pk completo, los estadísticos del grupo y la razón de la señal. El pk se muestra enmascarado (últimos 6 caracteres) por defecto."
        actions={
          <Badge tone="neutral" icon="doc">
            {formatNumero(f.filtrados.length)} filtradas · {formatNumero(data.mostrados)} publicadas ·{' '}
            {formatNumero(resumen.total)} en total
          </Badge>
        }
      >
        {f.filtrados.length > 0 ? (
          <>
            {/* Escritorio: tabla con scroll horizontal */}
            <div className="hidden md:block">
              <DataTable
                columns={columnas}
                rows={visibles}
                rowKey={(r) => r.id}
                dense
                caption={`Año ${f.anio} · página ${pag} de ${totalPaginas} · valores reales en COP dic-2023; el valor nominal es secundario.`}
              />
            </div>

            {/* Móvil: tarjetas legibles */}
            <ul className="space-y-2 md:hidden">
              {visibles.map((it) => (
                <Card as="li" key={it.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[0.9rem] font-bold text-navy">
                      {nombreCorto(SLUG_POR_NOMBRE[it.municipio])} · {formatFecha(it.fecha)}
                    </p>
                    <Badge tone={DIRECCION_INFO[it.direccion].tono}>{DIRECCION_INFO[it.direccion].etiqueta}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={CATEGORIA_INFO[it.categoria_razon].tono}>{CATEGORIA_INFO[it.categoria_razon].corta}</Badge>
                    {it.duplicado_valor ? (
                      <Badge tone="warning" icon="warning">
                        monto repetido
                      </Badge>
                    ) : null}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[0.8rem]">
                    <div>
                      <dt className="label">Valor real</dt>
                      <dd className="font-semibold tabular-nums text-navy">{formatCOPCompacto(it.valor_real)}</dd>
                    </div>
                    <div>
                      <dt className="label">Valor nominal</dt>
                      <dd className="tabular-nums text-navy">{formatCOP(it.valor_nominal)}</dd>
                    </div>
                    <div>
                      <dt className="label">z robusto</dt>
                      <dd className="font-semibold tabular-nums text-navy">{formatZ(it.z_robusto)}</dd>
                    </div>
                    <div>
                      <dt className="label">Tramo · n grupo</dt>
                      <dd className="text-navy">
                        {it.tramo} · {formatNumero(it.grupo_n)}
                      </dd>
                    </div>
                    <div>
                      <dt className="label">Mediana grupo</dt>
                      <dd className="tabular-nums text-navy">{formatCOPCompacto(it.grupo_mediana_real)}</dd>
                    </div>
                    <div>
                      <dt className="label">pk</dt>
                      <dd className="font-mono text-navy">{pkEnmascarado(it.pk)}</dd>
                    </div>
                  </dl>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => setDetalleId(it.id)}
                    aria-label={`Ver detalle de la señal ${it.id}`}
                  >
                    Ver detalle y pk completo
                  </Button>
                </Card>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="nota" aria-live="polite">
                Mostrando {formatNumero(desde + 1)}–{formatNumero(desde + visibles.length)} de{' '}
                {formatNumero(f.filtrados.length)} señales filtradas.
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={pag <= 1} onClick={() => setPagina(pag - 1)} aria-label="Página anterior">
                  Anterior
                </Button>
                <span className="text-[0.8rem] font-semibold tabular-nums text-navy">
                  Página {pag} de {totalPaginas}
                </span>
                <Button size="sm" disabled={pag >= totalPaginas} onClick={() => setPagina(pag + 1)} aria-label="Página siguiente">
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </Section>

      {/* ---------------------------------------------------------- descarga */}
      <Section
        title="Descarga el CSV completo"
        description={`El JSON publicado trae solo las ${formatNumero(data.mostrados)} señales de mayor |z|; el CSV incluye las ${formatNumero(resumen.total)} señales del periodo 2015–2023.`}
      >
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1.5">
            <a
              href={urlAlertasCsv()}
              download
              className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-navy bg-navy px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-700"
            >
              <Icon name="download" className="h-4 w-4" />
              Descargar alertas.csv ({formatNumero(resumen.total)} filas)
            </a>
            <p className="nota max-w-xl">
              El CSV conserva el pk completo para trazabilidad. Los datos son públicos y se publican agregados a partir
              de registros de compraventa urbana.
            </p>
          </div>
          <Badge tone="method" icon="doc">
            CSV · {formatNumero(resumen.total)} filas
          </Badge>
        </Card>
      </Section>

      {/* ------------------------------------------------- cómo leer las señales */}
      <Section title="Cómo leer estas señales">
        <Accordion
          items={[
            {
              id: 'metodo',
              title: 'El método: z robusto por grupo comparable',
              badge: <Badge tone="method">método</Badge>,
              content: (
                <div className="space-y-2">
                  <p>
                    Cada registro se compara con su <strong>grupo comparable</strong>: mismo municipio, mismo año y
                    mismo tramo de número de anotación ({metodo.tramos.join(', ')}). El grupo necesita al menos{' '}
                    {formatNumero(metodo.min_grupo)} registros y una MAD mayor que cero.
                  </p>
                  <p>
                    El estadístico es un <strong>z robusto sobre el logaritmo del valor real</strong>:
                  </p>
                  <p>
                    <code className="rounded bg-navy-50 px-1.5 py-0.5 text-[0.8rem]">
                      z = (log(valor_real) − mediana_log_grupo) / ({formatRatio(metodo.mad_factor, 4)} × MAD_grupo)
                    </code>
                  </p>
                  <p>
                    Se publica una señal cuando |z| &gt; {formatRatio(metodo.umbral, 1)}. El factor{' '}
                    {formatRatio(metodo.mad_factor, 4)} vuelve la MAD comparable con la desviación estándar de una
                    distribución normal; la mediana y la MAD resisten los valores extremos sin dejarse arrastrar por
                    ellos.
                  </p>
                  <p className="nota">{metodo.descripcion}</p>
                </div>
              ),
            },
            {
              id: 'por-que-bajos',
              title: '¿Por qué la mayoría son valores bajos?',
              content: (
                <p>
                  De las {formatNumero(resumen.total)} señales, {formatNumero(resumen.por_direccion.baja)} (
                  {formatPct(pctBaja, 1)}) son valores anormalmente bajos y {formatNumero(resumen.por_direccion.alta)}{' '}
                  son valores anormalmente altos. En la fuente aparecen montos nominales como $5 o $35, compatibles con
                  registros hechos en millones o con unidades inconsistentes;{' '}
                  {formatNumero(resumen.por_categoria.valor_bajo_unidad ?? 0)} señales están marcadas como posible
                  unidad inconsistente. Esto es una <strong>señal de calidad de los datos</strong>: el valor registrado
                  no es usable tal cual, pero no describe la operación en sí.
                </p>
              ),
            },
            {
              id: 'que-hacer',
              title: 'Qué hacer con una señal',
              content: (
                <ul className="list-disc space-y-1 pl-5">
                  <li>Verifica la fuente (escritura u oficina de registro) antes de usar el registro en un análisis.</li>
                  <li>Revisa si el monto está expresado en miles o millones, o si le faltan ceros.</li>
                  <li>Compara con la mediana y el rango Q1–Q3 del grupo que muestra el detalle.</li>
                  <li>
                    Si el monto repetido corresponde a varios actos del mismo folio, recuerda que los registros no son
                    inmuebles únicos.
                  </li>
                  <li>
                    Usa el CSV completo para revisar las {formatNumero(resumen.total)} señales, no solo las{' '}
                    {formatNumero(data.mostrados)} publicadas.
                  </li>
                </ul>
              ),
            },
            {
              id: 'que-no',
              title: 'Qué NO significan estas señales',
              content: (
                <div className="space-y-2">
                  <p>{COPY.alertas}</p>
                  <p>
                    Una señal no es una conclusión sobre la operación ni sobre las personas que participaron: es una
                    distancia estadística frente a un grupo comparable. No equivale a un avalúo, no invalida el
                    registro y no sustituye la verificación documental. Muchos valores bajos son simples problemas de
                    unidades en la fuente.
                  </p>
                </div>
              ),
            },
          ]}
        />
      </Section>

      <AlertaDetalle alerta={detalle} metodo={metodo} onCerrar={() => setDetalleId(null)} />
    </div>
  )
}

/** Nombre completo del municipio para el atributo title de los chips. */
function NOMBRE_COMPLETO(slug: Slug): string {
  return nombreCorto(slug)
}
