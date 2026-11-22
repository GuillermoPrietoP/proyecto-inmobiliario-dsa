/**
 * Capa de datos: fetch de los JSON versionados + validación zod + TanStack Query.
 * Los datos son inmutables por versión (`staleTime: Infinity`).
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { z } from 'zod'
import type {
  Alertas,
  Calidad,
  Comparacion,
  Ficha,
  GamModel,
  Manifest,
  MunicipioNombre,
  Panorama,
  Slug,
} from '@/types/domain'

export const DATA_VERSION = 'v1'
export const DATA_BASE = `/data/${DATA_VERSION}/`

const nullableNumber = z.number().nullable()
const nullableInt = z.number().int().nullable()

export const manifestSchema = z.looseObject({
  schema_version: z.string(),
  data_version: z.string(),
  generated_at: z.string(),
  source: z.looseObject({ csv_sha256: z.string(), rows: z.number(), municipalities: z.array(z.string()) }),
  currency: z.looseObject({ canonical: z.literal('COP_dic2023'), factors: z.record(z.string(), z.number()) }),
  model: z.looseObject({
    parity: z.looseObject({ passed: z.boolean(), max_abs_diff: z.number(), n: z.number() }),
  }),
  budget: z.looseObject({ within_budget: z.boolean(), total_bytes: z.number() }),
})

const municipioResumenSchema = z.looseObject({
  slug: z.string(),
  nombre: z.string(),
  tiene_datos: z.boolean(),
  n: z.number(),
  share_6_pct: z.number(),
  share_3_pct: nullableNumber,
  mediana_real: nullableNumber,
  q1: nullableNumber,
  q3: nullableNumber,
  var_registros_pct: nullableNumber,
  serie_parcial: z.boolean(),
})

export const panoramaSchema = z.looseObject({
  schema_version: z.string(),
  anio_default: z.number(),
  anios: z.array(z.number()),
  por_anio: z.record(
    z.string(),
    z.looseObject({
      kpis: z.looseObject({ registros: z.number(), mediana_real: nullableNumber }),
      municipios: z.array(municipioResumenSchema),
    }),
  ),
  series: z.looseObject({
    anios: z.array(z.number()),
    por_municipio: z.record(
      z.string(),
      z.looseObject({
        n: z.array(nullableInt),
        mediana_real: z.array(nullableInt),
        mediana_nominal: z.array(nullableInt),
      }),
    ),
  }),
  notas: z.array(z.string()),
})

export const fichaSchema = z.looseObject({
  schema_version: z.string(),
  municipio: z.looseObject({ slug: z.string(), nombre: z.string(), serie_parcial: z.boolean() }),
  anio_default: z.number(),
  anios: z.array(z.number()),
  por_anio: z.record(
    z.string(),
    z.looseObject({
      kpis: z.looseObject({ registros: z.number(), mediana_real: z.number(), q1: z.number(), q3: z.number() }),
      distribucion: z.looseObject({ bins: z.array(z.number()), conteo: z.array(z.number()) }),
      notas: z.array(z.string()),
    }),
  ),
  historico: z.array(z.looseObject({ anio: z.number(), n: z.number() })),
  contexto: z.array(z.looseObject({ anio: z.number(), poblacion_total: z.number() })),
})

export const comparacionSchema = z.looseObject({
  schema_version: z.string(),
  anio_default: z.number(),
  anios: z.array(z.number()),
  definiciones: z.record(z.string(), z.looseObject({ label: z.string(), direccion: z.string() })),
  preguntas: z.array(z.looseObject({ id: z.string(), titulo: z.string(), metricas: z.array(z.string()) })),
  por_anio: z.record(z.string(), z.looseObject({ matriz: z.array(z.looseObject({ slug: z.string(), registros: z.number() })) })),
})

export const calidadSchema = z.looseObject({
  schema_version: z.string(),
  anios: z.array(z.number()),
  universo: z.looseObject({ filas_entregadas: z.number(), filas_analiticas: z.number() }),
  verificacion_filtros: z.array(z.looseObject({ filtro: z.string(), pct: z.number() })),
  cobertura_municipio: z.array(z.looseObject({ municipio: z.string(), n_por_anio: z.array(nullableInt) })),
  hashes: z.looseObject({ csv: z.string() }),
})

export const alertasSchema = z.looseObject({
  schema_version: z.string(),
  metodo: z.looseObject({ umbral: z.number(), min_grupo: z.number(), tramos: z.array(z.string()) }),
  resumen: z.looseObject({
    total: z.number(),
    tasa_pct: z.number(),
    por_direccion: z.looseObject({ alta: z.number(), baja: z.number() }),
    por_municipio: z.array(z.looseObject({ municipio: z.string(), alertas: z.number() })),
  }),
  items: z.array(
    z.looseObject({
      id: z.string(),
      pk: z.string(),
      municipio: z.string(),
      anio: z.number(),
      valor_real: z.number(),
      z_robusto: z.number(),
      direccion: z.enum(['alta', 'baja']),
      razon: z.string().min(1),
    }),
  ),
  mostrados: z.number(),
  csv: z.string(),
})

const numericaSchema = z.looseObject({
  coef: z.number(),
  media: z.number(),
  escala: z.number().positive(),
  mediana_imputacion: z.number(),
  transform: z.enum(['identity', 'log1p']),
})

export const gamSchema = z.looseObject({
  schema_version: z.string(),
  modelo: z.looseObject({
    id: z.string(),
    version: z.string(),
    escala: z.number(),
    clip_min: z.number(),
    anio_referencia: z.number(),
  }),
  intercepto: z.number(),
  municipios: z.record(
    z.string(),
    z.looseObject({ offset: z.number(), habilitado: z.boolean(), mejora_2023_pct: z.number(), mejora_2022_pct: z.number() }),
  ),
  numericas: z.record(z.string(), numericaSchema),
  indicadores_faltantes: z.record(z.string(), z.looseObject({ coef: z.number(), media: z.number(), escala: z.number().positive() })),
  curvas: z.record(z.string(), z.looseObject({ rango: z.array(z.number()).length(2), valores: z.array(z.number()) })),
  contexto_por_municipio: z.record(z.string(), z.record(z.string(), z.record(z.string(), nullableNumber))),
  percentiles_por_municipio: z.record(z.string(), z.array(z.number())).optional(),
  metricas: z.looseObject({}),
  rangos: z.record(z.string(), z.array(z.number()).length(2)),
  paridad: z.looseObject({ passed: z.boolean(), max_abs_diff: z.number() }),
})

export class DataError extends Error {
  constructor(
    message: string,
    readonly archivo: string,
    readonly causa?: unknown,
  ) {
    super(message)
    this.name = 'DataError'
  }
}

async function fetchJson<T>(archivo: string, schema: z.ZodType<T>): Promise<T> {
  const url = `${DATA_BASE}${archivo}`
  let res: Response
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch (e) {
    throw new DataError(`No se pudo cargar ${archivo}. Revisa tu conexión o vuelve a intentar.`, archivo, e)
  }
  if (!res.ok) {
    throw new DataError(`No se pudo cargar ${archivo} (HTTP ${res.status}). Ejecuta el pipeline de datos.`, archivo)
  }
  let raw: unknown
  try {
    raw = await res.json()
  } catch (e) {
    throw new DataError(`El archivo ${archivo} no es JSON válido.`, archivo, e)
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw new DataError(
      `El archivo ${archivo} no cumple el contrato de datos v1. Regenera los JSON con el pipeline.`,
      archivo,
      parsed.error.issues.slice(0, 5),
    )
  }
  return parsed.data
}

export const queryKeys = {
  manifest: ['data', DATA_VERSION, 'manifest'] as const,
  panorama: ['data', DATA_VERSION, 'panorama'] as const,
  ficha: (slug: Slug) => ['data', DATA_VERSION, 'ficha', slug] as const,
  comparacion: ['data', DATA_VERSION, 'comparacion'] as const,
  calidad: ['data', DATA_VERSION, 'calidad'] as const,
  alertas: ['data', DATA_VERSION, 'alertas'] as const,
  gam: ['data', DATA_VERSION, 'gam'] as const,
}

const opc = { staleTime: Infinity, gcTime: Infinity, retry: 2, refetchOnWindowFocus: false }

export function useManifest(): UseQueryResult<Manifest, DataError> {
  return useQuery({
    queryKey: queryKeys.manifest,
    queryFn: () => fetchJson('manifest.json', manifestSchema as unknown as z.ZodType<Manifest>),
    ...opc,
  })
}

export function usePanorama(): UseQueryResult<Panorama, DataError> {
  return useQuery({
    queryKey: queryKeys.panorama,
    queryFn: () => fetchJson('panorama.json', panoramaSchema as unknown as z.ZodType<Panorama>),
    ...opc,
  })
}

export function useFicha(slug: Slug | undefined): UseQueryResult<Ficha, DataError> {
  return useQuery({
    queryKey: queryKeys.ficha(slug ?? 'armenia'),
    queryFn: () => fetchJson(`fichas/${slug}.json`, fichaSchema as unknown as z.ZodType<Ficha>),
    enabled: Boolean(slug),
    ...opc,
  })
}

export function useComparacion(): UseQueryResult<Comparacion, DataError> {
  return useQuery({
    queryKey: queryKeys.comparacion,
    queryFn: () => fetchJson('comparacion.json', comparacionSchema as unknown as z.ZodType<Comparacion>),
    ...opc,
  })
}

export function useCalidad(): UseQueryResult<Calidad, DataError> {
  return useQuery({
    queryKey: queryKeys.calidad,
    queryFn: () => fetchJson('calidad.json', calidadSchema as unknown as z.ZodType<Calidad>),
    ...opc,
  })
}

export function useAlertas(): UseQueryResult<Alertas, DataError> {
  return useQuery({
    queryKey: queryKeys.alertas,
    queryFn: () => fetchJson('alertas.json', alertasSchema as unknown as z.ZodType<Alertas>),
    ...opc,
  })
}

export function useGam(): UseQueryResult<GamModel, DataError> {
  return useQuery({
    queryKey: queryKeys.gam,
    queryFn: () => fetchJson('gam_simulador.json', gamSchema as unknown as z.ZodType<GamModel>),
    ...opc,
  })
}

export const SLUGS: Slug[] = [
  'armenia',
  'manizales',
  'pereira',
  'dosquebradas',
  'santa-rosa-de-cabal',
  'calarca',
]

export const NOMBRE_POR_SLUG: Record<Slug, MunicipioNombre> = {
  armenia: 'ARMENIA',
  manizales: 'MANIZALES',
  pereira: 'PEREIRA',
  dosquebradas: 'DOSQUEBRADAS',
  'santa-rosa-de-cabal': 'SANTA ROSA DE CABAL',
  calarca: 'CALARCÁ',
}

export const SLUG_POR_NOMBRE: Record<string, Slug> = Object.fromEntries(
  Object.entries(NOMBRE_POR_SLUG).map(([s, n]) => [n, s as Slug]),
)

export function urlAlertasCsv(): string {
  return `${DATA_BASE}alertas.csv`
}

export function urlManifest(): string {
  return `${DATA_BASE}manifest.json`
}
