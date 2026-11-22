import type { Slug } from '@/types/domain'

/** Paleta del mockup: azul = actividad, verde = valores, naranja = advertencia, morado = método. */
export const COLOR = {
  navy: '#173B61',
  slate: '#617D9C',
  lightblue: '#BFD4E7',
  blue: '#2E86D1',
  green: '#2BB07F',
  orange: '#FF8A28',
  purple: '#6F63C7',
  red: '#C8453C',
  line: '#E5EAF0',
} as const

export const COLOR_MUNICIPIO: Record<Slug, string> = {
  armenia: COLOR.blue,
  manizales: COLOR.navy,
  pereira: COLOR.green,
  dosquebradas: COLOR.orange,
  'santa-rosa-de-cabal': COLOR.purple,
  calarca: COLOR.slate,
}

export const COLOR_SERIE = [COLOR.blue, COLOR.navy, COLOR.green, COLOR.orange, COLOR.purple, COLOR.slate]

export function colorMunicipio(slug: string): string {
  return COLOR_MUNICIPIO[slug as Slug] ?? COLOR.slate
}
