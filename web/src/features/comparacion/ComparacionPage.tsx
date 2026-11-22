/**
 * Comparación multivariable (architecture.md §12.3).
 * Responde las 5 preguntas del inversionista con una matriz de evidencia.
 * Sin índice compuesto (BR-06): el mejor valor por fila se marca con texto.
 */
import { useMemo } from 'react'
import { saveAs } from 'file-saver'
import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  InfoTip,
  Loading,
  Section,
  type Columna,
} from '@/components/ui'
import { ComparisonBars, TrendChart, type PuntoSerie } from '@/components/charts'
import { PageHeader } from '@/components/PageHeader'
import { AgregarEstudio } from '@/components/AgregarEstudio'
import { nombreCorto } from '@/components/GlobalFilters'
import { COPY, PREGUNTAS_INVERSIONISTA } from '@/content/es'
import { useFiltros } from '@/hooks/useFiltros'
import { NOMBRE_POR_SLUG, useComparacion, usePanorama } from '@/lib/data'
import { formatCOPCompacto, formatDelta, formatNumero, formatPct, formatRatio, ND } from '@/lib/format'
import { colorMunicipio } from '@/lib/palette'
import type { ComparacionFila, Slug } from '@/types/domain'
import { construirMatriz, matrizACsv, TEXTO_DIRECCION, type FilaMatriz } from './matriz'

