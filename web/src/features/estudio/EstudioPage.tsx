/**
 * Mi Estudio — asistente de decisión en 3 pasos y exportación (architecture.md §12.7).
 *
 * Paso 1 selección · Paso 2 evidencia automática · Paso 3 limitaciones y checklist.
 * BR-11: el reporte no se genera sin completar el paso 3.
 * Los estudios se guardan en localStorage (sin PII) y se exportan en el navegador.
 */
import { useMemo, useState } from 'react'
import { saveAs } from 'file-saver'
import {
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  Collapsible,
  DataTable,
  DefinitionList,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  KpiCard,
  LinkButton,
  Loading,
  Section,
  Select,
  TextArea,
  TextInput,
  type Columna,
} from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { nombreCorto } from '@/components/GlobalFilters'
import { CHECKLIST_CAMPO, COPY, GATE, LIMITACIONES, PREGUNTAS_INVERSIONISTA } from '@/content/es'
import { ANIOS, useFiltros, useParam } from '@/hooks/useFiltros'
import { NOMBRE_POR_SLUG, SLUGS, useAlertas, useComparacion, useGam, useManifest, usePanorama } from '@/lib/data'
import { formatCOP, formatCOPCompacto, formatDelta, formatFecha, formatNumero, formatPct, formatRatio } from '@/lib/format'
import { colorMunicipio } from '@/lib/palette'
import { MAX_ESTUDIOS, MAX_MUNICIPIOS_ESTUDIO, puedeExportar, useStudyStore } from '@/stores/study'
import type { Estudio, MunicipioNombre, Slug } from '@/types/domain'
import { construirReporte, nombreReporte, type ReportData } from './report/datos'
import { generarMarkdown } from './report/markdown'

const NOMBRE_UI: Record<MunicipioNombre, string> = {
  ARMENIA: 'Armenia',
  CALARCÁ: 'Calarcá',
  DOSQUEBRADAS: 'Dosquebradas',
  MANIZALES: 'Manizales',
  PEREIRA: 'Pereira',
  'SANTA ROSA DE CABAL': 'Santa Rosa de Cabal',
}

const PASOS = [
  { id: '1', label: '1 · Selección' },
  { id: '2', label: '2 · Evidencia' },
  { id: '3', label: '3 · Limitaciones' },
]

