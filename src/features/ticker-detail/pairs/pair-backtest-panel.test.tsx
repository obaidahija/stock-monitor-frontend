import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getPairBacktest, runPairBacktest } from '@/api/pair-backtest'
import { ApiError } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import type { PairBacktestOut } from '@/types/pair-backtest'
import { PairBacktestPanel } from './pair-backtest-panel'
import { completedBacktest, insufficientBacktest, noSignalBacktest } from './test-fixtures'

// jsdom has no layout: give charts a fixed size and keep everything else real.
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>()
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: ReactNode }) =>
      isValidElement(children)
        ? cloneElement(children as ReactElement<{ width: number; height: number }>, {
            width: 560,
            height: 320,
          })
        : null,
  }
})

vi.mock('@/api/pair-backtest', () => ({
  getPairBacktest: vi.fn(),
  runPairBacktest: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(getPairBacktest).mockReset()
  vi.mocked(runPairBacktest).mockReset()
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

function renderPanel(disabledReason?: string) {
  return renderWithProviders(
    <PairBacktestPanel ticker="WDC" candidateTicker="STX" disabledReason={disabledReason} />,
  )
}

function panel() {
  return screen.getByRole('region', { name: 'Historical backtest: WDC against STX' })
}

test('without a saved backtest the panel offers one explicit run', async () => {
  vi.mocked(getPairBacktest).mockResolvedValue(null)
  vi.mocked(runPairBacktest).mockReturnValue(deferred<PairBacktestOut>().promise)
  const user = userEvent.setup()
  renderPanel()

  const run = await screen.findByRole('button', { name: 'Backtest pair' })
  expect(getPairBacktest).toHaveBeenCalledWith('WDC', 'STX')
  expect(runPairBacktest).not.toHaveBeenCalled()
  expect(panel()).toHaveTextContent('Historical performance with assumed costs')

  await user.click(run)

  expect(runPairBacktest).toHaveBeenCalledTimes(1)
  expect(runPairBacktest).toHaveBeenCalledWith('WDC', 'STX', false)
  expect(screen.getByRole('button', { name: /Running backtest/ })).toBeDisabled()
  expect(within(panel()).getByRole('status')).toHaveTextContent('Running backtest…')
})

test('loading the saved backtest is not the same as having none', async () => {
  const read = deferred<PairBacktestOut | null>()
  vi.mocked(getPairBacktest).mockReturnValue(read.promise)
  renderPanel()

  expect(await screen.findByText('Loading saved backtest…')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Backtest pair' })).not.toBeInTheDocument()

  read.resolve(null)

  expect(await screen.findByRole('button', { name: 'Backtest pair' })).toBeEnabled()
  expect(screen.queryByText('Loading saved backtest…')).not.toBeInTheDocument()
})

test('a saved backtest shows its dates, period and a refresh button', async () => {
  vi.mocked(getPairBacktest).mockResolvedValue(completedBacktest)
  renderPanel()

  expect(await screen.findByRole('button', { name: 'Refresh backtest' })).toBeEnabled()
  const ran = screen.getByText(/^Backtested/)
  expect(ran.querySelector('time')).toHaveAttribute('datetime', completedBacktest.generated_at)
  const period = screen.getByText(/^Evaluated/)
  expect(period).toHaveTextContent('252 sessions')
  expect(period.querySelector('time')).toHaveAttribute(
    'datetime',
    completedBacktest.calculation.evaluation_start,
  )
  const through = screen.getByText(/^Prices through/)
  expect(through.querySelector('time')).toHaveAttribute('datetime', '2026-09-30')
  expect(screen.queryByRole('button', { name: 'Backtest pair' })).not.toBeInTheDocument()
  expect(runPairBacktest).not.toHaveBeenCalled()
})

test.each([
  [completedBacktest, '2 historical signals'],
  [noSignalBacktest, 'No qualifying historical signals'],
  [insufficientBacktest, 'Insufficient history'],
])('the status describes the replay without judging it: %#', async (report, label) => {
  vi.mocked(getPairBacktest).mockResolvedValue(report)
  renderPanel()

  expect(await within(await screen.findByRole('region')).findByText(label)).toBeInTheDocument()
  expect(panel()).not.toHaveTextContent(/profitable|guaranteed|buy signal/i)
})

test('a failed saved read offers to retry loading, never an automatic run', async () => {
  vi.mocked(getPairBacktest).mockRejectedValueOnce(new ApiError(503, 'Database unavailable'))
  vi.mocked(getPairBacktest).mockResolvedValueOnce(null)
  const user = userEvent.setup()
  renderPanel()

  expect(await screen.findByText(/saved backtest could not be loaded/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Backtest pair' })).not.toBeInTheDocument()
  expect(runPairBacktest).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'Retry loading' }))

  expect(await screen.findByRole('button', { name: 'Backtest pair' })).toBeEnabled()
  expect(getPairBacktest).toHaveBeenCalledTimes(2)
  expect(runPairBacktest).not.toHaveBeenCalled()
})

test('an unsupported security disables the action and says why', async () => {
  renderPanel('QQQ is listed as ETF, not a common stock.')

  expect(screen.getByRole('button', { name: 'Backtest pair' })).toBeDisabled()
  expect(screen.getByText(/QQQ is listed as ETF, not a common stock\./)).toBeInTheDocument()
  await new Promise((done) => setTimeout(done, 20))
  expect(getPairBacktest).not.toHaveBeenCalled()
  expect(runPairBacktest).not.toHaveBeenCalled()
})

test('a running refresh keeps the saved backtest visible', async () => {
  vi.mocked(getPairBacktest).mockResolvedValue(completedBacktest)
  vi.mocked(runPairBacktest).mockReturnValue(deferred<PairBacktestOut>().promise)
  const user = userEvent.setup()
  renderPanel()

  await user.click(await screen.findByRole('button', { name: 'Refresh backtest' }))

  expect(runPairBacktest).toHaveBeenCalledWith('WDC', 'STX', true)
  expect(screen.getByRole('button', { name: /Refreshing backtest/ })).toBeDisabled()
  expect(within(panel()).getByRole('status')).toHaveTextContent('Refreshing backtest…')
  expect(screen.getByText(/^Backtested/).querySelector('time')).toHaveAttribute(
    'datetime',
    completedBacktest.generated_at,
  )
})

test('a failed refresh keeps every saved value and can be tried again', async () => {
  vi.mocked(getPairBacktest).mockResolvedValue(completedBacktest)
  vi.mocked(runPairBacktest).mockRejectedValue(
    new ApiError(409, 'Another pair backtest is calculating. Try again shortly.'),
  )
  const user = userEvent.setup()
  renderPanel()

  await user.click(await screen.findByRole('button', { name: 'Refresh backtest' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Another pair backtest is calculating. Try again shortly.',
  )
  expect(screen.getByText('2 historical signals')).toBeInTheDocument()
  expect(screen.getByText(/^Backtested/).querySelector('time')).toHaveAttribute(
    'datetime',
    completedBacktest.generated_at,
  )
  expect(screen.getByRole('button', { name: 'Refresh backtest' })).toBeEnabled()
  expect(runPairBacktest).toHaveBeenCalledTimes(1)
})

test('a completed refresh replaces the status and the dates together', async () => {
  vi.mocked(getPairBacktest).mockResolvedValue(completedBacktest)
  vi.mocked(runPairBacktest).mockResolvedValue({
    ...noSignalBacktest,
    run_id: 'second-run',
    generated_at: '2026-10-02T21:00:00Z',
    cached: false,
  })
  const user = userEvent.setup()
  renderPanel()

  await user.click(await screen.findByRole('button', { name: 'Refresh backtest' }))

  expect(await screen.findByText('No qualifying historical signals')).toBeInTheDocument()
  expect(screen.getByText(/^Backtested/).querySelector('time')).toHaveAttribute(
    'datetime',
    '2026-10-02T21:00:00Z',
  )
})

// --- the saved report inside the panel ------------------------------------------------

test('a saved backtest leads with Stock A outcomes, then the pair simulation', async () => {
  vi.mocked(getPairBacktest).mockResolvedValue(completedBacktest)
  renderPanel()

  const stockA = await within(panel()).findByRole('region', { name: 'Stock A outcomes' })
  const pair = within(panel()).getByRole('region', { name: 'Pair simulation' })
  expect(stockA.compareDocumentPosition(pair) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(within(panel()).getByRole('region', { name: 'Backtest assumptions' })).toBeInTheDocument()
})

test('the equity curve mounts only while shown and never runs a backtest', async () => {
  vi.mocked(getPairBacktest).mockResolvedValue(completedBacktest)
  const user = userEvent.setup()
  renderPanel()
  const show = await screen.findByRole('button', { name: 'Show equity curve' })
  expect(show).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('figure')).toBeNull()

  await user.click(show)

  expect(
    screen.getByRole('figure', { name: 'Illustrative equity of the WDC/STX pair simulation' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Hide equity curve' }))
  expect(screen.queryByRole('figure')).toBeNull()
  expect(runPairBacktest).not.toHaveBeenCalled()
})

test('a refresh replaces the open report as a whole', async () => {
  vi.mocked(getPairBacktest).mockResolvedValue(completedBacktest)
  vi.mocked(runPairBacktest).mockResolvedValue({
    ...noSignalBacktest,
    run_id: 'second-run',
    generated_at: '2026-10-02T21:00:00Z',
    cached: false,
  })
  const user = userEvent.setup()
  renderPanel()
  await user.click(await screen.findByRole('button', { name: 'Show trade log (2)' }))

  await user.click(screen.getByRole('button', { name: 'Refresh backtest' }))

  expect(await screen.findByText('No qualifying historical signals')).toBeInTheDocument()
  expect(screen.queryByRole('table', { name: 'Simulated trades' })).toBeNull()
  expect(screen.getByText('No simulated trades')).toBeInTheDocument()
})
