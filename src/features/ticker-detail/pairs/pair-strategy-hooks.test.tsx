import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { analyzePairStrategy, getPairStrategy } from '@/api/pair-strategy'
import { ApiError } from '@/lib/api-client'
import type { PairStrategyOut } from '@/types/pair-strategy'
import { useAnalyzePairStrategy, usePairStrategy } from './pair-strategy-hooks'
import { supportedStrategy, targetLowStrategy } from './test-fixtures'

vi.mock('@/api/pair-strategy', () => ({
  getPairStrategy: vi.fn(),
  analyzePairStrategy: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(getPairStrategy).mockReset()
  vi.mocked(analyzePairStrategy).mockReset()
})
afterEach(() => {
  cleanup()
  focusManager.setFocused(undefined)
  onlineManager.setOnline(true)
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

const KEY = ['pair-strategy', 'WDC', 'STX']

function SavedHarness({
  ticker,
  candidate,
  enabled = true,
}: {
  ticker: string
  candidate: string
  enabled?: boolean
}) {
  const query = usePairStrategy(ticker, candidate, enabled)
  const text =
    query.isError ? 'error' : query.data === undefined ? 'loading' : query.data === null ? 'none' : query.data.candidate_ticker
  return <p>{text}</p>
}

function AnalyzeHarness({
  ticker,
  candidate,
  forceRefresh = false,
}: {
  ticker: string
  candidate: string
  forceRefresh?: boolean
}) {
  const analyze = useAnalyzePairStrategy(ticker, candidate)
  return (
    <>
      <button onClick={() => analyze.mutate(forceRefresh)}>Analyze</button>
      {analyze.isError && <p role="alert">failed</p>}
    </>
  )
}

function withClient(client: QueryClient, ui: React.ReactElement) {
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>
}

test('mounting reads the saved analysis with GET only, keyed by both ordered tickers', async () => {
  vi.mocked(getPairStrategy).mockResolvedValue(null)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(withClient(client, <SavedHarness ticker="wdc" candidate=" stx " />))

  expect(await screen.findByText('none')).toBeInTheDocument()
  expect(getPairStrategy).toHaveBeenCalledWith('WDC', 'STX')
  expect(analyzePairStrategy).not.toHaveBeenCalled()
  expect(client.getQueryData(KEY)).toBeNull()
})

test('share classes key the pair under their dot spellings', async () => {
  vi.mocked(getPairStrategy).mockResolvedValue(null)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(withClient(client, <SavedHarness ticker="brk-b" candidate="bf-b" />))

  expect(await screen.findByText('none')).toBeInTheDocument()
  expect(getPairStrategy).toHaveBeenCalledWith('BRK.B', 'BF.B')
  expect(client.getQueryData(['pair-strategy', 'BRK.B', 'BF.B'])).toBeNull()
})

test('a disabled pair is never read', async () => {
  const client = new QueryClient()

  render(withClient(client, <SavedHarness ticker="WDC" candidate="QQQ" enabled={false} />))
  await new Promise((done) => setTimeout(done, 20))

  expect(screen.getByText('loading')).toBeInTheDocument()
  expect(getPairStrategy).not.toHaveBeenCalled()
})

test('a failed saved read is reported once, never retried and never turned into an analysis', async () => {
  vi.mocked(getPairStrategy).mockRejectedValue(new ApiError(503, 'Database unavailable'))
  // Even a client that retries by default must not repeat the read on its own.
  const client = new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 0 } } })

  render(withClient(client, <SavedHarness ticker="WDC" candidate="STX" />))

  expect(await screen.findByText('error')).toBeInTheDocument()
  await new Promise((done) => setTimeout(done, 20))
  expect(getPairStrategy).toHaveBeenCalledTimes(1)
  expect(analyzePairStrategy).not.toHaveBeenCalled()
})

test('regaining focus or connectivity never starts an analysis', async () => {
  vi.mocked(getPairStrategy).mockResolvedValue(null)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
  render(withClient(client, <SavedHarness ticker="WDC" candidate="STX" />))
  await screen.findByText('none')

  act(() => {
    focusManager.setFocused(false)
    focusManager.setFocused(true)
    onlineManager.setOnline(false)
    onlineManager.setOnline(true)
  })
  await new Promise((done) => setTimeout(done, 20))

  expect(analyzePairStrategy).not.toHaveBeenCalled()
})

test('a default analysis and a forced refresh post their own request', async () => {
  vi.mocked(analyzePairStrategy).mockResolvedValue(supportedStrategy)
  const client = new QueryClient()
  const { rerender } = render(withClient(client, <AnalyzeHarness ticker="wdc" candidate="stx" />))

  fireEvent.click(screen.getByRole('button', { name: 'Analyze' }))
  await waitFor(() => expect(analyzePairStrategy).toHaveBeenCalledWith('WDC', 'STX', false))
  rerender(withClient(client, <AnalyzeHarness ticker="wdc" candidate="stx" forceRefresh />))
  fireEvent.click(screen.getByRole('button', { name: 'Analyze' }))

  await waitFor(() => expect(analyzePairStrategy).toHaveBeenLastCalledWith('WDC', 'STX', true))
  expect(analyzePairStrategy).toHaveBeenCalledTimes(2)
  await waitFor(() => expect(client.getQueryData(KEY)).toEqual(supportedStrategy))
})

