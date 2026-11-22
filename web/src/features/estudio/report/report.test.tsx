/**
 * Verifica los exportadores del estudio: Markdown completo y PDF vectorial.
 * El PDF se genera de verdad (motor de @react-pdf/renderer) para detectar
 * errores de fuentes, glifos o layout antes de publicar.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHECKLIST_CAMPO, DISCLAIMER_LARGO } from '@/content/es'
import { checklistInicial, estudioVacio } from '@/stores/study'
import type { Alertas, Comparacion, GamModel, Manifest, Panorama } from '@/types/domain'
import { construirReporte, nombreReporte } from './datos'
import { generarMarkdown } from './markdown'
import { sanitizarPdf } from './pdf'

const DIR = join(process.cwd(), 'public', 'data', 'v1')
const leer = <T,>(f: string): T => JSON.parse(readFileSync(join(DIR, f), 'utf-8')) as T

const panorama = leer<Panorama>('panorama.json')
const comparacion = leer<Comparacion>('comparacion.json')
const alertas = leer<Alertas>('alertas.json')
const gam = leer<GamModel>('gam_simulador.json')
const manifest = leer<Manifest>('manifest.json')

function estudioCompleto() {
  const e = estudioVacio(2023, manifest.data_version)
  e.titulo = 'Priorización de municipios para vivienda urbana'
  e.municipios = ['ARMENIA', 'MANIZALES', 'CALARCÁ']
  e.objetivo = 'Identificar dónde profundizar un estudio de oferta, arriendos y costos.'
  e.perfil = 'Inversionista particular'
  e.checklist = checklistInicial().map((c) => ({ ...c, completado: true, nota: `Verificado: ${c.id}`, fecha_verificacion: '2026-11-22' }))
  e.limitaciones_reconocidas = true
  e.evidencia.incluir_gam = true
  e.gam = {
    municipio: 'MANIZALES',
    estimado_cop: 135000000,
    mediana_real: 135000000,
    mae_cop: gam.metricas.por_municipio_2023.MANIZALES.mae_modelo,
    mejora_pct: gam.municipios.MANIZALES.mejora_2023_pct,
    reconocio_limitacion: true,
    inputs: { num_anotacion: 8 },
    mes: 6,
    dia: 15,
  }
  return e
}

const fuentes = { panorama, comparacion, alertas, gam, manifest }

describe('construcción del reporte', () => {
  it('reúne la evidencia de los municipios seleccionados', () => {
    const r = construirReporte(estudioCompleto(), fuentes)
    expect(r.filas).toHaveLength(3)
    expect(r.filas.map((f) => f.nombre_ui)).toEqual(['Armenia', 'Manizales', 'Calarcá'])
    expect(r.filas[0].registros).toBe(9672)
    expect(r.hallazgos.length).toBeGreaterThanOrEqual(3)
    expect(r.justificacion).toMatch(/Profundizaría/)
    expect(r.justificacion).toMatch(/campo/)
    expect(r.criterios.length).toBeGreaterThan(0)
    expect(r.hash_datos).toBe(manifest.data_version)
  })

  it('la participación se calcula sobre la selección, no sobre los 6 municipios', () => {
    const r = construirReporte(estudioCompleto(), fuentes)
    const suma = r.filas.reduce((a, f) => a + f.share_pct, 0)
    expect(Math.abs(suma - 100)).toBeLessThan(0.01)
    expect(r.filas[0].share_pct).toBeGreaterThan(r.filas[0].registros / 283.84)
  })

  it('marca la serie parcial de Calarcá y la compuerta de Manizales', () => {
    const r = construirReporte(estudioCompleto(), fuentes)
    expect(r.filas.find((f) => f.municipio === 'CALARCÁ')?.serie_parcial).toBe(true)
    expect(r.gam?.habilitado).toBe(false)
    expect(r.gam?.reconocio_limitacion).toBe(true)
    expect(r.limitaciones.length).toBeGreaterThan(5)
  })

  it('el nombre de archivo es el del contrato', () => {
    const pdfNom = nombreReporte(estudioCompleto(), 'pdf')
    expect(pdfNom.startsWith('DSA_Estudio_')).toBe(true)
    expect(pdfNom).toMatch(/_\d{4}-\d{2}-\d{2}\.pdf$/)
    expect(nombreReporte(estudioCompleto(), 'md')).toMatch(/\.md$/)
  })
})

describe('exportador Markdown', () => {
  const md = generarMarkdown(construirReporte(estudioCompleto(), fuentes))

  it('incluye todas las secciones obligatorias', () => {
    for (const seccion of [
      '# Priorización de municipios',
      '## 1. Resumen ejecutivo',
      '## 2. Evidencia comparada',
      'Estimación GAM',
      'Alertas y operaciones atípicas',
      'Limitaciones y checklist de campo',
      'Metodología y fuentes',
      'Descargo de responsabilidad',
    ]) {
      expect(md, seccion).toContain(seccion)
    }
    expect(md).toContain(DISCLAIMER_LARGO.slice(0, 60))
    expect(md).toContain(manifest.source.csv_sha256)
  })

  it('incluye el checklist con estado y fecha, y la advertencia de compuerta', () => {
    for (const c of CHECKLIST_CAMPO) expect(md).toContain(c.label)
    expect(md).toContain('2026-11-22')
    expect(md).toMatch(/no supera\*\* la mediana municipal/)
    expect(md).toContain('SIN MEJORA DEMOSTRADA')
  })

  it('no usa lenguaje prohibido y escapa las notas del usuario', () => {
    expect(md.toLowerCase()).not.toContain('fraude')
    expect(md.toLowerCase()).not.toContain('rentabilidad asegurada')
    const conNota = estudioCompleto()
    conNota.checklist[0].nota = 'texto | con pipe y *asterisco*'
    const md2 = generarMarkdown(construirReporte(conNota, fuentes))
    expect(md2).toContain('\\|')
    expect(md2).toContain('\\*')
  })

  it('las tablas Markdown son rectangulares', () => {
    const bloques: string[][] = []
    let bloque: string[] = []
    for (const l of [...md.split('\n'), '']) {
      if (l.startsWith('|')) bloque.push(l)
      else if (bloque.length) {
        bloques.push(bloque)
        bloque = []
      }
    }
    expect(bloques.length).toBeGreaterThan(5)
    for (const b of bloques) {
      const anchos = new Set(b.map((l) => l.split('|').length))
      expect(anchos.size, b[0]).toBe(1)
    }
  })
})

describe('exportador PDF', () => {
  it('sustituye glifos fuera de WinAnsi para que Helvetica no muestre cuadros', () => {
    expect(sanitizarPdf('−15,6 % → ~ ≥ ≤ «x» — …')).toBe('-15,6 % -> ~ >= <= "x" - ...')
    expect(sanitizarPdf('Calarcá, Manizales, año 2023 · ¿?')).toBe('Calarcá, Manizales, año 2023 · ¿?')
  })

  it('genera un PDF real y sustancial (motor de react-pdf, sin errores de layout)', async () => {
    const { pdf } = await import('@react-pdf/renderer')
    const { ReportePdf } = await import('./pdf')
    const r = construirReporte(estudioCompleto(), fuentes)
    // El build de navegador entrega un Blob; se verifica tamaño y tipo MIME.
    const blob = await pdf(<ReportePdf data={r} />).toBlob()
    expect(blob.size).toBeGreaterThan(10000)
    if (blob.type) expect(blob.type).toMatch(/pdf/)
    // Un estudio vacío también debe renderizar sin romper el layout.
    const vacio = estudioVacio(2023, manifest.data_version)
    const blobVacio = await pdf(<ReportePdf data={construirReporte(vacio, fuentes)} />).toBlob()
    expect(blobVacio.size).toBeGreaterThan(5000)
  }, 180000)
})
