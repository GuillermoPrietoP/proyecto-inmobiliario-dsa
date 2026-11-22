/**
 * Construcción del reporte de estudio a partir de los agregados del pipeline
 * y la selección del usuario. Las narrativas son deterministas y no causales.
 */
import { COPY, LIMITACIONES, PREGUNTA_RECTORA } from '@/content/es'
import { formatCOPCompacto, formatDelta, formatNumero, formatPct, formatRatio } from '@/lib/format'
import type {
  Alerta,
  Alertas,
  Comparacion,
  ComparacionFila,
  Estudio,
  GamModel,
  Manifest,
  MunicipioNombre,
  Panorama,
} from '@/types/domain'

export interface FilaEvidencia {
  municipio: MunicipioNombre
  slug: string
  nombre_ui: string
  registros: number
  share_pct: number
  var_registros_pct: number | null
  mediana_real: number | null
  q1: number | null
  q3: number | null
  iqr_ratio: number | null
  p90_p10: number | null
  poblacion_total: number | null
  va_real_pc: number | null
  licencias: number | null
  predios_nuevos_pct: number | null
  alertas: number
  gam_habilitado: boolean
  gam_mejora: number
  serie_parcial: boolean
  tiene_datos: boolean
}

export interface SerieReporte {
  slug: string
  nombre_ui: string
  n: Array<number | null>
  mediana_real: Array<number | null>
}

export interface ReportData {
  estudio: Estudio
  generado_en: string
  hash_datos: string
  pregunta: string
  anios: number[]
  filas: FilaEvidencia[]
  series: SerieReporte[]
  hallazgos: string[]
  justificacion: string
  criterios: string[]
  gam: {
    municipio: MunicipioNombre
    nombre_ui: string
    estimado_cop: number
    mediana_real: number
    diferencia_pct: number | null
    mae_cop: number
    mae_mediana_cop: number
    mejora_pct: number
    habilitado: boolean
    reconocio_limitacion: boolean
    mes: number | null
    dia: number | null
    num_anotacion: number | null
  } | null
  alertas: {
    total_base: number
    tasa_base_pct: number
    en_seleccion: number
    ejemplos: Alerta[]
    por_municipio: Array<{ nombre_ui: string; alertas: number; registros: number; tasa_pct: number }>
  }
  metodologia: {
    formula: string
    factores: Array<{ anio: number; factor: number }>
    modelo_id: string
    cuantil: number
    alpha: number
    entrenamiento: string
    evaluacion: string
    mae_2023: number
    mae_mediana_2023: number
    reduccion_2023_pct: number
    csv_sha256: string
    joblib_sha256: string
    data_version: string
    generado_datos: string
    filas_base: number
    versiones: Record<string, string>
  }
  limitaciones: string[]
}

const NOMBRE_UI: Record<MunicipioNombre, string> = {
  ARMENIA: 'Armenia',
  CALARCÁ: 'Calarcá',
  DOSQUEBRADAS: 'Dosquebradas',
  MANIZALES: 'Manizales',
  PEREIRA: 'Pereira',
  'SANTA ROSA DE CABAL': 'Santa Rosa de Cabal',
}

export function nombreUi(m: MunicipioNombre): string {
  return NOMBRE_UI[m] ?? m
}

export interface FuentesReporte {
  panorama: Panorama | undefined
  comparacion: Comparacion | undefined
  alertas: Alertas | undefined
  gam: GamModel | undefined
  manifest: Manifest | undefined
}

