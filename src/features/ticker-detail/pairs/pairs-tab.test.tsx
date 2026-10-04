import { act, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getPairBacktest, runPairBacktest } from '@/api/pair-backtest'
import { analyzePairStrategy, getPairStrategy } from '@/api/pair-strategy'
import { getStockPairs, refreshStockPairs } from '@/api/stock-pairs'
import { ApiError } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import type { StockPairsOut } from '@/types/api'
import type { PairBacktestOut } from '@/types/pair-backtest'
import type { PairStrategyOut } from '@/types/pair-strategy'
import { PairsTab } from './pairs-tab'
import {
  checkedEvidence,
  enhancedReport,
  fund,
  partialEvidence,
  savedReport,
  seagate,
  sixMonthScatter,
  candidateLowStrategy,
  completedBacktest,
  notSupportedStrategy,
  supportedStrategy,
  targetLowStrategy,
} from './test-fixtures'

vi.mock('@/api/stock-pairs', async (importOriginal) => ({
  // The real pairTicker; only the network calls are replaced.
  ...(await importOriginal<typeof import('@/api/stock-pairs')>()),
  getStockPairs: vi.fn(),
  refreshStockPairs: vi.fn(),
}))

vi.mock('@/api/pair-strategy', () => ({
  getPairStrategy: vi.fn(),
  analyzePairStrategy: vi.fn(),
}))

vi.mock('@/api/pair-backtest', () => ({
  getPairBacktest: vi.fn(),
  runPairBacktest: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(getStockPairs).mockReset()
  vi.mocked(refreshStockPairs).mockReset()
  vi.mocked(getPairStrategy).mockReset()
  vi.mocked(analyzePairStrategy).mockReset()
  // No candidate has a saved strategy analysis unless a test says so.
  vi.mocked(getPairStrategy).mockResolvedValue(null)
  vi.mocked(getPairBacktest).mockReset()
  vi.mocked(runPairBacktest).mockReset()
  // Nor a saved backtest.
  vi.mocked(getPairBacktest).mockResolvedValue(null)
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

function rankedReport(): StockPairsOut {
  const row = (ticker: string, six: number, three: number) => ({
    ...seagate,
    ticker,
    company_name: `${ticker} Corp`,
    six_month: { ...seagate.six_month!, correlation: six },
    three_month: { ...seagate.three_month!, correlation: three },
  })
  return {
    ...savedReport,
    items: [row('AAA', 0.52, 0.91), row('BBB', 0.86, 0.33), row('CCC', 0.73, 0.55)],
  }
}

function candidateOrder() {
  const list = screen.getByRole('list', { name: 'Pair candidates' })
  return within(list)
    .getAllByRole('link')
    .map((link) => link.textContent)
}

test('candidates follow the selected window and switching re-sorts without any request', async () => {
  const report = rankedReport()
  vi.mocked(getStockPairs).mockResolvedValue(report)
  const user = userEvent.setup()
  renderWithProviders(<PairsTab ticker="WDC" />)
  await screen.findByText('AAA Corp')
  const reads = vi.mocked(getStockPairs).mock.calls.length

  expect(candidateOrder()).toEqual(['BBB', 'CCC', 'AAA'])
  expect(screen.getByText("Sorted by 6-month correlation among Google's suggestions")).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '3 months (~63 sessions)' }))

  expect(candidateOrder()).toEqual(['AAA', 'CCC', 'BBB'])
  expect(screen.getByText("Sorted by 3-month correlation among Google's suggestions")).toBeInTheDocument()
  expect(getStockPairs).toHaveBeenCalledTimes(reads)
  expect(refreshStockPairs).not.toHaveBeenCalled()
  // The cached report keeps Google's order.
  expect(report.items.map((item) => item.ticker)).toEqual(['AAA', 'BBB', 'CCC'])
})

