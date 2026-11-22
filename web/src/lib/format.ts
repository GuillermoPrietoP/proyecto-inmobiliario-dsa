/** Formato es-CO: moneda, porcentajes, fechas y números (architecture.md §11.7). */

const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})
const num = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
const num1 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })
const num2 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })
const num3 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 })

export const ND = 'n.d.'

/** $115.000.000 */
export function formatCOP(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return ND
  return cop.format(Math.round(v))
}

/** $115,0 M · $1,2 mil M (escala colombiana, sin "billón" ambiguo). */
export function formatCOPCompacto(v: number | null | undefined, dec = 1): string {
  if (v == null || !Number.isFinite(v)) return ND
  const abs = Math.abs(v)
  const signo = v < 0 ? '−' : ''
  const fmt = (x: number) => x.toLocaleString('es-CO', { maximumFractionDigits: dec, minimumFractionDigits: dec })
  if (abs >= 1e12) return `${signo}$${fmt(abs / 1e12)} billones`
  if (abs >= 1e9) return `${signo}$${fmt(abs / 1e9)} mil M`
  if (abs >= 1e6) return `${signo}$${fmt(abs / 1e6)} M`
  if (abs >= 1e3) return `${signo}$${fmt(abs / 1e3)} mil`
  return `${signo}$${fmt(abs)}`
}

/** Millones de pesos, sin símbolo: 115,0 */
export function millones(v: number | null | undefined, dec = 1): string {
  if (v == null || !Number.isFinite(v)) return ND
  return (v / 1e6).toLocaleString('es-CO', { maximumFractionDigits: dec, minimumFractionDigits: dec })
}

export function formatNumero(v: number | null | undefined, dec = 0): string {
  if (v == null || !Number.isFinite(v)) return ND
  return dec === 0 ? num.format(v) : dec === 1 ? num1.format(v) : dec === 2 ? num2.format(v) : num3.format(v)
}

/** 34,1 % (sin signo). */
export function formatPct(v: number | null | undefined, dec = 1): string {
  if (v == null || !Number.isFinite(v)) return ND
  return `${v.toLocaleString('es-CO', { maximumFractionDigits: dec, minimumFractionDigits: dec })} %`
}

/** +2,8 % / −15,6 % con signo explícito. */
export function formatDelta(v: number | null | undefined, dec = 1): string {
  if (v == null || !Number.isFinite(v)) return ND
  const signo = v > 0 ? '+' : v < 0 ? '−' : ''
  return `${signo}${Math.abs(v).toLocaleString('es-CO', { maximumFractionDigits: dec, minimumFractionDigits: dec })} %`
}

export function formatRatio(v: number | null | undefined, dec = 2): string {
  if (v == null || !Number.isFinite(v)) return ND
  return v.toLocaleString('es-CO', { maximumFractionDigits: dec, minimumFractionDigits: dec })
}

/** dd MMM yyyy en es-CO a partir de ISO. */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return ND
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatFechaLarga(iso: string | null | undefined): string {
  if (!iso) return ND
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function formatBytes(b: number): string {
  if (b >= 1e6) return `${(b / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 2 })} MB`
  return `${(b / 1e3).toLocaleString('es-CO', { maximumFractionDigits: 0 })} KB`
}

/** Semántica de color: verde = positivo/valores, naranja = advertencia, rojo = sin mejora. */
export function tonoDelta(v: number | null | undefined): 'positivo' | 'negativo' | 'neutro' {
  if (v == null || !Number.isFinite(v) || v === 0) return 'neutro'
  return v > 0 ? 'positivo' : 'negativo'
}

export function signoTexto(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return ND
  return v > 0 ? 'sube' : v < 0 ? 'baja' : 'se mantiene'
}

/** Escapa texto para Markdown (títulos y notas del usuario). */
export function escapeMd(s: string): string {
  return s.replace(/([\\`*_{}[\]()#+\-.!|>])/g, '\\$1').replace(/\r?\n/g, ' ')
}

export function nombreArchivoPartes(partes: string[]): string {
  return partes
    .map((p) =>
      p
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .filter(Boolean)
    .join('_')
}