export function construirReporte(estudio: Estudio, f: FuentesReporte): ReportData {
  const anio = estudio.anio
  const matriz: ComparacionFila[] = f.comparacion?.por_anio[String(anio)]?.matriz ?? []
  // Se respeta el orden de selección del usuario, no el alfabético del pipeline.
  const seleccion = estudio.municipios
    .map((m) => matriz.find((r) => r.municipio === m))
    .filter((r): r is ComparacionFila => Boolean(r))
  const totalSeleccion = seleccion.reduce((a, r) => a + r.registros, 0)

  const filas: FilaEvidencia[] = seleccion.map((r) => ({
    municipio: r.municipio,
    slug: r.slug,
    nombre_ui: r.nombre_ui,
    registros: r.registros,
    share_pct: totalSeleccion > 0 ? (100 * r.registros) / totalSeleccion : 0,
    var_registros_pct: r.var_registros_pct,
    mediana_real: r.mediana_real,
    q1: r.q1,
    q3: r.q3,
    iqr_ratio: r.iqr_ratio,
    p90_p10: r.p90_p10,
    poblacion_total: r.poblacion_total,
    va_real_pc: r.va_real_pc,
    licencias: r.elic_unidades_vivienda_nueva_lag1,
    predios_nuevos_pct: r.predios_nuevos_pct,
    alertas: r.alertas,
    gam_habilitado: r.gam_habilitado,
    gam_mejora: r.gam_mejora_2023_pct,
    serie_parcial: r.serie_parcial,
    tiene_datos: r.tiene_datos,
  }))

  const anios = f.panorama?.anios ?? []
  const series: SerieReporte[] = filas.map((fila) => {
    const s = f.panorama?.series.por_municipio[fila.slug as keyof Panorama['series']['por_municipio']]
    return {
      slug: fila.slug,
      nombre_ui: fila.nombre_ui,
      n: s?.n ?? [],
      mediana_real: s?.mediana_real ?? [],
    }
  })

  const conDatos = filas.filter((x) => x.tiene_datos)
  const hallazgos: string[] = []
  const criterios: string[] = []

  if (conDatos.length > 0) {
    const mayor = [...conDatos].sort((a, b) => b.registros - a.registros)[0]
    hallazgos.push(
      `${mayor.nombre_ui} concentra la mayor actividad de la selección en ${anio}: ${formatNumero(mayor.registros)} registros, ` +
        `el ${formatPct(mayor.share_pct, 2)} del total seleccionado (${formatNumero(totalSeleccion)}).`,
    )
    criterios.push('volumen de actividad transaccional')

    const variaciones = conDatos.filter((x) => x.var_registros_pct != null)
    if (variaciones.length) {
      const mejor = [...variaciones].sort((a, b) => (b.var_registros_pct ?? 0) - (a.var_registros_pct ?? 0))[0]
      const peor = [...variaciones].sort((a, b) => (a.var_registros_pct ?? 0) - (b.var_registros_pct ?? 0))[0]
      hallazgos.push(
        `Frente a ${anio - 1}, la actividad ${mejor.var_registros_pct! >= 0 ? 'se expande más' : 'se contrae menos'} en ` +
          `${mejor.nombre_ui} (${formatDelta(mejor.var_registros_pct)}) y ${peor.var_registros_pct! >= 0 ? 'se expande menos' : 'se contrae más'} ` +
          `en ${peor.nombre_ui} (${formatDelta(peor.var_registros_pct)}).`,
      )
      criterios.push('dinámica anual de la actividad')
    }

    const medianas = conDatos.filter((x) => x.mediana_real != null)
    if (medianas.length) {
      const alta = [...medianas].sort((a, b) => (b.mediana_real ?? 0) - (a.mediana_real ?? 0))[0]
      hallazgos.push(
        `La mediana real más alta de la selección es la de ${alta.nombre_ui}: ${formatCOPCompacto(alta.mediana_real)} ` +
          `(Q1–Q3: ${formatCOPCompacto(alta.q1)} – ${formatCOPCompacto(alta.q3)}). Es una referencia descriptiva, no un precio de negociación.`,
      )
      criterios.push('valores típicos registrados en pesos constantes')
    }

    const dispersion = conDatos.filter((x) => x.p90_p10 != null)
    if (dispersion.length > 1) {
      const mas = [...dispersion].sort((a, b) => (b.p90_p10 ?? 0) - (a.p90_p10 ?? 0))[0]
      const menos = [...dispersion].sort((a, b) => (a.p90_p10 ?? 0) - (b.p90_p10 ?? 0))[0]
      hallazgos.push(
        `La dispersión P90/P10 va de ${formatRatio(menos.p90_p10)} en ${menos.nombre_ui} a ${formatRatio(mas.p90_p10)} en ` +
          `${mas.nombre_ui}: a mayor dispersión, menos comparables equivalentes sin datos de área y ubicación.`,
      )
      criterios.push('dispersión del mercado')
    }

    const contexto = conDatos.filter((x) => x.poblacion_total != null)
    if (contexto.length) {
      const grande = [...contexto].sort((a, b) => (b.poblacion_total ?? 0) - (a.poblacion_total ?? 0))[0]
      hallazgos.push(
        `${grande.nombre_ui} es el municipio de mayor población de la selección (${formatNumero(grande.poblacion_total)} habitantes) ` +
          `con VA real per cápita de ${formatCOPCompacto(grande.va_real_pc)} y ${formatNumero(grande.licencias)} unidades de vivienda nueva licenciadas (lag1).`,
      )
      criterios.push('contexto urbano y económico')
    }

    const totalAlertas = conDatos.reduce((a, x) => a + x.alertas, 0)
    if (totalAlertas > 0) {
      hallazgos.push(
        `Se identificaron ${formatNumero(totalAlertas)} señales de investigación en la selección durante ${anio}. ` +
          'Son operaciones que se alejan de su grupo comparable; no implican irregularidad.',
      )
    }

    const parciales = conDatos.filter((x) => x.serie_parcial)
    if (parciales.length) {
      hallazgos.push(
        `${parciales.map((x) => x.nombre_ui).join(', ')} tiene serie parcial (desde 2021): no se calculan tendencias 2015–2023.`,
      )
    }
  } else {
    hallazgos.push(`Los municipios seleccionados no tienen registros en ${anio}. Elige otro año de corte.`)
  }

  const principal = conDatos.length ? [...conDatos].sort((a, b) => b.registros - a.registros)[0] : null
  const justificacion = principal
    ? `Profundizaría el estudio de ${principal.nombre_ui} por su volumen de actividad (${formatNumero(principal.registros)} registros en ${anio}, ` +
      `${formatPct(principal.share_pct, 2)} de la selección), por sus valores típicos registrados (mediana real ${formatCOPCompacto(principal.mediana_real)}) ` +
      `y por su contexto urbano (población ${formatNumero(principal.poblacion_total)}, VA real per cápita ${formatCOPCompacto(principal.va_real_pc)}). ` +
      `Revisaría en campo el área, el estado físico, la oferta actual, los arriendos y los costos antes de decidir, ` +
      `y verificaría las ${formatNumero(principal.alertas)} señales de investigación de ${anio}. ` +
      'Esta priorización se basa en criterios explícitos y separados, no en un índice compuesto de inversión.'
    : 'No hay evidencia suficiente para priorizar un municipio en el año seleccionado.'

  const gamInfo = estudio.gam
  const gam = gamInfo
    ? {
        municipio: gamInfo.municipio,
        nombre_ui: nombreUi(gamInfo.municipio),
        estimado_cop: gamInfo.estimado_cop,
        mediana_real: gamInfo.mediana_real,
        diferencia_pct: gamInfo.mediana_real ? (100 * (gamInfo.estimado_cop - gamInfo.mediana_real)) / gamInfo.mediana_real : null,
        mae_cop: gamInfo.mae_cop,
        mae_mediana_cop: f.gam?.metricas.por_municipio_2023[gamInfo.municipio]?.mae_mediana ?? 0,
        mejora_pct: gamInfo.mejora_pct,
        habilitado: f.gam?.municipios[gamInfo.municipio]?.habilitado ?? gamInfo.mejora_pct > 0,
        reconocio_limitacion: gamInfo.reconocio_limitacion,
        mes: gamInfo.mes ?? null,
        dia: gamInfo.dia ?? null,
        num_anotacion: (gamInfo.inputs?.num_anotacion as number | null | undefined) ?? null,
      }
    : null

  const ejemplos = (f.alertas?.items ?? [])
    .filter((a) => estudio.municipios.includes(a.municipio) && a.anio === anio)
    .slice(0, 5)

  const porMunicipioAlertas = filas.map((fila) => ({
    nombre_ui: fila.nombre_ui,
    alertas: fila.alertas,
    registros: fila.registros,
    tasa_pct: fila.registros > 0 ? (100 * fila.alertas) / fila.registros : 0,
  }))

  const factores = Object.entries(f.manifest?.currency.factors ?? {})
    .map(([a, v]) => ({ anio: Number(a), factor: v }))
    .sort((a, b) => a.anio - b.anio)

  return {
    estudio,
    generado_en: new Date().toISOString(),
    hash_datos: estudio.hash_datos || f.manifest?.data_version || 'n.d.',
    pregunta: PREGUNTA_RECTORA,
    anios,
    filas,
    series,
    hallazgos,
    justificacion,
    criterios,
    gam,
    alertas: {
      total_base: f.alertas?.resumen.total ?? 0,
      tasa_base_pct: f.alertas?.resumen.tasa_pct ?? 0,
      en_seleccion: filas.reduce((a, x) => a + x.alertas, 0),
      ejemplos,
      por_municipio: porMunicipioAlertas,
    },
    metodologia: {
      formula: 'valor_cop_dic2023 = valor × factor[year_radica]',
      factores,
      modelo_id: f.gam?.modelo.id ?? 'gam_cuantilico_sin_apertura',
      cuantil: f.gam?.modelo.cuantil ?? 0.5,
      alpha: f.gam?.modelo.alpha ?? 0.01,
      entrenamiento: f.gam?.modelo.entrenamiento ?? '2015–2022',
      evaluacion: String(f.gam?.modelo.anio_referencia ?? 2023),
      mae_2023: f.gam?.metricas['2023'].mae_modelo ?? 0,
      mae_mediana_2023: f.gam?.metricas['2023'].mae_mediana ?? 0,
      reduccion_2023_pct: f.gam?.metricas['2023'].reduccion_pct ?? 0,
      csv_sha256: f.manifest?.source.csv_sha256 ?? 'n.d.',
      joblib_sha256: f.manifest?.model.joblib_sha256 ?? 'n.d.',
      data_version: f.manifest?.data_version ?? estudio.hash_datos,
      generado_datos: f.manifest?.generated_at ?? 'n.d.',
      filas_base: f.manifest?.source.rows ?? 0,
      versiones: f.manifest?.versions ?? {},
    },
    limitaciones: [...LIMITACIONES, COPY.campo],
  }
}

/** Nombre de archivo: DSA_Estudio_<municipios>_<fecha>.pdf/.md */
export function nombreReporte(estudio: Estudio, extension: 'pdf' | 'md'): string {
  const munis = estudio.municipios
    .map((m) =>
      nombreUi(m)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '')
        .slice(0, 12),
    )
    .join('-')
  const fecha = new Date().toISOString().slice(0, 10)
  return `DSA_Estudio_${munis || 'sin-municipio'}_${fecha}.${extension}`
}