export default function ComparacionPage() {
  const { data: comparacion, isPending, isError, error, refetch } = useComparacion()
  const { data: panorama } = usePanorama()
  const { anio, moneda, seleccionEfectiva, setSeleccion, toggleMunicipio, municipiosDisponibles } = useFiltros()

  const filas = useMemo<ComparacionFila[]>(() => {
    const matriz = comparacion?.por_anio[String(anio)]?.matriz ?? []
    return seleccionEfectiva
      .map((s) => matriz.find((f) => f.slug === s))
      .filter((f): f is ComparacionFila => Boolean(f))
  }, [comparacion, anio, seleccionEfectiva])

  const matriz = useMemo(
    () => (comparacion ? construirMatriz(filas, moneda, comparacion.definiciones) : []),
    [comparacion, filas, moneda],
  )

  if (isPending) return <Loading label="Cargando la matriz de comparación…" />
  if (isError || !comparacion) return <ErrorState detail={error?.message} onRetry={() => refetch()} />

  const conDatos = filas.filter((f) => f.tiene_datos)
  const totalSeleccion = conDatos.reduce((a, f) => a + f.registros, 0)

  function exportarCsv() {
    const csv = matrizACsv(matriz, seleccionEfectiva, (s) => NOMBRE_POR_SLUG[s])
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    saveAs(blob, `DSA_comparacion_${anio}_${seleccionEfectiva.join('-')}.csv`)
  }

  const columnas: Array<Columna<FilaMatriz>> = [
    {
      id: 'indicador',
      header: 'Indicador',
      cell: (fila) => (
        <span className="flex items-start gap-1.5">
          <span className="min-w-0">
            <span className="block font-semibold text-navy">{fila.label}</span>
            <span className="nota block">
              {fila.unidad} ·{' '}
              {fila.direccion === 'gam' ? 'desempeño del modelo' : fila.direccion === 'contexto' ? 'contexto' : fila.direccion === 'mayor' ? 'mayor = más actividad' : 'menor = menos dispersión'}
            </span>
          </span>
          <InfoTip text={fila.ayuda} />
        </span>
      ),
      className: 'min-w-[220px]',
    },
    ...seleccionEfectiva.map((slug) => ({
      id: slug,
      header: (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: colorMunicipio(slug) }} aria-hidden="true" />
          {nombreCorto(slug)}
        </span>
      ),
      align: 'right' as const,
      cell: (fila: FilaMatriz) => {
        const c = fila.celdas.find((x) => x.slug === slug)
        if (!c) return ND
        if (fila.direccion === 'gam') {
          return (
            <span className="inline-flex flex-col items-end gap-1">
              <span className={c.valor != null && c.valor > 0 ? 'font-semibold text-green-mock' : 'font-semibold text-red-mock'}>
                {c.valor == null ? ND : formatDelta(c.valor, 2)}
              </span>
              <Badge tone={c.gamHabilitado ? 'success' : 'danger'} icon={c.gamHabilitado ? 'check' : 'lock'}>
                {c.gamHabilitado ? 'habilitado' : 'sin mejora'}
              </Badge>
            </span>
          )
        }
        if (!c.tieneDatos) return <Badge tone="neutral">sin datos</Badge>
        if (c.valor == null) return <span className="text-slate-mock">{ND}</span>
        return (
          <span className="inline-flex flex-col items-end gap-1">
            <span className={`tabular-nums ${c.esMejor ? 'font-bold text-navy' : 'text-navy'}`}>{fila.formato(c.valor)}</span>
            {c.esMejor && fila.badgeMejor ? <Badge tone="info">{fila.badgeMejor}</Badge> : null}
          </span>
        )
      },
    })),
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Comparación multivariable"
        title={`Comparar municipios · ${anio}`}
        lead="Cinco preguntas clave, una matriz de evidencia y gráficos lado a lado. No hay un ranking compuesto: cada métrica se lee por separado."
        badges={
          <>
            <Badge tone="info">{seleccionEfectiva.length} municipios</Badge>
            <Badge tone={moneda === 'real' ? 'success' : 'warning'}>{moneda === 'real' ? 'COP dic-2023' : 'nominal'}</Badge>
            <Badge tone="method" icon="spark">sin índice compuesto</Badge>
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" icon="download" onClick={exportarCsv} disabled={filas.length === 0}>
              Exportar CSV
            </Button>
            <AgregarEstudio etiqueta="Agregar selección a Mi Estudio" />
          </>
        }
      />

      <Card className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="label">Municipios a comparar (1–6)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSeleccion(municipiosDisponibles)}>
              Seleccionar todos
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSeleccion([])}>
              Limpiar
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {municipiosDisponibles.map((slug) => (
            <Chip key={slug} active={seleccionEfectiva.includes(slug)} onClick={() => toggleMunicipio(slug)}>
              <span className="h-2 w-2 rounded-full" style={{ background: colorMunicipio(slug) }} aria-hidden="true" />
              {nombreCorto(slug)}
            </Chip>
          ))}
        </div>
        {seleccionEfectiva.length === 1 ? (
          <p className="nota">Con un solo municipio las preguntas comparativas muestran «—». Agrega otro para comparar.</p>
        ) : null}
        {seleccionEfectiva.length === 0 ? <EmptyState title="Sin municipios seleccionados">Elige al menos un municipio para construir la matriz.</EmptyState> : null}
      </Card>

      {filas.length > 0 ? (
        <>
          <Section
            title="Matriz de evidencia"
            description={`Indicadores del año ${anio}. ${COPY.sinScore} El mejor valor de cada fila se etiqueta con texto; las variables de contexto no se califican como mejores o peores.`}
          >
            <DataTable
              columns={columnas}
              rows={matriz}
              rowKey={(f) => f.clave}
              caption={`Participación calculada sobre ${formatNumero(totalSeleccion)} registros de la selección. «n.d.» = dato no disponible; «sin datos» = el municipio no tiene registros en ${anio}.`}
              highlight={(f) => f.direccion === 'gam'}
            />
            <Banner tone="method" compact>
              {TEXTO_DIRECCION.gam} La compuerta (BR-07) bloquea el simulador donde el GAM no supera la mediana municipal.
            </Banner>
          </Section>

          <Section title="Las cinco preguntas del inversionista" description="Cada tarjeta responde una pregunta con la evidencia de la selección y un gráfico de apoyo.">
            <div className="grid gap-3 lg:grid-cols-2">
              {PREGUNTAS_INVERSIONISTA.map((p) => (
                <QuestionCard key={p.id} id={p.id} titulo={p.titulo} ayuda={p.ayuda} filas={conDatos} anio={anio} moneda={moneda} multiple={conDatos.length > 1} />
              ))}
            </div>
          </Section>

          <Section title="Series lado a lado" description="Evolución 2015–2023 de los municipios seleccionados. Los huecos indican años sin datos (serie parcial de Calarcá).">
            <div className="grid gap-3 xl:grid-cols-2">
              <TrendChart
                data={serieDe(panorama?.anios ?? [], seleccionEfectiva, panorama?.series.por_municipio, 'n')}
                series={seleccionEfectiva.map((s) => ({ id: s, label: nombreCorto(s), color: colorMunicipio(s) }))}
                title="Registros por año"
                summary={`Registros anuales de ${seleccionEfectiva.map(nombreCorto).join(', ')} entre 2015 y 2023.`}
                note={COPY.registros}
              />
              <TrendChart
                data={serieDe(panorama?.anios ?? [], seleccionEfectiva, panorama?.series.por_municipio, moneda === 'real' ? 'mediana_real' : 'mediana_nominal')}
                series={seleccionEfectiva.map((s) => ({ id: s, label: nombreCorto(s), color: colorMunicipio(s) }))}
                title={moneda === 'real' ? 'Mediana real por año (COP dic-2023)' : 'Mediana nominal por año'}
                formato="cop"
                summary={`Mediana ${moneda === 'real' ? 'real' : 'nominal'} anual de los municipios seleccionados.`}
                note={moneda === 'real' ? COPY.moneda : COPY.nominal}
              />
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              <ComparisonBars
                data={conDatos.map((f) => ({ slug: f.slug, label: f.nombre_ui, valor: moneda === 'real' ? f.mediana_real : f.mediana_nominal }))}
                title={`Mediana ${moneda === 'real' ? 'real' : 'nominal'} en ${anio}`}
                formato="cop"
                summary={`Mediana ${moneda === 'real' ? 'real' : 'nominal'} de ${conDatos.map((f) => f.nombre_ui).join(', ')} en ${anio}.`}
                note={COPY.mediana}
              />
              <ComparisonBars
                data={conDatos.map((f) => ({ slug: f.slug, label: f.nombre_ui, valor: f.registros }))}
                title={`Registros en ${anio}`}
                summary={`Registros de ${conDatos.map((f) => f.nombre_ui).join(', ')} en ${anio}.`}
                note={COPY.registros}
              />
            </div>
          </Section>

          <Card className="space-y-2">
            <h2 className="h3 text-navy">Cómo usar esta comparación</h2>
            <ul className="nota list-disc space-y-1 pl-4">
              <li>{COPY.sinScore}</li>
              <li>{COPY.registros}</li>
              <li>{COPY.mediana}</li>
              <li>{COPY.sumas}</li>
              <li>{COPY.campo}</li>
              <li>
                <strong>Lectura de las direcciones:</strong> «mayor» y «menor» son ayudas de lectura sobre actividad y dispersión;
                «contexto» describe el entorno y no se califica. Ninguna implica una recomendación de compra.
              </li>
              <li>La selección, el año, el alcance y la moneda quedan en la URL: el enlace es reproducible.</li>
            </ul>
          </Card>
        </>
      ) : null}
    </div>
  )
}

