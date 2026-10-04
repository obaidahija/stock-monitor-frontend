import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getStockPairs, refreshStockPairs } from '@/api/stock-pairs'
import { ApiError } from '@/lib/api-client'
import type { StockPairsOut } from '@/types/api'
import { useRefreshStockPairs, useStockPairs } from './hooks'
import { enhancedReport, savedReport } from './test-fixtures'

vi.mock('@/api/stock-pairs', async (importOriginal) => ({
  // The real pairTicker; only the network calls are replaced.
  ...(await importOriginal<typeof import('@/api/stock-pairs')>()),
  getStockPairs: vi.fn(),
  refreshStockPairs: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(getStockPairs).mockReset()
  vi.mocked(refreshStockPairs).mockReset()
})
afterEach(cleanup)

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

function SavedHarness({ ticker }: { ticker: string }) {
  const query = useStockPairs(ticker)
  return <p>{query.data === undefined ? 'loading' : query.data === null ? 'none' : query.data.ticker}</p>
}

function SearchHarness({ ticker, forceRefresh = false }: { ticker: string; forceRefresh?: boolean }) {
  const search = useRefreshStockPairs(ticker)
  return (
    <>
      <button onClick={() => search.mutate(forceRefresh)}>Search</button>
      {search.isError && <p role="alert">failed</p>}
    </>
  )
}

function withClient(client: QueryClient, ui: React.ReactElement) {
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>
}

test('the saved report is read with GET only under an uppercase ticker key', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(null)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(withClient(client, <SavedHarness ticker="wdc" />))

  expect(await screen.findByText('none')).toBeInTheDocument()
  expect(getStockPairs).toHaveBeenCalledWith('WDC')
  expect(refreshStockPairs).not.toHaveBeenCalled()
  expect(client.getQueryData(['stock-pairs', 'WDC'])).toBeNull()
})

test('a dash-spelled share class reads and saves under the dot spelling', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(null)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(withClient(client, <SavedHarness ticker="brk-b" />))

  expect(await screen.findByText('none')).toBeInTheDocument()
  expect(getStockPairs).toHaveBeenCalledWith('BRK.B')
  expect(client.getQueryData(['stock-pairs', 'BRK.B'])).toBeNull()
})

test('a search completing after navigation is saved under its response ticker', async () => {
  const pending = deferred<StockPairsOut>()
  vi.mocked(refreshStockPairs).mockReturnValue(pending.promise)
  const client = new QueryClient()
  const nvdaSaved = { ...savedReport, ticker: 'NVDA' }
  client.setQueryData(['stock-pairs', 'NVDA'], nvdaSaved)
  const { rerender } = render(withClient(client, <SearchHarness ticker="WDC" />))

  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(refreshStockPairs).toHaveBeenCalledWith('WDC', false))
  rerender(withClient(client, <SearchHarness ticker="NVDA" />))
  await act(async () => pending.resolve(savedReport))

  expect(client.getQueryData(['stock-pairs', 'WDC'])).toEqual(savedReport)
  expect(client.getQueryData(['stock-pairs', 'NVDA'])).toEqual(nvdaSaved)
})

test('a late saved read cannot overwrite the newly refreshed report', async () => {
  const previous = savedReport
  const refreshed = { ...savedReport, cached: false, generated_at: '2026-10-02T09:00:00Z' }
  const read = deferred<StockPairsOut | null>()
  const search = deferred<StockPairsOut>()
  vi.mocked(getStockPairs).mockReturnValue(read.promise)
  vi.mocked(refreshStockPairs).mockReturnValue(search.promise)
  const client = new QueryClient()
  const key = ['stock-pairs', 'WDC']
  client.setQueryData(key, previous)
  const pendingRead = client
    .fetchQuery({ queryKey: key, queryFn: () => getStockPairs('WDC') })
    .catch(() => undefined)
  render(withClient(client, <SearchHarness ticker="WDC" forceRefresh />))

  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(refreshStockPairs).toHaveBeenCalledWith('WDC', true))
  await act(async () => search.resolve(refreshed))
  await waitFor(() => expect(client.getQueryData(key)).toEqual(refreshed))
  await act(async () => {
    read.resolve(previous)
    await pendingRead
  })

  expect(client.getQueryData(key)).toEqual(refreshed)
})

test('a failed search is never retried and never replaces the saved report', async () => {
  vi.mocked(refreshStockPairs).mockRejectedValue(new ApiError(503, 'Prices unavailable'))
  // Even a client that retries mutations by default must not repeat a pair search.
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: 3, retryDelay: 0 } },
  })
  client.setQueryData(['stock-pairs', 'WDC'], savedReport)
  render(withClient(client, <SearchHarness ticker="WDC" forceRefresh />))

  fireEvent.click(screen.getByRole('button', { name: 'Search' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('failed')
  await new Promise((done) => setTimeout(done, 20))
  expect(refreshStockPairs).toHaveBeenCalledTimes(1)
  expect(client.getQueryData(['stock-pairs', 'WDC'])).toEqual(savedReport)
})

test('a late legacy read cannot overwrite a refreshed report with evidence and plots', async () => {
  const refreshed = { ...enhancedReport, cached: false, generated_at: '2026-10-02T09:00:00Z' }
  const read = deferred<StockPairsOut | null>()
  const search = deferred<StockPairsOut>()
  vi.mocked(getStockPairs).mockReturnValue(read.promise)
  vi.mocked(refreshStockPairs).mockReturnValue(search.promise)
  const client = new QueryClient()
  const key = ['stock-pairs', 'WDC']
  client.setQueryData(key, savedReport)
  const pendingRead = client
    .fetchQuery({ queryKey: key, queryFn: () => getStockPairs('WDC') })
    .catch(() => undefined)
  render(withClient(client, <SearchHarness ticker="WDC" forceRefresh />))

  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(refreshStockPairs).toHaveBeenCalledWith('WDC', true))
  await act(async () => search.resolve(refreshed))
  await waitFor(() => expect(client.getQueryData(key)).toEqual(refreshed))
  await act(async () => {
    read.resolve(savedReport)
    await pendingRead
  })

  const cached = client.getQueryData<StockPairsOut>(key)
  expect(cached).toEqual(refreshed)
  expect(cached?.items[0].business_evidence?.status).toBe('source_checked')
  expect(cached?.items[0].six_month?.scatter?.points).toHaveLength(120)
})

test('an enhanced search finishing after navigation is saved only under its own ticker', async () => {
  const pending = deferred<StockPairsOut>()
  vi.mocked(refreshStockPairs).mockReturnValue(pending.promise)
  const client = new QueryClient()
  const nvdaSaved = { ...savedReport, ticker: 'NVDA' }
  client.setQueryData(['stock-pairs', 'NVDA'], nvdaSaved)
  const { rerender } = render(withClient(client, <SearchHarness ticker="WDC" />))

  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(refreshStockPairs).toHaveBeenCalledWith('WDC', false))
  rerender(withClient(client, <SearchHarness ticker="NVDA" />))
  await act(async () => pending.resolve(enhancedReport))

  expect(client.getQueryData(['stock-pairs', 'WDC'])).toEqual(enhancedReport)
  expect(client.getQueryData(['stock-pairs', 'NVDA'])).toEqual(nvdaSaved)
})
