import { StrictMode } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { PriceChart } from './price-chart'

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('StrictMode starts each external widget once, after its throwaway mount is cleaned up', () => {
  vi.useFakeTimers()
  const append = vi.spyOn(Node.prototype, 'appendChild')
  render(<StrictMode><PriceChart ticker="NVDA" /></StrictMode>)
  act(() => vi.runOnlyPendingTimers())
  const scripts = append.mock.calls.map(([node]) => node).filter(
    (node) => node instanceof HTMLScriptElement && node.src.includes('tradingview.com'),
  )
  expect(scripts).toHaveLength(2)
  expect(scripts.every((script) => script.isConnected)).toBe(true)
})

test('leaving before initialization does not start detached widget scripts', () => {
  vi.useFakeTimers()
  const append = vi.spyOn(Node.prototype, 'appendChild')
  const view = render(<PriceChart ticker="NVDA" />)
  view.unmount()
  act(() => vi.runOnlyPendingTimers())
  expect(append.mock.calls.some(([node]) => node instanceof HTMLScriptElement)).toBe(false)
})
