import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { analyzePairStrategy, getPairStrategy } from '@/api/pair-strategy'
import { ApiError } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import type { PairStrategyOut } from '@/types/pair-strategy'
import { PairStrategyPanel } from './pair-strategy-panel'
import {
  candidateLowStrategy,
  insufficientStrategy,
  notSupportedStrategy,
  strategyPoints,
  strategyWith,
  supportedStrategy,
  targetLowStrategy,
  undefinedStrategy,
} from './test-fixtures'

vi.mock('@/api/pair-strategy', () => ({
  getPairStrategy: vi.fn(),
  analyzePairStrategy: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(getPairStrategy).mockReset()
  vi.mocked(analyzePairStrategy).mockReset()
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
    <PairStrategyPanel ticker="WDC" candidateTicker="STX" disabledReason={disabledReason} />,
  )
}

function panel() {
  return screen.getByRole('region', { name: 'Strategy check: WDC against STX' })
}

test('without a saved analysis the panel offers one explicit analysis', async () => {
  vi.mocked(getPairStrategy).mockResolvedValue(null)
  vi.mocked(analyzePairStrategy).mockReturnValue(deferred<PairStrategyOut>().promise)
  const user = userEvent.setup()
  renderPanel()

  const analyze = await screen.findByRole('button', { name: 'Analyze strategy' })
  expect(getPairStrategy).toHaveBeenCalledWith('WDC', 'STX')
  expect(analyzePairStrategy).not.toHaveBeenCalled()

  await user.click(analyze)

  expect(analyzePairStrategy).toHaveBeenCalledTimes(1)
  expect(analyzePairStrategy).toHaveBeenCalledWith('WDC', 'STX', false)
  expect(screen.getByRole('button', { name: /Analyzing strategy/ })).toBeDisabled()
  expect(within(panel()).getByRole('status')).toHaveTextContent('Analyzing strategy…')
})

test('a saved analysis shows its dates, its status and a refresh button', async () => {
  vi.mocked(getPairStrategy).mockResolvedValue(supportedStrategy)
  renderPanel()

  expect(await screen.findByText('No unusual divergence')).toBeInTheDocument()
  const analyzed = screen.getByText(/^Analyzed/)
  expect(analyzed.querySelector('time')).toHaveAttribute('datetime', supportedStrategy.generated_at)
  const through = screen.getByText(/^Prices through/)
  expect(through.querySelector('time')).toHaveAttribute('datetime', '2026-09-30')
  expect(through).toHaveTextContent('Sep 30, 2026')
  expect(screen.getByRole('button', { name: 'Refresh analysis' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Analyze strategy' })).not.toBeInTheDocument()
  expect(analyzePairStrategy).not.toHaveBeenCalled()
})

test('a stale saved analysis keeps the dates it was calculated with', async () => {
  vi.mocked(getPairStrategy).mockResolvedValue({
    ...supportedStrategy,
    generated_at: '2026-08-03T14:00:00Z',
    data_through: '2026-07-31',
  })
  renderPanel()

  const through = await screen.findByText(/^Prices through/)
  expect(through).toHaveTextContent('Jul 31, 2026')
  expect(screen.getByText(/^Analyzed/).querySelector('time')).toHaveAttribute(
    'datetime',
    '2026-08-03T14:00:00Z',
  )
})

test.each([
  [targetLowStrategy, 'WDC relatively low vs STX'],
  [candidateLowStrategy, 'STX relatively low vs WDC'],
  [supportedStrategy, 'No unusual divergence'],
  [notSupportedStrategy, 'Relationship not supported'],
  [insufficientStrategy, 'Insufficient data'],
  [undefinedStrategy, 'Analysis unavailable'],
])('the status names the ordered pair: %#', async (report, label) => {
  vi.mocked(getPairStrategy).mockResolvedValue(report)
  renderPanel()

  expect(await within(await screen.findByRole('region')).findByText(label)).toBeInTheDocument()
})

test('an unsupported relationship shows its reasons and never a divergence label', async () => {
  vi.mocked(getPairStrategy).mockResolvedValue(notSupportedStrategy)
  renderPanel()

  expect(await screen.findByText('Relationship not supported')).toBeInTheDocument()
  expect(
    screen.getByText(/did not find a cointegrating relationship in the formation period/),
  ).toBeInTheDocument()
  expect(screen.queryByText(/relatively low/)).not.toBeInTheDocument()
  expect(screen.queryByText('No unusual divergence')).not.toBeInTheDocument()
})

test('insufficient history explains what is missing instead of showing measurements', async () => {
  vi.mocked(getPairStrategy).mockResolvedValue(insufficientStrategy)
  renderPanel()

  expect(await screen.findByText(/180 of the 252 formation sessions/)).toBeInTheDocument()
  expect(screen.queryByText('Current z-score')).not.toBeInTheDocument()
})

test('undefined math is explained rather than shown as no divergence', async () => {
  vi.mocked(getPairStrategy).mockResolvedValue(undefinedStrategy)
  renderPanel()

  expect(await screen.findByText(/almost perfectly collinear/)).toBeInTheDocument()
  expect(screen.queryByText('No unusual divergence')).not.toBeInTheDocument()
})

test('the summary shows the hedge ratio, the current z-score and the test p-value', async () => {
  vi.mocked(getPairStrategy).mockResolvedValue(supportedStrategy)
  renderPanel()

  const region = await screen.findByRole('region')
  const metrics = await within(region).findByRole('list', { name: 'Strategy measurements' })
  expect(within(metrics).getByText('Hedge ratio (β)').nextSibling).toHaveTextContent('1.493')
  expect(within(metrics).getByText('Current z-score').nextSibling).toHaveTextContent('-1.50')
  expect(within(metrics).getByText('Engle-Granger p-value').nextSibling).toHaveTextContent('0.0012')
  expect(region).not.toHaveTextContent(/confidence score/i)
})

test('rounding never carries a z-score across the signal threshold', async () => {
  const points = strategyPoints(-0.8)
  const final = { ...points[20], z_score: -1.9999 }
  vi.mocked(getPairStrategy).mockResolvedValue(
    strategyWith({ points: [...points.slice(0, 20), final], z_score: -1.9999 }),
  )
  renderPanel()

  const metrics = await screen.findByRole('list', { name: 'Strategy measurements' })
  const z = within(metrics).getByText('Current z-score').nextSibling
  expect(z).toHaveTextContent('-1.9999')
  expect(z).not.toHaveTextContent('-2.00')
  expect(screen.getByText('No unusual divergence')).toBeInTheDocument()
})

test('rounding never carries a p-value across the significance cutoff', async () => {
  vi.mocked(getPairStrategy).mockResolvedValue(
    strategyWith({
      diagnostics: { ...supportedStrategy.calculation.diagnostics, cointegration_pvalue: 0.04996 },
    }),
  )
  renderPanel()

  const metrics = await screen.findByRole('list', { name: 'Strategy measurements' })
  expect(within(metrics).getByText('Engle-Granger p-value').nextSibling).toHaveTextContent(
    '0.04996',
  )
})

test('details are collapsed by default and show the windows, fit and tests when opened', async () => {
  vi.mocked(getPairStrategy).mockResolvedValue(supportedStrategy)
  const user = userEvent.setup()
  renderPanel()
  const toggle = await screen.findByRole('button', { name: 'Show strategy details' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText(/Formation period/)).not.toBeInTheDocument()

  await user.click(toggle)

  expect(screen.getByRole('button', { name: 'Hide strategy details' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  const formation = screen.getByText(/^Formation period/)
  expect(formation).toHaveTextContent('Aug 28, 2025 – Aug 31, 2026')
  expect(formation).toHaveTextContent('252 of 252 sessions')
  expect(screen.getByText(/^Observation period/)).toHaveTextContent('21 of 21 sessions')
  expect(screen.getByText('WDC = 7.12 + 1.493 × STX + spread')).toBeInTheDocument()
  const tests = screen.getByRole('table', { name: 'Formation-period tests' })
  expect(within(tests).getByText('0.6214')).toBeInTheDocument()
  expect(within(tests).getByText('-4.731')).toBeInTheDocument()
  expect(screen.getByText(/checked separately and does not validate/)).toBeInTheDocument()
  expect(screen.getByText(supportedStrategy.caveat)).toBeInTheDocument()
})

test('an unsupported security disables the action and says why', async () => {
  renderPanel('QQQ is listed as ETF, not a common stock.')

  expect(screen.getByRole('button', { name: 'Analyze strategy' })).toBeDisabled()
  expect(screen.getByText(/QQQ is listed as ETF, not a common stock\./)).toBeInTheDocument()
  await new Promise((done) => setTimeout(done, 20))
  expect(getPairStrategy).not.toHaveBeenCalled()
  expect(analyzePairStrategy).not.toHaveBeenCalled()
})

test('a failed refresh keeps every saved value and can be retried', async () => {
  vi.mocked(getPairStrategy).mockResolvedValue(targetLowStrategy)
  vi.mocked(analyzePairStrategy).mockRejectedValue(
    new ApiError(503, 'Daily prices for STX are unavailable.'),
  )
  const user = userEvent.setup()
  renderPanel()

  await user.click(await screen.findByRole('button', { name: 'Refresh analysis' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Daily prices for STX are unavailable.')
  expect(analyzePairStrategy).toHaveBeenCalledWith('WDC', 'STX', true)
  expect(screen.getByText('WDC relatively low vs STX')).toBeInTheDocument()
  expect(screen.getByText(/^Analyzed/).querySelector('time')).toHaveAttribute(
    'datetime',
    targetLowStrategy.generated_at,
  )
  const retry = screen.getByRole('button', { name: 'Refresh analysis' })
  expect(retry).toBeEnabled()
  expect(analyzePairStrategy).toHaveBeenCalledTimes(1)
})

test('a completed refresh replaces the status and the dates together', async () => {
  vi.mocked(getPairStrategy).mockResolvedValue(supportedStrategy)
  vi.mocked(analyzePairStrategy).mockResolvedValue({
    ...targetLowStrategy,
    generated_at: '2026-10-02T21:00:00Z',
    cached: false,
  })
  const user = userEvent.setup()
  renderPanel()

  await user.click(await screen.findByRole('button', { name: 'Refresh analysis' }))

  expect(await screen.findByText('WDC relatively low vs STX')).toBeInTheDocument()
  expect(screen.getByText(/^Analyzed/).querySelector('time')).toHaveAttribute(
    'datetime',
    '2026-10-02T21:00:00Z',
  )
})

test('a failed saved read offers to retry loading, never an automatic analysis', async () => {
  vi.mocked(getPairStrategy).mockRejectedValueOnce(new ApiError(503, 'Database unavailable'))
  vi.mocked(getPairStrategy).mockResolvedValueOnce(null)
  const user = userEvent.setup()
  renderPanel()

  expect(await screen.findByText(/saved strategy analysis could not be loaded/i)).toBeInTheDocument()
  expect(screen.queryByText('Insufficient data')).not.toBeInTheDocument()
  expect(analyzePairStrategy).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'Retry loading' }))

  expect(await screen.findByRole('button', { name: 'Analyze strategy' })).toBeEnabled()
  expect(getPairStrategy).toHaveBeenCalledTimes(2)
  expect(analyzePairStrategy).not.toHaveBeenCalled()
})

// --- the saved spread chart inside the details -------------------------------------

function spreadRows() {
  return within(screen.getByRole('table', { name: 'Daily spread of WDC against STX' })).getAllByRole(
    'row',
  )
}

test('the spread chart mounts only inside the expanded details', async () => {
  vi.mocked(getPairStrategy).mockResolvedValue(supportedStrategy)
  const user = userEvent.setup()
  renderPanel()
  await screen.findByText('No unusual divergence')
  expect(
    screen.queryByRole('figure', { name: 'Adjusted-price spread of WDC against STX' }),
  ).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Show strategy details' }))

  expect(
    screen.getByRole('figure', { name: 'Adjusted-price spread of WDC against STX' }),
  ).toBeInTheDocument()
  expect(spreadRows()).toHaveLength(22)

  await user.click(screen.getByRole('button', { name: 'Hide strategy details' }))

  expect(screen.queryByRole('figure')).not.toBeInTheDocument()
  expect(analyzePairStrategy).not.toHaveBeenCalled()
})

test('a refresh updates the open chart and the dates together', async () => {
  vi.mocked(getPairStrategy).mockResolvedValue(supportedStrategy)
  vi.mocked(analyzePairStrategy).mockResolvedValue({
    ...targetLowStrategy,
    generated_at: '2026-10-02T21:00:00Z',
    cached: false,
  })
  const user = userEvent.setup()
  renderPanel()
  await user.click(await screen.findByRole('button', { name: 'Show strategy details' }))
  expect(within(spreadRows()[21]).getAllByRole('cell')[1]).toHaveTextContent('-0.80')

  await user.click(screen.getByRole('button', { name: 'Refresh analysis' }))

  expect(await screen.findByText('WDC relatively low vs STX')).toBeInTheDocument()
  expect(within(spreadRows()[21]).getAllByRole('cell')[1]).toHaveTextContent('-1.50')
  expect(screen.getByText(/^Analyzed/).querySelector('time')).toHaveAttribute(
    'datetime',
    '2026-10-02T21:00:00Z',
  )
})

test('a failed refresh keeps the open chart and the dates', async () => {
  vi.mocked(getPairStrategy).mockResolvedValue(supportedStrategy)
  vi.mocked(analyzePairStrategy).mockRejectedValue(new ApiError(503, 'Calendar unavailable.'))
  const user = userEvent.setup()
  renderPanel()
  await user.click(await screen.findByRole('button', { name: 'Show strategy details' }))

  await user.click(screen.getByRole('button', { name: 'Refresh analysis' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Calendar unavailable.')
  expect(spreadRows()).toHaveLength(22)
  expect(within(spreadRows()[21]).getAllByRole('cell')[1]).toHaveTextContent('-0.80')
  expect(screen.getByText(/^Analyzed/).querySelector('time')).toHaveAttribute(
    'datetime',
    supportedStrategy.generated_at,
  )
})

// --- small hedge ratios (e.g. BRK.B against BRK.A) keep their significant digits ------

test.each([
  [0.000667, '0.000667'],
  [0.0004, '0.0004'],
])('a small hedge ratio of %s is never rounded to zero or overstated', async (beta, shown) => {
  vi.mocked(getPairStrategy).mockResolvedValue(strategyWith({ hedge_ratio: beta }))
  const user = userEvent.setup()
  renderPanel()

  const metrics = await screen.findByRole('list', { name: 'Strategy measurements' })
  expect(within(metrics).getByText('Hedge ratio (β)').nextSibling).toHaveTextContent(shown)
  await user.click(screen.getByRole('button', { name: 'Show strategy details' }))
  const tests = screen.getByRole('table', { name: 'Formation-period tests' })
  expect(within(tests).getByText('Hedge ratio (β)').nextSibling).toHaveTextContent(shown)
  expect(screen.getByText(`WDC = 7.12 + ${shown} × STX + spread`)).toBeInTheDocument()
  expect(screen.getByText(`Spread = WDC − (7.12 + ${shown} × STX)`)).toBeInTheDocument()
})

test('a tiny negative hedge ratio keeps its sign and digits', async () => {
  vi.mocked(getPairStrategy).mockResolvedValue(notSupportedStrategyWithBeta(-0.00004))
  renderPanel()

  const metrics = await screen.findByRole('list', { name: 'Strategy measurements' })
  expect(within(metrics).getByText('Hedge ratio (β)').nextSibling).toHaveTextContent('-0.00004')
})

function notSupportedStrategyWithBeta(beta: number) {
  return strategyWith({
    evidence_status: 'not_supported',
    signal: 'unavailable',
    reasons: ['The fitted hedge ratio is negative, so WDC and STX prices did not rise and fall together.'],
    hedge_ratio: beta,
  })
}
