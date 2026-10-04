import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getPairBacktest, runPairBacktest } from '@/api/pair-backtest'
import { ApiError } from '@/lib/api-client'
import type { PairBacktestOut } from '@/types/pair-backtest'
import { usePairBacktest, useRunPairBacktest } from './pair-backtest-hooks'
import { completedBacktest, noSignalBacktest } from './test-fixtures'

vi.mock('@/api/pair-backtest', () => ({
  getPairBacktest: vi.fn(),
  runPairBacktest: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(getPairBacktest).mockReset()
  vi.mocked(runPairBacktest).mockReset()
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

const KEY = ['pair-backtest', 'WDC', 'STX']

function SavedHarness({
  ticker,
  candidate,
  enabled = true,
}: {
  ticker: string
  candidate: string
  enabled?: boolean
}) {
  const query = usePairBacktest(ticker, candidate, enabled)
  const text = query.isError
    ? 'error'
    : query.data === undefined
      ? 'loading'
      : query.data === null
        ? 'none'
        : query.data.run_id
  return <p>{text}</p>
}

function RunHarness({
  ticker,
  candidate,
  forceRefresh = false,
}: {
  ticker: string
  candidate: string
  forceRefresh?: boolean
}) {
  const run = useRunPairBacktest(ticker, candidate)
  return (
    <>
      <button onClick={() => run.mutate(forceRefresh)}>Backtest</button>
      {run.isError && <p role="alert">failed</p>}
    </>
  )
}

function withClient(client: QueryClient, ui: React.ReactElement) {
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>
}

function runAt(generatedAt: string, runId: string): PairBacktestOut {
  return { ...completedBacktest, generated_at: generatedAt, run_id: runId }
}

test('mounting reads the saved backtest with GET only, keyed by both ordered tickers', async () => {
  vi.mocked(getPairBacktest).mockResolvedValue(null)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(withClient(client, <SavedHarness ticker="wdc" candidate=" stx " />))

  expect(await screen.findByText('none')).toBeInTheDocument()
  expect(getPairBacktest).toHaveBeenCalledWith('WDC', 'STX')
  expect(runPairBacktest).not.toHaveBeenCalled()
  expect(client.getQueryData(KEY)).toBeNull()
})

test('share classes key the pair under their dot spellings', async () => {
  vi.mocked(getPairBacktest).mockResolvedValue(null)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(withClient(client, <SavedHarness ticker="brk-b" candidate="bf-b" />))

  expect(await screen.findByText('none')).toBeInTheDocument()
  expect(getPairBacktest).toHaveBeenCalledWith('BRK.B', 'BF.B')
  expect(client.getQueryData(['pair-backtest', 'BRK.B', 'BF.B'])).toBeNull()
})

test('a disabled pair is never read', async () => {
  const client = new QueryClient()

  render(withClient(client, <SavedHarness ticker="WDC" candidate="QQQ" enabled={false} />))
  await new Promise((done) => setTimeout(done, 20))

  expect(screen.getByText('loading')).toBeInTheDocument()
  expect(getPairBacktest).not.toHaveBeenCalled()
})

test('a failed saved read is reported once, never retried and never turned into a run', async () => {
  vi.mocked(getPairBacktest).mockRejectedValue(new ApiError(503, 'Database unavailable'))
  const client = new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 0 } } })

  render(withClient(client, <SavedHarness ticker="WDC" candidate="STX" />))

  expect(await screen.findByText('error')).toBeInTheDocument()
  await new Promise((done) => setTimeout(done, 20))
  expect(getPairBacktest).toHaveBeenCalledTimes(1)
  expect(runPairBacktest).not.toHaveBeenCalled()
})

test('regaining focus or connectivity never starts a backtest', async () => {
  vi.mocked(getPairBacktest).mockResolvedValue(null)
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

  expect(runPairBacktest).not.toHaveBeenCalled()
})

test('a default backtest and a forced refresh post their own request', async () => {
  vi.mocked(runPairBacktest).mockResolvedValue(completedBacktest)
  const client = new QueryClient()
  const { rerender } = render(withClient(client, <RunHarness ticker="wdc" candidate="stx" />))

  fireEvent.click(screen.getByRole('button', { name: 'Backtest' }))
  await waitFor(() => expect(runPairBacktest).toHaveBeenCalledWith('WDC', 'STX', false))
  rerender(withClient(client, <RunHarness ticker="wdc" candidate="stx" forceRefresh />))
  fireEvent.click(screen.getByRole('button', { name: 'Backtest' }))

  await waitFor(() => expect(runPairBacktest).toHaveBeenLastCalledWith('WDC', 'STX', true))
  expect(runPairBacktest).toHaveBeenCalledTimes(2)
  await waitFor(() => expect(client.getQueryData(KEY)).toEqual(completedBacktest))
})