test('every row shows both coefficients and strength is labelled historical co-movement', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(rankedReport())
  renderWithProviders(<PairsTab ticker="WDC" />)

  expect(
    await screen.findByText('Daily-return correlation: 6 months 0.86 · 3 months 0.33'),
  ).toBeInTheDocument()
  expect(screen.getByText('Daily-return correlation: 6 months 0.52 · 3 months 0.91')).toBeInTheDocument()
  expect(screen.getAllByText('Historical co-movement')).toHaveLength(3)
  const explanation = screen.getByText(/require both the 3- and 6-month windows/)
  expect(explanation).toHaveTextContent(/business evidence/i)
  expect(explanation.textContent).not.toMatch(/verif/i)
})

test('each candidate shows its checked business evidence or says it was not checked', async () => {
  vi.mocked(getStockPairs).mockResolvedValue({
    ...savedReport,
    items: [{ ...seagate, business_evidence: checkedEvidence }, fund],
  })
  renderWithProviders(<PairsTab ticker="WDC" />)

  expect(await screen.findByText('Source passage checked')).toBeInTheDocument()
  expect(
    screen.getByText('Not independently checked; refresh to check sources'),
  ).toBeInTheDocument()
  expect(screen.getByText('Google Finance: Tracks large technology stocks')).toBeInTheDocument()
})

function plottedReport(): StockPairsOut {
  const scatter = (count: number, slope: number) => ({
    ...sixMonthScatter,
    points: sixMonthScatter.points.slice(0, count),
    slope,
  })
  const row = (ticker: string, six: number, three: number, sixCount: number, threeCount: number) => ({
    ...seagate,
    ticker,
    company_name: `${ticker} Corp`,
    six_month: { ...seagate.six_month!, correlation: six, sample_size: sixCount, scatter: scatter(sixCount, 1.5) },
    three_month: {
      ...seagate.three_month!,
      correlation: three,
      sample_size: threeCount,
      scatter: scatter(threeCount, 0.5),
    },
  })
  return {
    ...savedReport,
    items: [row('AAA', 0.52, 0.91, 110, 50), row('BBB', 0.86, 0.33, 120, 60)],
  }
}

function rowOf(ticker: string) {
  const list = screen.getByRole('list', { name: 'Pair candidates' })
  const link = within(list).getByRole('link', { name: ticker })
  return link.closest('li') as HTMLElement
}

