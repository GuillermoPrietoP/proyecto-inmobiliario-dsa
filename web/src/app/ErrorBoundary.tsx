import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from '@/components/ui'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Sin PII ni envío a terceros: solo consola para diagnóstico local.
    console.error('[DSA] Error de interfaz', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <ErrorState
            title="La vista encontró un error"
            detail={
              <>
                <p>{this.state.error.message}</p>
                <p className="nota mt-1">
                  Si el problema persiste, regenera los datos con el pipeline y revisa la versión del contrato en Cobertura.
                </p>
              </>
            }
            onRetry={() => {
              this.setState({ error: null })
              window.location.reload()
            }}
          />
        </div>
      )
    }
    return this.props.children
  }
}
