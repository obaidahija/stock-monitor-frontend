import { act, cleanup, screen, within } from '@testing-library/react'
import { focusManager, onlineManager, Query, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import type { QuoteOut } from '@/types/api'
import { DigestLivePrice, DigestLiveQuotes } from './live-quotes'

vi.mock('@/lib/api-client', () => ({ apiClient: { post: vi.fn() } }))
class ViewportObserver implements IntersectionObserver {
  static instances: ViewportObserver[] = []
  readonly root = null
  readonly rootMargin: string
  readonly scrollMargin = '0px'
  readonly thresholds = [0]
  readonly targets = new Set<Element>()
  readonly callback: IntersectionObserverCallback
  observe = vi.fn((target: Element) => { this.targets.add(target) })
  unobserve = vi.fn((target: Element) => { this.targets.delete(target) })
  disconnect = vi.fn(() => { this.targets.clear() })
  takeRecords = () => []

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback
    this.rootMargin = options?.rootMargin ?? '0px'
    ViewportObserver.instances.push(this)
  }

  emit(entries: { target: Element; isIntersecting: boolean }[]) {
    this.callback(entries.map(({ target, isIntersecting }) => ({
      target, isIntersecting, intersectionRatio: isIntersecting ? 1 : 0,
      time: 0, boundingClientRect: target.getBoundingClientRect(),
      intersectionRect: target.getBoundingClientRect(), rootBounds: null,
    })), this)
  }
}

function quote(ticker: string): QuoteOut {
  return {
    ticker, price: 100, session_price: 102, change_amount: 5, change_pct: 5,
    session_change_amount: 2, session_change_pct: 2, market_session: 'pre_market',
    session_time: '2026-10-06T12:00:00Z', regular_market_time: '2026-10-05T20:00:00Z',
  }
}

function price(id: string) {
  return screen.getByTestId(id).firstElementChild!
}

function intersect(entries: { target: Element; isIntersecting: boolean }[]) {
  act(() => {
    for (const observer of ViewportObserver.instances) {
      const observed = entries.filter((entry) => observer.targets.has(entry.target))
      if (observed.length > 0) observer.emit(observed)
    }
  })
}

async function flushQueries(ms = 250) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
}

beforeEach(() => {
  vi.useFakeTimers()
  ViewportObserver.instances = []
  vi.stubGlobal('IntersectionObserver', ViewportObserver)
  vi.mocked(apiClient.post).mockReset().mockImplementation(async (_path, tickers) => (tickers as string[]).map(quote))
})

