/**
 * Matriz de evidencia de la comparación: filas = indicadores, columnas = municipios.
 * Sin score compuesto (BR-06): el mejor valor por fila se marca con TEXTO además de
 * color, y solo para métricas con dirección `mayor` o `menor`; las de `contexto` no.
 */
import { AYUDAS, COPY } from '@/content/es'
import { formatCOP, formatDelta, formatNumero, formatPct, formatRatio, ND } from '@/lib/format'
import type { ComparacionFila, DefinicionMetrica, DireccionMetrica, Moneda, Slug } from '@/types/domain'

export interface CeldaMatriz {
  slug: Slug
  tieneDatos: boolean
  valor: number | null
  esMejor: boolean
  /** Solo para la fila GAM: compuerta de confiabilidad (BR-07). */
  gamHabilitado?: boolean
}

export interface FilaMatriz {
  clave: string
  label: string
  unidad: string
  direccion: DireccionMetrica | 'gam'
  ayuda: string
  badgeMejor: string | null
  formato: (v: number) => string
  celdas: CeldaMatriz[]
}

interface ConfigMetrica {
  clave: string
  get: (f: ComparacionFila) => number | null
  formato: (v: number) => string
  badgeMejor?: string
  local: { label: string; unidad: string; direccion: DireccionMetrica; ayuda: string }
}

export const TEXTO_DIRECCION: Record<DireccionMetrica | 'gam', string> = {
  mayor: 'A mayor valor, mayor actividad o expansión relativa. Es una ayuda de lectura, no una recomendación.',
  menor: 'A menor valor, menor dispersión relativa de los valores registrados. Es una ayuda de lectura, no una recomendación.',
  contexto: 'Variable de contexto: describe el entorno urbano y económico; no es «mejor» ni «peor».',
  gam: 'Desempeño del modelo en la evaluación retrospectiva 2023. No es un score de inversión.',
}

