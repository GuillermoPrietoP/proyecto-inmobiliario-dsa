/**
 * Grid accesible de tarjetas municipales, ordenado por actividad (n descendente).
 * Reutilizado por el panorama y el índice de municipios.
 */
import { MunicipalityCard } from '@/components/MunicipalityCard'
import { EmptyState } from '@/components/ui'
import type { Moneda, MunicipioResumen, SerieMunicipio, Slug } from '@/types/domain'

export function MunicipalityGrid({
  resumenes,
  series,
  moneda,
  anio,
}: {
  resumenes: MunicipioResumen[]
  series?: Partial<Record<Slug, SerieMunicipio>>
  moneda: Moneda
  anio: number
}) {
  const ordenados = [...resumenes].sort((a, b) => b.n - a.n)
  if (ordenados.length === 0) {
    return (
      <EmptyState title="Sin municipios en la selección">
        Activa al menos un municipio en los filtros para ver sus tarjetas.
      </EmptyState>
    )
  }
  return (
    <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
      {ordenados.map((m) =>
        // MunicipalityCard ya renderiza <li> cuando hay datos; la variante
        // "sin datos" renderiza un <div>, así que la envolvemos en <li>.
        m.tiene_datos ? (
          <MunicipalityCard key={m.slug} resumen={m} serie={series?.[m.slug]} moneda={moneda} anio={anio} />
        ) : (
          <li key={m.slug} className="list-none">
            <MunicipalityCard resumen={m} serie={series?.[m.slug]} moneda={moneda} anio={anio} />
          </li>
        ),
      )}
    </ul>
  )
}
