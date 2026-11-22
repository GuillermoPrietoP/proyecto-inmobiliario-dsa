/**
 * Copy canónico del Observatorio DSA (fuente única).
 * Reglas de negocio BR-01…BR-12 de `architecture.md` §4.1.
 * No usar "avalúo", "garantiza", "rentabilidad asegurada" ni "fraude" como afirmaciones.
 */

export const MARCA = {
  nombre: 'DSA',
  producto: 'Observatorio de Inversión Inmobiliaria Urbana',
  claim: 'Prioriza dónde profundizar tu estudio',
} as const

export const PREGUNTA_RECTORA =
  '¿En qué municipio conviene profundizar un estudio de inversión inmobiliaria urbana?'

export const COPY = {
  moneda: 'Montos en pesos constantes de diciembre de 2023 (factores IPC DANE 2015–2023).',
  registros: 'Registros de compraventa urbana; no son inmuebles únicos.',
  gam:
    'El GAM cuantílico (q=0,5) estima valores típicos registrados según variables territoriales, demográficas y registrales. No usa área física, estado ni fecha de apertura.',
  experimental: 'Esta estimación es experimental, no es un avalúo y no garantiza rentabilidad.',
  alertas: 'Las alertas son señales para investigar; no implican irregularidad.',
  mediana: 'La mediana municipal es una referencia descriptiva, no un precio de negociación.',
  retrospectiva: '2022 y 2023 son evaluaciones retrospectivas; no son reservas vírgenes.',
  sinScore:
    'No hay un índice compuesto de inversión: la matriz es evidencia para decidir dónde investigar, no un ranking.',
  serieParcial: 'Serie parcial: este municipio solo tiene datos desde 2021.',
  nominal:
    'Estás viendo valores nominales. La inflación explica gran parte del aumento: entre 2015 y 2023 la mediana nominal sube 75,9 % y la real 12,5 %. Usa COP dic-2023 para comparar.',
  sumas: 'Las sumas son sensibles a valores extremos y a matrículas repetidas; prefiere mediana e IQR.',
  campo:
    'La fuente no tiene área, estado físico, antigüedad, ubicación, oferta, arriendos ni costos. Verifícalos en campo antes de decidir.',
  profundizar:
    'Este sitio ayuda a priorizar dónde profundizar un estudio; no recomienda comprar ni garantiza rentabilidad.',
} as const

export const DISCLAIMER_LARGO =
  'Este observatorio es un instrumento de priorización territorial construido sobre registros públicos de ' +
  'compraventa urbana. No constituye un avalúo, una recomendación de compra ni una proyección de rentabilidad. ' +
  'Los valores están expresados en pesos constantes de diciembre de 2023. Los registros no equivalen a inmuebles ' +
  'únicos: una matrícula puede tener varios actos. El modelo GAM es experimental y su mejora frente a la mediana ' +
  'municipal es marginal; en algunos municipios no la supera. Toda decisión requiere verificación en campo de ' +
  'área, estado, ubicación, oferta, arriendos, costos y situación legal.'

export const GATE = {
  titulo: 'El GAM no supera la mediana municipal en este municipio',
  detalle:
    'En {municipio} el error del modelo (MAE) es mayor que el de la mediana municipal en 2023 ' +
    '({mejora} %). Mostrarlo como mejora sería engañoso. Puedes verlo de todos modos con fines exploratorios.',
  toggle: 'Ver de todos modos (experimental)',
  reconocer: 'Entiendo que en este municipio el GAM no supera la mediana municipal',
  bloqueado: 'Estimación bloqueada por la compuerta de confiabilidad (BR-07).',
  marginal: 'Mejora marginal (< 1 %): trátala como exploratoria.',
  habilitado: 'El GAM reduce el MAE frente a la mediana municipal en este municipio.',
} as const

export const CHECKLIST_CAMPO: Array<{ id: string; label: string; ayuda: string }> = [
  { id: 'area', label: 'Área física y distribución', ayuda: 'm² construidos y privados, linderos, distribución interna.' },
  { id: 'estado', label: 'Estado físico y antigüedad', ayuda: 'Acabados, estructura, instalaciones, año de construcción y remodelaciones.' },
  { id: 'oferta', label: 'Oferta actual comparable', ayuda: 'Inmuebles similares en venta en la zona, precios pedidos y tiempo en mercado.' },
  { id: 'arriendos', label: 'Arriendos de la zona', ayuda: 'Canon mensual comparable, vacancia y contratos vigentes.' },
  { id: 'costos', label: 'Costos de la operación', ayuda: 'Impuestos, administración, servicios, mantenimiento, comisión y costos de cierre.' },
  { id: 'ubicacion', label: 'Ubicación y entorno', ayuda: 'Acceso, transporte, seguridad, usos del suelo, proyectos cercanos.' },
  { id: 'legal', label: 'Situación legal y registral', ayuda: 'Tradición, gravámenes, afectaciones, uso del suelo y licencias.' },
  { id: 'visita', label: 'Visita de campo', ayuda: 'Verificación presencial con fecha y responsable.' },
]