test('a late saved read cannot overwrite the newly refreshed analysis', async () => {
  const read = deferred<PairStrategyOut | null>()
  const analysis = deferred<PairStrategyOut>()
  vi.mocked(getPairStrategy).mockReturnValue(read.promise)
  vi.mocked(analyzePairStrategy).mockReturnValue(analysis.promise)
  const client = new QueryClient()
  client.setQueryData(KEY, supportedStrategy)
  const pendingRead = client
    .fetchQuery({ queryKey: KEY, queryFn: () => getPairStrategy('WDC', 'STX') })
    .catch(() => undefined)
  render(withClient(client, <AnalyzeHarness ticker="WDC" candidate="STX" forceRefresh />))

  fireEvent.click(screen.getByRole('button', { name: 'Analyze' }))
  await waitFor(() => expect(analyzePairStrategy).toHaveBeenCalledWith('WDC', 'STX', true))
  await act(async () => analysis.resolve(targetLowStrategy))
  await waitFor(() => expect(client.getQueryData(KEY)).toEqual(targetLowStrategy))
  await act(async () => {
    read.resolve(supportedStrategy)
    await pendingRead
  })

  expect(client.getQueryData(KEY)).toEqual(targetLowStrategy)
})

test('an analysis finishing after navigation is saved only under its own pair', async () => {
  const pending = deferred<PairStrategyOut>()
  vi.mocked(analyzePairStrategy).mockReturnValue(pending.promise)
  const client = new QueryClient()
  const otherKey = ['pair-strategy', 'NVDA', 'STX']
  const otherSaved = { ...supportedStrategy, ticker: 'NVDA', report_id: 99 }
  client.setQueryData(otherKey, otherSaved)
  const { rerender } = render(withClient(client, <AnalyzeHarness ticker="WDC" candidate="STX" />))

  fireEvent.click(screen.getByRole('button', { name: 'Analyze' }))
  await waitFor(() => expect(analyzePairStrategy).toHaveBeenCalledWith('WDC', 'STX', false))
  rerender(withClient(client, <AnalyzeHarness ticker="NVDA" candidate="STX" />))
  await act(async () => pending.resolve(supportedStrategy))

  await waitFor(() => expect(client.getQueryData(KEY)).toEqual(supportedStrategy))
  expect(client.getQueryData(otherKey)).toEqual(otherSaved)
  // The reverse pair is a different analysis.
  expect(client.getQueryData(['pair-strategy', 'STX', 'WDC'])).toBeUndefined()
})

test.each([
  ['2026-10-01T13:00:00Z', '2026-10-01T13:01:00Z'],
  ['2026-10-01T15:00:00+02:00', '2026-10-01T13:01:00Z'],
  ['2026-10-01T13:00:00.123001Z', '2026-10-01T13:00:00.123002Z'],
])('a delayed analysis dated %s keeps a newer saved read dated %s', async (oldDate, newDate) => {
  const pending = deferred<PairStrategyOut>()
  const older = { ...supportedStrategy, generated_at: oldDate }
  const newer = { ...targetLowStrategy, generated_at: newDate }
  vi.mocked(analyzePairStrategy).mockReturnValue(pending.promise)
  vi.mocked(getPairStrategy).mockResolvedValue(newer)
  const client = new QueryClient()
  const { rerender } = render(withClient(client, <AnalyzeHarness ticker="WDC" candidate="STX" />))

  fireEvent.click(screen.getByRole('button', { name: 'Analyze' }))
  await waitFor(() => expect(client.isMutating()).toBe(1))
  // Return to the pair while the earlier POST response is still in flight.
  rerender(withClient(client, <SavedHarness ticker="WDC" candidate="STX" />))
  await screen.findByText('STX')
  expect(client.getQueryData(KEY)).toEqual(newer)
  await act(async () => pending.resolve(older))
  await waitFor(() => expect(client.isMutating()).toBe(0))

  expect(client.getQueryData(KEY)).toEqual(newer)
})

test('a delayed analysis cannot replace a newer refresh after remounting the pair', async () => {
  const pending = deferred<PairStrategyOut>()
  const newer = { ...targetLowStrategy, generated_at: '2026-10-01T13:01:00Z' }
  vi.mocked(analyzePairStrategy)
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(newer)
  const client = new QueryClient()
  const { rerender } = render(
    withClient(client, <AnalyzeHarness key="first" ticker="WDC" candidate="STX" />),
  )

  fireEvent.click(screen.getByRole('button', { name: 'Analyze' }))
  await waitFor(() => expect(client.isMutating()).toBe(1))
  rerender(withClient(client, <AnalyzeHarness key="return" ticker="WDC" candidate="STX" forceRefresh />))
  fireEvent.click(screen.getByRole('button', { name: 'Analyze' }))
  await waitFor(() => expect(client.getQueryData(KEY)).toEqual(newer))
  await act(async () => pending.resolve(supportedStrategy))
  await waitFor(() => expect(client.isMutating()).toBe(0))

  expect(client.getQueryData(KEY)).toEqual(newer)
})

test('a failed refresh is never retried and keeps the saved analysis', async () => {
  vi.mocked(analyzePairStrategy).mockRejectedValue(new ApiError(503, 'Prices unavailable'))
  const client = new QueryClient({ defaultOptions: { mutations: { retry: 3, retryDelay: 0 } } })
  client.setQueryData(KEY, supportedStrategy)
  render(withClient(client, <AnalyzeHarness ticker="WDC" candidate="STX" forceRefresh />))

  fireEvent.click(screen.getByRole('button', { name: 'Analyze' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('failed')
  await new Promise((done) => setTimeout(done, 20))
  expect(analyzePairStrategy).toHaveBeenCalledTimes(1)
  expect(client.getQueryData(KEY)).toEqual(supportedStrategy)
})
