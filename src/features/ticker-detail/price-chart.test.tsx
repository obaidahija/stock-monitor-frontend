import { StrictMode } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { PriceChart } from './price-chart'

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('StrictMode starts the chart widget once, after its throwaway mount is cleaned up', () => {
  vi.useFakeTimers()
  const append = vi.spyOn(Node.prototype, 'appendChild')
  render(<StrictMode><PriceChart ticker="NVDA" /></StrictMode>)
  act(() => vi.runOnlyPendingTimers())
  const scripts = append.mock.calls.map(([node]) => node).filter(
    (node) => node instanceof HTMLScriptElement && node.src.includes('tradingview.com'),
  ) as HTMLScriptElement[]
  expect(scripts).toHaveLength(1)
  expect(scripts[0].src).toContain('embed-widget-advanced-chart.js')
  expect(scripts[0].isConnected).toBe(true)
})

test('leaving before initialization does not start a detached widget script', () => {
  vi.useFakeTimers()
  const append = vi.spyOn(Node.prototype, 'appendChild')
  const view = render(<PriceChart ticker="NVDA" />)
  view.unmount()
  act(() => vi.runOnlyPendingTimers())
  expect(append.mock.calls.some(([node]) => node instanceof HTMLScriptElement)).toBe(false)
})

test('gives the chart a fixed-height wrapper so it cannot collapse', () => {
  render(<PriceChart ticker="NVDA" />)

  expect(screen.getByRole('img', { name: 'Price chart for NVDA' }).parentElement).toHaveClass(
    'h-[360px]',
    'sm:h-[520px]',
  )
})
