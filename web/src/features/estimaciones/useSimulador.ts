/**
 * Estado del simulador GAM: defaults del municipio-año de referencia,
 * overrides del usuario y sincronización de los inputs registrales con la URL.
 */
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { NOMBRE_POR_SLUG, SLUGS } from '@/lib/data'
import { extrapolaciones } from '@/lib/gam/engine'
import type { GamModel, MunicipioNombre, Slug } from '@/types/domain'

export type Overrides = Record<string, number | null>

/** Campos del contexto que el modelo usa como features (mapeo 1:1). */
const CAMPOS_CONTEXTO = [
  'poblacion_total',
  'proporcion_cabecera',
  'proporcion_0_17',
  'proporcion_18_24',
  'proporcion_25_44',
  'proporcion_65_mas',
  'crecimiento_poblacion',
  'crecimiento_poblacion_cambio_serie',
  'elic_area_vivienda_nueva_m2_lag1',
  'viviendas_por_1000',
  'va_real_pc',
  'va_proporcion_secundaria_lag2',
  'va_proporcion_terciaria_lag2',
  'elic_en_cobertura_lag1',
  'elic_con_registros_lag1',
] as const

export const VARIABLES_SIN_EFECTO = new Set([
  'proporcion_0_17',
  'proporcion_18_24',
  'proporcion_25_44',
  'proporcion_65_mas',
  'elic_area_vivienda_nueva_m2_lag1',
  'va_real_pc',
  'va_proporcion_secundaria_lag2',
  'va_proporcion_terciaria_lag2',
  'crecimiento_poblacion_cambio_serie',
  'elic_en_cobertura_lag1',
  'elic_con_registros_lag1',
  'count_de',
  'predios_nuevos',
  'mes_coseno',
  'dia_mes',
])

export function rangoDe(model: GamModel, campo: string): [number, number] {
  const exportado = model.rangos[campo]
  if (exportado) return [exportado[0], exportado[1]]
  let min = Infinity
  let max = -Infinity
  for (const porAnio of Object.values(model.contexto_por_municipio)) {
    for (const ctx of Object.values(porAnio)) {
      const v = ctx[campo]
      if (v == null || !Number.isFinite(v)) continue
      min = Math.min(min, v)
      max = Math.max(max, v)
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  if (min === max) return [min, min + 1]
  return [min, max]
}

function enterosDe(v: number): number {
  return Math.round(v)
}

export function useSimulador(model: GamModel | undefined) {
  const [params, setParams] = useSearchParams()
  const [overrides, setOverrides] = useState<Overrides>({})
  const [reconocido, setReconocido] = useState(false)
  const [verExperimental, setVerExperimental] = useState(false)

  const anio = model?.modelo.anio_referencia ?? 2023

  const slug: Slug = useMemo(() => {
    const m = params.get('m') as Slug | null
    return m && SLUGS.includes(m) ? m : 'armenia'
  }, [params])

  const municipio: MunicipioNombre = NOMBRE_POR_SLUG[slug]

  const ctx = useMemo(() => {
    if (!model) return undefined
    return model.contexto_por_municipio[municipio]?.[String(anio)]
  }, [model, municipio, anio])

  const setParam = useCallback(
    (clave: string, valor: string | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (valor == null || valor === '') next.delete(clave)
          else next.set(clave, valor)
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const setMunicipio = useCallback(
    (s: Slug) => {
      setParam('m', s === 'armenia' ? null : s)
      setOverrides({})
      setReconocido(false)
      setVerExperimental(false)
    },
    [setParam],
  )

  const numAnotacion = useMemo(() => {
    const v = Number(params.get('na'))
    const def = ctx?.num_anotacion_mediana ?? 8
    return Number.isFinite(v) && v >= 1 ? enterosDe(v) : enterosDe(def)
  }, [params, ctx])

  const countA = useMemo(() => {
    const v = Number(params.get('ca'))
    const def = ctx?.count_a_mediana ?? 0
    return Number.isFinite(v) && v >= 0 ? enterosDe(v) : enterosDe(def)
  }, [params, ctx])

  const countDe = useMemo(() => {
    const v = Number(params.get('cd'))
    const def = ctx?.count_de_mediana ?? 0
    return Number.isFinite(v) && v >= 0 ? enterosDe(v) : enterosDe(def)
  }, [params, ctx])

  const mes = useMemo(() => {
    const v = Number(params.get('mes'))
    const def = ctx?.mes_moda ?? 6
    return Number.isFinite(v) && v >= 1 && v <= 12 ? enterosDe(v) : enterosDe(def)
  }, [params, ctx])

  const dia = useMemo(() => {
    const v = Number(params.get('dia'))
    const def = ctx?.dia_mediana ?? 15
    return Number.isFinite(v) && v >= 1 && v <= 31 ? enterosDe(v) : enterosDe(def)
  }, [params, ctx])

  const setNumAnotacion = useCallback((v: number) => setParam('na', String(enterosDe(v))), [setParam])
  const setCountA = useCallback((v: number) => setParam('ca', String(enterosDe(v))), [setParam])
  const setCountDe = useCallback((v: number) => setParam('cd', String(enterosDe(v))), [setParam])
  const setMes = useCallback((v: number) => setParam('mes', String(enterosDe(v))), [setParam])
  const setDia = useCallback((v: number) => setParam('dia', String(enterosDe(v))), [setParam])

  const setOverride = useCallback((campo: string, valor: number | null) => {
    setOverrides((prev) => ({ ...prev, [campo]: valor }))
  }, [])

  const reset = useCallback(() => {
    setOverrides({})
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const k of ['na', 'ca', 'cd', 'mes', 'dia']) next.delete(k)
        return next
      },
      { replace: true },
    )
  }, [setParams])

  /** Features crudas (pre-transform) que consume el motor. */
  const features = useMemo(() => {
    const f: Record<string, number | null> = {}
    if (!model || !ctx) return f
    for (const campo of CAMPOS_CONTEXTO) {
      const base = ctx[campo] ?? null
      f[campo] = campo in overrides ? overrides[campo] : base
    }
    f.year_radica = anio
    f.num_anotacion = numAnotacion
    f.count_a = countA
    f.count_de = countDe
    f.predios_nuevos = 'predios_nuevos' in overrides ? overrides.predios_nuevos : 0
    return f
  }, [model, ctx, overrides, anio, numAnotacion, countA, countDe])

  const input = useMemo(
    () => ({ municipio, mes, dia, features }),
    [municipio, mes, dia, features],
  )

  const fueraDeRango = useMemo(
    () => (model ? extrapolaciones(model, input) : []),
    [model, input],
  )

  const gate = model?.municipios[municipio]
  const bloqueado = gate ? !gate.habilitado : false
  const visible = !bloqueado || (verExperimental && reconocido)

  const valor = useCallback(
    (campo: string): number | null => {
      if (campo in overrides) return overrides[campo]
      return ctx?.[campo] ?? null
    },
    [overrides, ctx],
  )

  const modificado = Object.keys(overrides).length > 0 || ['na', 'ca', 'cd', 'mes', 'dia'].some((k) => params.has(k))

  return {
    slug,
    municipio,
    anio,
    ctx,
    input,
    features,
    valor,
    overrides,
    setOverride,
    reset,
    modificado,
    numAnotacion,
    countA,
    countDe,
    mes,
    dia,
    setNumAnotacion,
    setCountA,
    setCountDe,
    setMes,
    setDia,
    setMunicipio,
    fueraDeRango,
    gate,
    bloqueado,
    visible,
    reconocido,
    setReconocido,
    verExperimental,
    setVerExperimental,
  }
}
