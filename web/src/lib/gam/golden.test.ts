/**
 * Prueba de paridad del motor TypeScript contra el GAM de `joblib`.
 * `golden.json` lo genera `pipeline/gam_export.py` con `modelo.predict()`.
 * Tolerancia: < 1 COP por caso (en la práctica ~1e-7 COP).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { evaluar, lookupCurva, percentilDe, predecir } from '@/lib/gam/engine'
import type { GamGolden, GamModel, MunicipioNombre } from '@/types/domain'

function leerJson<T>(relativa: string): T {
  return JSON.parse(readFileSync(new URL(relativa, import.meta.url), 'utf-8')) as T
}

const golden = leerJson<GamGolden>('./golden.json')
const model = leerJson<GamModel>('../../../public/data/v1/gam_simulador.json')

const TOLERANCIA = 1.0

describe('paridad GAM: motor aditivo vs joblib', () => {
  it('el golden tiene 300 casos de 2023 y casos con faltantes', () => {
    expect(golden.casos).toHaveLength(300)
    expect(golden.casos_faltantes.length).toBeGreaterThan(0)
    expect(golden.casos.every((c) => c.anio === 2023)).toBe(true)
    expect(golden.modelo).toBe(model.modelo.version)
  })

  it('los 300 casos dorados de 2023 coinciden con diferencia < 1 COP', () => {
    let maxDiff = 0
    for (const caso of golden.casos) {
      const pred = predecir(model, {
        municipio: caso.municipio,
        mes: caso.mes,
        dia: caso.dia,
        features: caso.features,
      })
      const diff = Math.abs(pred - caso.esperado_cop)
      maxDiff = Math.max(maxDiff, diff)
      expect(diff, `caso ${caso.id} (${caso.municipio})`).toBeLessThan(TOLERANCIA)
    }
    // La deriva real es de punto flotante, no de metodología.
    expect(maxDiff).toBeLessThan(1e-4)
  })

  it('los casos con faltantes reales (2015–2016) coinciden: rama de imputación', () => {
    for (const caso of golden.casos_faltantes) {
      const pred = predecir(model, {
        municipio: caso.municipio,
        mes: caso.mes,
        dia: caso.dia,
        features: caso.features,
      })
      expect(Math.abs(pred - caso.esperado_cop), `caso ${caso.id}`).toBeLessThan(TOLERANCIA)
    }
    expect(golden.casos_faltantes.some((c) => Object.values(c.features).some((v) => v === null))).toBe(true)
  })

  it('cubre los 6 municipios', () => {
    const municipios = new Set(golden.casos.map((c) => c.municipio))
    expect(municipios.size).toBe(6)
  })

  it('la descomposición aditiva suma la predicción (antes del clip)', () => {
    for (const caso of golden.casos.slice(0, 40)) {
      const c = evaluar(model, { municipio: caso.municipio, mes: caso.mes, dia: caso.dia, features: caso.features })
      const suma =
        c.intercepto +
        c.municipio +
        Object.values(c.numericas).reduce((a, b) => a + b, 0) +
        Object.values(c.curvas).reduce((a, b) => a + b, 0)
      expect(Math.abs(suma - c.total)).toBeLessThan(1e-6)
    }
  })
})

describe('estructura del modelo exportado', () => {
  it('expone 23 numéricas, 4 indicadores, 6 municipios y 3 curvas', () => {
    expect(Object.keys(model.numericas)).toHaveLength(23)
    expect(Object.keys(model.indicadores_faltantes)).toHaveLength(4)
    expect(Object.keys(model.municipios)).toHaveLength(6)
    expect(Object.keys(model.curvas)).toHaveLength(3)
    expect(model.oficinas.usar).toBe(false)
    expect(Object.values(model.oficinas.offsets).every((v) => v === 0)).toBe(true)
  })

  it('las curvas cubren el rango observado completo', () => {
    expect(model.curvas.num_anotacion.valores).toHaveLength(329)
    expect(model.curvas.count_a.valores).toHaveLength(45)
    expect(model.curvas.count_de.valores).toHaveLength(55)
    expect(model.curvas.num_anotacion.rango).toEqual([1, 329])
  })

  it('la compuerta bloquea Manizales y Santa Rosa de Cabal', () => {
    expect(model.municipios.MANIZALES.habilitado).toBe(false)
    expect(model.municipios['SANTA ROSA DE CABAL'].habilitado).toBe(false)
    expect(model.municipios.ARMENIA.habilitado).toBe(true)
    expect(model.municipios.PEREIRA.mejora_2023_pct).toBeLessThan(1)
  })

  it('mes/día no se duplican: solo entran una vez en la suma numérica', () => {
    expect(model.numericas.mes_seno).toBeDefined()
    expect(model.numericas.mes_coseno).toBeDefined()
    expect(model.numericas.dia_mes).toBeDefined()
    expect(model.numericas.mes).toBeUndefined()
  })
})

describe('utilidades del motor', () => {
  it('lookupCurva recorta al extremo del rango', () => {
    const curva = model.curvas.num_anotacion
    expect(lookupCurva(curva, 0)).toBe(curva.valores[0])
    expect(lookupCurva(curva, -50)).toBe(curva.valores[0])
    expect(lookupCurva(curva, 9999)).toBe(curva.valores[curva.valores.length - 1])
    expect(lookupCurva(curva, 1)).toBe(curva.valores[0])
    expect(lookupCurva(curva, 329)).toBe(curva.valores[328])
  })

  it('percentilDe ubica la mediana en el percentil 50', () => {
    const mediana = model.contexto_por_municipio.ARMENIA['2023'].mediana_real as number
    const p = percentilDe(model, 'ARMENIA', mediana)
    expect(p).not.toBeNull()
    expect(Math.abs((p as number) - 50)).toBeLessThan(1.5)
    expect(percentilDe(model, 'ARMENIA', 0)).toBe(0)
    expect(percentilDe(model, 'ARMENIA', 1e15)).toBe(100)
  })

  it('el clip en cero evita valores negativos', () => {
    const caso = golden.casos[0]
    const features = { ...caso.features, poblacion_total: 1, crecimiento_poblacion: -5 }
    const pred = predecir(model, { municipio: caso.municipio, mes: caso.mes, dia: caso.dia, features })
    expect(pred).toBeGreaterThanOrEqual(0)
  })

  it('cambiar el mes cambia el resultado (mes_seno tiene coeficiente)', () => {
    const caso = golden.casos[0]
    const base = { municipio: caso.municipio as MunicipioNombre, dia: caso.dia, features: caso.features }
    // Enero: sin(0) = 0. Abril: sin(π/2) = 1. (Julio también da ~0, no sirve.)
    const enero = predecir(model, { ...base, mes: 1 })
    const abril = predecir(model, { ...base, mes: 4 })
    expect(enero).not.toBe(abril)
    const esperado = (model.numericas.mes_seno.coef / model.numericas.mes_seno.escala) * model.modelo.escala
    expect(Math.abs(abril - enero - esperado)).toBeLessThan(1e-6)
  })
})
