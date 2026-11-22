/** CTA transversal "Agregar a Mi Estudio" (ficha, comparación, estimaciones). */
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui'
import { useFiltros } from '@/hooks/useFiltros'
import { useManifest } from '@/lib/data'
import { MAX_MUNICIPIOS_ESTUDIO, useStudyStore } from '@/stores/study'
import type { MunicipioNombre } from '@/types/domain'

export function AgregarEstudio({
  municipio,
  etiqueta = 'Agregar a Mi Estudio',
  size = 'sm',
}: {
  municipio?: MunicipioNombre
  etiqueta?: string
  size?: 'sm' | 'md'
}) {
  const navigate = useNavigate()
  const { anio } = useFiltros()
  const { data: manifest } = useManifest()
  const borrador = useStudyStore((s) => s.borrador)
  const iniciar = useStudyStore((s) => s.iniciar)
  const toggleMunicipio = useStudyStore((s) => s.toggleMunicipio)
  const aviso = useStudyStore((s) => s.aviso)

  const incluido = municipio ? (borrador?.municipios.includes(municipio) ?? false) : false
  const lleno = borrador != null && borrador.municipios.length >= MAX_MUNICIPIOS_ESTUDIO && !incluido

  function onClick() {
    const hash = manifest?.data_version ?? 'sin-manifest'
    if (!borrador) {
      iniciar(anio, hash, municipio ? [municipio] : [])
    } else if (municipio) {
      toggleMunicipio(municipio)
    }
    navigate('/mi-estudio')
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        variant={incluido ? 'primary' : 'secondary'}
        size={size}
        icon={incluido ? 'check' : 'plus'}
        onClick={onClick}
        disabled={lleno}
        title={lleno ? `Máximo ${MAX_MUNICIPIOS_ESTUDIO} municipios por estudio` : undefined}
      >
        {incluido ? 'En Mi Estudio' : etiqueta}
      </Button>
      {aviso ? <span className="nota max-w-[220px] text-orange-mock">{aviso}</span> : null}
    </span>
  )
}
