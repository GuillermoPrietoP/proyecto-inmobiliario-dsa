/** Filtros globales sincronizados con la URL: año, alcance, moneda y municipios. */
import { Badge, Chip, Select } from '@/components/ui'
import { ANIOS, useFiltros } from '@/hooks/useFiltros'
import { NOMBRE_POR_SLUG } from '@/lib/data'
import { COPY } from '@/content/es'
import type { Slug } from '@/types/domain'

export function GlobalFilters({
  showMunicipios = false,
  anioDeshabilitado = false,
  notaAnio,
  maxMunicipios,
}: {
  showMunicipios?: boolean
  anioDeshabilitado?: boolean
  notaAnio?: string
  maxMunicipios?: number
}) {
  const { anio, setAnio, moneda, setMoneda, alcance, setAlcance, seleccionEfectiva, toggleMunicipio, municipiosDisponibles } = useFiltros()

  return (
    <div className="card card-pad space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[130px]">
          <label htmlFor="filtro-anio" className="label mb-1 block">Año de corte</label>
          <Select id="filtro-anio" value={anio} disabled={anioDeshabilitado} onChange={(e) => setAnio(Number(e.target.value))}>
            {ANIOS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
        </div>

        <div className="min-w-[150px]">
          <label htmlFor="filtro-alcance" className="label mb-1 block">Alcance</label>
          <Select id="filtro-alcance" value={alcance} onChange={(e) => setAlcance(e.target.value as '6' | '3')}>
            <option value="6">6 municipios</option>
            <option value="3">3 ciudades capitales</option>
          </Select>
        </div>

        <div className="min-w-[190px]">
          <span className="label mb-1 block">Moneda</span>
          <div className="flex gap-1 rounded-[10px] border border-line bg-white p-1" role="group" aria-label="Unidad de los montos">
            <button
              type="button"
              aria-pressed={moneda === 'real'}
              onClick={() => setMoneda('real')}
              className={`flex-1 rounded-[7px] px-2.5 py-1 text-[0.78rem] font-semibold ${moneda === 'real' ? 'bg-green-mock text-white' : 'text-navy hover:bg-navy-50'}`}
            >
              COP dic-2023
            </button>
            <button
              type="button"
              aria-pressed={moneda === 'nominal'}
              onClick={() => setMoneda('nominal')}
              className={`flex-1 rounded-[7px] px-2.5 py-1 text-[0.78rem] font-semibold ${moneda === 'nominal' ? 'bg-orange-mock text-white' : 'text-navy hover:bg-navy-50'}`}
            >
              Nominal
            </button>
          </div>
        </div>

        <div className="ml-auto flex flex-col items-end gap-1">
          <Badge tone={moneda === 'real' ? 'success' : 'warning'} icon={moneda === 'real' ? 'check' : 'warning'}>
            {moneda === 'real' ? 'Pesos constantes' : 'Pesos nominales'}
          </Badge>
          {notaAnio ? <span className="nota max-w-[240px] text-right">{notaAnio}</span> : null}
        </div>
      </div>

      {moneda === 'nominal' ? (
        <p className="rounded-[10px] border border-[#ffd9b0] bg-[#fff3e6] px-3 py-2 text-[0.78rem] leading-snug text-[#7d4409]">
          {COPY.nominal}
        </p>
      ) : null}

      {showMunicipios ? (
        <div>
          <span className="label mb-1.5 block">
            Municipios {maxMunicipios ? `(máx. ${maxMunicipios})` : ''}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {municipiosDisponibles.map((slug: Slug) => {
              const activo = seleccionEfectiva.includes(slug)
              const lleno = maxMunicipios != null && !activo && seleccionEfectiva.length >= maxMunicipios
              return (
                <Chip key={slug} active={activo} disabled={lleno} onClick={() => toggleMunicipio(slug)} title={NOMBRE_POR_SLUG[slug]}>
                  {nombreCorto(slug)}
                </Chip>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function nombreCorto(slug: Slug): string {
  const n = NOMBRE_POR_SLUG[slug]
  if (n === 'SANTA ROSA DE CABAL') return 'Santa Rosa'
  return n.charAt(0) + n.slice(1).toLowerCase()
}
