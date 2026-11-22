/**
 * Reporte PDF vectorial generado en el navegador con @react-pdf/renderer.
 * Texto seleccionable, sin fuentes externas: Helvetica cubre el español (WinAnsi).
 * Los glifos fuera de WinAnsi se sustituyen para evitar cuadros vacíos.
 */
import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import { saveAs } from 'file-saver'
import { CHECKLIST_CAMPO, COPY, DISCLAIMER_LARGO } from '@/content/es'
import { formatCOP, formatCOPCompacto, formatDelta, formatFechaLarga, formatNumero, formatPct, formatRatio } from '@/lib/format'
import { nombreReporte, type ReportData } from './datos'

const NAVY = '#173B61'
const SLATE = '#617D9C'
const LINE = '#E5EAF0'
const BLUE = '#2E86D1'
const GREEN = '#2BB07F'
const ORANGE = '#FF8A28'
const PURPLE = '#6F63C7'
const RED = '#C8453C'
const CANVAS = '#F6F8FB'

/** Sustituye glifos no representables en WinAnsi (Helvetica estándar). */
export function sanitizarPdf(s: string): string {
  return s
    .replace(/\u2212/g, '-')
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u2192/g, '->')
    .replace(/\u2248/g, '~')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u00ab/g, '"')
    .replace(/\u00bb/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u00a0/g, ' ')
}

const st = StyleSheet.create({
  page: { paddingTop: 42, paddingBottom: 54, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 9, color: NAVY, lineHeight: 1.45 },
  marca: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  marcaBox: { backgroundColor: NAVY, color: '#fff', fontSize: 11, fontFamily: 'Helvetica-Bold', paddingHorizontal: 7, paddingVertical: 3, marginRight: 8 },
  marcaTxt: { fontSize: 8.5, color: SLATE },
  h1: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: NAVY, marginTop: 10, marginBottom: 4, lineHeight: 1.2 },
  h2: { fontSize: 12.5, fontFamily: 'Helvetica-Bold', color: NAVY, marginTop: 14, marginBottom: 5, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: LINE, borderBottomStyle: 'solid' },
  h3: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: NAVY, marginTop: 8, marginBottom: 3 },
  p: { marginBottom: 4, color: NAVY },
  nota: { fontSize: 7.6, color: SLATE, marginBottom: 3 },
  lead: { fontSize: 9.5, color: SLATE, marginBottom: 6 },
  destacado: { backgroundColor: CANVAS, borderLeftWidth: 3, borderLeftColor: BLUE, borderLeftStyle: 'solid', padding: 8, marginBottom: 6 },
  aviso: { backgroundColor: '#FFF3E6', borderLeftWidth: 3, borderLeftColor: ORANGE, borderLeftStyle: 'solid', padding: 8, marginBottom: 6 },
  metodo: { backgroundColor: '#F0EEFB', borderLeftWidth: 3, borderLeftColor: PURPLE, borderLeftStyle: 'solid', padding: 8, marginBottom: 6 },
  peligro: { backgroundColor: '#FDECEB', borderLeftWidth: 3, borderLeftColor: RED, borderLeftStyle: 'solid', padding: 8, marginBottom: 6 },
  bold: { fontFamily: 'Helvetica-Bold' },
  tabla: { borderWidth: 1, borderColor: LINE, borderStyle: 'solid', marginBottom: 6 },
  thRow: { flexDirection: 'row', backgroundColor: CANVAS, borderBottomWidth: 1, borderBottomColor: LINE, borderBottomStyle: 'solid' },
  trRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: LINE, borderBottomStyle: 'solid' },
  th: { fontSize: 7.4, fontFamily: 'Helvetica-Bold', color: SLATE, paddingHorizontal: 5, paddingVertical: 4, textTransform: 'uppercase' },
  td: { fontSize: 8.2, paddingHorizontal: 5, paddingVertical: 4, color: NAVY },
  tdRight: { textAlign: 'right' },
  bullet: { flexDirection: 'row', marginBottom: 3 },
  bulletDot: { width: 10, color: BLUE, fontSize: 9 },
  bulletTxt: { flex: 1, fontSize: 8.6 },
  barraFila: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  barraLabel: { width: 108, fontSize: 8 },
  barraPista: { flex: 1, height: 9, backgroundColor: CANVAS, marginRight: 6 },
  barraRelleno: { height: 9 },
  barraValor: { width: 84, fontSize: 8, textAlign: 'right' },
  kvFila: { flexDirection: 'row', marginBottom: 2.5 },
  kvClave: { width: 168, fontSize: 8, color: SLATE },
  kvValor: { flex: 1, fontSize: 8.4, fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 22, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.75, borderTopColor: LINE, borderTopStyle: 'solid', paddingTop: 5 },
  footerTxt: { fontSize: 6.8, color: SLATE },
  hash: { fontSize: 6.6, color: SLATE, fontFamily: 'Courier' },
  salto: { marginTop: 6 },
})

