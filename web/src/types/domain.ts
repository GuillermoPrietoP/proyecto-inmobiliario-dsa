/**
 * Tipos del contrato de datos v1 (ver `_bmad-output/planning-artifacts/data-contracts.md`).
 * Los JSON son generados por `pipeline/preprocess.py`; el frontend no recalcula agregados.
 */

export type Slug =
  | 'armenia'
  | 'manizales'
  | 'pereira'
  | 'dosquebradas'
  | 'santa-rosa-de-cabal'
  | 'calarca'

export type MunicipioNombre =
  | 'ARMENIA'
  | 'MANIZALES'
  | 'PEREIRA'
  | 'DOSQUEBRADAS'
  | 'SANTA ROSA DE CABAL'
  | 'CALARCÁ'

export type Moneda = 'real' | 'nominal'
export type Alcance = '6' | '3'

export const MUNICIPIOS_3: MunicipioNombre[] = ['ARMENIA', 'MANIZALES', 'PEREIRA']

export interface ArchivoManifest {
  bytes: number
  sha256: string
  gzip_bytes?: number
  cuenta_presupuesto?: boolean
  ruta?: string
}

export interface Manifest {
  schema_version: string
  data_version: string
  generated_at: string
  source: {
    csv: string
    csv_sha256: string
    rows: number
    columns: number
    years: number[]
    municipalities: MunicipioNombre[]
  }
  filters: {
    tipo_predio_zona: string
    nombre_natujur: string
    valor: string
    tiene_mas_de_un_valor: number
    all_rows_pass: boolean
    verificacion: Array<{ filtro: string; filas: number; pct: number }>
  }
  currency: {
    canonical: 'COP_dic2023'
    ipc_source: string
    ipc_pct_anual: Record<string, number>
    factors: Record<string, number>
  }
  model: {
    id: string
    quantile: number
    alpha: number
    n_knots: number
    spline_degree: number
    train: string
    evaluation_year: number
    joblib_sha256: string
    parity: Paridad
  }
  files: Record<string, ArchivoManifest>
  budget: {
    total_bytes: number
    total_gzip_bytes: number
    limit_bytes: number
    limit_gzip_bytes: number
    within_budget: boolean
    excesos_por_archivo: Array<{ archivo: string; bytes: number; limite: number }>
  }
  versions: Record<string, string>
  git_commit: string | null
}

export interface Paridad {
  n: number
  max_abs_diff: number
  tolerancia_cop: number
  passed: boolean
  checked_at?: string
}

export interface PanoramaKpis {
  registros: number
  municipios_con_datos: number
  mediana_real: number | null
  mediana_nominal: number | null
  q1: number | null
  q3: number | null
  suma_real: number | null
  suma_nominal: number | null
  var_registros_pct: number | null
  var_mediana_real_pct: number | null
  cobertura_pct: number
}

export interface MunicipioResumen {
  slug: Slug
  nombre: MunicipioNombre
  nombre_ui: string
  divipola: number
  departamento: string
  tiene_datos: boolean
  n: number
  share_6_pct: number
  share_3_pct: number | null
  mediana_real: number | null
  mediana_nominal: number | null
  q1: number | null
  q3: number | null
  p10: number | null
  p90: number | null
  suma_real: number | null
  suma_nominal: number | null
  var_registros_pct: number | null
  primer_anio: number
  ultimo_anio: number
  serie_parcial: boolean
}

export interface SerieMunicipio {
  n: Array<number | null>
  mediana_real: Array<number | null>
  mediana_nominal: Array<number | null>
  suma_real: Array<number | null>
  suma_nominal: Array<number | null>
}

export interface Panorama {
  schema_version: string
  anio_default: number
  anios: number[]
  por_anio: Record<string, { kpis: PanoramaKpis; municipios: MunicipioResumen[] }>
  series: { anios: number[]; por_municipio: Record<Slug, SerieMunicipio> }
  notas: string[]
}

export interface Distribucion {
  tipo: 'log'
  primer_bin_lineal: boolean
  bins: number[]
  conteo: number[]
  marcadores: { q1: number; mediana: number; q3: number }
}

export interface FichaKpis {
  registros: number
  share_6_pct: number
  share_3_pct: number | null
  mediana_real: number
  mediana_nominal: number | null
  q1: number
  q3: number
  p10: number
  p90: number
  iqr_ratio: number
  p90_p10: number
  var_registros_pct: number | null
  var_mediana_real_pct: number | null
  cobertura_pct: number
}

export interface ContextoAnio {
  anio: number
  poblacion_total: number
  poblacion_lag1: number | null
  poblacion_lag2: number | null
  proporcion_cabecera: number
  proporcion_25_44: number
  proporcion_0_17: number | null
  proporcion_18_24: number | null
  proporcion_65_mas: number | null
  crecimiento_poblacion: number
  va_total: number | null
  va_total_lag2: number | null
  va_real_pc: number | null
  viviendas_por_1000: number | null
  elic_unidades_vivienda_nueva_lag1: number
  elic_area_vivienda_nueva_m2_lag1: number
  elic_licencias_nuevas_lag1: number | null
  elic_area_nueva_m2_lag1: number | null
  predios_nuevos_pct: number
}