test('a late saved read cannot overwrite the newly finished backtest', async () => {
  const read = deferred<PairBacktestOut | null>()
  const run = deferred<PairBacktestOut>()
  const older = runAt('2026-10-01T13:10:00Z', 'old-run')
  const newer = runAt('2026-10-01T14:00:00Z', 'new-run')
  vi.mocked(getPairBacktest).mockReturnValue(read.promise)
  vi.mocked(runPairBacktest).mockReturnValue(run.promise)
  const client = new QueryClient()
  client.setQueryData(KEY, older)
  const pendingRead = client
    .fetchQuery({ queryKey: KEY, queryFn: () => getPairBacktest('WDC', 'STX') })
    .catch(() => undefined)
  render(withClient(client, <RunHarness ticker="WDC" candidate="STX" forceRefresh />))

  fireEvent.click(screen.getByRole('button', { name: 'Backtest' }))
  await waitFor(() => expect(runPairBacktest).toHaveBeenCalledWith('WDC', 'STX', true))
  await act(async () => run.resolve(newer))
  await waitFor(() => expect(client.getQueryData(KEY)).toEqual(newer))
  await act(async () => {
    read.resolve(older)
    await pendingRead
  })

  expect(client.getQueryData(KEY)).toEqual(newer)
})

test('a backtest finishing after navigation is saved only under its own pair', async () => {
  const pending = deferred<PairBacktestOut>()
  vi.mocked(runPairBacktest).mockReturnValue(pending.promise)
  const client = new QueryClient()
  const otherKey = ['pair-backtest', 'NVDA', 'STX']
  const otherSaved = { ...noSignalBacktest, ticker: 'NVDA', run_id: 'nvda-run' }
  client.setQueryData(otherKey, otherSaved)
  const { rerender } = render(withClient(client, <RunHarness ticker="WDC" candidate="STX" />))

  fireEvent.click(screen.getByRole('button', { name: 'Backtest' }))
  await waitFor(() => expect(runPairBacktest).toHaveBeenCalledWith('WDC', 'STX', false))
  rerender(withClient(client, <RunHarness ticker="NVDA" candidate="STX" />))
  await act(async () => pending.resolve(completedBacktest))

  await waitFor(() => expect(client.getQueryData(KEY)).toEqual(completedBacktest))
  expect(client.getQueryData(otherKey)).toEqual(otherSaved)
  // The reverse pair is a different backtest.
  expect(client.getQueryData(['pair-backtest', 'STX', 'WDC'])).toBeUndefined()
})

test.each([
  ['2026-10-01T13:00:00Z', '2026-10-01T13:01:00Z'],
  ['2026-10-01T15:00:00+02:00', '2026-10-01T13:01:00Z'],
  ['2026-10-01T13:00:00.123001Z', '2026-10-01T13:00:00.123002Z'],
])('a delayed backtest dated %s keeps a newer saved read dated %s', async (oldDate, newDate) => {
  const pending = deferred<PairBacktestOut>()
  const older = runAt(oldDate, 'old-run')
  const newer = runAt(newDate, 'new-run')
  vi.mocked(runPairBacktest).mockReturnValue(pending.promise)
  vi.mocked(getPairBacktest).mockResolvedValue(newer)
  const client = new QueryClient()
  const { rerender } = render(withClient(client, <RunHarness ticker="WDC" candidate="STX" />))

  fireEvent.click(screen.getByRole('button', { name: 'Backtest' }))
  await waitFor(() => expect(client.isMutating()).toBe(1))
  // Return to the pair while the earlier POST response is still in flight.
  rerender(withClient(client, <SavedHarness ticker="WDC" candidate="STX" />))
  await screen.findByText('new-run')
  await act(async () => pending.resolve(older))
  await waitFor(() => expect(client.isMutating()).toBe(0))

  expect(client.getQueryData(KEY)).toEqual(newer)
})

test('a delayed backtest cannot replace a newer refresh after remounting the pair', async () => {
  const pending = deferred<PairBacktestOut>()
  const newer = runAt('2026-10-01T14:01:00Z', 'new-run')
  vi.mocked(runPairBacktest)
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(newer)
  const client = new QueryClient()
  const { rerender } = render(
    withClient(client, <RunHarness key="first" ticker="WDC" candidate="STX" />),
  )

  fireEvent.click(screen.getByRole('button', { name: 'Backtest' }))
  await waitFor(() => expect(client.isMutating()).toBe(1))
  rerender(withClient(client, <RunHarness key="return" ticker="WDC" candidate="STX" forceRefresh />))
  fireEvent.click(screen.getByRole('button', { name: 'Backtest' }))
  await waitFor(() => expect(client.getQueryData(KEY)).toEqual(newer))
  await act(async () => pending.resolve(runAt('2026-10-01T14:00:00Z', 'old-run')))
  await waitFor(() => expect(client.isMutating()).toBe(0))

  expect(client.getQueryData(KEY)).toEqual(newer)
})

test('a failed refresh is never retried and keeps the saved backtest', async () => {
  vi.mocked(runPairBacktest).mockRejectedValue(new ApiError(409, 'Another pair backtest is calculating.'))
  const client = new QueryClient({ defaultOptions: { mutations: { retry: 3, retryDelay: 0 } } })
  client.setQueryData(KEY, completedBacktest)
  render(withClient(client, <RunHarness ticker="WDC" candidate="STX" forceRefresh />))

  fireEvent.click(screen.getByRole('button', { name: 'Backtest' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('failed')
  await new Promise((done) => setTimeout(done, 20))
  expect(runPairBacktest).toHaveBeenCalledTimes(1)
  expect(client.getQueryData(KEY)).toEqual(completedBacktest)
})