/* --------------------------------------------------------- series helper */

function serieDe(
  anios: number[],
  slugs: Slug[],
  porMunicipio: Record<string, { n: Array<number | null>; mediana_real: Array<number | null>; mediana_nominal: Array<number | null> }> | undefined,
  campo: 'n' | 'mediana_real' | 'mediana_nominal',
): PuntoSerie[] {
  return anios.map((anio, i) => {
    const punto: PuntoSerie = { anio }
    for (const s of slugs) punto[s] = porMunicipio?.[s]?.[campo]?.[i] ?? null
    return punto
  })
}

/* ------------------------------------------------------- tarjeta pregunta */

function QuestionCard({
  id,
  titulo,
  ayuda,
  filas,
  anio,
  moneda,
  multiple,
}: {
  id: string
  titulo: string
  ayuda: string
  filas: ComparacionFila[]
  anio: number
  moneda: 'real' | 'nominal'
  multiple: boolean
}) {
  const { hallazgo, datos, formato, metrica } = useMemo(
    () => construirHallazgo(id, filas, anio, moneda, multiple),
    [id, filas, anio, moneda, multiple],
  )

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="h3 text-navy">{titulo}</h3>
        <Badge tone="neutral">{id.toUpperCase()}</Badge>
      </div>
      <p className="nota">{ayuda}</p>
      {filas.length === 0 ? (
        <EmptyState>Sin municipios con datos en este año.</EmptyState>
      ) : (
        <>
          <p className="text-[0.88rem] leading-relaxed text-navy">{hallazgo}</p>
          {datos.length > 0 ? (
            <ComparisonBars
              data={datos}
              title={metrica}
              formato={formato}
              height={Math.max(150, 46 * datos.length + 60)}
              summary={`${metrica} en ${anio}: ${datos.map((d) => `${d.label} ${d.valor == null ? 'n.d.' : d.valor}`).join('; ')}.`}
            />
          ) : null}
        </>
      )}
    </Card>
  )
}