export interface Ficha {
  schema_version: string
  municipio: {
    slug: Slug
    nombre: MunicipioNombre
    nombre_ui: string
    divipola: number
    departamento: string
    primer_anio: number
    ultimo_anio: number
    serie_parcial: boolean
  }
  anio_default: number
  anios: number[]
  por_anio: Record<string, { kpis: FichaKpis; distribucion: Distribucion; notas: string[] }>
  historico: Array<{
    anio: number
    n: number
    mediana_real: number
    mediana_nominal: number
    q1: number
    q3: number
    p10: number
    p90: number
    suma_real: number
    suma_nominal: number
    var_registros_pct: number | null
  }>
  contexto: ContextoAnio[]
}

export type DireccionMetrica = 'mayor' | 'menor' | 'contexto'

export interface DefinicionMetrica {
  label: string
  unidad: string
  direccion: DireccionMetrica
  pregunta: string
}

export interface ComparacionFila {
  municipio: MunicipioNombre
  slug: Slug
  nombre_ui: string
  tiene_datos: boolean
  registros: number
  share_6_pct: number
  share_3_pct: number | null
  var_registros_pct: number | null
  mediana_real: number | null
  mediana_nominal: number | null
  q1: number | null
  q3: number | null
  p10: number | null
  p90: number | null
  iqr_ratio: number | null
  p90_p10: number | null
  suma_real: number | null
  poblacion_total: number | null
  crecimiento_poblacion: number | null
  va_real_pc: number | null
  viviendas_por_1000: number | null
  elic_unidades_vivienda_nueva_lag1: number | null
  elic_area_vivienda_nueva_m2_lag1: number | null
  predios_nuevos_pct: number | null
  alertas: number
  gam_habilitado: boolean
  gam_mejora_2023_pct: number
  gam_mejora_2022_pct: number | null
  serie_parcial: boolean
}

export interface Comparacion {
  schema_version: string
  anio_default: number
  anios: number[]
  definiciones: Record<string, DefinicionMetrica>
  preguntas: Array<{ id: string; titulo: string; metricas: string[] }>
  por_anio: Record<string, { matriz: ComparacionFila[] }>
  nota: string
}

export interface CoberturaMunicipio {
  municipio: MunicipioNombre
  nombre_ui: string
  slug: Slug
  primer_anio: number
  anios_con_datos: number
  n: number
  n_por_anio: Array<number | null>
  serie_parcial: boolean
}

export interface Calidad {
  schema_version: string
  anios: number[]
  universo: { filas_entregadas: number; filas_analiticas: number; retencion_pct: number; nota: string }
  embudo: Array<{
    paso: string
    filas: number
    retencion_pct?: number
    excluidos?: number
    alcance: string
    fuente?: string
    nota?: string
  }>
  verificacion_filtros: Array<{ filtro: string; filas: number; pct: number }>
  faltantes: Array<{ variable: string; nulos: number; pct: number; impacto: string }>
  duplicados: {
    pk_duplicados: number
    matriculas_repetidas_filas: number
    matriculas_distintas: number
    nota: string
  }
  extremos: { es_extremo_iqr: number; pct: number; nota: string }
  valores_bajos: { valor_lt_1000: number; valor_lt_1m: number; nota: string }
  cobertura_municipio: CoberturaMunicipio[]
  metodologia: {
    ipc: Record<string, number>
    ipc_pct_anual: Record<string, number | null>
    formula: string
    fuente_ipc: string
    modelo: {
      id: string
      cuantil: number
      alpha: number
      n_knots: number
      grado_spline: number
      entrenamiento: string
      evaluacion: string
      mae_2023: number
      mae_mediana_2023: number
      reduccion_2023_pct: number
      mae_2022: number
      mae_mediana_2022: number
      reduccion_2022_pct: number
      r2_2023: number
      evaluacion_retrospectiva: boolean
      nota_r2: string
      sin_recortar_extremos: boolean
    }
    alertas: { grupo: string; estadistico: string; umbral: number; min_grupo: number; mad_factor: number }
  }
  hashes: { csv: string; modelo: string }
  versiones: Record<string, string>
}

export type Tramo = '1-5' | '6-10' | '11-20' | '21-40' | '41+'
export type DireccionAlerta = 'alta' | 'baja'
export type CategoriaRazon =
  | 'valor_bajo_unidad'
  | 'valor_bajo_extremo'
  | 'valor_alto_extremo'
  | 'duplicado_valor'

