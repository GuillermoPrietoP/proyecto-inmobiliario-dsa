/**
 * Filtros locales de /alertas sincronizados con la URL (ADR-08):
 * tramo, dirección, categoría, búsqueda pk/matrícula y orden.
 * El año y los municipios vienen del filtro global (useFiltros).
 */
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useFiltros, useParam } from '@/hooks/useFiltros'
import { NOMBRE_POR_SLUG } from '@/lib/data'
import type { Alerta, CategoriaRazon, DireccionAlerta, Slug, Tramo } from '@/types/domain'
import { TRAMOS } from './etiquetas'

export type OrdenAlertas = 'z' | 'real_asc' | 'real_desc'

const ORDENES: readonly OrdenAlertas[] = ['z', 'real_asc', 'real_desc']
const CATEGORIAS: readonly CategoriaRazon[] = [
  'valor_bajo_unidad',
  'valor_bajo_extremo',
  'valor_alto_extremo',
  'duplicado_valor',
]
const PARAMS_LOCALES = ['tramo', 'direccion', 'categoria', 'q', 'orden']

export function useFiltrosAlertas(items: Alerta[]) {
  const { anio, seleccionEfectiva } = useFiltros()
  const [, setParams] = useSearchParams()
  const [tramoRaw, setTramo] = useParam('tramo', 'todos')
  const [direccionRaw, setDireccion] = useParam('direccion', 'todas')
  const [categoriaRaw, setCategoria] = useParam('categoria', 'todas')
  const [q, setQ] = useParam('q', '')
  const [ordenRaw, setOrden] = useParam('orden', 'z')

  // Sanea valores inválidos llegados por URL.
  const tramo: Tramo | 'todos' = TRAMOS.includes(tramoRaw as Tramo) ? (tramoRaw as Tramo) : 'todos'
  const direccion: DireccionAlerta | 'todas' =
    direccionRaw === 'alta' || direccionRaw === 'baja' ? direccionRaw : 'todas'
  const categoria: CategoriaRazon | 'todas' = CATEGORIAS.includes(categoriaRaw as CategoriaRazon)
    ? (categoriaRaw as CategoriaRazon)
    : 'todas'
  const orden: OrdenAlertas = ORDENES.includes(ordenRaw as OrdenAlertas) ? (ordenRaw as OrdenAlertas) : 'z'

  const munKey = seleccionEfectiva.join(',')

  const filtrados = useMemo(() => {
    const nombres = new Set(
      munKey
        .split(',')
        .filter(Boolean)
        .map((s) => NOMBRE_POR_SLUG[s as Slug]),
    )
    const texto = q.trim().toLowerCase()
    const resultado = items.filter(
      (it) =>
        it.anio === anio &&
        nombres.has(it.municipio) &&
        (tramo === 'todos' || it.tramo === tramo) &&
        (direccion === 'todas' || it.direccion === direccion) &&
        (categoria === 'todas' || it.categoria_razon === categoria) &&
        (texto === '' || it.pk.toLowerCase().includes(texto) || it.matricula.toLowerCase().includes(texto)),
    )
    resultado.sort(
      orden === 'real_asc'
        ? (a, b) => a.valor_real - b.valor_real
        : orden === 'real_desc'
          ? (a, b) => b.valor_real - a.valor_real
          : (a, b) => Math.abs(b.z_robusto) - Math.abs(a.z_robusto),
    )
    return resultado
  }, [items, anio, munKey, tramo, direccion, categoria, q, orden])

  /** Conteo de las señales publicadas por año (para orientar el año de corte). */
  const porAnioPublicadas = useMemo(() => {
    const m = new Map<number, number>()
    for (const it of items) m.set(it.anio, (m.get(it.anio) ?? 0) + 1)
    return m
  }, [items])

  const limpiar = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const clave of PARAMS_LOCALES) next.delete(clave)
        return next
      },
      { replace: true },
    )
  }, [setParams])

  const hayFiltrosLocales =
    tramo !== 'todos' || direccion !== 'todas' || categoria !== 'todas' || q.trim() !== '' || orden !== 'z'

  return {
    anio,
    tramo,
    setTramo,
    direccion,
    setDireccion,
    categoria,
    setCategoria,
    q,
    setQ,
    orden,
    setOrden,
    filtrados,
    porAnioPublicadas,
    hayFiltrosLocales,
    limpiar,
  }
}
