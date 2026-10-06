import { act, cleanup, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import { DigestLivePrice, DigestLiveQuotes } from './live-quotes'

vi.mock('@/lib/api-client', () => ({ apiClient: { post: vi.fn() } }))
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks() })

test('batches quotes on entry, refreshes every 30 seconds, and stops after leaving', async () => {
  vi.useFakeTimers()
  vi.mocked(apiClient.post).mockResolvedValue([{
    ticker: 'NVDA', price: 100, session_price: 102, change_amount: 5, change_pct: 5,
    session_change_amount: 2, session_change_pct: 2, market_session: 'pre_market',
    session_time: '2026-10-06T12:00:00Z', regular_market_time: '2026-10-05T20:00:00Z',
  }])
  const view = renderWithProviders(<DigestLiveQuotes tickers={['NVDA', 'NVDA']}><DigestLivePrice ticker="NVDA" /></DigestLiveQuotes>)
  await act(async () => { await vi.advanceTimersByTimeAsync(10) })
  expect(apiClient.post).toHaveBeenCalledWith('/v1/digest/quotes/refresh', ['NVDA'])
  expect(screen.getByText('$102.00')).toBeInTheDocument()
  expect(screen.getByText('+\u00242.00 · +2.00%')).toBeInTheDocument()
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(apiClient.post).toHaveBeenCalledTimes(2)
  view.unmount()
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(apiClient.post).toHaveBeenCalledTimes(2)
})