export const LIMITACIONES = [
  'La fuente no incluye área física ni precio por m²: no se pueden comparar inmuebles equivalentes.',
  'No hay estado físico, antigüedad ni fecha de apertura de los inmuebles.',
  'No hay datos de oferta actual, arriendos, vacancia ni costos de operación.',
  'Los registros son actos de compraventa, no inmuebles únicos; una matrícula puede repetir varios actos.',
  'Calarcá tiene serie parcial (2021–2023): no se calculan tendencias 2015–2023.',
  'El GAM no supera la mediana municipal en Manizales ni en Santa Rosa de Cabal.',
  'La mejora global del GAM es marginal (1,25 % en 2023; 0,37 % en 2022) y la evaluación es retrospectiva.',
  'Los valores extremos y los posibles registros en unidades inconsistentes distorsionan las sumas.',
]

export const NAV = [
  { to: '/', label: 'Inicio', corto: 'Panorama', descripcion: 'Panorama territorial del año de corte' },
  { to: '/municipio', label: 'Por municipio', corto: 'Ficha', descripcion: 'Ficha profunda de cada municipio' },
  { to: '/comparar', label: 'Comparación', corto: 'Comparar', descripcion: 'Comparación multivariable: 5 preguntas' },
  { to: '/cobertura', label: 'Cobertura', corto: 'Calidad', descripcion: 'Cobertura y calidad de los datos' },
  { to: '/alertas', label: 'Alertas', corto: 'Atípicas', descripcion: 'Operaciones atípicas como señales de investigación' },
  { to: '/estimaciones', label: 'Estimaciones', corto: 'GAM', descripcion: 'Simulador GAM cuantílico experimental' },
  { to: '/mi-estudio', label: 'Mi estudio', corto: 'Estudio', descripcion: 'Asistente de decisión y exportación' },
] as const

export const PREGUNTAS_INVERSIONISTA = [
  { id: 'q1', titulo: '¿Dónde se concentra la actividad?', ayuda: 'Volumen de registros y participación en el alcance seleccionado.' },
  { id: 'q2', titulo: '¿La actividad se expande o se contrae?', ayuda: 'Variación anual del número de registros frente al año anterior.' },
  { id: 'q3', titulo: '¿Qué valores típicos se registran?', ayuda: 'Mediana real y rango intercuartílico Q1–Q3.' },
  { id: 'q4', titulo: '¿Qué tan disperso es el mercado?', ayuda: 'IQR/mediana y P90/P10: a mayor dispersión, menos comparables equivalentes.' },
  { id: 'q5', titulo: '¿Qué contexto urbano y económico acompaña?', ayuda: 'Población, valor agregado real per cápita, licencias de vivienda nueva y predios nuevos.' },
] as const

export const ETIQUETAS = {
  registros: 'Registros',
  medianaReal: 'Mediana real',
  medianaNominal: 'Mediana nominal',
  share: 'Participación',
  varAnual: 'Variación anual',
  q1q3: 'Rango Q1–Q3',
  iqrRatio: 'IQR / mediana',
  p90p10: 'P90 / P10',
  poblacion: 'Población',
  vaRealPc: 'VA real per cápita',
  licencias: 'Unidades de vivienda nueva (lag1)',
  areaLicencias: 'Área de vivienda nueva (lag1)',
  prediosNuevos: 'Registros con predio nuevo',
  crecimiento: 'Crecimiento poblacional',
  cabecera: 'Proporción en cabecera',
  numAnotacion: 'Número de anotación',
  countA: 'Conteo A (registral)',
  countDe: 'Conteo D (registral)',
  mes: 'Mes de radicación',
  dia: 'Día de radicación',
  valorTipico: 'Valor típico estimado',
  errorTipico: 'Error típico (MAE)',
  nd: 'n.d.',
} as const

export const AYUDAS = {
  numAnotacion:
    'Complejidad registral del folio: cuántas anotaciones tiene. No describe el inmueble físico.',
  countA: 'Variable registral de la fuente. Definición exacta pendiente de confirmación con el dueño de datos.',
  countDe: 'Variable registral de la fuente. Sin efecto material en el corte 2023.',
  viviendasPor1000:
    'Unidades de vivienda nueva licenciadas el año anterior por cada 1.000 habitantes (población lag1).',
  vaRealPc:
    'Valor agregado total de dos años atrás, en pesos dic-2023, dividido por la población de ese año.',
  crecimiento: 'Variación anual de la población total del municipio.',
  proporcionCabecera: 'Proporción de la población que vive en la cabecera municipal.',
  extrapolacion: 'Algún input está fuera del rango observado en la base: el resultado es una extrapolación.',
  percentil: 'Posición del valor estimado dentro de la distribución empírica municipal del año de referencia.',
  clamp: 'La curva del spline se recorta al extremo más cercano del rango observado.',
} as const

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const
