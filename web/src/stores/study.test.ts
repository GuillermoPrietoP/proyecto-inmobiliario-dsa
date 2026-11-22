import { beforeEach, describe, expect, it } from 'vitest'
import { CHECKLIST_CAMPO } from '@/content/es'
import { MAX_ESTUDIOS, MAX_MUNICIPIOS_ESTUDIO, puedeExportar, useStudyStore } from '@/stores/study'

function iniciar() {
  useStudyStore.getState().descartar()
  useStudyStore.getState().iniciar(2023, '2026.11.22+bcdbe95', ['ARMENIA'])
  return useStudyStore.getState().borrador!
}

beforeEach(() => {
  window.localStorage.clear()
  useStudyStore.setState({ borrador: null, guardados: [], aviso: null })
})

describe('store de Mi Estudio', () => {
  it('inicia un borrador con checklist completo y esquema versionado', () => {
    const e = iniciar()
    expect(e.schema_version).toBe('1.0.0')
    expect(e.municipios).toEqual(['ARMENIA'])
    expect(e.checklist).toHaveLength(CHECKLIST_CAMPO.length)
    expect(e.checklist.every((c) => !c.completado)).toBe(true)
    expect(e.limitaciones_reconocidas).toBe(false)
    expect(e.hash_datos).toBe('2026.11.22+bcdbe95')
  })

  it('limita a 3 municipios y avisa', () => {
    iniciar()
    const s = useStudyStore.getState()
    s.toggleMunicipio('MANIZALES')
    s.toggleMunicipio('PEREIRA')
    s.toggleMunicipio('CALARCÁ')
    expect(useStudyStore.getState().borrador!.municipios).toHaveLength(MAX_MUNICIPIOS_ESTUDIO)
    expect(useStudyStore.getState().aviso).toMatch(/Máximo 3/)
  })

  it('al quitar un municipio se descarta su estimación GAM', () => {
    iniciar()
    const s = useStudyStore.getState()
    s.setGam({ municipio: 'ARMENIA', estimado_cop: 1e8, mediana_real: 1.08e8, mae_cop: 9.4e7, mejora_pct: 2.8, reconocio_limitacion: false })
    expect(useStudyStore.getState().borrador!.gam).not.toBeNull()
    s.toggleMunicipio('ARMENIA')
    expect(useStudyStore.getState().borrador!.gam).toBeNull()
  })

  it('el checklist registra fecha al verificar y la limpia al desmarcar', () => {
    iniciar()
    useStudyStore.getState().setChecklist('area', { completado: true, nota: 'Medido en campo' })
    let item = useStudyStore.getState().borrador!.checklist.find((c) => c.id === 'area')!
    expect(item.completado).toBe(true)
    expect(item.fecha_verificacion).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(item.nota).toBe('Medido en campo')
    useStudyStore.getState().setChecklist('area', { completado: false })
    item = useStudyStore.getState().borrador!.checklist.find((c) => c.id === 'area')!
    expect(item.fecha_verificacion).toBeNull()
  })

  it('BR-11: no se puede exportar sin título, municipios, checklist y limitaciones', () => {
    const e = iniciar()
    expect(puedeExportar(e).ok).toBe(false)
    expect(puedeExportar(null).ok).toBe(false)

    const s = useStudyStore.getState()
    s.actualizar({ titulo: 'Estudio de prueba' })
    expect(puedeExportar(useStudyStore.getState().borrador).ok).toBe(false)

    for (const c of CHECKLIST_CAMPO) s.setChecklist(c.id as never, { completado: true })
    expect(puedeExportar(useStudyStore.getState().borrador).ok).toBe(false)
    expect(puedeExportar(useStudyStore.getState().borrador).pendientes.join(' ')).toMatch(/limitaciones/i)

    s.actualizar({ limitaciones_reconocidas: true })
    const final = useStudyStore.getState().borrador!
    expect(puedeExportar(final).ok).toBe(true)
    expect(puedeExportar(final).pendientes).toEqual([])
  })

  it('guarda, recupera y limita a 10 estudios', () => {
    for (let i = 0; i < MAX_ESTUDIOS + 3; i++) {
      useStudyStore.getState().descartar()
      useStudyStore.getState().iniciar(2023, 'hash', ['ARMENIA'])
      useStudyStore.getState().actualizar({ titulo: `Estudio ${i}` })
      useStudyStore.getState().guardar()
    }
    const guardados = useStudyStore.getState().guardados
    expect(guardados).toHaveLength(MAX_ESTUDIOS)
    expect(guardados[0].titulo).toBe(`Estudio ${MAX_ESTUDIOS + 2}`)

    const id = guardados[1].id
    useStudyStore.getState().descartar()
    useStudyStore.getState().cargar(id)
    expect(useStudyStore.getState().borrador?.id).toBe(id)

    useStudyStore.getState().eliminar(id)
    expect(useStudyStore.getState().guardados.find((g) => g.id === id)).toBeUndefined()
  })

  it('persiste en localStorage con la clave versionada', () => {
    iniciar()
    useStudyStore.getState().actualizar({ titulo: 'Persistido' })
    useStudyStore.getState().guardar()
    const crudo = window.localStorage.getItem('dsa.estudios.v1')
    expect(crudo).not.toBeNull()
    const parsed = JSON.parse(crudo as string)
    expect(parsed.state.guardados[0].titulo).toBe('Persistido')
  })
})
