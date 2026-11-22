/** Carcasa de la aplicación: header, navegación de 7 vistas, filtros y footer. */
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { Badge, Button, Icon, TooltipProvider } from '@/components/ui'
import { GlobalFilters } from '@/components/GlobalFilters'
import { COPY, DISCLAIMER_LARGO, MARCA, NAV } from '@/content/es'
import { useManifest } from '@/lib/data'
import { formatFechaLarga } from '@/lib/format'

const RUTAS_SIN_FILTROS = ['/metodologia']

export function AppShell() {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const location = useLocation()
  const { data: manifest } = useManifest()
  const mostrarFiltros = !RUTAS_SIN_FILTROS.some((r) => location.pathname.startsWith(r))
  const esSimulador = location.pathname.startsWith('/estimaciones')

  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-navy focus:px-3 focus:py-2 focus:text-white">
          Saltar al contenido
        </a>

        <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-2.5">
            <NavLink to="/" className="flex items-center gap-2.5" aria-label="Inicio del observatorio">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-navy text-[0.95rem] font-bold text-white">
                DSA
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-[0.9rem] font-bold text-navy">{MARCA.producto}</span>
                <span className="block text-[0.72rem] text-slate-mock">{MARCA.claim}</span>
              </span>
            </NavLink>

            <nav aria-label="Secciones del observatorio" className="ml-auto hidden lg:block">
              <ul className="flex items-center gap-0.5">
                {NAV.map((n) => (
                  <li key={n.to}>
                    <NavLink
                      to={n.to}
                      end={n.to === '/'}
                      className={({ isActive }) =>
                        clsx(
                          'rounded-[9px] px-2.5 py-1.5 text-[0.8rem] font-semibold transition-colors',
                          isActive || (n.to !== '/' && location.pathname.startsWith(n.to))
                            ? 'bg-navy-50 text-navy'
                            : 'text-slate-mock hover:bg-navy-50 hover:text-navy',
                        )
                      }
                    >
                      {n.label}
                    </NavLink>
                  </li>
                ))}
                <li>
                  <NavLink
                    to="/metodologia"
                    className={({ isActive }) =>
                      clsx('rounded-[9px] px-2.5 py-1.5 text-[0.8rem] font-semibold', isActive ? 'bg-purple-mock text-white' : 'text-purple-mock hover:bg-[#f0eefb]')
                    }
                  >
                    Metodología
                  </NavLink>
                </li>
              </ul>
            </nav>

            <Button
              variant="ghost"
              size="sm"
              className="ml-auto lg:hidden"
              icon={menuAbierto ? 'close' : 'chevron'}
              aria-expanded={menuAbierto}
              aria-controls="menu-movil"
              onClick={() => setMenuAbierto((v) => !v)}
            >
              Menú
            </Button>
          </div>

          {menuAbierto ? (
            <nav id="menu-movil" aria-label="Secciones (móvil)" className="border-t border-line bg-white px-4 py-2 lg:hidden">
              <ul className="grid grid-cols-2 gap-1">
                {[...NAV, { to: '/metodologia', label: 'Metodología', corto: 'Método', descripcion: 'Fuentes y método' }].map((n) => (
                  <li key={n.to}>
                    <NavLink
                      to={n.to}
                      end={n.to === '/'}
                      onClick={() => setMenuAbierto(false)}
                      className={({ isActive }) =>
                        clsx(
                          'block rounded-[9px] px-3 py-2 text-[0.83rem] font-semibold',
                          isActive || (n.to !== '/' && location.pathname.startsWith(n.to)) ? 'bg-navy text-white' : 'bg-navy-50 text-navy',
                        )
                      }
                    >
                      {n.label}
                      <span className="block text-[0.7rem] font-normal opacity-80">{n.descripcion}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </header>

        <main id="contenido" className="mx-auto w-full max-w-[1280px] flex-1 space-y-5 px-4 py-5">
          {mostrarFiltros ? (
            <GlobalFilters
              anioDeshabilitado={esSimulador}
              notaAnio={esSimulador ? 'El simulador usa el año de referencia del modelo (2023).' : undefined}
            />
          ) : null}
          <Outlet />
        </main>

        <footer className="mt-6 border-t border-line bg-white">
          <div className="mx-auto max-w-[1280px] space-y-3 px-4 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="method" icon="spark">Metodología abierta</Badge>
              <Badge tone="info">{COPY.moneda}</Badge>
              <Badge tone="neutral">{COPY.registros}</Badge>
            </div>
            <p className="nota max-w-4xl">{DISCLAIMER_LARGO}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem] text-slate-mock">
              <span>
                <Icon name="doc" className="mr-1 inline h-3.5 w-3.5" />
                Datos: {manifest ? manifest.source.rows.toLocaleString('es-CO') : '—'} registros ·{' '}
                {manifest ? `${manifest.source.years[0]}–${manifest.source.years[manifest.source.years.length - 1]}` : '2015–2023'}
              </span>
              {manifest ? (
                <>
                  <span>Versión de datos: <code className="rounded bg-navy-50 px-1">{manifest.data_version}</code></span>
                  <span>Generado: {formatFechaLarga(manifest.generated_at)}</span>
                  <span>
                    Paridad GAM:{' '}
                    {manifest.model.parity.passed ? (
                      <span className="font-semibold text-green-mock">aprobada (Δ máx {manifest.model.parity.max_abs_diff.toExponential(2)} COP)</span>
                    ) : (
                      <span className="font-semibold text-red-mock">no aprobada</span>
                    )}
                  </span>
                </>
              ) : null}
              <NavLink to="/metodologia" className="enlace font-semibold">Ver metodología y fuentes</NavLink>
              <NavLink to="/cobertura" className="enlace font-semibold">Cobertura y calidad</NavLink>
            </div>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  )
}
