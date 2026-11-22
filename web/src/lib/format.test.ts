import { describe, expect, it } from 'vitest'
import {
  escapeMd,
  formatBytes,
  formatCOP,
  formatCOPCompacto,
  formatDelta,
  formatFecha,
  formatNumero,
  formatPct,
  formatRatio,
  millones,
  nombreArchivoPartes,
  tonoDelta,
} from '@/lib/format'

describe('formato es-CO', () => {
  it('moneda con punto de miles y sin decimales', () => {
    expect(formatCOP(115000000)).toMatch(/115\.000\.000/)
    expect(formatCOP(null)).toBe('n.d.')
    expect(formatCOP(undefined)).toBe('n.d.')
    expect(formatCOP(NaN)).toBe('n.d.')
  })

  it('compacto usa la escala colombiana (mil millones, no billón ambiguo)', () => {
    expect(formatCOPCompacto(108000000)).toMatch(/108,0 M/)
    expect(formatCOPCompacto(1410451583)).toMatch(/1,4 mil M/)
    expect(formatCOPCompacto(1410451583975)).toMatch(/billones/)
    expect(formatCOPCompacto(-2500000)).toMatch(/−/)
    expect(formatCOPCompacto(null)).toBe('n.d.')
  })

  it('millones y números', () => {
    expect(millones(115000000)).toBe('115,0')
    expect(formatNumero(28384)).toBe('28.384')
    expect(formatNumero(9672)).toBe('9.672')
    expect(formatNumero(null)).toBe('n.d.')
  })

  it('porcentajes y variaciones con signo explícito', () => {
    expect(formatPct(34.08, 2)).toBe('34,08 %')
    expect(formatDelta(-15.61)).toMatch(/^−15,6 %$/)
    expect(formatDelta(2.8)).toMatch(/^\+2,8 %$/)
    expect(formatDelta(0)).toMatch(/^0,0 %$/)
    expect(formatDelta(null)).toBe('n.d.')
  })

  it('ratios y fechas', () => {
    expect(formatRatio(1.048)).toBe('1,05')
    expect(formatFecha('2023-06-15')).toMatch(/2023/)
    expect(formatFecha(null)).toBe('n.d.')
  })

  it('bytes y tono', () => {
    expect(formatBytes(550856)).toMatch(/KB/)
    expect(formatBytes(3000000)).toMatch(/MB/)
    expect(tonoDelta(3)).toBe('positivo')
    expect(tonoDelta(-3)).toBe('negativo')
    expect(tonoDelta(0)).toBe('neutro')
    expect(tonoDelta(null)).toBe('neutro')
  })

  it('escapa Markdown y normaliza nombres de archivo', () => {
    expect(escapeMd('a_b*c')).toBe('a\\_b\\*c')
    expect(escapeMd('linea1\nlinea2')).toBe('linea1 linea2')
    expect(nombreArchivoPartes(['Calarcá', 'Santa Rosa de Cabal', '2026-11-22'])).toBe('Calarca_Santa-Rosa-de-Cabal_2026-11-22')
  })
})
