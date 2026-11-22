/** Panel de validación del GAM: MAE global y por municipio, compuerta y protocolo. */
import { Badge, Banner, Card, DataTable, DefinitionList, Section, type Columna } from '@/components/ui'
import { COPY, GATE } from '@/content/es'
import { formatCOPCompacto, formatNumero, formatPct } from '@/lib/format'
import type { GamModel, MunicipioNombre } from '@/types/domain'

interface FilaMunicipio {
  municipio: MunicipioNombre
  nombre_ui: string
  n2023: number
  mae2023: number
  mediana2023: number
  mejora2023: number
  mejora2022: number
  habilitado: boolean
  estado: string
}

const NOMBRE_UI: Record<MunicipioNombre, string> = {
  ARMENIA: 'Armenia',
  CALARCÁ: 'Calarcá',
  DOSQUEBRADAS: 'Dosquebradas',
  MANIZALES: 'Manizales',
  PEREIRA: 'Pereira',
  'SANTA ROSA DE CABAL': 'Santa Rosa de Cabal',
}

export function PanelValidacion({ model }: { model: GamModel }) {
  const m23 = model.metricas['2023']
  const m22 = model.metricas['2022']
  const por23 = model.metricas.por_municipio_2023

  const filas: FilaMunicipio[] = (Object.keys(model.municipios) as MunicipioNombre[])
    .map((m) => {
      const info = model.municipios[m]
      return {
        municipio: m,
        nombre_ui: NOMBRE_UI[m],
        n2023: por23[m]?.n ?? 0,
        mae2023: por23[m]?.mae_modelo ?? 0,
        mediana2023: por23[m]?.mae_mediana ?? 0,
        mejora2023: info.mejora_2023_pct,
        mejora2022: info.mejora_2022_pct,
        habilitado: info.habilitado,
        estado: info.mejora_2023_pct <= 0 ? 'sin mejora demostrada' : info.mejora_2023_pct < 1 ? 'mejora marginal' : 'habilitado',
      }
    })
    .sort((a, b) => b.mejora2023 - a.mejora2023)

  const columnas: Array<Columna<FilaMunicipio>> = [
    { id: 'muni', header: 'Municipio', cell: (r) => <span className="font-semibold">{r.nombre_ui}</span> },
    { id: 'n', header: 'Registros 2023', align: 'right', cell: (r) => formatNumero(r.n2023) },
    { id: 'mae', header: 'MAE del GAM', align: 'right', cell: (r) => formatCOPCompacto(r.mae2023), help: 'Error absoluto medio en COP dic-2023 sobre la comprobación retrospectiva de 2023.' },
    { id: 'base', header: 'MAE de la mediana', align: 'right', cell: (r) => formatCOPCompacto(r.mediana2023), help: 'Error de usar la mediana municipal del entrenamiento como referencia.' },
    {
      id: 'm23',
      header: 'Mejora 2023',
      align: 'right',
      cell: (r) => (
        <span className={r.mejora2023 > 0 ? 'font-semibold text-green-mock' : 'font-semibold text-red-mock'}>
          {r.mejora2023 > 0 ? '+' : '−'}
          {formatPct(Math.abs(r.mejora2023), 2)}
        </span>
      ),
    },
    {
      id: 'm22',
      header: 'Mejora 2022',
      align: 'right',
      cell: (r) => (
        <span className={r.mejora2022 > 0 ? 'text-green-mock' : 'text-red-mock'}>
          {r.mejora2022 > 0 ? '+' : '−'}
          {formatPct(Math.abs(r.mejora2022), 2)}
        </span>
      ),
    },
    {
      id: 'estado',
      header: 'Compuerta',
      cell: (r) => (
        <Badge tone={r.habilitado ? (r.mejora2023 < 1 ? 'warning' : 'success') : 'danger'} icon={r.habilitado ? 'check' : 'lock'}>
          {r.estado}
        </Badge>
      ),
    },
  ]

  return (
    <Section
      title="Validación del modelo"
      description="La métrica de selección es el MAE, no el R². Con pérdida L1 el R² puede ser cercano a cero o negativo."
      level={2}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <span className="label">MAE 2023 (comprobación)</span>
          <p className="text-[1.3rem] font-bold text-navy">{formatCOPCompacto(m23.mae_modelo)}</p>
          <p className="nota">Mediana municipal: {formatCOPCompacto(m23.mae_mediana)}</p>
          <Badge tone="warning" className="mt-1">mejora {formatPct(m23.reduccion_pct, 2)}</Badge>
        </Card>
        <Card>
          <span className="label">MAE 2022 (validación)</span>
          <p className="text-[1.3rem] font-bold text-navy">{formatCOPCompacto(m22.mae_modelo)}</p>
          <p className="nota">Mediana municipal: {formatCOPCompacto(m22.mae_mediana)}</p>
          <Badge tone="warning" className="mt-1">mejora {formatPct(m22.reduccion_pct, 2)}</Badge>
        </Card>
        <Card>
          <span className="label">Error mediano 2023</span>
          <p className="text-[1.3rem] font-bold text-navy">{formatCOPCompacto(m23.error_mediano)}</p>
          <p className="nota">P90 del error: {formatCOPCompacto(m23.p90_error)}</p>
        </Card>
        <Card>
          <span className="label">Paridad de exportación</span>
          <p className="text-[1.3rem] font-bold text-green-mock">{model.paridad.passed ? 'Aprobada' : 'No aprobada'}</p>
          <p className="nota">
            {formatNumero(model.paridad.n)} casos · Δ máx {model.paridad.max_abs_diff.toExponential(2)} COP · tolerancia {model.paridad.tolerancia_cop} COP
          </p>
        </Card>
      </div>

      <Banner tone="warning" title="Evaluación retrospectiva">
        {COPY.retrospectiva} El modelo se entrenó con {model.modelo.entrenamiento} y se comprobó con 2023. La mejora global es
        marginal ({formatPct(m23.reduccion_pct, 2)} en 2023 y {formatPct(m22.reduccion_pct, 2)} en 2022): no debe interpretarse como precisión de avalúo.
      </Banner>

      <DataTable
        columns={columnas}
        rows={filas}
        rowKey={(r) => r.municipio}
        caption="Reducción del MAE frente a la mediana municipal del entrenamiento. Un valor negativo significa que el GAM es peor que la mediana en ese municipio."
        highlight={(r) => !r.habilitado}
      />

      <Card className="space-y-3">
        <h3 className="h3 text-navy">Protocolo</h3>
        <DefinitionList
          items={[
            { term: 'Modelo', detail: model.modelo.id },
            { term: 'Versión exportada', detail: model.modelo.version },
            { term: 'Cuantil', detail: `q = ${model.modelo.cuantil} (mediana condicional)` },
            { term: 'Regularización', detail: `alpha = ${model.modelo.alpha} (L1)` },
            { term: 'Entrenamiento', detail: model.modelo.entrenamiento },
            { term: 'Año de referencia', detail: String(model.modelo.anio_referencia) },
            { term: 'Objetivo', detail: 'valor_cop_dic2023 (pesos constantes de diciembre de 2023)' },
            { term: 'Splines', detail: 'grado 2, 4 nudos, extrapolación lineal; curvas precalculadas 1–329 / 0–44 / 0–54' },
            { term: 'Extremos', detail: 'No se recortan: el modelo conserva todas las operaciones' },
            { term: 'R² 2023', detail: `${model.metricas['2023'].r2.toLocaleString('es-CO', { maximumFractionDigits: 4 })} (no es la métrica de selección)` },
            { term: 'Oficina registral', detail: model.oficinas.nota },
            { term: 'Escala interna', detail: `${model.modelo.escala.toLocaleString('es-CO')} (objetivo / 1e8)` },
          ]}
        />
        <Banner tone="method" compact>
          {GATE.habilitado} La compuerta (BR-07) bloquea la estimación donde el GAM no supera la mediana municipal:
          Manizales y Santa Rosa de Cabal.
        </Banner>
        <p className="nota">{COPY.experimental}</p>
      </Card>
    </Section>
  )
}