function construirHallazgo(
  id: string,
  filas: ComparacionFila[],
  anio: number,
  moneda: 'real' | 'nominal',
  multiple: boolean,
): {
  hallazgo: string
  datos: Array<{ slug: string; label: string; valor: number | null }>
  formato: 'numero' | 'cop' | 'pct' | 'ratio'
  metrica: string
} {
  const vacio = { hallazgo: '—', datos: [], formato: 'numero' as const, metrica: '' }
  if (filas.length === 0) return vacio
  const orden = (sel: (f: ComparacionFila) => number | null, desc: boolean) =>
    [...filas].filter((f) => sel(f) != null).sort((a, b) => (desc ? (sel(b) ?? 0) - (sel(a) ?? 0) : (sel(a) ?? 0) - (sel(b) ?? 0)))

  switch (id) {
    case 'q1': {
      const total = filas.reduce((a, f) => a + f.registros, 0)
      const tops = orden((f) => f.registros, true)
      const líder = tops[0]
      const share = total > 0 ? (100 * líder.registros) / total : 0
      return {
        hallazgo: multiple
          ? `${líder.nombre_ui} concentra la mayor actividad de la selección: ${formatNumero(líder.registros)} registros (${formatPct(share, 2)} de ${formatNumero(total)}). ${tops[tops.length - 1].nombre_ui} es el de menor volumen (${formatNumero(tops[tops.length - 1].registros)}).`
          : `${líder.nombre_ui} registra ${formatNumero(líder.registros)} actos de compraventa urbana en ${anio}. Agrega otro municipio para comparar la concentración.`,
        datos: filas.map((f) => ({ slug: f.slug, label: f.nombre_ui, valor: f.registros })),
        formato: 'numero',
        metrica: `Registros ${anio}`,
      }
    }
    case 'q2': {
      const conVar = orden((f) => f.var_registros_pct, true)
      if (conVar.length === 0) return { ...vacio, hallazgo: `No hay año anterior comparable para ${anio} (la serie empieza en 2015).`, metrica: 'Variación anual' }
      const mejor = conVar[0]
      const peor = conVar[conVar.length - 1]
      return {
        hallazgo: multiple
          ? `Frente a ${anio - 1}, ${mejor.nombre_ui} es el que ${mejor.var_registros_pct! >= 0 ? 'más se expande' : 'menos se contrae'} (${formatDelta(mejor.var_registros_pct)}) y ${peor.nombre_ui} el que ${peor.var_registros_pct! >= 0 ? 'menos se expande' : 'más se contrae'} (${formatDelta(peor.var_registros_pct)}).`
          : `La actividad de ${mejor.nombre_ui} ${mejor.var_registros_pct! >= 0 ? 'se expande' : 'se contrae'} ${formatDelta(mejor.var_registros_pct)} frente a ${anio - 1}.`,
        datos: filas.map((f) => ({ slug: f.slug, label: f.nombre_ui, valor: f.var_registros_pct })),
        formato: 'pct',
        metrica: `Variación anual de registros (${anio} vs ${anio - 1})`,
      }
    }
    case 'q3': {
      const clave = moneda === 'real' ? 'mediana_real' : 'mediana_nominal'
      const tops = orden((f) => f[clave], true)
      if (tops.length === 0) return { ...vacio, hallazgo: 'Sin valores disponibles para este año.', metrica: 'Mediana' }
      const alto = tops[0]
      const bajo = tops[tops.length - 1]
      return {
        hallazgo: multiple
          ? `La mediana ${moneda === 'real' ? 'real' : 'nominal'} más alta es la de ${alto.nombre_ui} (${formatCOPCompacto(alto[clave])}, Q1–Q3 ${formatCOPCompacto(alto.q1)}–${formatCOPCompacto(alto.q3)}); la más baja, la de ${bajo.nombre_ui} (${formatCOPCompacto(bajo[clave])}). Son referencias descriptivas, no precios de negociación.`
          : `${alto.nombre_ui} tiene una mediana ${moneda === 'real' ? 'real' : 'nominal'} de ${formatCOPCompacto(alto[clave])} con rango Q1–Q3 de ${formatCOPCompacto(alto.q1)} a ${formatCOPCompacto(alto.q3)}.`,
        datos: filas.map((f) => ({ slug: f.slug, label: f.nombre_ui, valor: f[clave] })),
        formato: 'cop',
        metrica: `Mediana ${moneda === 'real' ? 'real (COP dic-2023)' : 'nominal'} ${anio}`,
      }
    }
    case 'q4': {
      const tops = orden((f) => f.p90_p10, true)
      if (tops.length === 0) return { ...vacio, hallazgo: 'Sin medidas de dispersión disponibles.', metrica: 'Dispersión' }
      const mas = tops[0]
      const menos = tops[tops.length - 1]
      return {
        hallazgo: multiple
          ? `${mas.nombre_ui} es el mercado más disperso (P90/P10 ${formatRatio(mas.p90_p10)}; IQR/mediana ${formatRatio(mas.iqr_ratio)}) y ${menos.nombre_ui} el menos disperso (P90/P10 ${formatRatio(menos.p90_p10)}). Mayor dispersión implica menos comparables equivalentes sin área, ubicación y estado.`
          : `${mas.nombre_ui} tiene P90/P10 de ${formatRatio(mas.p90_p10)} e IQR/mediana de ${formatRatio(mas.iqr_ratio)}.`,
        datos: filas.map((f) => ({ slug: f.slug, label: f.nombre_ui, valor: f.p90_p10 })),
        formato: 'ratio',
        metrica: `Dispersión P90/P10 en ${anio}`,
      }
    }
    case 'q5': {
      const tops = orden((f) => f.poblacion_total, true)
      if (tops.length === 0) return { ...vacio, hallazgo: 'Sin contexto disponible.', metrica: 'Contexto' }
      const grande = tops[0]
      return {
        hallazgo:
          `${grande.nombre_ui} es el de mayor población (${formatNumero(grande.poblacion_total)} hab.), con VA real per cápita de ${formatCOPCompacto(grande.va_real_pc)}, ` +
          `${formatNumero(grande.elic_unidades_vivienda_nueva_lag1)} unidades de vivienda nueva licenciadas (lag1) y ${formatPct(grande.predios_nuevos_pct ?? 0, 2)} de registros con predio nuevo. ` +
          'El contexto acompaña la lectura; no determina por sí solo la conveniencia de invertir.',
        datos: filas.map((f) => ({ slug: f.slug, label: f.nombre_ui, valor: f.va_real_pc })),
        formato: 'cop',
        metrica: `VA real per cápita ${anio} (COP dic-2023)`,
      }
    }
    default:
      return vacio
  }
}
