import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/app/AppShell'
import { ErrorState, Loading } from '@/components/ui'

const PanoramaPage = lazy(() => import('@/features/panorama/PanoramaPage'))
const MunicipioIndex = lazy(() => import('@/features/municipio/MunicipioIndex'))
const MunicipioPage = lazy(() => import('@/features/municipio/MunicipioPage'))
const ComparacionPage = lazy(() => import('@/features/comparacion/ComparacionPage'))
const CoberturaPage = lazy(() => import('@/features/cobertura/CoberturaPage'))
const AlertasPage = lazy(() => import('@/features/alertas/AlertasPage'))
const EstimacionesPage = lazy(() => import('@/features/estimaciones/EstimacionesPage'))
const EstudioPage = lazy(() => import('@/features/estudio/EstudioPage'))
const MetodologiaPage = lazy(() => import('@/features/metodologia/MetodologiaPage'))

function PaginaNoEncontrada() {
  return (
    <ErrorState
      title="Esta ruta no existe"
      detail="Usa la navegación superior para volver al panorama territorial."
    />
  )
}

export default function App() {
  return (
    <Suspense fallback={<Loading label="Cargando vista…" />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<PanoramaPage />} />
          <Route path="municipio" element={<MunicipioIndex />} />
          <Route path="municipio/:slug" element={<MunicipioPage />} />
          <Route path="comparar" element={<ComparacionPage />} />
          <Route path="cobertura" element={<CoberturaPage />} />
          <Route path="alertas" element={<AlertasPage />} />
          <Route path="estimaciones" element={<EstimacionesPage />} />
          <Route path="mi-estudio" element={<EstudioPage />} />
          <Route path="metodologia" element={<MetodologiaPage />} />
          <Route path="inicio" element={<Navigate to="/" replace />} />
          <Route path="*" element={<PaginaNoEncontrada />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
