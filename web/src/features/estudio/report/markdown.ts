/** Generador del reporte en Markdown (reutilizable, legible, sin PII). */
import { CHECKLIST_CAMPO, COPY, DISCLAIMER_LARGO } from '@/content/es'
import { formatCOP, formatCOPCompacto, formatDelta, formatFechaLarga, formatNumero, formatPct, formatRatio } from '@/lib/format'
import type { ReportData } from './datos'

function tabla(cabeceras: string[], filas: Array<Array<string>>): string {
  const head = `| ${cabeceras.join(' | ')} |`
  const sep = `| ${cabeceras.map(() => '---').join(' | ')} |`
  const body = filas.map((f) => `| ${f.join(' | ')} |`).join('\n')
  return [head, sep, body].filter(Boolean).join('\n')
}

function lista(items: string[]): string {
  return items.map((i) => `- ${i}`).join('\n')
}

/** Escapa lo único que rompe una celda de tabla o el énfasis en Markdown. */
function escapeCelda(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/([*_[\]`])/g, '\\$1').replace(/\r?\n/g, ' ')
}

export function generarMarkdown(r: ReportData): string {
  const e = r.estudio
  const municipios = r.filas.map((f) => f.nombre_ui).join(', ') || 'ninguno'
  const s: string[] = []

  s.push(`# ${e.titulo || 'Estudio preliminar de inversión inmobiliaria urbana'}`)
  s.push('')
  s.push(`**Observatorio DSA · Informe preliminar de priorización territorial**`)
  s.push('')
  s.push(tabla(['Campo', 'Valor'], [
    ['Fecha del informe', formatFechaLarga(r.generado_en)],
    ['Municipios', municipios],
    ['Año de corte', String(e.anio)],
    ['Alcance', e.alcance === '3_municipios' ? '3 ciudades capitales' : '6 municipios'],
    ['Horizonte de inversión', e.horizonte || 'n.d.'],
    ['Perfil del inversionista', e.perfil || 'no especificado'],
    ['Versión de datos', `\`${r.hash_datos}\``],
  ]))
  s.push('')
  if (e.objetivo.trim()) {
    s.push(`**Objetivo declarado:** ${e.objetivo.trim()}`)
    s.push('')
  }

  s.push('## 1. Resumen ejecutivo')
  s.push('')
  s.push(`> ${r.pregunta}`)
  s.push('')
  s.push(r.justificacion)
  s.push('')
  s.push('### Hallazgos')
  s.push('')
  s.push(lista(r.hallazgos))
  s.push('')
  s.push(`**Criterios usados (separados, sin índice compuesto):** ${r.criterios.join('; ') || 'n.d.'}.`)
  s.push('')
  s.push(`_${COPY.profundizar}_`)
  s.push('')

  s.push('## 2. Evidencia comparada')
  s.push('')
  s.push(`Año de corte: **${e.anio}**. Montos en pesos constantes de diciembre de 2023.`)
  s.push('')
  if (e.evidencia.incluir_actividad) {
    s.push('### 2.1 Actividad transaccional')
    s.push('')
    s.push(tabla(
      ['Municipio', 'Registros', 'Participación en la selección', 'Variación anual'],
      r.filas.map((f) => [
        f.nombre_ui + (f.serie_parcial ? ' (serie parcial)' : ''),
        f.tiene_datos ? formatNumero(f.registros) : 'sin datos',
        f.tiene_datos ? formatPct(f.share_pct, 2) : '—',
        f.var_registros_pct == null ? 'n.d.' : formatDelta(f.var_registros_pct),
      ]),
    ))
    s.push('')
    s.push(`_${COPY.registros}_`)
    s.push('')
    if (r.series.length && r.anios.length) {
      s.push('#### Serie histórica de registros')
      s.push('')
      s.push(tabla(
        ['Municipio', ...r.anios.map(String)],
        r.series.map((sr) => [sr.nombre_ui, ...sr.n.map((v) => (v == null ? '—' : formatNumero(v)))]),
      ))
      s.push('')
      s.push('«—» indica año sin datos. Calarcá solo tiene registros desde 2021.')
      s.push('')
    }
  }

  if (e.evidencia.incluir_valores) {
    s.push('### 2.2 Valores registrados típicos')
    s.push('')
    s.push(tabla(
      ['Municipio', 'Mediana real', 'Q1', 'Q3', 'IQR/mediana', 'P90/P10'],
      r.filas.map((f) => [
        f.nombre_ui,
        f.mediana_real == null ? 'n.d.' : formatCOP(f.mediana_real),
        f.q1 == null ? 'n.d.' : formatCOPCompacto(f.q1),
        f.q3 == null ? 'n.d.' : formatCOPCompacto(f.q3),
        f.iqr_ratio == null ? 'n.d.' : formatRatio(f.iqr_ratio),
        f.p90_p10 == null ? 'n.d.' : formatRatio(f.p90_p10),
      ]),
    ))
    s.push('')
    s.push(`_${COPY.mediana}_ ${COPY.sumas}`)
    s.push('')
    if (r.series.length && r.anios.length) {
      s.push('#### Serie histórica de la mediana real (COP dic-2023)')
      s.push('')
      s.push(tabla(
        ['Municipio', ...r.anios.map(String)],
        r.series.map((sr) => [sr.nombre_ui, ...sr.mediana_real.map((v) => (v == null ? '—' : formatCOPCompacto(v)))]),
      ))
      s.push('')
    }
  }

  if (e.evidencia.incluir_contexto) {
    s.push('### 2.3 Contexto urbano y económico')
    s.push('')
    s.push(tabla(
      ['Municipio', 'Población', 'VA real per cápita', 'Unidades vivienda nueva (lag1)', 'Predios nuevos'],
      r.filas.map((f) => [
        f.nombre_ui,
        f.poblacion_total == null ? 'n.d.' : formatNumero(f.poblacion_total),
        f.va_real_pc == null ? 'n.d.' : formatCOPCompacto(f.va_real_pc),
        f.licencias == null ? 'n.d.' : formatNumero(f.licencias),
        f.predios_nuevos_pct == null ? 'n.d.' : formatPct(f.predios_nuevos_pct, 2),
      ]),
    ))
    s.push('')
    s.push('«n.d.» en VA real per cápita corresponde a 2015–2016, sin valor agregado con rezago de dos años.')
    s.push('')
  }

  if (r.gam && e.evidencia.incluir_gam) {
    const g = r.gam
    s.push('## 3. Estimación GAM cuantílico (experimental)')
    s.push('')
    s.push(`_${COPY.gam}_`)
    s.push('')
    s.push(tabla(['Concepto', 'Valor'], [
      ['Municipio', g.nombre_ui],
      ['Valor típico estimado', formatCOP(g.estimado_cop)],
      ['Mediana observada del municipio', formatCOP(g.mediana_real)],
      ['Diferencia frente a la mediana', g.diferencia_pct == null ? 'n.d.' : formatDelta(g.diferencia_pct)],
      ['Error típico (MAE municipal 2023)', formatCOP(g.mae_cop)],
      ['MAE de la mediana municipal 2023', formatCOP(g.mae_mediana_cop)],
      ['Reducción de MAE del GAM en 2023', formatDelta(g.mejora_pct)],
      ['Compuerta de confiabilidad', g.habilitado ? 'habilitado' : 'SIN MEJORA DEMOSTRADA'],
      ['Limitación reconocida por el usuario', g.reconocio_limitacion ? 'sí' : 'no'],
      ['Mes / día de radicación simulados', g.mes != null ? `${g.mes} / ${g.dia ?? 'n.d.'}` : 'n.d.'],
      ['Número de anotación simulado', g.num_anotacion == null ? 'n.d.' : formatNumero(g.num_anotacion)],
    ]))
    s.push('')
    if (!g.habilitado) {
      s.push(`> **Advertencia:** en ${g.nombre_ui} el GAM **no supera** la mediana municipal (reducción de MAE ${formatDelta(g.mejora_pct)}).`)
      s.push(`> El usuario activó la vista experimental${g.reconocio_limitacion ? ' y reconoció explícitamente esta limitación' : ' sin marcar el reconocimiento de la limitación'}.`)
      s.push('')
    }
    s.push(`_${COPY.experimental}_ El MAE es una medida de error típico, **no un intervalo de confianza**. ${COPY.retrospectiva}`)
    s.push('')
  }

  if (e.evidencia.incluir_alertas) {
    s.push(`## ${r.gam && e.evidencia.incluir_gam ? '4' : '3'}. Alertas y operaciones atípicas`)
    s.push('')
    s.push(`_${COPY.alertas}_`)
    s.push('')
    s.push(
      `En la base completa hay **${formatNumero(r.alertas.total_base)} señales** (${formatPct(r.alertas.tasa_base_pct, 2)} de los registros). ` +
      `En los municipios y el año de este estudio se identificaron **${formatNumero(r.alertas.en_seleccion)}**.`,
    )
    s.push('')
    s.push(tabla(
      ['Municipio', 'Señales', 'Registros del año', 'Tasa'],
      r.alertas.por_municipio.map((a) => [a.nombre_ui, formatNumero(a.alertas), formatNumero(a.registros), formatPct(a.tasa_pct, 2)]),
    ))
    s.push('')
    if (r.alertas.ejemplos.length) {
      s.push('### Ejemplos (las de mayor |z| publicadas en el observatorio)')
      s.push('')
      s.push(tabla(
        ['Municipio', 'Fecha', 'Valor real', 'Anotación', 'Grupo (n)', 'Mediana del grupo', 'z robusto', 'Dirección'],
        r.alertas.ejemplos.map((a) => [
          a.municipio,
          a.fecha,
          formatCOPCompacto(a.valor_real),
          formatNumero(a.num_anotacion),
          formatNumero(a.grupo_n),
          formatCOPCompacto(a.grupo_mediana_real),
          a.z_robusto.toLocaleString('es-CO', { maximumFractionDigits: 2 }),
          a.direccion === 'alta' ? 'valor alto' : 'valor bajo',
        ]),
      ))
      s.push('')
      for (const a of r.alertas.ejemplos.slice(0, 3)) {
        s.push(`- **${a.municipio} · ${a.fecha}**: ${a.razon}`)
      }
      s.push('')
    }
    s.push('**Método:** grupo comparable = municipio × año × tramo de número de anotación (1-5, 6-10, 11-20, 21-40, 41+);')
    s.push('z robusto sobre el logaritmo del valor real, con umbral 3,5, mínimo 30 registros por grupo y MAD × 1,4826.')
    s.push('La mayoría de las señales son valores anormalmente bajos, compatibles con registros en millones o unidades inconsistentes.')
    s.push('')
  }

  const nLimit = r.gam && e.evidencia.incluir_gam ? 5 : 4
  s.push(`## ${nLimit}. Limitaciones y checklist de campo`)
  s.push('')
  s.push('### Limitaciones reconocidas')
  s.push('')
  s.push(lista(r.limitaciones))
  s.push('')
  s.push(`Confirmación del usuario: **${e.limitaciones_reconocidas ? 'reconocidas explícitamente' : 'PENDIENTE'}**.`)
  s.push('')
  s.push('### Checklist de verificación en campo')
  s.push('')
  s.push(tabla(
    ['Ítem', 'Estado', 'Fecha de verificación', 'Nota'],
    e.checklist.map((c) => {
      const def = CHECKLIST_CAMPO.find((x) => x.id === c.id)
      return [
        def?.label ?? c.id,
        c.completado ? 'verificado' : 'pendiente',
        c.fecha_verificacion ?? '—',
        (c.nota ? escapeCelda(c.nota) : '—'),
      ]
    }),
  ))
  s.push('')

  s.push(`## ${nLimit + 1}. Metodología y fuentes`)
  s.push('')
  s.push(`- **Base analítica:** ${formatNumero(r.metodologia.filas_base)} registros de compraventa urbana, 2015–2023, 6 municipios.`)
  s.push(`- **Moneda canónica:** ${COPY.moneda}`)
  s.push(`- **Fórmula:** \`${r.metodologia.formula}\``)
  s.push('')
  s.push(tabla(['Año', 'Factor a dic-2023'], r.metodologia.factores.map((f) => [String(f.anio), f.factor.toLocaleString('es-CO', { maximumFractionDigits: 10 })])))
  s.push('')
  s.push(`- **Modelo:** ${r.metodologia.modelo_id}, cuantil ${r.metodologia.cuantil}, alpha ${r.metodologia.alpha}, splines grado 2 con 4 nudos.`)
  s.push(`- **Entrenamiento:** ${r.metodologia.entrenamiento}. **Evaluación:** ${r.metodologia.evaluacion} (retrospectiva).`)
  s.push(`- **Desempeño 2023:** MAE ${formatCOP(r.metodologia.mae_2023)} frente a ${formatCOP(r.metodologia.mae_mediana_2023)} de la mediana municipal (reducción ${formatPct(r.metodologia.reduccion_2023_pct, 2)}).`)
  s.push(`- **SHA-256 del CSV:** \`${r.metodologia.csv_sha256}\``)
  s.push(`- **SHA-256 del modelo:** \`${r.metodologia.joblib_sha256}\``)
  s.push(`- **Versión de datos:** \`${r.metodologia.data_version}\` (generada ${formatFechaLarga(r.metodologia.generado_datos)}).`)
  s.push(`- **Versiones:** ${Object.entries(r.metodologia.versiones).map(([k, v]) => `${k} ${v}`).join(' · ') || 'n.d.'}`)
  s.push('- **Fuentes:** registros públicos de compraventa urbana (ORIP), IPC DANE, contexto poblacional DANE, licencias ELC, valor agregado municipal. Prototipo: Mockup_Prototipo_DSA.pptx.')
  s.push('')

  s.push(`## ${nLimit + 2}. Descargo de responsabilidad`)
  s.push('')
  s.push(DISCLAIMER_LARGO)
  s.push('')
  s.push(`_Informe generado en el navegador el ${formatFechaLarga(r.generado_en)}. No se enviaron datos a ningún servidor._`)
  s.push('')

  return s.join('\n')
}