function Tabla({ cabeceras, filas, pesos, derecha = [] }: { cabeceras: string[]; filas: string[][]; pesos?: number[]; derecha?: number[] }) {
  const w = pesos ?? cabeceras.map(() => 1)
  return (
    <View style={st.tabla}>
      <View style={st.thRow}>
        {cabeceras.map((c, i) => (
          <Text key={i} style={[st.th, { flex: w[i] }, derecha.includes(i) ? st.tdRight : {}]}>
            {sanitizarPdf(c)}
          </Text>
        ))}
      </View>
      {filas.map((f, ri) => (
        <View key={ri} style={st.trRow} wrap={false}>
          {f.map((c, ci) => (
            <Text key={ci} style={[st.td, { flex: w[ci] }, derecha.includes(ci) ? st.tdRight : {}]}>
              {sanitizarPdf(c)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

function KV({ items }: { items: Array<[string, string]> }) {
  return (
    <View>
      {items.map(([k, v], i) => (
        <View key={i} style={st.kvFila} wrap={false}>
          <Text style={st.kvClave}>{sanitizarPdf(k)}</Text>
          <Text style={st.kvValor}>{sanitizarPdf(v)}</Text>
        </View>
      ))}
    </View>
  )
}

function Vinetas({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((it, i) => (
        <View key={i} style={st.bullet} wrap={false}>
          <Text style={st.bulletDot}>-</Text>
          <Text style={st.bulletTxt}>{sanitizarPdf(it)}</Text>
        </View>
      ))}
    </View>
  )
}

function Barras({ datos, color = BLUE }: { datos: Array<{ label: string; valor: number | null; texto: string }>; color?: string }) {
  const max = Math.max(1, ...datos.map((d) => Math.abs(d.valor ?? 0)))
  return (
    <View style={{ marginBottom: 6 }}>
      {datos.map((d, i) => (
        <View key={i} style={st.barraFila} wrap={false}>
          <Text style={st.barraLabel}>{sanitizarPdf(d.label)}</Text>
          <View style={st.barraPista}>
            <View style={[st.barraRelleno, { width: `${d.valor == null ? 0 : Math.max(1.5, (Math.abs(d.valor) / max) * 100)}%`, backgroundColor: d.valor == null ? LINE : color }]} />
          </View>
          <Text style={st.barraValor}>{sanitizarPdf(d.texto)}</Text>
        </View>
      ))}
    </View>
  )
}

export function ReportePdf({ data: r }: { data: ReportData }) {
  const e = r.estudio
  const municipios = r.filas.map((f) => f.nombre_ui).join(', ') || 'ninguno'
  const conDatos = r.filas.filter((f) => f.tiene_datos)

  return (
    <Document
      title={e.titulo || 'Estudio preliminar DSA'}
      author="Observatorio DSA"
      subject="Priorizacion de municipios para estudio de inversion inmobiliaria urbana"
      language="es-CO"
      creator="DSA Observatorio (generado en el navegador)"
    >
      <Page size="A4" style={st.page} wrap>
        {/* ------------------------------------------------------- portada */}
        <View style={st.marca}>
          <Text style={st.marcaBox}>DSA</Text>
          <Text style={st.marcaTxt}>Observatorio de Inversion Inmobiliaria Urbana · Informe preliminar</Text>
        </View>

        <Text style={st.h1}>{sanitizarPdf(e.titulo || 'Estudio preliminar de inversion inmobiliaria urbana')}</Text>
        <Text style={st.lead}>{sanitizarPdf(r.pregunta)}</Text>

        <KV
          items={[
            ['Fecha del informe', formatFechaLarga(r.generado_en)],
            ['Municipios', municipios],
            ['Ano de corte', String(e.anio)],
            ['Alcance', e.alcance === '3_municipios' ? '3 ciudades capitales' : '6 municipios'],
            ['Horizonte de inversion', e.horizonte || 'n.d.'],
            ['Perfil del inversionista', e.perfil || 'no especificado'],
            ['Version de datos', r.hash_datos],
          ]}
        />
        {e.objetivo.trim() ? (
          <View style={st.destacado}>
            <Text style={[st.nota, { marginBottom: 2 }]}>OBJETIVO DECLARADO</Text>
            <Text style={st.p}>{sanitizarPdf(e.objetivo.trim())}</Text>
          </View>
        ) : null}

        {/* ------------------------------------------- resumen ejecutivo */}
        <Text style={st.h2}>1. Resumen ejecutivo</Text>
        <View style={st.destacado}>
          <Text style={st.p}>{sanitizarPdf(r.justificacion)}</Text>
        </View>
        <Text style={st.h3}>Hallazgos</Text>
        <Vinetas items={r.hallazgos} />
        <Text style={st.nota}>
          {sanitizarPdf(`Criterios usados (separados, sin indice compuesto): ${r.criterios.join('; ') || 'n.d.'}.`)}
        </Text>
        <Text style={st.nota}>{sanitizarPdf(COPY.profundizar)}</Text>

        {/* ---------------------------------------------------- evidencia */}
        <Text style={st.h2}>2. Evidencia comparada</Text>
        <Text style={st.nota}>{sanitizarPdf(`Ano de corte ${e.anio}. ${COPY.moneda}`)}</Text>

        {e.evidencia.incluir_actividad ? (
          <View>
            <Text style={st.h3}>2.1 Actividad transaccional</Text>
            <Tabla
              cabeceras={['Municipio', 'Registros', 'Participacion', 'Var. anual']}
              pesos={[2.1, 1, 1.1, 1]}
              derecha={[1, 2, 3]}
              filas={r.filas.map((f) => [
                f.nombre_ui + (f.serie_parcial ? ' (parcial)' : ''),
                f.tiene_datos ? formatNumero(f.registros) : 'sin datos',
                f.tiene_datos ? formatPct(f.share_pct, 2) : '-',
                f.var_registros_pct == null ? 'n.d.' : formatDelta(f.var_registros_pct),
              ])}
            />
            <Barras datos={conDatos.map((f) => ({ label: f.nombre_ui, valor: f.registros, texto: formatNumero(f.registros) }))} />
            <Text style={st.nota}>{sanitizarPdf(COPY.registros)}</Text>
            {r.series.length && r.anios.length ? (
              <View>
                <Text style={st.h3}>Serie historica de registros</Text>
                <Tabla
                  cabeceras={['Municipio', ...r.anios.map(String)]}
                  pesos={[1.7, ...r.anios.map(() => 1)]}
                  derecha={r.anios.map((_, i) => i + 1)}
                  filas={r.series.map((s) => [s.nombre_ui, ...s.n.map((v) => (v == null ? '-' : formatNumero(v)))])}
                />
                <Text style={st.nota}>"-" indica ano sin datos. Calarca solo tiene registros desde 2021.</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {e.evidencia.incluir_valores ? (
          <View>
            <Text style={st.h3}>2.2 Valores registrados tipicos</Text>
            <Tabla
              cabeceras={['Municipio', 'Mediana real', 'Q1', 'Q3', 'IQR/med.', 'P90/P10']}
              pesos={[1.7, 1.3, 1, 1, 0.9, 0.9]}
              derecha={[1, 2, 3, 4, 5]}
              filas={r.filas.map((f) => [
                f.nombre_ui,
                f.mediana_real == null ? 'n.d.' : formatCOPCompacto(f.mediana_real),
                f.q1 == null ? 'n.d.' : formatCOPCompacto(f.q1),
                f.q3 == null ? 'n.d.' : formatCOPCompacto(f.q3),
                f.iqr_ratio == null ? 'n.d.' : formatRatio(f.iqr_ratio),
                f.p90_p10 == null ? 'n.d.' : formatRatio(f.p90_p10),
              ])}
            />
            <Barras
              color={GREEN}
              datos={conDatos.map((f) => ({ label: f.nombre_ui, valor: f.mediana_real, texto: f.mediana_real == null ? 'n.d.' : formatCOPCompacto(f.mediana_real) }))}
            />
            <Text style={st.nota}>{sanitizarPdf(`${COPY.mediana} ${COPY.sumas}`)}</Text>
            {r.series.length && r.anios.length ? (
              <View>
                <Text style={st.h3}>Serie historica de la mediana real (COP dic-2023)</Text>
                <Tabla
                  cabeceras={['Municipio', ...r.anios.map(String)]}
                  pesos={[1.7, ...r.anios.map(() => 1)]}
                  derecha={r.anios.map((_, i) => i + 1)}
                  filas={r.series.map((s) => [s.nombre_ui, ...s.mediana_real.map((v) => (v == null ? '-' : formatCOPCompacto(v, 0)))])}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {e.evidencia.incluir_contexto ? (
          <View>
            <Text style={st.h3}>2.3 Contexto urbano y economico</Text>
            <Tabla
              cabeceras={['Municipio', 'Poblacion', 'VA real p/c', 'Vivienda nueva', 'Predios nuevos']}
              pesos={[1.7, 1.1, 1.3, 1.2, 1.1]}
              derecha={[1, 2, 3, 4]}
              filas={r.filas.map((f) => [
                f.nombre_ui,
                f.poblacion_total == null ? 'n.d.' : formatNumero(f.poblacion_total),
                f.va_real_pc == null ? 'n.d.' : formatCOPCompacto(f.va_real_pc),
                f.licencias == null ? 'n.d.' : formatNumero(f.licencias),
                f.predios_nuevos_pct == null ? 'n.d.' : formatPct(f.predios_nuevos_pct, 2),
              ])}
            />
            <Text style={st.nota}>"n.d." en VA real per capita corresponde a 2015-2016, sin valor agregado con rezago de dos anos.</Text>
          </View>
        ) : null}

        {/* ---------------------------------------------------------- GAM */}
        {r.gam && e.evidencia.incluir_gam ? (
          <View>
            <Text style={st.h2}>3. Estimacion GAM cuantilico (experimental)</Text>
            <View style={st.metodo}>
              <Text style={st.p}>{sanitizarPdf(COPY.gam)}</Text>
            </View>
            <KV
              items={[
                ['Municipio', r.gam.nombre_ui],
                ['Valor tipico estimado', formatCOP(r.gam.estimado_cop)],
                ['Mediana observada', formatCOP(r.gam.mediana_real)],
                ['Diferencia vs. mediana', r.gam.diferencia_pct == null ? 'n.d.' : formatDelta(r.gam.diferencia_pct)],
                ['Error tipico (MAE 2023)', formatCOP(r.gam.mae_cop)],
                ['MAE mediana municipal', formatCOP(r.gam.mae_mediana_cop)],
                ['Reduccion de MAE 2023', formatDelta(r.gam.mejora_pct)],
                ['Compuerta', r.gam.habilitado ? 'habilitado' : 'SIN MEJORA DEMOSTRADA'],
                ['Limitacion reconocida', r.gam.reconocio_limitacion ? 'si' : 'no'],
                ['Mes / dia simulados', r.gam.mes != null ? `${r.gam.mes} / ${r.gam.dia ?? 'n.d.'}` : 'n.d.'],
                ['Numero de anotacion', r.gam.num_anotacion == null ? 'n.d.' : formatNumero(r.gam.num_anotacion)],
              ]}
            />
            {!r.gam.habilitado ? (
              <View style={st.peligro}>
                <Text style={[st.p, st.bold]}>
                  {sanitizarPdf(`Advertencia: en ${r.gam.nombre_ui} el GAM no supera la mediana municipal (reduccion de MAE ${formatDelta(r.gam.mejora_pct)}).`)}
                </Text>
                <Text style={st.nota}>
                  {sanitizarPdf(
                    `El usuario activo la vista experimental${r.gam.reconocio_limitacion ? ' y reconocio explicitamente esta limitacion' : ' sin marcar el reconocimiento de la limitacion'}.`,
                  )}
                </Text>
              </View>
            ) : null}
            <View style={st.aviso}>
              <Text style={st.nota}>
                {sanitizarPdf(`${COPY.experimental} El MAE es una medida de error tipico, no un intervalo de confianza. ${COPY.retrospectiva}`)}
              </Text>
            </View>
          </View>
        ) : null}

        {/* ------------------------------------------------------ alertas */}
        {e.evidencia.incluir_alertas ? (
          <View>
            <Text style={st.h2}>{r.gam && e.evidencia.incluir_gam ? '4' : '3'}. Alertas y operaciones atipicas</Text>
            <View style={st.aviso}>
              <Text style={st.p}>{sanitizarPdf(COPY.alertas)}</Text>
            </View>
            <Text style={st.p}>
              {sanitizarPdf(
                `En la base completa hay ${formatNumero(r.alertas.total_base)} senales (${formatPct(r.alertas.tasa_base_pct, 2)} de los registros). En los municipios y el ano de este estudio se identificaron ${formatNumero(r.alertas.en_seleccion)}.`,
              )}
            </Text>
            <Tabla
              cabeceras={['Municipio', 'Senales', 'Registros del ano', 'Tasa']}
              pesos={[2, 1, 1.4, 1]}
              derecha={[1, 2, 3]}
              filas={r.alertas.por_municipio.map((a) => [a.nombre_ui, formatNumero(a.alertas), formatNumero(a.registros), formatPct(a.tasa_pct, 2)])}
            />
            {r.alertas.ejemplos.length ? (
              <View>
                <Text style={st.h3}>Ejemplos (las de mayor |z| publicadas)</Text>
                <Tabla
                  cabeceras={['Municipio', 'Fecha', 'Valor real', 'Anot.', 'Grupo n', 'Mediana grupo', 'z', 'Direccion']}
                  pesos={[1.5, 1, 1.1, 0.6, 0.8, 1.2, 0.7, 0.9]}
                  derecha={[2, 3, 4, 5, 6]}
                  filas={r.alertas.ejemplos.map((a) => [
                    a.municipio,
                    a.fecha,
                    formatCOPCompacto(a.valor_real),
                    formatNumero(a.num_anotacion),
                    formatNumero(a.grupo_n),
                    formatCOPCompacto(a.grupo_mediana_real),
                    a.z_robusto.toLocaleString('es-CO', { maximumFractionDigits: 2 }),
                    a.direccion === 'alta' ? 'valor alto' : 'valor bajo',
                  ])}
                />
                <Vinetas items={r.alertas.ejemplos.slice(0, 3).map((a) => `${a.municipio} · ${a.fecha}: ${a.razon}`)} />
              </View>
            ) : null}
            <Text style={st.nota}>
              Metodo: grupo comparable = municipio x ano x tramo de numero de anotacion (1-5, 6-10, 11-20, 21-40, 41+);
              z robusto sobre el logaritmo del valor real, umbral 3,5, minimo 30 registros por grupo y MAD x 1,4826.
              La mayoria de las senales son valores anormalmente bajos, compatibles con registros en millones o unidades inconsistentes.
            </Text>
          </View>
        ) : null}

        {/* ---------------------------------------- limitaciones y campo */}
        <Text style={st.h2}>{r.gam && e.evidencia.incluir_gam ? '5' : '4'}. Limitaciones y checklist de campo</Text>
        <Text style={st.h3}>Limitaciones reconocidas</Text>
        <Vinetas items={r.limitaciones} />
        <Text style={st.nota}>
          {sanitizarPdf(`Confirmacion del usuario: ${e.limitaciones_reconocidas ? 'reconocidas explicitamente' : 'PENDIENTE'}.`)}
        </Text>
        <Text style={st.h3}>Checklist de verificacion en campo</Text>
        <Tabla
          cabeceras={['Item', 'Estado', 'Fecha', 'Nota']}
          pesos={[1.7, 0.9, 0.9, 2.5]}
          filas={e.checklist.map((c) => {
            const def = CHECKLIST_CAMPO.find((x) => x.id === c.id)
            return [def?.label ?? c.id, c.completado ? 'verificado' : 'pendiente', c.fecha_verificacion ?? '-', c.nota || '-']
          })}
        />

        {/* -------------------------------------------------- metodologia */}
        <Text style={st.h2}>{r.gam && e.evidencia.incluir_gam ? '6' : '5'}. Metodologia y fuentes</Text>
        <Vinetas
          items={[
            `Base analitica: ${formatNumero(r.metodologia.filas_base)} registros de compraventa urbana, 2015-2023, 6 municipios.`,
            `Moneda canonica: ${COPY.moneda}`,
            `Formula: ${r.metodologia.formula}`,
            `Modelo: ${r.metodologia.modelo_id}, cuantil ${r.metodologia.cuantil}, alpha ${r.metodologia.alpha}, splines grado 2 con 4 nudos.`,
            `Entrenamiento ${r.metodologia.entrenamiento}; evaluacion ${r.metodologia.evaluacion} (retrospectiva).`,
            `Desempeno 2023: MAE ${formatCOP(r.metodologia.mae_2023)} frente a ${formatCOP(r.metodologia.mae_mediana_2023)} de la mediana municipal (reduccion ${formatPct(r.metodologia.reduccion_2023_pct, 2)}).`,
            `Version de datos ${r.metodologia.data_version}, generada ${formatFechaLarga(r.metodologia.generado_datos)}.`,
            `Versiones: ${Object.entries(r.metodologia.versiones).map(([k, v]) => `${k} ${v}`).join(' · ') || 'n.d.'}`,
            'Fuentes: registros publicos de compraventa urbana (ORIP), IPC DANE, poblacion DANE, licencias ELC, valor agregado municipal. Prototipo: Mockup_Prototipo_DSA.pptx.',
          ]}
        />
        <Tabla
          cabeceras={['Ano', 'Factor a dic-2023']}
          pesos={[1, 2]}
          derecha={[1]}
          filas={r.metodologia.factores.map((f) => [String(f.anio), f.factor.toLocaleString('es-CO', { maximumFractionDigits: 10 })])}
        />
        <Text style={st.h3}>Hashes de trazabilidad</Text>
        <Text style={st.hash}>CSV    {r.metodologia.csv_sha256}</Text>
        <Text style={st.hash}>MODELO {r.metodologia.joblib_sha256}</Text>

        {/* ---------------------------------------------------- descargo */}
        <Text style={st.h2}>{r.gam && e.evidencia.incluir_gam ? '7' : '6'}. Descargo de responsabilidad</Text>
        <View style={st.peligro}>
          <Text style={[st.nota, { color: NAVY }]}>{sanitizarPdf(DISCLAIMER_LARGO)}</Text>
        </View>
        <Text style={st.nota}>
          {sanitizarPdf(`Informe generado en el navegador el ${formatFechaLarga(r.generado_en)}. No se enviaron datos a ningun servidor.`)}
        </Text>

        <View style={st.footer} fixed>
          <Text style={st.footerTxt}>DSA · Observatorio de Inversion Inmobiliaria Urbana · {r.hash_datos}</Text>
          <Text style={st.footerTxt} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

/** Genera y descarga el PDF. Se importa de forma diferida para no engordar el bundle inicial. */
export async function descargarPdf(r: ReportData): Promise<void> {
  const blob = await pdf(<ReportePdf data={r} />).toBlob()
  saveAs(blob, nombreReporte(r.estudio, 'pdf'))
}
