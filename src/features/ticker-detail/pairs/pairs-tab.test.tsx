import { act, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getStockPairs, refreshStockPairs } from '@/api/stock-pairs'
import { ApiError } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import type { StockPairsOut } from '@/types/api'
import { PairsTab } from './pairs-tab'
import { savedReport, seagate } from './test-fixtures'

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

test('mounting only reads the saved report and waits for an explicit search', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(null)
  const user = userEvent.setup()
  renderWithProviders(<PairsTab ticker="wdc" />)

  expect(await screen.findByRole('button', { name: 'Find pairs' })).toBeEnabled()
  expect(getStockPairs).toHaveBeenCalledWith('WDC')
  expect(refreshStockPairs).not.toHaveBeenCalled()

  vi.mocked(refreshStockPairs).mockReturnValue(deferred<StockPairsOut>().promise)
  await user.click(screen.getByRole('button', { name: 'Find pairs' }))

  expect(refreshStockPairs).toHaveBeenCalledWith('WDC', false)
  expect(screen.getByRole('button', { name: /Finding and checking pairs/ })).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('Finding and checking pairs…')
})

test('a dash-spelled share class shows the report the server saved under the dot spelling', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(null)
  vi.mocked(refreshStockPairs).mockResolvedValue({ ...savedReport, ticker: 'BRK.B', cached: false })
  const user = userEvent.setup()
  renderWithProviders(<PairsTab ticker="brk-b" />)

  await user.click(await screen.findByRole('button', { name: 'Find pairs' }))

  expect(refreshStockPairs).toHaveBeenCalledWith('BRK.B', false)
  expect(await screen.findByText('Possible pairs for BRK.B')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled()
})

test('a saved report shows dated evidence with six months by default', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(savedReport)
  const user = userEvent.setup()
  renderWithProviders(<PairsTab ticker="WDC" />)

  expect(await screen.findByText('Seagate Technology Holdings plc')).toBeInTheDocument()
  const received = screen.getByText(/Google response received/)
  expect(within(received).getByText(/2026/).closest('time')).toHaveAttribute(
    'datetime',
    savedReport.generated_at,
  )
  const verified = screen.getByText(/^Verified/)
  expect(verified.querySelector('time')).toHaveAttribute('datetime', savedReport.verified_at)
  const pricesThrough = screen.getByText(/Prices through/)
  expect(pricesThrough.querySelector('time')).toHaveAttribute('datetime', '2026-09-30')
  expect(pricesThrough).toHaveTextContent('Sep 30, 2026')
  expect(screen.getByText(/Google Finance: Duopoly in enterprise hard drives/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '6 months (~126 sessions)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByText('0.82')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled()
  expect(screen.getByText(savedReport.caveat)).toBeInTheDocument()

  await user.click(screen.getByText('Google Finance research and sources'))
  expect(screen.getByRole('link', { name: /Storage stocks move together/ })).toHaveAttribute(
    'href',
    'https://example.com/storage-peers',
  )
})

test('switching to three months only changes what is displayed', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(savedReport)
  const user = userEvent.setup()
  renderWithProviders(<PairsTab ticker="WDC" />)
  await screen.findByText('0.82')
  const reads = vi.mocked(getStockPairs).mock.calls.length

  await user.click(screen.getByRole('button', { name: '3 months (~63 sessions)' }))

  expect(screen.getByText('0.65')).toBeInTheDocument()
  expect(screen.queryByText('0.82')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '3 months (~63 sessions)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(getStockPairs).toHaveBeenCalledTimes(reads)
  expect(refreshStockPairs).not.toHaveBeenCalled()
})

test('without a strong pair the report says so and keeps each candidate reason', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(savedReport)
  renderWithProviders(<PairsTab ticker="WDC" />)

  expect(await screen.findByText('No strong pairs confirmed')).toBeInTheDocument()
  expect(screen.getByText('Moderate')).toBeInTheDocument()
  expect(screen.getByText('QQQ is listed as ETF, not a common stock.')).toBeInTheDocument()
  expect(screen.getByText(/only 33 aligned daily returns/)).toBeInTheDocument()
  expect(screen.getByText('Not a supported stock')).toBeInTheDocument()
  expect(screen.getByText('Insufficient data')).toBeInTheDocument()
})

test('a strong pair is not hidden behind the no-strong message', async () => {
  const strong = { ...seagate, strength: 'strong' as const }
  vi.mocked(getStockPairs).mockResolvedValue({ ...savedReport, items: [strong] })
  renderWithProviders(<PairsTab ticker="WDC" />)

  expect(await screen.findByText('Strong')).toBeInTheDocument()
  expect(screen.queryByText('No strong pairs confirmed')).not.toBeInTheDocument()
})

