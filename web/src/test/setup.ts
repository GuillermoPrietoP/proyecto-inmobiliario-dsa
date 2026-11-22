import '@testing-library/jest-dom/vitest'

// jsdom no implementa matchMedia ni ResizeObserver (los usa Recharts).
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in window)) {
  ;(window as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
}

// jsdom no expone localStorage en este entorno: se provee uno en memoria para
// que el store persistido de "Mi Estudio" funcione igual que en el navegador.
if (!('localStorage' in window) || !window.localStorage) {
  const almacen = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return almacen.size
    },
    clear: () => almacen.clear(),
    getItem: (k: string) => (almacen.has(k) ? (almacen.get(k) as string) : null),
    key: (i: number) => Array.from(almacen.keys())[i] ?? null,
    removeItem: (k: string) => {
      almacen.delete(k)
    },
    setItem: (k: string, v: string) => {
      almacen.set(k, String(v))
    },
  }
  Object.defineProperty(window, 'localStorage', { value: storage, writable: true, configurable: true })
  Object.defineProperty(globalThis, 'localStorage', { value: storage, writable: true, configurable: true })
}