afterEach(() => {
  cleanup()
  focusManager.setFocused(undefined)
  onlineManager.setOnline(true)
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

test('requests only mounted prices entering the viewport and deduplicates their allowed symbols', async () => {
  renderWithProviders(<DigestLiveQuotes tickers={['NVDA', 'NVDA', 'AAPL', 'OFFSCREEN', 'NOTMOUNTED']}>
    <div data-testid="nvda"><DigestLivePrice ticker="NVDA" /></div>
    <div data-testid="duplicate"><DigestLivePrice ticker="NVDA" compact /></div>
    <div data-testid="aapl"><DigestLivePrice ticker="AAPL" /></div>
    <div data-testid="offscreen"><DigestLivePrice ticker="OFFSCREEN" /></div>
    <div data-testid="unallowed"><DigestLivePrice ticker="MSFT" /></div>
  </DigestLiveQuotes>)
  await flushQueries()
  expect(apiClient.post).not.toHaveBeenCalled()

  intersect(['nvda', 'duplicate', 'aapl', 'unallowed'].map((id) => ({ target: price(id), isIntersecting: true })))
  await flushQueries()
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/v1/digest/quotes/refresh', ['AAPL', 'NVDA'])
  expect(within(screen.getByTestId('nvda')).getByText('$102.00')).toBeInTheDocument()
  expect(within(screen.getByTestId('duplicate')).getByText('+\u00242.00 · +2.00%')).toBeInTheDocument()
  expect(ViewportObserver.instances.some((observer) => observer.rootMargin === '150px')).toBe(true)
})

test('keeps a duplicate visible symbol until its last price scrolls out and stops with no visible prices', async () => {
  renderWithProviders(<DigestLiveQuotes tickers={['NVDA', 'AAPL']}>
    <div data-testid="nvda"><DigestLivePrice ticker="NVDA" /></div>
    <div data-testid="duplicate"><DigestLivePrice ticker="NVDA" compact /></div>
    <div data-testid="aapl"><DigestLivePrice ticker="AAPL" /></div>
  </DigestLiveQuotes>)
  intersect(['nvda', 'duplicate', 'aapl'].map((id) => ({ target: price(id), isIntersecting: true })))
  await flushQueries()
  intersect([{ target: price('nvda'), isIntersecting: false }])
  await flushQueries(30_000)
  expect(apiClient.post).toHaveBeenCalledTimes(2)
  expect(apiClient.post).toHaveBeenLastCalledWith('/v1/digest/quotes/refresh', ['AAPL', 'NVDA'])

  intersect([{ target: price('duplicate'), isIntersecting: false }])
  await flushQueries()
  expect(apiClient.post).toHaveBeenCalledTimes(2)
  await flushQueries(30_000)
  expect(apiClient.post).toHaveBeenLastCalledWith('/v1/digest/quotes/refresh', ['AAPL'])
  const callsBeforeLeaving = vi.mocked(apiClient.post).mock.calls.length
  intersect([{ target: price('aapl'), isIntersecting: false }])
  await flushQueries(60_000)
  expect(apiClient.post).toHaveBeenCalledTimes(callsBeforeLeaving)
})

test('removes unmounted prices from the batch and disconnects the observer and interval on provider unmount', async () => {
  const view = renderWithProviders(<DigestLiveQuotes tickers={['NVDA', 'AAPL']}>
    <div key="nvda" data-testid="nvda"><DigestLivePrice ticker="NVDA" /></div>
    <div key="aapl" data-testid="aapl"><DigestLivePrice ticker="AAPL" /></div>
  </DigestLiveQuotes>)
  const nvda = price('nvda')
  intersect([{ target: nvda, isIntersecting: true }, { target: price('aapl'), isIntersecting: true }])
  await flushQueries()

  view.rerender(<DigestLiveQuotes tickers={['NVDA', 'AAPL']}>
    <div key="aapl" data-testid="aapl"><DigestLivePrice ticker="AAPL" /></div>
  </DigestLiveQuotes>)
  await flushQueries()
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  await flushQueries(30_000)
  expect(apiClient.post).toHaveBeenLastCalledWith('/v1/digest/quotes/refresh', ['AAPL'])
  expect(ViewportObserver.instances.some((observer) => observer.unobserve.mock.calls.some(([target]) => target === nvda))).toBe(true)
  const callsBeforeUnmount = vi.mocked(apiClient.post).mock.calls.length
  view.unmount()
  await flushQueries(60_000)
  expect(apiClient.post).toHaveBeenCalledTimes(callsBeforeUnmount)
  expect(ViewportObserver.instances.every((observer) => observer.disconnect.mock.calls.length > 0)).toBe(true)
})

test('quotes only mounted allowed prices when IntersectionObserver is unavailable', async () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  const view = renderWithProviders(<DigestLiveQuotes tickers={['nvda', 'NVDA', 'AAPL', 'NOTMOUNTED']}>
    <DigestLivePrice ticker="nvda" />
    <DigestLivePrice ticker="NVDA" compact />
    <DigestLivePrice ticker="AAPL" />
    <DigestLivePrice ticker="MSFT" />
  </DigestLiveQuotes>)
  await flushQueries()
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/v1/digest/quotes/refresh', ['AAPL', 'NVDA'])
  view.rerender(<DigestLiveQuotes tickers={['NVDA', 'AAPL']}><span>No prices mounted</span></DigestLiveQuotes>)
  await flushQueries(60_000)
  expect(apiClient.post).toHaveBeenCalledTimes(1)
})

test('a failed newly visible symbol does not mark another fresh price as failed', async () => {
  vi.mocked(apiClient.post).mockResolvedValueOnce([quote('NVDA')]).mockRejectedValue(new Error('Offline'))
  renderWithProviders(<DigestLiveQuotes tickers={['NVDA', 'AAPL']}>
    <div data-testid="nvda"><DigestLivePrice ticker="NVDA" /></div>
    <div data-testid="aapl"><DigestLivePrice ticker="AAPL" /></div>
  </DigestLiveQuotes>)
  expect(within(screen.getByTestId('aapl')).getByText('Loading price…')).toBeInTheDocument()
  intersect([{ target: price('nvda'), isIntersecting: true }])
  await flushQueries()
  expect(within(screen.getByTestId('nvda')).getByText('$102.00')).toBeInTheDocument()

  intersect([{ target: price('aapl'), isIntersecting: true }])
  await flushQueries()
  expect(within(screen.getByTestId('nvda')).getByText('$102.00')).toBeInTheDocument()
  expect(within(screen.getByTestId('nvda')).queryByText(/Refresh failed/)).not.toBeInTheDocument()
  expect(within(screen.getByTestId('aapl')).getByText('Price unavailable')).toBeInTheDocument()
})

test('returning to an earlier viewport retains its newer price and refresh failures keep it visible', async () => {
  vi.mocked(apiClient.post)
    .mockResolvedValueOnce([{ ...quote('AAPL'), session_price: 100, session_time: '2026-10-06T12:00:00Z' }])
    .mockResolvedValueOnce([{ ...quote('AAPL'), session_price: 102, session_time: '2026-10-06T12:01:00Z' }])
    .mockResolvedValueOnce([quote('MSFT')])
    .mockRejectedValue(new Error('Offline'))
  renderWithProviders(<DigestLiveQuotes tickers={['AAPL', 'MSFT']}>
    <div data-testid="aapl"><DigestLivePrice ticker="AAPL" /></div>
    <div data-testid="msft"><DigestLivePrice ticker="MSFT" /></div>
  </DigestLiveQuotes>)
  intersect([{ target: price('aapl'), isIntersecting: true }])
  await flushQueries()
  expect(within(screen.getByTestId('aapl')).getByText('$100.00')).toBeInTheDocument()
  await flushQueries(30_000)
  await flushQueries(1) // Deliver QueryClient's deferred cache notification at the polling boundary.
  expect(within(screen.getByTestId('aapl')).getByText('$102.00')).toBeInTheDocument()
  intersect([{ target: price('msft'), isIntersecting: true }])
  await flushQueries()
  expect(within(screen.getByTestId('aapl')).getByText('$102.00')).toBeInTheDocument()

  intersect([{ target: price('msft'), isIntersecting: false }])
  await flushQueries()

  expect(within(screen.getByTestId('aapl')).getByText('$102.00')).toBeInTheDocument()
  expect(within(screen.getByTestId('aapl')).queryByText('$100.00')).not.toBeInTheDocument()
  expect(apiClient.post).toHaveBeenCalledTimes(3)
  await flushQueries(30_000)
  expect(within(screen.getByTestId('aapl')).getByText(/Refresh failed/)).toBeInTheDocument()
})

test('refreshes visible quotes every 30 seconds and suspends polling in the background', async () => {
  const view = renderWithProviders(<DigestLiveQuotes tickers={['NVDA']}>
    <div data-testid="nvda"><DigestLivePrice ticker="NVDA" /></div>
  </DigestLiveQuotes>)
  intersect([{ target: price('nvda'), isIntersecting: true }])
  await flushQueries()
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  await flushQueries(30_000)
  expect(apiClient.post).toHaveBeenCalledTimes(2)
  act(() => focusManager.setFocused(false))
  await flushQueries(60_000)
  expect(apiClient.post).toHaveBeenCalledTimes(2)
  view.unmount()
  await flushQueries(60_000)
  expect(apiClient.post).toHaveBeenCalledTimes(2)
})

test('registers the live price again after Strict Mode effect cleanup and releases the replacement observer', async () => {
  const view = renderWithProviders(<StrictMode>
    <DigestLiveQuotes tickers={['NVDA']}>
      <div data-testid="nvda"><DigestLivePrice ticker="NVDA" /></div>
    </DigestLiveQuotes>
  </StrictMode>)
  await flushQueries()
  expect(apiClient.post).not.toHaveBeenCalled()
  intersect([{ target: price('nvda'), isIntersecting: true }])
  await flushQueries()
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/v1/digest/quotes/refresh', ['NVDA'])
  expect(screen.getByText('$102.00')).toBeInTheDocument()
  view.unmount()
  await flushQueries(60_000)
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  expect(ViewportObserver.instances.every((observer) => observer.disconnect.mock.calls.length > 0)).toBe(true)
})

test('coalesces viewport changes for 200 ms before requesting a shared quote batch', async () => {
  renderWithProviders(<DigestLiveQuotes tickers={['AAPL', 'MSFT']}>
    <div data-testid="aapl"><DigestLivePrice ticker="AAPL" /></div>
    <div data-testid="msft"><DigestLivePrice ticker="MSFT" /></div>
  </DigestLiveQuotes>)
  intersect([{ target: price('aapl'), isIntersecting: true }])
  await flushQueries(100)
  intersect([{ target: price('msft'), isIntersecting: true }])
  await flushQueries(199)
  expect(apiClient.post).not.toHaveBeenCalled()
  await flushQueries(11)
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/v1/digest/quotes/refresh', ['AAPL', 'MSFT'])
  expect(within(screen.getByTestId('msft')).getByText('$102.00')).toBeVisible()
})

test('reuses fresh symbols across overlapping batches and viewport returns', async () => {
  renderWithProviders(<DigestLiveQuotes tickers={['AAPL', 'MSFT']}>
    <div data-testid="aapl"><DigestLivePrice ticker="AAPL" /></div>
    <div data-testid="msft"><DigestLivePrice ticker="MSFT" /></div>
  </DigestLiveQuotes>)
  intersect([{ target: price('aapl'), isIntersecting: true }])
  await flushQueries(250)
  intersect([{ target: price('msft'), isIntersecting: true }])
  await flushQueries(250)
  expect(apiClient.post).toHaveBeenCalledTimes(2)
  expect(apiClient.post).toHaveBeenLastCalledWith('/v1/digest/quotes/refresh', ['MSFT'])
  intersect([{ target: price('aapl'), isIntersecting: false }, { target: price('msft'), isIntersecting: false }])
  await flushQueries(250)
  intersect([{ target: price('aapl'), isIntersecting: true }])
  await flushQueries(250)
  expect(apiClient.post).toHaveBeenCalledTimes(2)
  expect(within(screen.getByTestId('aapl')).getByText('$102.00')).toBeVisible()
})

test('shows per-symbol cached fallback without marking a successful quote as failed', async () => {
  vi.mocked(apiClient.post).mockResolvedValue([
    { ...quote('AAPL'), refresh_status: 'cached', refresh_error: 'Provider unavailable' },
    { ...quote('MSFT'), refresh_status: 'fresh', refresh_error: null },
  ])
  renderWithProviders(<DigestLiveQuotes tickers={['AAPL', 'MSFT']}>
    <div data-testid="aapl"><DigestLivePrice ticker="AAPL" /></div>
    <div data-testid="msft"><DigestLivePrice ticker="MSFT" /></div>
  </DigestLiveQuotes>)
  intersect(['aapl', 'msft'].map((id) => ({ target: price(id), isIntersecting: true })))
  await flushQueries(250)
  expect(within(screen.getByTestId('aapl')).getByText('$102.00')).toBeVisible()
  expect(within(screen.getByTestId('aapl')).getByText(/Cached quote.*Refresh failed/)).toBeVisible()
  expect(within(screen.getByTestId('msft')).queryByText(/Cached quote|Refresh failed/)).not.toBeInTheDocument()
})

test('does not replace a newer displayed price with an older server fallback', async () => {
  vi.mocked(apiClient.post)
    .mockResolvedValueOnce([{ ...quote('AAPL'), session_price: 105, session_time: '2026-10-06T12:01:00Z' }])
    .mockResolvedValue([{ ...quote('AAPL'), session_price: 100, session_time: '2026-10-06T12:00:00Z',
      refresh_status: 'cached', refresh_error: 'Provider unavailable' }])
  renderWithProviders(<DigestLiveQuotes tickers={['AAPL']}>
    <div data-testid="aapl"><DigestLivePrice ticker="AAPL" /></div>
  </DigestLiveQuotes>)
  intersect([{ target: price('aapl'), isIntersecting: true }])
  await flushQueries(250)
  await flushQueries(30_000)
  await flushQueries(1)
  expect(within(screen.getByTestId('aapl')).getByText('$105.00')).toBeVisible()
  expect(within(screen.getByTestId('aapl')).queryByText('$100.00')).not.toBeInTheDocument()
  expect(within(screen.getByTestId('aapl')).getByText(/Cached quote/)).toBeVisible()
})

test('a slow request and a newly visible symbol do not duplicate or discard each other', async () => {
  let finishFirst!: (quotes: QuoteOut[]) => void
  vi.mocked(apiClient.post)
    .mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve as typeof finishFirst }))
    .mockResolvedValue([quote('MSFT')])
  renderWithProviders(<DigestLiveQuotes tickers={['AAPL', 'MSFT']}>
    <div data-testid="aapl"><DigestLivePrice ticker="AAPL" /></div>
    <div data-testid="msft"><DigestLivePrice ticker="MSFT" /></div>
  </DigestLiveQuotes>)
  intersect([{ target: price('aapl'), isIntersecting: true }])
  await flushQueries(250)
  intersect([{ target: price('msft'), isIntersecting: true }])
  await flushQueries(250)
  expect(apiClient.post).toHaveBeenLastCalledWith('/v1/digest/quotes/refresh', ['MSFT'])
  expect(within(screen.getByTestId('msft')).getByText('$102.00')).toBeVisible()
  await act(async () => finishFirst([{ ...quote('AAPL'), session_price: 104 }]))
  await flushQueries(1)
  expect(within(screen.getByTestId('aapl')).getByText('$104.00')).toBeVisible()
  expect(within(screen.getByTestId('msft')).getByText('$102.00')).toBeVisible()
})