test('a scatter plot mounts only when expanded and stays with its ticker after re-sorting', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(plottedReport())
  const user = userEvent.setup()
  renderWithProviders(<PairsTab ticker="WDC" />)
  await screen.findByText('BBB Corp')
  const reads = vi.mocked(getStockPairs).mock.calls.length
  expect(screen.queryByRole('figure')).not.toBeInTheDocument()

  const toggle = within(rowOf('BBB')).getByRole('button', { name: 'View daily-return scatter plot' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await user.click(toggle)

  const figure = within(rowOf('BBB')).getByRole('figure', {
    name: '6-month daily returns of BBB against WDC',
  })
  expect(within(figure).getByText(/120 daily returns,/)).toBeInTheDocument()
  expect(within(rowOf('AAA')).queryByRole('figure')).not.toBeInTheDocument()
  expect(candidateOrder()).toEqual(['BBB', 'AAA'])

  await user.click(screen.getByRole('button', { name: '3 months (~63 sessions)' }))

  expect(candidateOrder()).toEqual(['AAA', 'BBB'])
  const moved = within(rowOf('BBB')).getByRole('figure', {
    name: '3-month daily returns of BBB against WDC',
  })
  expect(within(moved).getByText(/60 daily returns,/)).toBeInTheDocument()
  expect(within(rowOf('AAA')).queryByRole('figure')).not.toBeInTheDocument()
  expect(getStockPairs).toHaveBeenCalledTimes(reads)
  expect(refreshStockPairs).not.toHaveBeenCalled()

  await user.click(within(rowOf('BBB')).getByRole('button', { name: 'Hide daily-return scatter plot' }))
  expect(screen.queryByRole('figure')).not.toBeInTheDocument()
})

test('a candidate without measurements offers no plot', async () => {
  vi.mocked(getStockPairs).mockResolvedValue({ ...savedReport, items: [fund] })
  renderWithProviders(<PairsTab ticker="WDC" />)

  await screen.findByText('Invesco QQQ Trust')

  expect(
    screen.queryByRole('button', { name: 'View daily-return scatter plot' }),
  ).not.toBeInTheDocument()
})

test('a failed refresh keeps the evidence, the plot and the dates', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(enhancedReport)
  vi.mocked(refreshStockPairs).mockRejectedValue(new ApiError(502, 'Google Finance research failed.'))
  const user = userEvent.setup()
  renderWithProviders(<PairsTab ticker="WDC" />)
  await screen.findByText('Source passage checked')
  await user.click(
    within(rowOf('STX')).getByRole('button', { name: 'View daily-return scatter plot' }),
  )

  await user.click(screen.getByRole('button', { name: 'Refresh' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Google Finance research failed.')
  expect(screen.getByText('Source passage checked')).toBeInTheDocument()
  expect(screen.getByRole('figure', { name: '6-month daily returns of STX against WDC' })).toBeInTheDocument()
  expect(document.querySelector(`time[datetime="${enhancedReport.generated_at}"]`)).not.toBeNull()
})

test('a partly failed source check stays visible on the candidate', async () => {
  vi.mocked(getStockPairs).mockResolvedValue({
    ...savedReport,
    items: [{ ...seagate, business_evidence: partialEvidence }],
  })
  renderWithProviders(<PairsTab ticker="WDC" />)

  expect(await screen.findByText('Source passage partly checked')).toBeInTheDocument()
  expect(screen.getByText('Not found as quoted')).toBeInTheDocument()
  expect(screen.getByText('Passages were found for only one company.')).toBeInTheDocument()
})

test('repeated warnings are all listed without confusing React', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const repeated = 'Ignored evidence for STX: its URL is not one of the cited sources.'
  vi.mocked(getStockPairs).mockResolvedValue({
    ...savedReport,
    warnings: [repeated, repeated],
    items: [{ ...seagate, reasons: ['Same reason.', 'Same reason.'] }],
  })
  renderWithProviders(<PairsTab ticker="WDC" />)

  const warnings = await screen.findByRole('list', { name: 'Report warnings' })
  expect(within(warnings).getAllByText(repeated)).toHaveLength(2)
  expect(screen.getAllByText('Same reason.')).toHaveLength(2)
  expect(errors.mock.calls.flat().join(' ')).not.toMatch(/same key/)
  errors.mockRestore()
})

// --- manual strategy analysis inside each candidate row -----------------------------

function strategyFor(ticker: string, candidate: string, base: PairStrategyOut = supportedStrategy) {
  return { ...base, ticker, candidate_ticker: candidate }
}

test('each eligible candidate reads its saved strategy; an unsupported one is disabled', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(savedReport)
  renderWithProviders(<PairsTab ticker="WDC" />)
  await screen.findByText('Seagate Technology Holdings plc')

  const fundRow = rowOf('QQQ')
  expect(within(fundRow).getByRole('button', { name: 'Analyze strategy' })).toBeDisabled()
  expect(within(fundRow).getByText(/^Strategy analysis unavailable/)).toHaveTextContent(
    'QQQ is listed as ETF, not a common stock.',
  )
  expect(await within(rowOf('STX')).findByRole('button', { name: 'Analyze strategy' })).toBeEnabled()
  expect(within(rowOf('NEWC')).getByRole('button', { name: 'Analyze strategy' })).toBeEnabled()
  expect(vi.mocked(getPairStrategy).mock.calls).toEqual([
    ['WDC', 'STX'],
    ['WDC', 'NEWC'],
  ])
  expect(analyzePairStrategy).not.toHaveBeenCalled()
})

test('analyzing one candidate posts once for that ordered pair only', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(savedReport)
  vi.mocked(analyzePairStrategy).mockResolvedValue(strategyFor('WDC', 'STX', targetLowStrategy))
  const user = userEvent.setup()
  renderWithProviders(<PairsTab ticker="WDC" />)
  await screen.findByText('Seagate Technology Holdings plc')

  await user.click(await within(rowOf('STX')).findByRole('button', { name: 'Analyze strategy' }))

  expect(await within(rowOf('STX')).findByText('WDC relatively low vs STX')).toBeInTheDocument()
  expect(analyzePairStrategy).toHaveBeenCalledTimes(1)
  expect(analyzePairStrategy).toHaveBeenCalledWith('WDC', 'STX', false)
  expect(within(rowOf('NEWC')).getByRole('button', { name: 'Analyze strategy' })).toBeEnabled()
  expect(refreshStockPairs).not.toHaveBeenCalled()
})

