/**
 * Drawer de detalle de una señal: pk completo, estadísticos del grupo comparable,
 * razón textual y explicación del método. Las alertas son señales para investigar.
 */
import { useEffect, useState } from 'react'
import { nombreCorto } from '@/components/GlobalFilters'
import { Badge, Banner, Button, DefinitionList, Dialog, LinkButton } from '@/components/ui'
import { COPY } from '@/content/es'
import { SLUG_POR_NOMBRE, useManifest } from '@/lib/data'
import { formatCOP, formatCOPCompacto, formatFecha, formatNumero, formatRatio } from '@/lib/format'
import type { Alerta, Alertas } from '@/types/domain'
import { CATEGORIA_INFO, DIRECCION_INFO, formatZ } from './etiquetas'

/** Copia al portapapeles con fallback para contextos sin navigator.clipboard. */
async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto)
      return true
    }
  } catch {
    // Continúa con el fallback.
  }
  try {
    const area = document.createElement('textarea')
    area.value = texto
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

export function AlertaDetalle({
  alerta,
  metodo,
  onCerrar,
}: {
  alerta: Alerta | null
  metodo: Alertas['metodo']
  onCerrar: () => void
}) {
  const { data: manifest } = useManifest()
  const [copiado, setCopiado] = useState<'idle' | 'ok' | 'error'>('idle')

  useEffect(() => {
    setCopiado('idle')
  }, [alerta?.id])

  if (!alerta) return null

  const slug = SLUG_POR_NOMBRE[alerta.municipio]
  const factor = manifest?.currency.factors[String(alerta.anio)]
  const direccion = DIRECCION_INFO[alerta.direccion]
  const categoria = CATEGORIA_INFO[alerta.categoria_razon]

  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onCerrar()
      }}
      wide
      title={`${nombreCorto(slug)} · ${formatFecha(alerta.fecha)}`}
      description={`Señal ${alerta.id} · grupo ${alerta.municipio} × ${alerta.anio} × tramo ${alerta.tramo}`}
      footer={
        <>
          <LinkButton to={`/municipio/${slug}?anio=${alerta.anio}`} variant="primary" icon="arrowRight">
            Ver ficha del municipio
          </LinkButton>
          <LinkButton to={`/comparar?anio=${alerta.anio}`} icon="chart">
            Comparar municipios
          </LinkButton>
          <Button onClick={onCerrar}>Cerrar</Button>
        </>
      }
    >
      <DefinitionList
        items={[
          {
            term: 'pk completo',
            detail: (
              <span className="flex flex-wrap items-center gap-2">
                <code className="break-all rounded bg-navy-50 px-1.5 py-0.5 text-[0.8rem]">{alerta.pk}</code>
                <Button
                  size="sm"
                  icon={copiado === 'ok' ? 'check' : 'doc'}
                  aria-label="Copiar el pk completo al portapapeles"
                  onClick={async () => {
                    const ok = await copiarTexto(alerta.pk)
                    setCopiado(ok ? 'ok' : 'error')
                  }}
                >
                  {copiado === 'ok' ? 'Copiado' : 'Copiar pk'}
                </Button>
              </span>
            ),
          },
          { term: 'Matrícula', detail: alerta.matricula },
          { term: 'Fecha de radicación', detail: formatFecha(alerta.fecha) },
          { term: 'Valor nominal (registrado)', detail: formatCOP(alerta.valor_nominal) },
          { term: 'Valor real (COP dic-2023)', detail: formatCOP(alerta.valor_real) },
          { term: `Factor IPC ${alerta.anio} → dic-2023`, detail: formatRatio(factor, 4) },
          { term: 'N.º de anotación', detail: formatNumero(alerta.num_anotacion) },
          { term: 'Tramo de anotación', detail: alerta.tramo },
          { term: 'Registros del grupo (n)', detail: formatNumero(alerta.grupo_n) },
          { term: 'Mediana del grupo (real)', detail: formatCOPCompacto(alerta.grupo_mediana_real) },
          {
            term: 'Q1 – Q3 del grupo (real)',
            detail: `${formatCOPCompacto(alerta.grupo_q1)} – ${formatCOPCompacto(alerta.grupo_q3)}`,
          },
          { term: 'z robusto', detail: <span className="font-semibold tabular-nums">{formatZ(alerta.z_robusto)}</span> },
          { term: 'Dirección', detail: <Badge tone={direccion.tono}>{direccion.etiqueta}</Badge> },
          { term: 'Categoría', detail: <Badge tone={categoria.tono}>{categoria.etiqueta}</Badge> },
          {
            term: 'Monto repetido (duplicado)',
            detail: alerta.duplicado_valor ? (
              <Badge tone="warning" icon="warning">
                sí
              </Badge>
            ) : (
              <Badge tone="neutral">no</Badge>
            ),
          },
        ]}
      />
      <div aria-live="polite">
        {copiado === 'ok' ? (
          <Badge tone="success" icon="check">
            pk copiado al portapapeles
          </Badge>
        ) : copiado === 'error' ? (
          <p className="nota" role="alert">
            No se pudo copiar automáticamente; selecciona el texto del pk y cópialo manualmente.
          </p>
        ) : null}
      </div>
      <p className="nota">Valor real = valor nominal × factor IPC del año (moneda canónica COP dic-2023).</p>

      <div className="rounded-[12px] border border-line bg-navy-50 px-3.5 py-3">
        <p className="text-[0.85rem] font-bold text-navy">¿Por qué se señaló?</p>
        <p className="mt-1 text-[0.85rem] leading-relaxed text-navy">{alerta.razon}</p>
        <p className="nota mt-2">
          Método: z = (log(valor real) − mediana del grupo en log) / ({formatRatio(metodo.mad_factor, 4)} × MAD del
          grupo). Se señala cuando |z| &gt; {formatRatio(metodo.umbral, 1)} y el grupo tiene al menos{' '}
          {formatNumero(metodo.min_grupo)} registros. Aquí |z| = {formatZ(Math.abs(alerta.z_robusto))} y el grupo
          comparable ({alerta.municipio} × {alerta.anio} × tramo {alerta.tramo}) tiene{' '}
          {formatNumero(alerta.grupo_n)} registros.
        </p>
      </div>

      <Banner tone="warning" compact>
        {COPY.alertas}
      </Banner>
    </Dialog>
  )
}
