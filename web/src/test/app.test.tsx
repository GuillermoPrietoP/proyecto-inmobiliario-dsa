/**
 * Pruebas de integración: renderizan las 7 vistas contra los JSON reales
 * generados por el pipeline (fetch simulado con el sistema de archivos).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/app/App'

const DATA_DIR = join(process.cwd(), 'public', 'data', 'v1')

// jsdom + Recharts es lento: cada vista monta varios gráficos responsivos.
vi.setConfig({ testTimeout: 40000, hookTimeout: 40000 })
const ESPERA = { timeout: 20000 }

function servirDatos() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    const rel = url.replace(/^.*\/data\/v1\//, '')
    const cuerpo = readFileSync(join(DATA_DIR, rel), 'utf-8')
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => JSON.parse(cuerpo),
      text: async () => cuerpo,
    } as unknown as Response
  })
}

function montar(ruta: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[ruta]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

let erroresConsola: unknown[][] = []

beforeEach(() => {
  vi.stubGlobal('fetch', servirDatos())
  erroresConsola = []
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    erroresConsola.push(args)
  })
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Fallos reales de React/interfaz, ignorando advertencias de Recharts en jsdom. */
function erroresReales() {
  return erroresConsola.filter((args) => {
    const txt = args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ')
    return !/width\(0\)|height\(0\)|ResponsiveContainer|not wrapped in act| defaultProps /i.test(txt)
  })
}

describe('vista 1 · Inicio / Panorama territorial', () => {
  it('muestra los KPIs y las tarjetas de los 6 municipios', async () => {
    montar('/')
    await waitFor(() => expect(screen.getByText('28.384')).toBeInTheDocument(), ESPERA)
    expect(screen.getAllByText(/Armenia/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Manizales/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Calarcá/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/serie parcial/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/no son inmuebles únicos/i).length).toBeGreaterThan(0)
    expect(erroresReales()).toEqual([])
  })

  it('el año en la URL cambia el corte', async () => {
    montar('/?anio=2019')
    await waitFor(() => expect(screen.getAllByText(/2019/).length).toBeGreaterThan(0), ESPERA)
    expect(erroresReales()).toEqual([])
  })
})

describe('vista 2 · Ficha por municipio', () => {
  it('renderiza Armenia con mediana, contexto y notas', async () => {
    montar('/municipio/armenia?anio=2023')
    await waitFor(() => expect(screen.getAllByText(/Armenia/).length).toBeGreaterThan(0), ESPERA)
    await waitFor(() => expect(screen.getByText(/9.672/)).toBeInTheDocument(), ESPERA)
    expect(screen.getByText(/Qué puedo interpretar/i)).toBeInTheDocument()
    expect(screen.getByText(/304.311/)).toBeInTheDocument()
    expect(erroresReales()).toEqual([])
  })

  it('Calarcá en 2015 no inventa datos', async () => {
    montar('/municipio/calarca?anio=2015')
    await waitFor(() => expect(screen.getByText(/Sin datos para este año/i)).toBeInTheDocument(), ESPERA)
    expect(erroresReales()).toEqual([])
  })

  it('el índice lista los 6 municipios', async () => {
    montar('/municipio')
    await waitFor(() => expect(screen.getAllByText(/Dosquebradas/).length).toBeGreaterThan(0), ESPERA)
    expect(erroresReales()).toEqual([])
  })
})

describe('vista 3 · Comparación multivariable', () => {
  it('construye la matriz y las cinco preguntas sin score compuesto', async () => {
    montar('/comparar?m=armenia,manizales,pereira&anio=2023')
    await waitFor(() => expect(screen.getAllByText(/Matriz de evidencia/i).length).toBeGreaterThan(0), ESPERA)
    expect(screen.getByText(/Dónde se concentra la actividad/i)).toBeInTheDocument()
    expect(screen.getByText(/Qué tan disperso es el mercado/i)).toBeInTheDocument()
    expect(screen.getAllByText(/índice compuesto de inversión:/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/^Score$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Ranking$/i)).not.toBeInTheDocument()
    expect(erroresReales()).toEqual([])
  })
})

describe('vista 4 · Cobertura y calidad', () => {
  it('distingue verificación de universo previo y muestra hashes', async () => {
    montar('/cobertura')
    await waitFor(() => expect(screen.getByText(/Embudo de datos/i)).toBeInTheDocument(), ESPERA)
    expect(screen.getByText(/Verificación de los filtros del estudio/i)).toBeInTheDocument()
    expect(screen.getAllByText(/100,00 %/).length).toBeGreaterThan(0)
    expect(screen.getByText(/No disponible en el archivo entregado/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/bcdbe957345a3b99844002492ec12c0c87717dbaf7b65d6017507ea9f8107e57/)).toBeInTheDocument(), ESPERA)
    expect(erroresReales()).toEqual([])
  })
})