test('newly visible fresh quotes do not postpone an existing symbols thirty-second refresh', async () => {
  renderWithProviders(<DigestLiveQuotes tickers={['AAPL', 'MSFT']}>
    <div data-testid="aapl"><DigestLivePrice ticker="AAPL" /></div>
    <div data-testid="msft"><DigestLivePrice ticker="MSFT" /></div>
  </DigestLiveQuotes>)
  intersect([{ target: price('aapl'), isIntersecting: true }])
  await flushQueries()
  await flushQueries(29_000)
  intersect([{ target: price('msft'), isIntersecting: true }])
  await flushQueries()
  expect(apiClient.post).toHaveBeenLastCalledWith('/v1/digest/quotes/refresh', ['MSFT'])
  await flushQueries(750)
  expect(apiClient.post).toHaveBeenCalledTimes(3)
  expect(apiClient.post).toHaveBeenLastCalledWith('/v1/digest/quotes/refresh', ['AAPL'])
})

test('visible symbols wait for focus before starting a request', async () => {
  act(() => focusManager.setFocused(false))
  renderWithProviders(<DigestLiveQuotes tickers={['AAPL']}>
    <div data-testid="aapl"><DigestLivePrice ticker="AAPL" /></div>
  </DigestLiveQuotes>)
  intersect([{ target: price('aapl'), isIntersecting: true }])
  await flushQueries(60_000)
  expect(apiClient.post).not.toHaveBeenCalled()
  act(() => focusManager.setFocused(true))
  await flushQueries()
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/v1/digest/quotes/refresh', ['AAPL'])
  expect(within(screen.getByTestId('aapl')).getByText('$102.00')).toBeVisible()
})