export default function EstudioPage() {
  const { anio, alcance } = useFiltros()
  const [paso, setPaso] = useParam('paso', '1')
  const { data: manifest, isPending: pManifest } = useManifest()
  const { data: comparacion, isPending: pComp, isError, error, refetch } = useComparacion()
  const { data: panorama } = usePanorama()
  const { data: alertas } = useAlertas()
  const { data: gam } = useGam()

  const borrador = useStudyStore((s) => s.borrador)
  const guardados = useStudyStore((s) => s.guardados)
  const aviso = useStudyStore((s) => s.aviso)
  const iniciar = useStudyStore((s) => s.iniciar)
  const actualizar = useStudyStore((s) => s.actualizar)
  const toggleMunicipio = useStudyStore((s) => s.toggleMunicipio)
  const setEvidencia = useStudyStore((s) => s.setEvidencia)
  const setChecklist = useStudyStore((s) => s.setChecklist)
  const guardar = useStudyStore((s) => s.guardar)
  const cargar = useStudyStore((s) => s.cargar)
  const eliminar = useStudyStore((s) => s.eliminar)
  const descartar = useStudyStore((s) => s.descartar)
  const setAviso = useStudyStore((s) => s.setAviso)

  const [exportando, setExportando] = useState<'pdf' | 'md' | null>(null)
  const [errorExport, setErrorExport] = useState<string | null>(null)
  const [confirmarDescarte, setConfirmarDescarte] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)

  const reporte = useMemo<ReportData | null>(() => {
    if (!borrador || !comparacion) return null
    return construirReporte(borrador, { panorama, comparacion, alertas, gam, manifest })
  }, [borrador, comparacion, panorama, alertas, gam, manifest])

  const validez = puedeExportar(borrador)

  if (pManifest || pComp) return <Loading label="Cargando el asistente de estudio…" />
  if (isError || !comparacion) return <ErrorState detail={error?.message} onRetry={() => refetch()} />

  async function exportarPdf() {
    if (!reporte) return
    setExportando('pdf')
    setErrorExport(null)
    try {
      const { descargarPdf } = await import('./report/pdf')
      await descargarPdf(reporte)
    } catch (e) {
      setErrorExport(e instanceof Error ? e.message : 'No se pudo generar el PDF.')
    } finally {
      setExportando(null)
    }
  }

  function exportarMarkdown() {
    if (!reporte) return
    setExportando('md')
    setErrorExport(null)
    try {
      const md = generarMarkdown(reporte)
      saveAs(new Blob([`\uFEFF${md}`], { type: 'text/markdown;charset=utf-8' }), nombreReporte(reporte.estudio, 'md'))
    } catch (e) {
      setErrorExport(e instanceof Error ? e.message : 'No se pudo generar el Markdown.')
    } finally {
      setExportando(null)
    }
  }

  /* ------------------------------------------------------------- sin borrador */
  if (!borrador) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Mi estudio"
          title="Asistente de decisión y exportación"
          lead="Selecciona hasta 3 municipios, recibe evidencia automática, reconoce las limitaciones físicas y descarga un reporte preliminar en PDF o Markdown."
          badges={<Badge tone="method" icon="spark">3 pasos · sin servidor</Badge>}
        />
        <Banner tone="info" title="Qué produce este asistente">
          Un informe de <strong>priorización</strong>: justifica en qué municipio profundizar un estudio de campo. No recomienda
          comprar, no produce avalúos y no garantiza rentabilidad. {COPY.profundizar}
        </Banner>
        <Card className="space-y-3">
          <h2 className="h3 text-navy">Iniciar un estudio</h2>
          <DefinitionList
            items={[
              { term: 'Año de corte', detail: String(anio) },
              { term: 'Alcance', detail: alcance === '3' ? '3 ciudades capitales' : '6 municipios' },
              { term: 'Versión de datos', detail: manifest?.data_version ?? 'n.d.' },
              { term: 'Máximo de municipios', detail: `${MAX_MUNICIPIOS_ESTUDIO} (para mantener el reporte legible)` },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon="plus" onClick={() => iniciar(anio, manifest?.data_version ?? 'sin-manifest')}>
              Iniciar estudio en {anio}
            </Button>
            {guardados.length > 0 ? (
              <Button variant="secondary" onClick={() => cargar(guardados[0].id)}>
                Retomar el más reciente
              </Button>
            ) : null}
          </div>
          {aviso ? <p className="nota text-orange-mock">{aviso}</p> : null}
        </Card>
        <EstudiosGuardados guardados={guardados} onCargar={cargar} onEliminar={eliminar} />
      </div>
    )
  }

  /* ------------------------------------------------------------- con borrador */
  const e = borrador
  const filas = reporte?.filas ?? []
  const conDatos = filas.filter((f) => f.tiene_datos)

  const columnasGuardados: Array<Columna<Estudio>> = [
    { id: 'titulo', header: 'Estudio', cell: (r) => <span className="font-semibold">{r.titulo || 'Sin título'}</span> },
    { id: 'munis', header: 'Municipios', cell: (r) => r.municipios.map((m) => NOMBRE_UI[m]).join(', ') || '—' },
    { id: 'anio', header: 'Año', align: 'right', cell: (r) => r.anio },
    { id: 'fecha', header: 'Actualizado', cell: (r) => formatFecha(r.actualizado_en.slice(0, 10)) },
    {
      id: 'acciones',
      header: 'Acciones',
      cell: (r) => (
        <span className="flex gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => { cargar(r.id); setPaso('1') }}>Abrir</Button>
          <Button size="sm" variant="ghost" onClick={() => eliminar(r.id)}>Eliminar</Button>
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Mi estudio"
        title={e.titulo || 'Estudio preliminar sin título'}
        lead="Tres pasos: selección, evidencia automática y reconocimiento de limitaciones. El reporte se genera en tu navegador."
        badges={
          <>
            <Badge tone="info">{e.municipios.length} / {MAX_MUNICIPIOS_ESTUDIO} municipios</Badge>
            <Badge tone="neutral">año {e.anio}</Badge>
            <Badge tone={validez.ok ? 'success' : 'warning'} icon={validez.ok ? 'check' : 'warning'}>
              {validez.ok ? 'listo para exportar' : 'paso 3 pendiente'}
            </Badge>
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" icon="doc" onClick={() => { guardar(); setGuardadoOk(true) }}>
              Guardar
            </Button>
            <Button variant="ghost" size="sm" icon="close" onClick={() => setConfirmarDescarte(true)}>
              Descartar
            </Button>
          </>
        }
      />

      {guardadoOk ? <Banner tone="success" compact>Estudio guardado en este navegador (localStorage). No se envió a ningún servidor.</Banner> : null}
      {aviso ? <Banner tone="warning" compact>{aviso}</Banner> : null}

      {/* -------------------------------------------------------- stepper */}
      <div className="card card-pad space-y-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Pasos del estudio">
          {PASOS.map((p) => (
            <button
              key={p.id}
              role="tab"
              type="button"
              aria-selected={paso === p.id}
              onClick={() => setPaso(p.id)}
              className={`rounded-pill border px-3.5 py-1.5 text-[0.82rem] font-semibold transition-colors ${
                paso === p.id ? 'border-navy bg-navy text-white' : 'border-lightblue bg-white text-navy hover:bg-navy-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-pill bg-lightblue/60">
          <div className="h-full rounded-pill bg-blue-mock transition-[width]" style={{ width: `${(Number(paso) / 3) * 100}%` }} />
        </div>
      </div>

      {/* ---------------------------------------------------------- paso 1 */}
      {paso === '1' ? (
        <Section title="Paso 1 · Selección del estudio" description="Define el alcance de tu investigación. Máximo 3 municipios para mantener el reporte legible.">
          <Card className="space-y-4">
            <Field label="Título del estudio" htmlFor="est-titulo" error={!e.titulo.trim() ? 'El título es obligatorio para exportar.' : null}>
              <TextInput
                id="est-titulo"
                value={e.titulo}
                placeholder="Ej.: Priorización de municipios para vivienda urbana en el Eje Cafetero"
                onChange={(ev) => actualizar({ titulo: ev.target.value })}
                maxLength={140}
              />
            </Field>

            <div>
              <span className="label mb-1.5 block">Municipios (1–{MAX_MUNICIPIOS_ESTUDIO})</span>
              <div className="flex flex-wrap gap-1.5">
                {SLUGS.map((s: Slug) => {
                  const nombre = NOMBRE_POR_SLUG[s]
                  const activo = e.municipios.includes(nombre)
                  const lleno = !activo && e.municipios.length >= MAX_MUNICIPIOS_ESTUDIO
                  return (
                    <Chip key={s} active={activo} disabled={lleno} onClick={() => toggleMunicipio(nombre)} title={lleno ? `Máximo ${MAX_MUNICIPIOS_ESTUDIO} municipios` : nombre}>
                      <span className="h-2 w-2 rounded-full" style={{ background: colorMunicipio(s) }} aria-hidden="true" />
                      {nombreCorto(s)}
                    </Chip>
                  )
                })}
              </div>
              {e.municipios.length === 0 ? <p className="nota mt-1 text-orange-mock">Selecciona al menos un municipio.</p> : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Año de corte" htmlFor="est-anio">
                <Select id="est-anio" value={e.anio} onChange={(ev) => actualizar({ anio: Number(ev.target.value) })}>
                  {ANIOS.map((a) => <option key={a} value={a}>{a}</option>)}
                </Select>
              </Field>
              <Field label="Alcance" htmlFor="est-alcance">
                <Select id="est-alcance" value={e.alcance} onChange={(ev) => actualizar({ alcance: ev.target.value as Estudio['alcance'] })}>
                  <option value="6_municipios">6 municipios</option>
                  <option value="3_municipios">3 ciudades capitales</option>
                </Select>
              </Field>
              <Field label="Horizonte de inversión" htmlFor="est-horizonte">
                <Select id="est-horizonte" value={e.horizonte} onChange={(ev) => actualizar({ horizonte: ev.target.value })}>
                  {['1–2 años', '3–5 años', '5–10 años', 'Más de 10 años', 'Por definir'].map((h) => <option key={h} value={h}>{h}</option>)}
                </Select>
              </Field>
            </div>

            <Field label="Objetivo del estudio" htmlFor="est-objetivo" help="Texto libre. Se incluye en el reporte y se escapa al exportar.">
              <TextArea
                id="est-objetivo"
                value={e.objetivo}
                placeholder="Ej.: identificar en qué municipio profundizar un estudio de oferta, arriendos y costos para vivienda urbana."
                onChange={(ev) => actualizar({ objetivo: ev.target.value })}
                maxLength={800}
              />
            </Field>

            <Field label="Perfil del inversionista (opcional)" htmlFor="est-perfil">
              <TextInput id="est-perfil" value={e.perfil} placeholder="Ej.: particular, fondo pequeño, constructor" onChange={(ev) => actualizar({ perfil: ev.target.value })} maxLength={120} />
            </Field>

            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              <Button variant="primary" icon="arrowRight" onClick={() => setPaso('2')} disabled={e.municipios.length === 0}>
                Continuar a la evidencia
              </Button>
              <LinkButton to="/comparar" variant="ghost" size="md">Abrir comparación multivariable</LinkButton>
            </div>
          </Card>
        </Section>
      ) : null}

      {/* ---------------------------------------------------------- paso 2 */}
      {paso === '2' ? (
        <Section title="Paso 2 · Evidencia automática" description="El observatorio reúne la evidencia de los municipios seleccionados. Elige qué incluir en el reporte.">
          {conDatos.length === 0 ? (
            <EmptyState title="Sin evidencia para este año">
              Los municipios seleccionados no tienen registros en {e.anio}. Cambia el año en el paso 1.
            </EmptyState>
          ) : (
            <>
              <div className="grid gap-3 lg:grid-cols-3">
                {filas.map((f) => (
                  <Card key={f.slug} className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="h3 text-navy">{f.nombre_ui}</h3>
                      {f.serie_parcial ? <Badge tone="warning">serie parcial</Badge> : null}
                    </div>
                    {!f.tiene_datos ? (
                      <p className="nota">Sin datos en {e.anio}.</p>
                    ) : (
                      <>
                        <DefinitionList
                          items={[
                            { term: 'Registros', detail: formatNumero(f.registros) },
                            { term: 'Participación', detail: formatPct(f.share_pct, 2) },
                            { term: 'Var. anual', detail: formatDelta(f.var_registros_pct) },
                            { term: 'Mediana real', detail: formatCOPCompacto(f.mediana_real) },
                            { term: 'Q1–Q3', detail: `${formatCOPCompacto(f.q1)} – ${formatCOPCompacto(f.q3)}` },
                            { term: 'IQR/mediana', detail: formatRatio(f.iqr_ratio) },
                            { term: 'Población', detail: formatNumero(f.poblacion_total) },
                            { term: 'VA real p/c', detail: formatCOPCompacto(f.va_real_pc) },
                            { term: 'Señales', detail: formatNumero(f.alertas) },
                          ]}
                        />
                        <Badge tone={f.gam_habilitado ? (f.gam_mejora < 1 ? 'warning' : 'success') : 'danger'} icon={f.gam_habilitado ? 'check' : 'lock'}>
                          GAM {f.gam_habilitado ? `mejora ${formatPct(f.gam_mejora, 2)}` : 'sin mejora demostrada'}
                        </Badge>
                        <LinkButton to={`/municipio/${f.slug}?anio=${e.anio}`} size="sm" variant="ghost">Ver ficha</LinkButton>
                      </>
                    )}
                  </Card>
                ))}
              </div>

              <Card className="space-y-3">
                <h3 className="h3 text-navy">Qué incluir en el reporte</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Checkbox label="Actividad transaccional" description="Registros, participación, variación anual y serie histórica." checked={e.evidencia.incluir_actividad} onChange={(ev) => setEvidencia('incluir_actividad', ev.target.checked)} />
                  <Checkbox label="Valores registrados" description="Mediana real, Q1–Q3, dispersión y serie histórica." checked={e.evidencia.incluir_valores} onChange={(ev) => setEvidencia('incluir_valores', ev.target.checked)} />
                  <Checkbox label="Contexto urbano y económico" description="Población, VA real per cápita, licencias y predios nuevos." checked={e.evidencia.incluir_contexto} onChange={(ev) => setEvidencia('incluir_contexto', ev.target.checked)} />
                  <Checkbox label="Alertas y operaciones atípicas" description="Conteos por municipio y ejemplos, como señales de investigación." checked={e.evidencia.incluir_alertas} onChange={(ev) => setEvidencia('incluir_alertas', ev.target.checked)} />
                  <Checkbox
                    label="Estimación GAM (experimental)"
                    description={e.gam ? `Incluye la estimación guardada para ${NOMBRE_UI[e.gam.municipio]}.` : 'Aún no has guardado una estimación desde el simulador.'}
                    checked={e.evidencia.incluir_gam}
                    disabled={!e.gam}
                    onChange={(ev) => setEvidencia('incluir_gam', ev.target.checked)}
                  />
                </div>
                {!e.gam ? (
                  <Banner tone="info" compact>
                    Para incluir una estimación, ve al <LinkButton to="/estimaciones" size="sm" variant="ghost">simulador GAM</LinkButton> y usa
                    «Guardar estimación en Mi Estudio». La compuerta y el reconocimiento de limitaciones quedan registrados en el reporte.
                  </Banner>
                ) : null}
                {e.gam && !gam?.municipios[e.gam.municipio]?.habilitado ? (
                  <Banner tone="danger" title={GATE.titulo}>
                    La estimación guardada corresponde a {NOMBRE_UI[e.gam.municipio]}, donde el GAM no supera la mediana municipal
                    ({formatDelta(e.gam.mejora_pct)}). El reporte incluirá esta advertencia y el estado del reconocimiento
                    ({e.gam.reconocio_limitacion ? 'marcado' : 'sin marcar'}).
                  </Banner>
                ) : null}
              </Card>

              <Card className="space-y-2">
                <h3 className="h3 text-navy">Justificación preliminar (generada con plantillas)</h3>
                <p className="rounded-[12px] border border-lightblue bg-navy-50 px-3.5 py-3 text-[0.9rem] leading-relaxed text-navy">
                  {reporte?.justificacion}
                </p>
                <p className="nota">{COPY.sinScore} {COPY.profundizar}</p>
              </Card>

              <Card className="space-y-2">
                <h3 className="h3 text-navy">Hallazgos automáticos</h3>
                <ul className="space-y-1.5 text-[0.86rem] leading-relaxed text-navy">
                  {reporte?.hallazgos.map((h, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-mock" aria-hidden="true" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="space-y-2">
                <h3 className="h3 text-navy">Las cinco preguntas, respondidas para tu selección</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PREGUNTAS_INVERSIONISTA.map((p) => (
                    <div key={p.id} className="rounded-[10px] border border-line px-3 py-2">
                      <p className="text-[0.83rem] font-semibold text-navy">{p.titulo}</p>
                      <p className="nota">{resumenPregunta(p.id, conDatos, e.anio)}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setPaso('1')}>Volver a la selección</Button>
                <Button variant="primary" icon="arrowRight" onClick={() => setPaso('3')}>Continuar a limitaciones</Button>
              </div>
            </>
          )}
        </Section>
      ) : null}

      {/* ---------------------------------------------------------- paso 3 */}
      {paso === '3' ? (
        <Section title="Paso 3 · Limitaciones y checklist de campo" description="Obligatorio (BR-11). La fuente no describe el inmueble físico: sin verificación en campo no hay decisión responsable.">
          <Banner tone="warning" title="Lo que este estudio no puede resolver">{COPY.campo}</Banner>

          <Card className="space-y-2">
            <h3 className="h3 text-navy">Limitaciones reconocidas</h3>
            <ul className="nota list-disc space-y-1 pl-4">
              {LIMITACIONES.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </Card>

          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="h3 text-navy">Checklist de verificación en campo</h3>
              <Badge tone={e.checklist.every((c) => c.completado) ? 'success' : 'warning'}>
                {e.checklist.filter((c) => c.completado).length} / {e.checklist.length} verificados
              </Badge>
            </div>
            <p className="nota">
              Marca cada ítem cuando lo hayas verificado y registra la fecha y una nota. El reporte incluye el estado de cada uno.
            </p>
            <div className="space-y-3">
              {CHECKLIST_CAMPO.map((def) => {
                const item = e.checklist.find((c) => c.id === def.id)
                if (!item) return null
                return (
                  <div key={def.id} className="rounded-[12px] border border-line p-3">
                    <Checkbox
                      label={def.label}
                      description={def.ayuda}
                      checked={item.completado}
                      onChange={(ev) => setChecklist(def.id as Estudio['checklist'][number]['id'], { completado: ev.target.checked })}
                    />
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_150px]">
                      <TextArea
                        aria-label={`Nota de verificación: ${def.label}`}
                        value={item.nota}
                        placeholder="Nota: qué se verificó, con quién, fuente y hallazgo."
                        className="min-h-[52px]"
                        onChange={(ev) => setChecklist(def.id as Estudio['checklist'][number]['id'], { nota: ev.target.value })}
                        maxLength={400}
                      />
                      <div className="space-y-1">
                        <span className="label block">Fecha</span>
                        <span className="block rounded-[10px] border border-line bg-navy-50 px-2.5 py-1.5 text-[0.8rem] text-navy">
                          {item.fecha_verificacion ? formatFecha(item.fecha_verificacion) : 'pendiente'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="space-y-3">
            <Checkbox
              label="Entiendo que este estudio es preliminar y no reemplaza un avalúo"
              description="Reconozco que el observatorio prioriza dónde investigar, que el GAM es experimental y que ninguna cifra garantiza rentabilidad."
              checked={e.limitaciones_reconocidas}
              onChange={(ev) => actualizar({ limitaciones_reconocidas: ev.target.checked })}
            />
            {!validez.ok ? (
              <Banner tone="warning" title="Pendientes para poder exportar">
                <ul className="list-disc pl-4">
                  {validez.pendientes.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </Banner>
            ) : (
              <Banner tone="success" title="Listo para exportar">
                El reporte incluirá la evidencia seleccionada, las limitaciones, el checklist con sus fechas y el descargo de responsabilidad.
              </Banner>
            )}
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setPaso('2')}>Volver a la evidencia</Button>
          </div>
        </Section>
      ) : null}

      {/* --------------------------------------------------------- reporte */}
      <Section
        title="Reporte del estudio"
        description="Se genera íntegramente en tu navegador: no se envían datos a ningún servidor. Incluye portada, resumen ejecutivo, evidencia, limitaciones, metodología y descargo."
        actions={
          <>
            <Button variant="primary" icon="download" onClick={exportarPdf} disabled={!validez.ok || exportando !== null}>
              {exportando === 'pdf' ? 'Generando PDF…' : 'Descargar PDF'}
            </Button>
            <Button variant="method" icon="doc" onClick={exportarMarkdown} disabled={!validez.ok || exportando !== null}>
              {exportando === 'md' ? 'Generando…' : 'Descargar Markdown'}
            </Button>
          </>
        }
      >
        {!validez.ok ? (
          <Banner tone="warning" title="Exportación bloqueada (BR-11)">
            Completa el paso 3: {validez.pendientes.join(' · ')}.
          </Banner>
        ) : null}
        {errorExport ? <Banner tone="danger" title="Error al exportar">{errorExport}</Banner> : null}

        {reporte ? (
          <Card className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="h3 text-navy">{reporte.estudio.titulo || 'Estudio preliminar'}</h3>
                <p className="nota">
                  {reporte.filas.map((f) => f.nombre_ui).join(', ') || 'sin municipios'} · año {reporte.estudio.anio} ·{' '}
                  {reporte.estudio.alcance === '3_municipios' ? '3 ciudades' : '6 municipios'} · datos {reporte.hash_datos}
                </p>
              </div>
              <Badge tone="neutral">{nombreReporte(reporte.estudio, 'pdf')}</Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <KpiCard label="Registros de la selección" value={formatNumero(conDatos.reduce((a, f) => a + f.registros, 0))} />
              <KpiCard label="Señales de investigación" value={formatNumero(reporte.alertas.en_seleccion)} help={COPY.alertas} />
              <KpiCard label="Hallazgos automáticos" value={reporte.hallazgos.length} />
            </div>

            <div>
              <span className="label block">Resumen ejecutivo</span>
              <p className="mt-1 rounded-[12px] border border-lightblue bg-navy-50 px-3.5 py-3 text-[0.88rem] leading-relaxed text-navy">
                {reporte.justificacion}
              </p>
            </div>

            <DataTable
              columns={[
                { id: 'm', header: 'Municipio', cell: (f: ReportData['filas'][number]) => f.nombre_ui },
                { id: 'n', header: 'Registros', align: 'right', cell: (f) => (f.tiene_datos ? formatNumero(f.registros) : 'sin datos') },
                { id: 's', header: 'Participación', align: 'right', cell: (f) => (f.tiene_datos ? formatPct(f.share_pct, 2) : '—') },
                { id: 'med', header: 'Mediana real', align: 'right', cell: (f) => formatCOPCompacto(f.mediana_real) },
                { id: 'iqr', header: 'IQR/med.', align: 'right', cell: (f) => formatRatio(f.iqr_ratio) },
                { id: 'al', header: 'Señales', align: 'right', cell: (f) => formatNumero(f.alertas) },
              ]}
              rows={reporte.filas}
              rowKey={(f) => f.slug}
              dense
              caption="Vista previa de la tabla comparativa del reporte."
            />

            {reporte.gam && reporte.estudio.evidencia.incluir_gam ? (
              <Banner tone={reporte.gam.habilitado ? 'method' : 'danger'} title="Estimación GAM incluida">
                {reporte.gam.nombre_ui}: {formatCOP(reporte.gam.estimado_cop)} · MAE {formatCOPCompacto(reporte.gam.mae_cop)} ·{' '}
                {reporte.gam.habilitado ? 'compuerta habilitada' : 'sin mejora demostrada'} · limitación reconocida:{' '}
                {reporte.gam.reconocio_limitacion ? 'sí' : 'no'}. {COPY.experimental}
              </Banner>
            ) : null}

            <Collapsible title="Ver el Markdown completo del reporte">
              <pre className="scroll-x max-h-[420px] overflow-y-auto rounded-[10px] border border-line bg-navy-50 p-3 text-[0.72rem] leading-relaxed text-navy">
                {generarMarkdown(reporte)}
              </pre>
            </Collapsible>
          </Card>
        ) : null}
      </Section>

      <EstudiosGuardados guardados={guardados} onCargar={(id) => { cargar(id); setPaso('1') }} onEliminar={eliminar} columnas={columnasGuardados} />

      <Dialog
        open={confirmarDescarte}
        onOpenChange={setConfirmarDescarte}
        title="Descartar el borrador"
        description="Se perderán los cambios no guardados de este estudio. Los estudios ya guardados no se eliminan."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmarDescarte(false)}>Cancelar</Button>
            <Button variant="secondary" onClick={() => { guardar(); setConfirmarDescarte(false); setGuardadoOk(true) }}>Guardar antes</Button>
            <Button variant="danger" onClick={() => { descartar(); setConfirmarDescarte(false); setAviso(null) }}>Descartar</Button>
          </>
        }
      >
        <p className="nota">Máximo {MAX_ESTUDIOS} estudios guardados; al superar el límite se descartan los más antiguos.</p>
      </Dialog>
    </div>
  )
}

/* -------------------------------------------------------------- auxiliares */

function EstudiosGuardados({
  guardados,
  onCargar,
  onEliminar,
  columnas,
}: {
  guardados: Estudio[]
  onCargar: (id: string) => void
  onEliminar: (id: string) => void
  columnas?: Array<Columna<Estudio>>
}) {
  if (guardados.length === 0) {
    return (
      <Card className="space-y-1">
        <h2 className="h3 text-navy">Estudios guardados</h2>
        <p className="nota">
          Aún no hay estudios guardados en este navegador. Se almacenan en localStorage con esquema versionado, sin datos personales.
        </p>
      </Card>
    )
  }
  const cols: Array<Columna<Estudio>> = columnas ?? [
    { id: 'titulo', header: 'Estudio', cell: (r) => <span className="font-semibold">{r.titulo || 'Sin título'}</span> },
    { id: 'munis', header: 'Municipios', cell: (r) => r.municipios.map((m) => NOMBRE_UI[m]).join(', ') || '—' },
    { id: 'anio', header: 'Año', align: 'right', cell: (r) => r.anio },
    { id: 'fecha', header: 'Actualizado', cell: (r) => formatFecha(r.actualizado_en.slice(0, 10)) },
    {
      id: 'acciones',
      header: 'Acciones',
      cell: (r) => (
        <span className="flex gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => onCargar(r.id)}>Abrir</Button>
          <Button size="sm" variant="ghost" onClick={() => onEliminar(r.id)}>Eliminar</Button>
        </span>
      ),
    },
  ]
  return (
    <Section title={`Estudios guardados (${guardados.length}/${MAX_ESTUDIOS})`} description="Persistidos en este navegador. Puedes reabrirlos, exportarlos o eliminarlos.">
      <DataTable columns={cols} rows={guardados} rowKey={(r) => r.id} />
    </Section>
  )
}

function resumenPregunta(id: string, filas: ReportData['filas'], anio: number): string {
  if (filas.length === 0) return 'Sin municipios con datos.'
  const orden = (sel: (f: ReportData['filas'][number]) => number | null, desc: boolean) =>
    [...filas].filter((f) => sel(f) != null).sort((a, b) => (desc ? (sel(b) ?? 0) - (sel(a) ?? 0) : (sel(a) ?? 0) - (sel(b) ?? 0)))
  switch (id) {
    case 'q1': {
      const t = orden((f) => f.registros, true)[0]
      return `${t.nombre_ui} lidera con ${formatNumero(t.registros)} registros (${formatPct(t.share_pct, 2)} de la selección).`
    }
    case 'q2': {
      const v = orden((f) => f.var_registros_pct, true)
      if (!v.length) return `Sin año anterior comparable para ${anio}.`
      return `${v[0].nombre_ui} ${formatDelta(v[0].var_registros_pct)}; ${v[v.length - 1].nombre_ui} ${formatDelta(v[v.length - 1].var_registros_pct)} frente a ${anio - 1}.`
    }
    case 'q3': {
      const t = orden((f) => f.mediana_real, true)[0]
      return `Mediana real más alta: ${t.nombre_ui} (${formatCOPCompacto(t.mediana_real)}). Referencia descriptiva.`
    }
    case 'q4': {
      const t = orden((f) => f.p90_p10, true)
      if (!t.length) return 'Sin medidas de dispersión.'
      return `Más disperso: ${t[0].nombre_ui} (P90/P10 ${formatRatio(t[0].p90_p10)}); menos disperso: ${t[t.length - 1].nombre_ui} (${formatRatio(t[t.length - 1].p90_p10)}).`
    }
    case 'q5': {
      const t = orden((f) => f.poblacion_total, true)[0]
      return `${t.nombre_ui}: ${formatNumero(t.poblacion_total)} hab., VA real p/c ${formatCOPCompacto(t.va_real_pc)}, ${formatNumero(t.licencias)} unidades nuevas (lag1).`
    }
    default:
      return '—'
  }
}
