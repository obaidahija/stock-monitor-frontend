import '@testing-library/jest-dom/vitest'

class ResizeObserverMock implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock
import { vi } from 'vitest'

Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
  configurable: true,
  value: () => false,
})
Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
  configurable: true,
  value: () => undefined,
})
Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
  configurable: true,
  value: () => undefined,
})

window.confirm = vi.fn(() => true)