test('remounting under the same query client reuses a fresh quote and retains it through a later outage', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const quotes = <DigestLiveQuotes tickers={['AAPL']}>
    <div data-testid="aapl"><DigestLivePrice ticker="AAPL" /></div>
  </DigestLiveQuotes>
  const view = renderWithProviders(<QueryClientProvider client={client}>{quotes}</QueryClientProvider>)
  intersect([{ target: price('aapl'), isIntersecting: true }])
  await flushQueries()
  expect(within(screen.getByTestId('aapl')).getByText('$102.00')).toBeVisible()
  view.rerender(<QueryClientProvider client={client}><span>Another tab</span></QueryClientProvider>)
  vi.mocked(apiClient.post).mockRejectedValue(new Error('Offline'))
  view.rerender(<QueryClientProvider client={client}>{quotes}</QueryClientProvider>)
  expect(within(screen.getByTestId('aapl')).getByText('$102.00')).toBeVisible()
  intersect([{ target: price('aapl'), isIntersecting: true }])
  await flushQueries()
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  await flushQueries(30_000)
  expect(within(screen.getByTestId('aapl')).getByText('$102.00')).toBeVisible()
  expect(within(screen.getByTestId('aapl')).getByText(/Cached quote.*Refresh failed/)).toBeVisible()
})

test('offline quotes do not spin a paused query and resume once connectivity returns', async () => {
  onlineManager.setOnline(false)
  const fetches = vi.spyOn(Query.prototype, 'fetch')
  renderWithProviders(<DigestLiveQuotes tickers={['AAPL']}>
    <div data-testid="aapl"><DigestLivePrice ticker="AAPL" /></div>
  </DigestLiveQuotes>)
  intersect([{ target: price('aapl'), isIntersecting: true }])
  await flushQueries()
  await flushQueries(1_000)
  expect(apiClient.post).not.toHaveBeenCalled()
  // The previous 1 ms interval repeatedly called a paused fetch without any I/O.
  expect(fetches.mock.calls.length).toBeLessThanOrEqual(2)
  onlineManager.setOnline(true)
  await flushQueries()
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/v1/digest/quotes/refresh', ['AAPL'])
  expect(within(screen.getByTestId('aapl')).getByText('$102.00')).toBeVisible()
})