export interface Alerta {
  id: string
  pk: string
  matricula: string
  municipio: MunicipioNombre
  anio: number
  fecha: string
  valor_nominal: number
  valor_real: number
  num_anotacion: number
  tramo: Tramo
  grupo_n: number
  grupo_mediana_real: number
  grupo_q1: number
  grupo_q3: number
  z_robusto: number
  direccion: DireccionAlerta
  categoria_razon: CategoriaRazon
  razon: string
  duplicado_valor: boolean
}

export interface Alertas {
  schema_version: string
  metodo: {
    grupo: string
    tramos: Tramo[]
    estadistico: string
    umbral: number
    min_grupo: number
    mad_factor: number
    descripcion: string
  }
  resumen: {
    total: number
    tasa_pct: number
    n_elegible: number
    por_direccion: { alta: number; baja: number }
    por_categoria: Record<CategoriaRazon, number>
    por_municipio: Array<{ municipio: MunicipioNombre; alertas: number; n: number; tasa_pct: number }>
  }
  items: Alerta[]
  mostrados: number
  csv: string
  nota: string
}

export interface NumericaGAM {
  coef: number
  media: number
  escala: number
  mediana_imputacion: number
  transform: 'identity' | 'log1p'
  curva?: string
}

export interface CurvaGAM {
  rango: [number, number]
  valores: number[]
}

export interface MunicipioGAM {
  offset: number
  habilitado: boolean
  mejora_2022_pct: number
  mejora_2023_pct: number
  serie_parcial: boolean
  slug: Slug
}

export interface MetricasCorte {
  mae_modelo: number
  mae_mediana: number
  reduccion_pct: number
  error_mediano: number
  p90_error: number
  rmse: number
  r2: number
}

export interface MetricasMunicipio {
  n: number
  mae_modelo: number
  mae_mediana: number
  reduccion_pct: number
  error_mediano: number
  p90_error: number
}

export type ContextoSimulador = Record<string, number | null>

export interface GamModel {
  schema_version: string
  modelo: {
    id: string
    version: string
    cuantil: number
    alpha: number
    entrenamiento: string
    anio_referencia: number
    escala: number
    clip_min: number
    evaluacion_retrospectiva: boolean
    no_usa: string[]
    nota: string
  }
  intercepto: number
  municipios: Record<MunicipioNombre, MunicipioGAM>
  oficinas: { usar: boolean; offsets: Record<string, number>; nota: string }
  numericas: Record<string, NumericaGAM>
  indicadores_faltantes: Record<string, { coef: number; media: number; escala: number }>
  curvas: Record<string, CurvaGAM>
  contexto_por_municipio: Record<MunicipioNombre, Record<string, ContextoSimulador>>
  percentiles_por_municipio: Record<MunicipioNombre, number[]>
  metricas: {
    '2022': MetricasCorte
    '2023': MetricasCorte
    por_municipio_2022: Record<MunicipioNombre, MetricasMunicipio>
    por_municipio_2023: Record<MunicipioNombre, MetricasMunicipio>
  }
  rangos: Record<string, [number, number]>
  efectos_materiales: string[]
  paridad: Paridad
}

export interface SimInput {
  municipio: MunicipioNombre
  mes: number
  dia: number
  features: Record<string, number | null>
}

export interface CasoGolden {
  id: string
  municipio: MunicipioNombre
  anio: number
  fecha: string
  mes: number
  dia: number
  features: Record<string, number | null>
  esperado_cop: number
}

export interface GamGolden {
  schema_version: string
  modelo: string
  casos: CasoGolden[]
  casos_faltantes: CasoGolden[]
}

/** Estudio persistido en localStorage (esquema versionado). */
export type ChecklistId =
  | 'area'
  | 'estado'
  | 'oferta'
  | 'arriendos'
  | 'costos'
  | 'ubicacion'
  | 'legal'
  | 'visita'

export interface ChecklistItem {
  id: ChecklistId
  completado: boolean
  nota: string
  fecha_verificacion: string | null
}

export interface EstudioGam {
  municipio: MunicipioNombre
  estimado_cop: number
  mediana_real: number
  mae_cop: number
  mejora_pct: number
  reconocio_limitacion: boolean
  inputs?: Record<string, number | null>
  mes?: number
  dia?: number
}

export interface Estudio {
  schema_version: '1.0.0'
  id: string
  creado_en: string
  actualizado_en: string
  titulo: string
  anio: number
  alcance: '6_municipios' | '3_municipios'
  municipios: MunicipioNombre[]
  horizonte: string
  objetivo: string
  perfil: string
  evidencia: {
    incluir_actividad: boolean
    incluir_valores: boolean
    incluir_contexto: boolean
    incluir_alertas: boolean
    incluir_gam: boolean
  }
  gam: EstudioGam | null
  checklist: ChecklistItem[]
  limitaciones_reconocidas: boolean
  hash_datos: string
}
