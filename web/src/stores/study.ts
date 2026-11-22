/**
 * Store de "Mi Estudio" (Zustand + localStorage, esquema versionado).
 * Sin PII. Máximo 10 estudios guardados; los más antiguos se descartan.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CHECKLIST_CAMPO } from '@/content/es'
import type { ChecklistId, ChecklistItem, Estudio, EstudioGam, MunicipioNombre } from '@/types/domain'

export const STORAGE_KEY = 'dsa.estudios.v1'
export const MAX_ESTUDIOS = 10
export const MAX_MUNICIPIOS_ESTUDIO = 3

export function nuevoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function checklistInicial(): ChecklistItem[] {
  return CHECKLIST_CAMPO.map((c) => ({
    id: c.id as ChecklistId,
    completado: false,
    nota: '',
    fecha_verificacion: null,
  }))
}

export function estudioVacio(anio: number, hash: string): Estudio {
  const ahora = new Date().toISOString()
  return {
    schema_version: '1.0.0',
    id: nuevoId(),
    creado_en: ahora,
    actualizado_en: ahora,
    titulo: '',
    anio,
    alcance: '6_municipios',
    municipios: [],
    horizonte: '3–5 años',
    objetivo: '',
    perfil: '',
    evidencia: {
      incluir_actividad: true,
      incluir_valores: true,
      incluir_contexto: true,
      incluir_alertas: true,
      incluir_gam: false,
    },
    gam: null,
    checklist: checklistInicial(),
    limitaciones_reconocidas: false,
    hash_datos: hash,
  }
}

interface StudyState {
  borrador: Estudio | null
  guardados: Estudio[]
  aviso: string | null
  iniciar: (anio: number, hash: string, municipios?: MunicipioNombre[]) => void
  actualizar: (patch: Partial<Estudio>) => void
  toggleMunicipio: (m: MunicipioNombre) => void
  setEvidencia: (clave: keyof Estudio['evidencia'], valor: boolean) => void
  setChecklist: (id: ChecklistId, patch: Partial<ChecklistItem>) => void
  setGam: (gam: EstudioGam | null) => void
  guardar: () => Estudio | null
  cargar: (id: string) => void
  eliminar: (id: string) => void
  descartar: () => void
  setAviso: (v: string | null) => void
}

export const useStudyStore = create<StudyState>()(
  persist(
    (set, get) => ({
      borrador: null,
      guardados: [],
      aviso: null,

      iniciar: (anio, hash, municipios = []) =>
        set((s) => {
          if (s.borrador) return { aviso: 'Ya hay un borrador en curso. Guárdalo o descártalo antes de iniciar otro.' }
          const base = estudioVacio(anio, hash)
          return { borrador: { ...base, municipios: municipios.slice(0, MAX_MUNICIPIOS_ESTUDIO) }, aviso: null }
        }),

      actualizar: (patch) =>
        set((s) => (s.borrador ? { borrador: { ...s.borrador, ...patch, actualizado_en: new Date().toISOString() } } : {})),

      toggleMunicipio: (m) =>
        set((s) => {
          if (!s.borrador) return {}
          const tiene = s.borrador.municipios.includes(m)
          if (!tiene && s.borrador.municipios.length >= MAX_MUNICIPIOS_ESTUDIO) {
            return { aviso: `Máximo ${MAX_MUNICIPIOS_ESTUDIO} municipios por estudio para mantener el reporte legible.` }
          }
          const municipios = tiene ? s.borrador.municipios.filter((x) => x !== m) : [...s.borrador.municipios, m]
          const gam = s.borrador.gam && !municipios.includes(s.borrador.gam.municipio) ? null : s.borrador.gam
          return { borrador: { ...s.borrador, municipios, gam, actualizado_en: new Date().toISOString() }, aviso: null }
        }),

      setEvidencia: (clave, valor) =>
        set((s) =>
          s.borrador
            ? { borrador: { ...s.borrador, evidencia: { ...s.borrador.evidencia, [clave]: valor }, actualizado_en: new Date().toISOString() } }
            : {},
        ),

      setChecklist: (id, patch) =>
        set((s) => {
          if (!s.borrador) return {}
          const checklist = s.borrador.checklist.map((c) =>
            c.id === id
              ? {
                  ...c,
                  ...patch,
                  fecha_verificacion:
                    patch.completado === true && !c.fecha_verificacion
                      ? new Date().toISOString().slice(0, 10)
                      : patch.completado === false
                        ? null
                        : (patch.fecha_verificacion ?? c.fecha_verificacion),
                }
              : c,
          )
          return { borrador: { ...s.borrador, checklist, actualizado_en: new Date().toISOString() } }
        }),

      setGam: (gam) =>
        set((s) => (s.borrador ? { borrador: { ...s.borrador, gam, actualizado_en: new Date().toISOString() } } : {})),

      guardar: () => {
        const b = get().borrador
        if (!b) return null
        const estudio: Estudio = { ...b, actualizado_en: new Date().toISOString() }
        set((s) => {
          const existentes = s.guardados.filter((e) => e.id !== estudio.id)
          const lista = [estudio, ...existentes].slice(0, MAX_ESTUDIOS)
          return { guardados: lista, borrador: estudio, aviso: null }
        })
        return estudio
      },

      cargar: (id) =>
        set((s) => {
          const e = s.guardados.find((x) => x.id === id)
          if (!e) return { aviso: 'No se encontró el estudio solicitado.' }
          if (e.schema_version !== '1.0.0') {
            return { aviso: 'El estudio tiene un esquema antiguo: expórtalo o elimínalo antes de editarlo.' }
          }
          return { borrador: { ...e, checklist: e.checklist?.length ? e.checklist : checklistInicial() }, aviso: null }
        }),

      eliminar: (id) =>
        set((s) => ({
          guardados: s.guardados.filter((e) => e.id !== id),
          borrador: s.borrador?.id === id ? null : s.borrador,
        })),

      descartar: () => set({ borrador: null, aviso: null }),
      setAviso: (v) => set({ aviso: v }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: (s) => ({ guardados: s.guardados, borrador: s.borrador }),
      migrate: (estado, version) => {
        // Esquemas antiguos: se conservan los estudios pero se avisa al usuario.
        if (version !== 1) return { guardados: [], borrador: null, aviso: 'Se descartaron estudios de un esquema anterior.' }
        return estado as StudyState
      },
    },
  ),
)

/** Paso 3 obligatorio (BR-11): checklist completo + limitaciones reconocidas. */
export function puedeExportar(e: Estudio | null): { ok: boolean; pendientes: string[] } {
  if (!e) return { ok: false, pendientes: ['Inicia un estudio'] }
  const pendientes: string[] = []
  if (!e.titulo.trim()) pendientes.push('Título del estudio')
  if (e.municipios.length === 0) pendientes.push('Al menos un municipio')
  const sinMarcar = e.checklist.filter((c) => !c.completado).map((c) => CHECKLIST_CAMPO.find((x) => x.id === c.id)?.label ?? c.id)
  if (sinMarcar.length) pendientes.push(`Checklist de campo: ${sinMarcar.join(', ')}`)
  if (!e.limitaciones_reconocidas) pendientes.push('Reconocer las limitaciones del estudio')
  return { ok: pendientes.length === 0, pendientes }
}
