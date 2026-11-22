/**
 * Motor aditivo del GAM cuantílico (ADR-02).
 *
 * Réplica exacta de `pipeline/gam_export.py::predecir_aditivo`. No usa
 * scikit-learn ni B-splines: las curvas vienen precalculadas por el pipeline.
 * La paridad se verifica contra `golden.json` (tolerancia < 1 COP).
 */
import type { CurvaGAM, GamModel, MunicipioNombre, SimInput } from '@/types/domain'

export const SPLINES = ['num_anotacion', 'count_a', 'count_de'] as const

/** Lookup con clamp al extremo del rango observado (aviso de extrapolación en la UI). */
export function lookupCurva(curva: CurvaGAM, valor: number): number {
  const [lo, hi] = curva.rango
  const idx = Math.max(lo, Math.min(hi, Math.round(valor))) - lo
  return curva.valores[idx] ?? 0
}

export function featuresEstacionales(mes: number, dia: number) {
  const ang = (2 * Math.PI * (mes - 1)) / 12
  return { mes_seno: Math.sin(ang), mes_coseno: Math.cos(ang), dia_mes: dia }
}

export interface Contribuciones {
  intercepto: number
  municipio: number
  numericas: Record<string, number>
  curvas: Record<string, number>
  total: number
}

/**
 * Evalúa el modelo y devuelve la descomposición aditiva en COP.
 * `total` es la predicción con clip en 0; la suma de partes puede ser negativa
 * antes del clip (por eso se reporta `total` por separado).
 */
export function evaluar(model: GamModel, input: SimInput): Contribuciones {
  const feats: Record<string, number | null> = {
    ...input.features,
    ...featuresEstacionales(input.mes, input.dia),
  }
  const escala = model.modelo.escala
  const intercepto = model.intercepto * escala
  const municipio = (model.municipios[input.municipio]?.offset ?? 0) * escala

  const numericas: Record<string, number> = {}
  let suma = model.intercepto + (model.municipios[input.municipio]?.offset ?? 0)

  for (const [nombre, spec] of Object.entries(model.numericas)) {
    const raw = feats[nombre]
    let aporte: number
    if (raw == null) {
      aporte = spec.coef * ((spec.mediana_imputacion - spec.media) / spec.escala)
      const ind = model.indicadores_faltantes[nombre]
      if (ind) aporte += ind.coef * ((1 - ind.media) / ind.escala)
    } else {
      const x = spec.transform === 'log1p' ? Math.log1p(raw) : raw
      aporte = spec.coef * ((x - spec.media) / spec.escala)
    }
    numericas[nombre] = aporte * escala
    suma += aporte
  }

  const curvas: Record<string, number> = {}
  for (const nombre of SPLINES) {
    const raw = feats[nombre]
    if (raw == null) throw new Error(`Falta ${nombre} para evaluar la curva del spline`)
    const aporte = lookupCurva(model.curvas[nombre], raw)
    curvas[nombre] = aporte * escala
    suma += aporte
  }

  return {
    intercepto,
    municipio,
    numericas,
    curvas,
    total: Math.max(model.modelo.clip_min, suma * escala),
  }
}

/** Predicción en COP dic-2023 (mediana condicional q=0,5). */
export function predecir(model: GamModel, input: SimInput): number {
  return evaluar(model, input).total
}

/** Variables cuyo input cae fuera del rango observado en la base. */
export function extrapolaciones(model: GamModel, input: SimInput): string[] {
  const fuera: string[] = []
  for (const [nombre, [lo, hi]] of Object.entries(model.rangos)) {
    const v = input.features[nombre]
    if (v == null) continue
    if (v < lo || v > hi) fuera.push(nombre)
  }
  if (input.mes < 1 || input.mes > 12) fuera.push('mes')
  if (input.dia < 1 || input.dia > 31) fuera.push('dia')
  return fuera
}

/** Percentil empírico del valor estimado dentro de la distribución municipal. */
export function percentilDe(model: GamModel, municipio: MunicipioNombre, valor: number): number | null {
  const p = model.percentiles_por_municipio[municipio]
  if (!p || p.length === 0) return null
  if (valor <= p[0]) return 0
  if (valor >= p[p.length - 1]) return 100
  let lo = 0
  let hi = p.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (p[mid] <= valor) lo = mid
    else hi = mid
  }
  const span = p[hi] - p[lo]
  const frac = span > 0 ? (valor - p[lo]) / span : 0
  return lo + frac
}

export type EstadoGate = 'habilitado' | 'marginal' | 'sin_mejora'

export function estadoGate(model: GamModel, municipio: MunicipioNombre): EstadoGate {
  const m = model.municipios[municipio]
  if (!m) return 'sin_mejora'
  if (m.mejora_2023_pct <= 0) return 'sin_mejora'
  if (m.mejora_2023_pct < 1) return 'marginal'
  return 'habilitado'
}

/** Agrupa la descomposición en bloques legibles para el waterfall. */
export interface BloqueContribucion {
  id: string
  label: string
  valor: number
  detalle?: string
}

export function bloquesContribucion(c: Contribuciones): BloqueContribucion[] {
  const n = c.numericas
  const sum = (...keys: string[]) => keys.reduce((acc, k) => acc + (n[k] ?? 0), 0)
  const bloques: BloqueContribucion[] = [
    { id: 'base', label: 'Base del modelo', valor: c.intercepto },
    { id: 'municipio', label: 'Efecto municipio', valor: c.municipio },
    {
      id: 'poblacion',
      label: 'Población y estructura',
      valor: sum('poblacion_total', 'proporcion_cabecera', 'proporcion_0_17', 'proporcion_18_24', 'proporcion_25_44', 'proporcion_65_mas'),
    },
    { id: 'crecimiento', label: 'Crecimiento poblacional', valor: sum('crecimiento_poblacion', 'crecimiento_poblacion_cambio_serie') },
    { id: 'licencias', label: 'Licencias de vivienda', valor: sum('viviendas_por_1000', 'elic_area_vivienda_nueva_m2_lag1', 'elic_en_cobertura_lag1', 'elic_con_registros_lag1') },
    { id: 'economia', label: 'Valor agregado', valor: sum('va_real_pc', 'va_proporcion_secundaria_lag2', 'va_proporcion_terciaria_lag2') },
    {
      id: 'registral',
      label: 'Complejidad registral',
      valor: sum('num_anotacion', 'count_a', 'count_de', 'predios_nuevos') + (c.curvas.num_anotacion ?? 0) + (c.curvas.count_a ?? 0) + (c.curvas.count_de ?? 0),
      detalle: 'Anotaciones y conteos registrales (splines)',
    },
    { id: 'estacionalidad', label: 'Estacionalidad', valor: sum('mes_seno', 'mes_coseno', 'dia_mes') },
    { id: 'anio', label: 'Año de radicación', valor: sum('year_radica') },
  ]
  return bloques
}