test('pair discovery and strategy analysis keep separate buttons and requests', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(savedReport)
  vi.mocked(getPairStrategy).mockImplementation(async (_ticker, candidate) =>
    candidate === 'STX' ? strategyFor('WDC', 'STX') : null,
  )
  vi.mocked(refreshStockPairs).mockReturnValue(new Promise(() => undefined))
  const user = userEvent.setup()
  renderWithProviders(<PairsTab ticker="WDC" />)
  await screen.findByText('Seagate Technology Holdings plc')

  const refreshAnalysis = await within(rowOf('STX')).findByRole('button', {
    name: 'Refresh analysis',
  })
  vi.mocked(analyzePairStrategy).mockReturnValue(new Promise(() => undefined))
  await user.click(refreshAnalysis)
  expect(analyzePairStrategy).toHaveBeenCalledWith('WDC', 'STX', true)
  expect(refreshStockPairs).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(refreshStockPairs).toHaveBeenCalledWith('WDC', true)
  expect(analyzePairStrategy).toHaveBeenCalledTimes(1)
})

test('switching the correlation window neither re-reads nor re-runs any strategy', async () => {
  const report = rankedReport()
  vi.mocked(getStockPairs).mockResolvedValue(report)
  vi.mocked(getPairStrategy).mockImplementation(async (_ticker, candidate) =>
    candidate === 'BBB' ? strategyFor('WDC', 'BBB', targetLowStrategy) : null,
  )
  const user = userEvent.setup()
  renderWithProviders(<PairsTab ticker="WDC" />)
  await screen.findByText('BBB Corp')
  expect(await within(rowOf('BBB')).findByText('WDC relatively low vs BBB')).toBeInTheDocument()
  const reads = vi.mocked(getPairStrategy).mock.calls.length
  expect(candidateOrder()).toEqual(['BBB', 'CCC', 'AAA'])

  await user.click(screen.getByRole('button', { name: '3 months (~63 sessions)' }))

  expect(candidateOrder()).toEqual(['AAA', 'CCC', 'BBB'])
  expect(within(rowOf('BBB')).getByText('WDC relatively low vs BBB')).toBeInTheDocument()
  expect(within(rowOf('AAA')).queryByText(/relatively low/)).not.toBeInTheDocument()
  expect(getPairStrategy).toHaveBeenCalledTimes(reads)
  expect(analyzePairStrategy).not.toHaveBeenCalled()
})

test('after discovery changes only currently listed candidates show a strategy panel', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(savedReport)
  vi.mocked(getPairStrategy).mockImplementation(async (_ticker, candidate) =>
    candidate === 'STX' ? strategyFor('WDC', 'STX', targetLowStrategy) : null,
  )
  vi.mocked(refreshStockPairs).mockResolvedValue({ ...savedReport, items: [fund], cached: false })
  const user = userEvent.setup()
  renderWithProviders(<PairsTab ticker="WDC" />)
  expect(await screen.findByText('WDC relatively low vs STX')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Refresh' }))

  expect(await screen.findByText('Invesco QQQ Trust')).toBeInTheDocument()
  expect(screen.queryByText('WDC relatively low vs STX')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('region', { name: 'Strategy check: WDC against STX' }),
  ).not.toBeInTheDocument()
})

