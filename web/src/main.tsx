import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '@/app/App'
import { ErrorBoundary } from '@/app/ErrorBoundary'
import '@/styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: Infinity,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

const root = document.getElementById('root')
if (!root) throw new Error('No se encontró el nodo #root')

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