test('an unsupported listing retains the candidate and its research explanation', async () => {
  vi.mocked(getStockPairs).mockResolvedValue({
    ...savedReport,
    items: [{
      ticker: 'SHOP', company_name: 'Shopify', exchange: 'TSX',
      explanation: 'Shared growth drivers', strength: 'not_confirmed',
      evidence_status: 'invalid_security', reasons: ['Google listed SHOP on TSX, not NYSE or Nasdaq.'],
      three_month: null, six_month: null,
    }],
  })
  renderWithProviders(<PairsTab ticker="WDC" />)

  expect(await screen.findByRole('link', { name: 'SHOP' })).toBeInTheDocument()
  expect(screen.getByText('TSX')).toBeInTheDocument()
  expect(screen.getByText('Google Finance: Shared growth drivers')).toBeInTheDocument()
  expect(screen.getByText('Not confirmed')).toBeInTheDocument()
  expect(screen.queryByText('Google Finance found no supported candidates')).not.toBeInTheDocument()
})

test('an empty Google answer keeps its research and says no candidates were supported', async () => {
  vi.mocked(getStockPairs).mockResolvedValue({
    ...savedReport,
    answer_markdown: 'NO_PAIRS_FOUND',
    items: [],
  })
  const user = userEvent.setup()
  renderWithProviders(<PairsTab ticker="WDC" />)

  expect(await screen.findByText('Google Finance found no supported candidates')).toBeInTheDocument()
  expect(screen.queryByText('No strong pairs confirmed')).not.toBeInTheDocument()
  await user.click(screen.getByText('Google Finance research and sources'))
  expect(screen.getByRole('link', { name: /Storage stocks move together/ })).toBeInTheDocument()
})

test('an unavailable benchmark is explained rather than hidden', async () => {
  const unavailable = {
    status: 'unavailable' as const,
    correlation: null,
    sample_size: 0,
    start_date: null,
    end_date: null,
    reason: 'SPY benchmark prices are unavailable.',
  }
  vi.mocked(getStockPairs).mockResolvedValue({
    ...savedReport,
    items: [{ ...seagate, six_month: { ...seagate.six_month!, market_check: unavailable } }],
    warnings: ['SPY benchmark prices are unavailable, so the market check was skipped.'],
  })
  renderWithProviders(<PairsTab ticker="WDC" />)

  expect(
    await screen.findByText('SPY benchmark prices are unavailable, so the market check was skipped.'),
  ).toBeInTheDocument()
  expect(screen.getByText(/Unavailable: SPY benchmark prices are unavailable\./)).toBeInTheDocument()
})

test('a pending refresh keeps the saved report and its date visible', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(savedReport)
  vi.mocked(refreshStockPairs).mockReturnValue(deferred<StockPairsOut>().promise)
  const user = userEvent.setup()
  renderWithProviders(<PairsTab ticker="WDC" />)

  await user.click(await screen.findByRole('button', { name: 'Refresh' }))

  expect(refreshStockPairs).toHaveBeenCalledWith('WDC', true)
  expect(screen.getByRole('button', { name: /Refreshing pairs/ })).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('Refreshing pairs…')
  expect(screen.getByText('Seagate Technology Holdings plc')).toBeInTheDocument()
  expect(document.querySelector(`time[datetime="${savedReport.generated_at}"]`)).not.toBeNull()
})

test('a failed refresh shows the error and keeps the old report', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(savedReport)
  vi.mocked(refreshStockPairs).mockRejectedValue(
    new ApiError(503, 'Daily prices for WDC are unavailable.'),
  )
  const user = userEvent.setup()
  renderWithProviders(<PairsTab ticker="WDC" />)

  await user.click(await screen.findByRole('button', { name: 'Refresh' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Daily prices for WDC are unavailable.')
  expect(screen.getByText('Seagate Technology Holdings plc')).toBeInTheDocument()
  expect(document.querySelector(`time[datetime="${savedReport.generated_at}"]`)).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled()
  expect(refreshStockPairs).toHaveBeenCalledTimes(1)
})

test('a search still pending after switching tickers never appears on the new ticker', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(null)
  const pending = deferred<StockPairsOut>()
  vi.mocked(refreshStockPairs).mockReturnValue(pending.promise)
  const user = userEvent.setup()
  const { rerender } = renderWithProviders(<PairsTab ticker="WDC" />)
  await user.click(await screen.findByRole('button', { name: 'Find pairs' }))

  rerender(<PairsTab ticker="NVDA" />)
  expect(await screen.findByRole('button', { name: 'Find pairs' })).toBeEnabled()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  await act(async () => pending.resolve(savedReport))
  // The server now has the WDC report too.
  vi.mocked(getStockPairs).mockImplementation(async (ticker) =>
    ticker === 'WDC' ? savedReport : null,
  )

  expect(screen.queryByText('Seagate Technology Holdings plc')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Find pairs' })).toBeEnabled()

  // The finished search was saved under its own ticker.
  rerender(<PairsTab ticker="WDC" />)
  expect(await screen.findByText('Seagate Technology Holdings plc')).toBeInTheDocument()
})