test('an analysis still running after navigation never appears on another stock', async () => {
  const nvdaReport = { ...savedReport, ticker: 'NVDA', items: [seagate] }
  vi.mocked(getStockPairs).mockImplementation(async (ticker) =>
    ticker === 'WDC' ? savedReport : nvdaReport,
  )
  const pending = deferred<PairStrategyOut>()
  vi.mocked(analyzePairStrategy).mockReturnValue(pending.promise)
  const user = userEvent.setup()
  const { rerender } = renderWithProviders(<PairsTab ticker="WDC" />)
  await screen.findByText('Seagate Technology Holdings plc')
  await user.click(await within(rowOf('STX')).findByRole('button', { name: 'Analyze strategy' }))

  rerender(<PairsTab ticker="NVDA" />)
  expect(await screen.findByText('Possible pairs for NVDA')).toBeInTheDocument()
  await act(async () => pending.resolve(strategyFor('WDC', 'STX', targetLowStrategy)))

  const nvdaPanel = await screen.findByRole('region', { name: 'Strategy check: NVDA against STX' })
  expect(within(nvdaPanel).getByRole('button', { name: 'Analyze strategy' })).toBeEnabled()
  expect(screen.queryByText(/relatively low/)).not.toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

function lastSpread(row: HTMLElement, target: string, candidate: string) {
  const table = within(row).getByRole('table', { name: `Daily spread of ${target} against ${candidate}` })
  const rows = within(table).getAllByRole('row')
  return within(rows[rows.length - 1]).getAllByRole('cell')[1].textContent
}

test('an open spread chart stays with its ordered pair when the window re-sorts rows', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(rankedReport())
  vi.mocked(getPairStrategy).mockImplementation(async (_ticker, candidate) =>
    candidate === 'BBB' ? strategyFor('WDC', 'BBB', targetLowStrategy) : null,
  )
  const user = userEvent.setup()
  renderWithProviders(<PairsTab ticker="WDC" />)
  await screen.findByText('BBB Corp')
  await user.click(
    await within(rowOf('BBB')).findByRole('button', { name: 'Show strategy details' }),
  )
  expect(
    within(rowOf('BBB')).getByRole('figure', { name: 'Adjusted-price spread of WDC against BBB' }),
  ).toBeInTheDocument()
  expect(lastSpread(rowOf('BBB'), 'WDC', 'BBB')).toBe('-1.50')
  const reads = vi.mocked(getPairStrategy).mock.calls.length

  await user.click(screen.getByRole('button', { name: '3 months (~63 sessions)' }))

  expect(candidateOrder()).toEqual(['AAA', 'CCC', 'BBB'])
  expect(
    within(rowOf('BBB')).getByRole('figure', { name: 'Adjusted-price spread of WDC against BBB' }),
  ).toBeInTheDocument()
  expect(lastSpread(rowOf('BBB'), 'WDC', 'BBB')).toBe('-1.50')
  expect(within(rowOf('AAA')).queryByRole('figure')).not.toBeInTheDocument()
  expect(getPairStrategy).toHaveBeenCalledTimes(reads)
  expect(analyzePairStrategy).not.toHaveBeenCalled()
})

test('a strategy refresh still running after navigation never shows on another stock', async () => {
  const nvdaReport = { ...savedReport, ticker: 'NVDA', items: [seagate] }
  vi.mocked(getStockPairs).mockImplementation(async (ticker) =>
    ticker === 'WDC' ? savedReport : nvdaReport,
  )
  const saved: Record<string, PairStrategyOut> = {
    'WDC/STX': strategyFor('WDC', 'STX'),
    'NVDA/STX': strategyFor('NVDA', 'STX', candidateLowStrategy),
  }
  vi.mocked(getPairStrategy).mockImplementation(
    async (ticker, candidate) => saved[`${ticker}/${candidate}`] ?? null,
  )
  const pending = deferred<PairStrategyOut>()
  vi.mocked(analyzePairStrategy).mockReturnValue(pending.promise)
  const user = userEvent.setup()
  const { rerender } = renderWithProviders(<PairsTab ticker="WDC" />)
  await screen.findByText('Possible pairs for WDC')
  await user.click(await within(rowOf('STX')).findByRole('button', { name: 'Refresh analysis' }))
  expect(analyzePairStrategy).toHaveBeenCalledWith('WDC', 'STX', true)

  rerender(<PairsTab ticker="NVDA" />)
  expect(await screen.findByText('STX relatively low vs NVDA')).toBeInTheDocument()
  await user.click(within(rowOf('STX')).getByRole('button', { name: 'Show strategy details' }))
  expect(lastSpread(rowOf('STX'), 'NVDA', 'STX')).toBe('1.70')
  const refreshed = strategyFor('WDC', 'STX', targetLowStrategy)
  saved['WDC/STX'] = refreshed
  await act(async () => {
    pending.resolve(refreshed)
    // Let the late response finish writing to the cache before looking.
    await new Promise((done) => setTimeout(done, 20))
  })

  expect(screen.getByText('STX relatively low vs NVDA')).toBeInTheDocument()
  expect(lastSpread(rowOf('STX'), 'NVDA', 'STX')).toBe('1.70')
  expect(screen.queryByText('WDC relatively low vs STX')).not.toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()

  // The finished refresh was saved under its own ordered pair.
  rerender(<PairsTab ticker="WDC" />)
  expect(await screen.findByText('WDC relatively low vs STX')).toBeInTheDocument()
})

// --- manual backtests beside the current analysis -------------------------------------

function backtestFor(ticker: string, candidate: string, base: PairBacktestOut = completedBacktest) {
  return { ...base, ticker, candidate_ticker: candidate }
}

const TODAY = {
  absent: () => vi.mocked(getPairStrategy).mockResolvedValue(null),
  loading: () => vi.mocked(getPairStrategy).mockReturnValue(new Promise(() => undefined)),
  failed: () =>
    vi.mocked(getPairStrategy).mockRejectedValue(new ApiError(503, 'Database unavailable')),
  'within range': () =>
    vi.mocked(getPairStrategy).mockImplementation(async (ticker, candidate) =>
      strategyFor(ticker, candidate, supportedStrategy),
    ),
  'not supported': () =>
    vi.mocked(getPairStrategy).mockImplementation(async (ticker, candidate) =>
      strategyFor(ticker, candidate, notSupportedStrategy),
    ),
}

test.each(Object.keys(TODAY))(
  "a supported candidate can be backtested whatever today's analysis is: %s",
  async (state) => {
    TODAY[state as keyof typeof TODAY]()
    vi.mocked(getStockPairs).mockResolvedValue(savedReport)
    vi.mocked(runPairBacktest).mockReturnValue(new Promise(() => undefined))
    const user = userEvent.setup()
    renderWithProviders(<PairsTab ticker="WDC" />)
    await screen.findByText('Seagate Technology Holdings plc')

    const run = await within(rowOf('STX')).findByRole('button', { name: 'Backtest pair' })
    expect(run).toBeEnabled()
    await user.click(run)

    expect(runPairBacktest).toHaveBeenCalledWith('WDC', 'STX', false)
    expect(analyzePairStrategy).not.toHaveBeenCalled()
  },
)

test('a known unsupported security cannot be backtested and says why', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(savedReport)
  renderWithProviders(<PairsTab ticker="WDC" />)
  await screen.findByText('Seagate Technology Holdings plc')

  const fundRow = rowOf('QQQ')
  expect(within(fundRow).getByRole('button', { name: 'Backtest pair' })).toBeDisabled()
  expect(within(fundRow).getByText(/^Backtest unavailable/)).toHaveTextContent(
    'QQQ is listed as ETF, not a common stock.',
  )
  await within(rowOf('STX')).findByRole('button', { name: 'Backtest pair' })
  expect(vi.mocked(getPairBacktest).mock.calls).toEqual([
    ['WDC', 'STX'],
    ['WDC', 'NEWC'],
  ])
})