/** Construye las filas de la matriz para los municipios seleccionados. */
export function construirMatriz(
  filas: ComparacionFila[],
  moneda: Moneda,
  definiciones: Record<string, DefinicionMetrica>,
): FilaMatriz[] {
  // Participación calculada en cliente sobre el total de la selección con datos.
  const totalSeleccion = filas.reduce((s, f) => s + (f.tiene_datos ? f.registros : 0), 0)
  const claveMediana = moneda === 'real' ? 'mediana_real' : 'mediana_nominal'

  const config: ConfigMetrica[] = [
    {
      clave: 'registros',
      get: (f) => f.registros,
      formato: (v) => formatNumero(v),
      badgeMejor: 'mayor actividad',
      local: {
        label: 'Registros',
        unidad: 'conteo',
        direccion: 'mayor',
        ayuda: 'Actos de compraventa urbana registrados en el año. No son inmuebles únicos.',
      },
    },
    {
      clave: 'share_seleccion_pct',
      get: (f) => (totalSeleccion > 0 ? (f.registros / totalSeleccion) * 100 : null),
      formato: (v) => formatPct(v, 1),
      badgeMejor: 'mayor participación',
      local: {
        label: 'Participación en la selección',
        unidad: '%',
        direccion: 'mayor',
        ayuda: 'Registros del municipio divididos por el total de registros de los municipios seleccionados con datos (calculado en el navegador).',
      },
    },
    {
      clave: 'var_registros_pct',
      get: (f) => f.var_registros_pct,
      formato: (v) => formatDelta(v, 1),
      badgeMejor: 'mayor variación',
      local: {
        label: 'Variación anual de registros',
        unidad: '%',
        direccion: 'mayor',
        ayuda: 'Cambio porcentual del número de registros frente al año anterior. En 2015 no hay año anterior comparable.',
      },
    },
    {
      clave: claveMediana,
      get: (f) => (moneda === 'real' ? f.mediana_real : f.mediana_nominal),
      formato: (v) => formatCOP(v),
      local:
        moneda === 'real'
          ? {
              label: 'Mediana real',
              unidad: 'COP dic-2023',
              direccion: 'contexto',
              ayuda: `Valor típico registrado en pesos constantes. ${COPY.mediana}`,
            }
          : {
              label: 'Mediana nominal',
              unidad: 'COP nominales',
              direccion: 'contexto',
              ayuda: 'Mediana en pesos corrientes del año de radicación. La inflación explica gran parte de su aumento; prefiere COP dic-2023 para comparar.',
            },
    },
    {
      clave: 'q1',
      get: (f) => f.q1,
      formato: (v) => formatCOP(v),
      local: {
        label: 'Cuartil 1 (Q1)',
        unidad: 'COP dic-2023',
        direccion: 'contexto',
        ayuda: 'El 25 % de los registros queda por debajo de este valor. Disponible solo en pesos constantes.',
      },
    },
    {
      clave: 'q3',
      get: (f) => f.q3,
      formato: (v) => formatCOP(v),
      local: {
        label: 'Cuartil 3 (Q3)',
        unidad: 'COP dic-2023',
        direccion: 'contexto',
        ayuda: 'El 75 % de los registros queda por debajo de este valor. Disponible solo en pesos constantes.',
      },
    },
    {
      clave: 'iqr_ratio',
      get: (f) => f.iqr_ratio,
      formato: (v) => formatRatio(v, 2),
      badgeMejor: 'menor dispersión',
      local: {
        label: 'Dispersión IQR/mediana',
        unidad: 'ratio',
        direccion: 'menor',
        ayuda: 'Rango intercuartílico (Q3−Q1) dividido por la mediana: a menor valor, menor dispersión relativa.',
      },
    },
    {
      clave: 'p90_p10',
      get: (f) => f.p90_p10,
      formato: (v) => formatRatio(v, 2),
      badgeMejor: 'menor dispersión',
      local: {
        label: 'P90/P10',
        unidad: 'ratio',
        direccion: 'menor',
        ayuda: 'Razón entre el percentil 90 y el percentil 10: a menor valor, colas menos extendidas.',
      },
    },
    {
      clave: 'poblacion_total',
      get: (f) => f.poblacion_total,
      formato: (v) => formatNumero(v),
      local: {
        label: 'Población',
        unidad: 'personas',
        direccion: 'contexto',
        ayuda: 'Población total del municipio (proyecciones DANE).',
      },
    },
    {
      clave: 'crecimiento_poblacion',
      get: (f) => (f.crecimiento_poblacion == null ? null : f.crecimiento_poblacion * 100),
      formato: (v) => formatDelta(v, 2),
      local: {
        label: 'Crecimiento poblacional',
        unidad: '%',
        direccion: 'contexto',
        ayuda: AYUDAS.crecimiento,
      },
    },
    {
      clave: 'va_real_pc',
      get: (f) => f.va_real_pc,
      formato: (v) => formatCOP(v),
      local: {
        label: 'Valor agregado real per cápita',
        unidad: 'COP dic-2023',
        direccion: 'contexto',
        ayuda: AYUDAS.vaRealPc,
      },
    },
    {
      clave: 'viviendas_por_1000',
      get: (f) => f.viviendas_por_1000,
      formato: (v) => formatNumero(v, 1),
      local: {
        label: 'Vivienda nueva por 1.000 hab. (lag1)',
        unidad: 'unidades/1.000 hab.',
        direccion: 'contexto',
        ayuda: AYUDAS.viviendasPor1000,
      },
    },
    {
      clave: 'elic_unidades_vivienda_nueva_lag1',
      get: (f) => f.elic_unidades_vivienda_nueva_lag1,
      formato: (v) => formatNumero(v),
      local: {
        label: 'Unidades de vivienda nueva (licencias, lag1)',
        unidad: 'unidades',
        direccion: 'contexto',
        ayuda: 'Unidades de vivienda nueva licenciadas el año anterior (ELIC).',
      },
    },
    {
      clave: 'elic_area_vivienda_nueva_m2_lag1',
      get: (f) => f.elic_area_vivienda_nueva_m2_lag1,
      formato: (v) => formatNumero(v),
      local: {
        label: 'Área de vivienda nueva (licencias, lag1)',
        unidad: 'm²',
        direccion: 'contexto',
        ayuda: 'Área en m² de vivienda nueva licenciada el año anterior (ELIC).',
      },
    },
    {
      clave: 'predios_nuevos_pct',
      get: (f) => f.predios_nuevos_pct,
      formato: (v) => formatPct(v, 2),
      local: {
        label: 'Registros con predio nuevo',
        unidad: '%',
        direccion: 'contexto',
        ayuda: 'Porcentaje de registros del año asociados a predios nuevos.',
      },
    },
    {
      clave: 'alertas',
      get: (f) => f.alertas,
      formato: (v) => formatNumero(v),
      local: {
        label: 'Señales de investigación',
        unidad: 'conteo',
        direccion: 'contexto',
        ayuda: COPY.alertas,
      },
    },
  ]

  const matriz: FilaMatriz[] = config.map((cfg) => {
    const def = definiciones[cfg.clave]
    const label = def?.label ?? cfg.local.label
    const unidad = def?.unidad ?? cfg.local.unidad
    const direccion = def?.direccion ?? cfg.local.direccion
    const celdas: CeldaMatriz[] = filas.map((f) => ({
      slug: f.slug,
      tieneDatos: f.tiene_datos,
      valor: f.tiene_datos ? cfg.get(f) : null,
      esMejor: false,
    }))
    // Mejor valor por fila: solo direcciones mayor/menor y con ≥2 municipios con dato.
    const validas = celdas.filter((c) => c.tieneDatos && c.valor != null)
    if (cfg.badgeMejor && (direccion === 'mayor' || direccion === 'menor') && validas.length >= 2) {
      const valores = validas.map((c) => c.valor as number)
      const mejor = direccion === 'mayor' ? Math.max(...valores) : Math.min(...valores)
      for (const c of validas) c.esMejor = c.valor === mejor
    }
    return {
      clave: cfg.clave,
      label,
      unidad,
      direccion,
      ayuda: `${cfg.local.ayuda} Unidad: ${unidad}. ${TEXTO_DIRECCION[direccion]}`,
      badgeMejor: cfg.badgeMejor ?? null,
      formato: cfg.formato,
      celdas,
    }
  })

  // Fila final: desempeño del GAM (no es un score de inversión ni se marca «mejor»).
  matriz.push({
    clave: 'gam_mejora_2023_pct',
    label: 'GAM: mejora MAE 2023',
    unidad: '%',
    direccion: 'gam',
    ayuda:
      'Reducción del error (MAE) del GAM frente a la mediana municipal en la evaluación retrospectiva de 2023. Es independiente del año de corte y NO es un score de inversión ni una recomendación de compra.',
    badgeMejor: null,
    formato: (v) => formatDelta(v, 2),
    celdas: filas.map((f) => ({
      slug: f.slug,
      tieneDatos: true,
      valor: f.gam_mejora_2023_pct,
      esMejor: false,
      gamHabilitado: f.gam_habilitado,
    })),
  })

  return matriz
}

