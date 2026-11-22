/**
 * Etiquetas y helpers de presentación de la vista de alertas (copy es-CO).
 * Las señales son para investigar; el lenguaje evita conclusiones sobre la operación.
 */
import type { Tone } from '@/components/ui'
import type { CategoriaRazon, DireccionAlerta, Tramo } from '@/types/domain'

export const TRAMOS: Tramo[] = ['1-5', '6-10', '11-20', '21-40', '41+']

export const CATEGORIA_INFO: Record<
  CategoriaRazon,
  { etiqueta: string; corta: string; tono: Tone; descripcion: string }
> = {
  valor_bajo_unidad: {
    etiqueta: 'Valor bajo: posible unidad inconsistente',
    corta: 'Unidad inconsistente',
    tono: 'method',
    descripcion:
      'Montos nominales como $5 o $35: posible registro en millones o unidad inconsistente. Es una señal de calidad de los datos.',
  },
  valor_bajo_extremo: {
    etiqueta: 'Valor bajo extremo',
    corta: 'Bajo extremo',
    tono: 'info',
    descripcion: 'Valor real muy por debajo de la mediana de su grupo comparable (municipio × año × tramo).',
  },
  valor_alto_extremo: {
    etiqueta: 'Valor alto extremo',
    corta: 'Alto extremo',
    tono: 'warning',
    descripcion: 'Valor real muy por encima de la mediana de su grupo comparable (municipio × año × tramo).',
  },
  duplicado_valor: {
    etiqueta: 'Monto repetido en el mismo año y anotación',
    corta: 'Monto repetido',
    tono: 'neutral',
    descripcion:
      'El mismo monto nominal con igual número de anotación se repite en el municipio y año; puede ser un acto repetido o una plantilla de registro.',
  },
}

export const DIRECCION_INFO: Record<DireccionAlerta, { etiqueta: string; tono: Tone }> = {
  alta: { etiqueta: 'valor alto', tono: 'warning' },
  baja: { etiqueta: 'valor bajo', tono: 'info' },
}

/** Enmascara el pk dejando visibles solo los últimos 6 caracteres. */
export function pkEnmascarado(pk: string): string {
  return pk.length > 6 ? `…${pk.slice(-6)}` : pk
}

/** z robusto con signo explícito y 2 decimales (es-CO). */
export function formatZ(v: number): string {
  const signo = v > 0 ? '+' : v < 0 ? '−' : ''
  return `${signo}${Math.abs(v).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