test('the current analysis and the saved backtest stay visible together', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(savedReport)
  vi.mocked(getPairStrategy).mockImplementation(async (ticker, candidate) =>
    candidate === 'STX' ? strategyFor(ticker, candidate, targetLowStrategy) : null,
  )
  vi.mocked(getPairBacktest).mockImplementation(async (ticker, candidate) =>
    candidate === 'STX' ? backtestFor(ticker, candidate) : null,
  )
  renderWithProviders(<PairsTab ticker="WDC" />)
  await screen.findByText('Seagate Technology Holdings plc')

  expect(await within(rowOf('STX')).findByText('WDC relatively low vs STX')).toBeInTheDocument()
  expect(await within(rowOf('STX')).findByText('2 historical signals')).toBeInTheDocument()
  expect(within(rowOf('STX')).getByRole('button', { name: 'Refresh analysis' })).toBeEnabled()
  expect(within(rowOf('STX')).getByRole('button', { name: 'Refresh backtest' })).toBeEnabled()
  expect(runPairBacktest).not.toHaveBeenCalled()
  expect(analyzePairStrategy).not.toHaveBeenCalled()
})

test("a running backtest disables only that pair's backtest button", async () => {
  vi.mocked(getStockPairs).mockResolvedValue(savedReport)
  vi.mocked(runPairBacktest).mockReturnValue(new Promise(() => undefined))
  const user = userEvent.setup()
  renderWithProviders(<PairsTab ticker="WDC" />)
  await screen.findByText('Seagate Technology Holdings plc')

  await user.click(await within(rowOf('STX')).findByRole('button', { name: 'Backtest pair' }))

  expect(within(rowOf('STX')).getByRole('button', { name: /Running backtest/ })).toBeDisabled()
  expect(within(rowOf('STX')).getByRole('button', { name: 'Analyze strategy' })).toBeEnabled()
  expect(within(rowOf('NEWC')).getByRole('button', { name: 'Backtest pair' })).toBeEnabled()
  expect(runPairBacktest).toHaveBeenCalledTimes(1)
})

