/**
 * Estado compartible por URL (ADR-08): año, alcance, moneda y municipios.
 * Todo link es reproducible; los estudios se persisten aparte en localStorage.
 */
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SLUGS } from '@/lib/data'
import type { Alcance, Moneda, MunicipioNombre, Slug } from '@/types/domain'
import { MUNICIPIOS_3 } from '@/types/domain'
import { NOMBRE_POR_SLUG } from '@/lib/data'

export const ANIO_DEFAULT = 2023
export const ANIOS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023]

export const SLUGS_3: Slug[] = ['armenia', 'manizales', 'pereira']

export function useFiltros() {
  const [params, setParams] = useSearchParams()

  const anio = useMemo(() => {
    const v = Number(params.get('anio'))
    return ANIOS.includes(v) ? v : ANIO_DEFAULT
  }, [params])

  const moneda: Moneda = params.get('moneda') === 'nominal' ? 'nominal' : 'real'
  const alcance: Alcance = params.get('alcance') === '3' ? '3' : '6'

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

  const setAnio = useCallback((v: number) => setParam('anio', String(v)), [setParam])
  const setMoneda = useCallback((v: Moneda) => setParam('moneda', v === 'real' ? null : v), [setParam])
  const setAlcance = useCallback(
    (v: Alcance) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (v === '6') next.delete('alcance')
          else next.set('alcance', v)
          // Al cambiar a 3 municipios, la selección se recorta al subconjunto.
          const m = (next.get('m') ?? '').split(',').filter(Boolean) as Slug[]
          if (v === '3' && m.length) next.set('m', m.filter((s) => SLUGS_3.includes(s)).join(',') || SLUGS_3.join(','))
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const seleccion = useMemo(() => {
    const raw = (params.get('m') ?? '').split(',').filter(Boolean) as Slug[]
    const validos = raw.filter((s) => SLUGS.includes(s))
    return validos
  }, [params])

  const setSeleccion = useCallback(
    (slugs: Slug[]) => {
      const unicos = Array.from(new Set(slugs)).filter((s) => SLUGS.includes(s))
      setParam('m', unicos.length ? unicos.join(',') : null)
    },
    [setParam],
  )

  const toggleMunicipio = useCallback(
    (slug: Slug) => {
      setSeleccion(seleccion.includes(slug) ? seleccion.filter((s) => s !== slug) : [...seleccion, slug])
    },
    [seleccion, setSeleccion],
  )

  const municipiosDisponibles = alcance === '3' ? SLUGS_3 : SLUGS
  const seleccionEfectiva = seleccion.length
    ? seleccion.filter((s) => municipiosDisponibles.includes(s))
    : municipiosDisponibles

  const nombres: MunicipioNombre[] = seleccionEfectiva.map((s) => NOMBRE_POR_SLUG[s])

  return {
    params,
    setParam,
    anio,
    setAnio,
    moneda,
    setMoneda,
    alcance,
    setAlcance,
    seleccion,
    seleccionEfectiva,
    setSeleccion,
    toggleMunicipio,
    municipiosDisponibles,
    nombres,
    nombres3: MUNICIPIOS_3,
  }
}

/** Lee un parámetro libre (p. ej. `direccion`, `paso`, `tramo`). */
export function useParam(clave: string, porDefecto: string): [string, (v: string | null) => void] {
  const [params, setParams] = useSearchParams()
  const valor = params.get(clave) ?? porDefecto
  const set = useCallback(
    (v: string | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (v == null || v === '' || v === porDefecto) next.delete(clave)
          else next.set(clave, v)
          return next
        },
        { replace: true },
      )
    },
    [clave, porDefecto, setParams],
  )
  return [valor, set]
}