describe('vista 5 · Alertas y operaciones atípicas', () => {
  it('muestra el total real, el top 500 y el lenguaje permitido', async () => {
    montar('/alertas')
    await waitFor(() => expect(screen.getAllByText(/9.218/).length).toBeGreaterThan(0), ESPERA)
    const texto = document.body.textContent ?? ''
    expect(texto).toMatch(/señal/i)
    expect(texto.toLowerCase()).not.toContain('fraude')
    expect(texto.toLowerCase()).not.toContain('irregularidad probada')
    expect(erroresReales()).toEqual([])
  })
})

describe('vista 6 · Estimaciones GAM', () => {
  it('calcula el valor típico en Armenia y muestra la descomposición', async () => {
    montar('/estimaciones?m=armenia')
    await waitFor(() => expect(screen.getAllByText(/Valor típico estimado/i).length).toBeGreaterThan(0), ESPERA)
    await waitFor(() => expect(screen.getAllByText(/Descomposición aditiva/i).length).toBeGreaterThan(0), ESPERA)
    expect(screen.getAllByText(/no es un avalúo/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Validación del modelo/i).length).toBeGreaterThan(0)
    // El valor estimado debe ser un monto en pesos, no NaN.
    expect(document.body.textContent).not.toContain('NaN')
    expect(erroresReales()).toEqual([])
  })

  it('la compuerta bloquea Manizales hasta reconocer la limitación', async () => {
    montar('/estimaciones?m=manizales')
    await waitFor(() => expect(screen.getAllByText(/no supera la mediana municipal/i).length).toBeGreaterThan(0), ESPERA)
    expect(screen.getAllByText(/Estimación no disponible/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Ver de todos modos/i })).toBeInTheDocument()
    expect(erroresReales()).toEqual([])
  })

  it('Santa Rosa de Cabal también queda bloqueada', async () => {
    montar('/estimaciones?m=santa-rosa-de-cabal')
    await waitFor(() => expect(screen.getByText(/Estimación no disponible/i)).toBeInTheDocument(), ESPERA)
    expect(erroresReales()).toEqual([])
  })
})

describe('vista 7 · Mi Estudio', () => {
  it('inicia el asistente y bloquea la exportación sin el paso 3', async () => {
    montar('/mi-estudio')
    await waitFor(() => expect(screen.getByText(/Asistente de decisión y exportación/i)).toBeInTheDocument(), ESPERA)
    const iniciar = await screen.findByRole('button', { name: /Iniciar estudio/i })
    iniciar.click()
    await waitFor(() => expect(screen.getByText(/Paso 1 · Selección del estudio/i)).toBeInTheDocument())
    expect(screen.getByText(/Exportación bloqueada/i)).toBeInTheDocument()
    expect(erroresReales()).toEqual([])
  })
})

describe('vista 8 · Metodología', () => {
  it('explica el modelo aditivo, la paridad y las limitaciones', async () => {
    montar('/metodologia')
    await waitFor(() => expect(screen.getByText(/Cómo se construye este observatorio/i)).toBeInTheDocument(), ESPERA)
    expect(screen.getByText(/El modelo GAM cuantílico/i)).toBeInTheDocument()
    expect(screen.getByText(/Descargo de responsabilidad/i)).toBeInTheDocument()
    expect(erroresReales()).toEqual([])
  })
})

describe('copy canónico y reglas de negocio', () => {
  it('el footer incluye los disclaimers persistentes', async () => {
    montar('/')
    await waitFor(() => expect(screen.getByText(/28.384/)).toBeInTheDocument(), ESPERA)
    const footer = document.querySelector('footer')
    expect(footer).not.toBeNull()
    const txt = within(footer as HTMLElement).getByText(/no constituye un avalúo/i)
    expect(txt).toBeInTheDocument()
    expect(footer?.textContent).toMatch(/pesos constantes de diciembre de 2023/i)
  })

  it('ninguna vista afirma avalúo, garantía o fraude', async () => {
    for (const ruta of ['/', '/comparar', '/cobertura', '/alertas', '/estimaciones', '/metodologia']) {
      const { unmount } = montar(ruta)
      await waitFor(() => expect(document.body.textContent?.length ?? 0).toBeGreaterThan(500), ESPERA)
      const texto = (document.body.textContent ?? '').toLowerCase()
      expect(texto, ruta).not.toMatch(/fraude/)
      expect(texto, ruta).not.toMatch(/rentabilidad asegurada/)
      expect(texto, ruta).not.toMatch(/garantizamos/)
      unmount()
    }
  })
})