function numeroCsv(v: number): string {
  return String(v).replace('.', ',')
}

function campoCsv(s: string): string {
  return `"${s.replace(/"/g, '""')}"`
}

/** CSV de la matriz (métricas × municipios seleccionados), separado por «;» para Excel es-CO. */
export function matrizACsv(matriz: FilaMatriz[], slugs: Slug[], nombreDe: (s: Slug) => string): string {
  const encabezado = ['Indicador', 'Unidad', 'Lectura', ...slugs.map(nombreDe)]
  const lineas = [encabezado.map(campoCsv).join(';')]
  for (const fila of matriz) {
    const valores = slugs.map((slug) => {
      const c = fila.celdas.find((x) => x.slug === slug)
      if (!c) return ND
      if (fila.direccion === 'gam') {
        const estado = c.gamHabilitado ? 'habilitado' : 'sin mejora demostrada'
        return `${c.valor == null ? ND : numeroCsv(c.valor)} (${estado})`
      }
      if (!c.tieneDatos) return 'Sin datos para este año'
      if (c.valor == null) return ND
      const base = numeroCsv(c.valor)
      return c.esMejor && fila.badgeMejor ? `${base} (${fila.badgeMejor})` : base
    })
    lineas.push([fila.label, fila.unidad, fila.direccion, ...valores].map(campoCsv).join(';'))
  }
  return lineas.join('\r\n')
}