test('switching the correlation window neither re-reads nor re-runs any backtest', async () => {
  vi.mocked(getStockPairs).mockResolvedValue(rankedReport())
  vi.mocked(getPairBacktest).mockImplementation(async (ticker, candidate) =>
    candidate === 'BBB' ? backtestFor(ticker, candidate) : null,
  )
  const user = userEvent.setup()
  renderWithProviders(<PairsTab ticker="WDC" />)
  await screen.findByText('BBB Corp')
  expect(await within(rowOf('BBB')).findByText('2 historical signals')).toBeInTheDocument()
  const reads = vi.mocked(getPairBacktest).mock.calls.length

  await user.click(screen.getByRole('button', { name: '3 months (~63 sessions)' }))

  expect(candidateOrder()).toEqual(['AAA', 'CCC', 'BBB'])
  expect(within(rowOf('BBB')).getByText('2 historical signals')).toBeInTheDocument()
  expect(within(rowOf('AAA')).queryByText('2 historical signals')).not.toBeInTheDocument()
  expect(getPairBacktest).toHaveBeenCalledTimes(reads)
  expect(runPairBacktest).not.toHaveBeenCalled()
})

test('a backtest still running after navigation never appears on another stock', async () => {
  const nvdaReport = { ...savedReport, ticker: 'NVDA', items: [seagate] }
  vi.mocked(getStockPairs).mockImplementation(async (ticker) =>
    ticker === 'WDC' ? savedReport : nvdaReport,
  )
  const pending = deferred<PairBacktestOut>()
  vi.mocked(runPairBacktest).mockReturnValue(pending.promise)
  const user = userEvent.setup()
  const { rerender } = renderWithProviders(<PairsTab ticker="WDC" />)
  await screen.findByText('Seagate Technology Holdings plc')
  await user.click(await within(rowOf('STX')).findByRole('button', { name: 'Backtest pair' }))

  rerender(<PairsTab ticker="NVDA" />)
  expect(await screen.findByText('Possible pairs for NVDA')).toBeInTheDocument()
  await act(async () => pending.resolve(backtestFor('WDC', 'STX')))

  const nvdaPanel = await screen.findByRole('region', {
    name: 'Historical backtest: NVDA against STX',
  })
  expect(within(nvdaPanel).getByRole('button', { name: 'Backtest pair' })).toBeEnabled()
  expect(screen.queryByText('2 historical signals')).not.toBeInTheDocument()
})
