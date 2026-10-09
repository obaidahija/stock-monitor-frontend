import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { CatalystOut, EarningsSummary } from '@/types/api'
import { EarningsTab } from './earnings-tab'
import { useCatalysts, useEarnings } from './hooks'

vi.mock('./hooks', () => ({
  useEarnings: vi.fn(),
  useEarningsReaction: () => ({ isPending: false, data: undefined }),
  useRefreshEarnings: () => ({ isPending: false, mutate: vi.fn() }),
  useCatalysts: vi.fn(),
}))
vi.mock('./eps-trend-chart', () => ({ EpsTrendChart: () => null }))
vi.mock('./earnings-reaction-chart', () => ({ EarningsReactionChart: () => null }))
vi.mock('./earnings-playbook-card', () => ({ EarningsPlaybookCard: () => null }))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const summary: EarningsSummary = {
  ticker: 'NVDA',
  next: {
    id: 1,
    ticker: 'NVDA',
    event_date: '2026-11-17',
    bmo_amc: 'amc',
    eps_estimate: 2.5253,
    eps_actual: null,
    revenue_estimate: 111_320_000_000,
    revenue_actual: null,
  } as EarningsSummary['next'],
  history: [
    {
      id: 2,
      ticker: 'NVDA',
      event_date: '2026-08-26',
      bmo_amc: 'amc',
      eps_estimate: 2.1384,
      eps_actual: 2.22,
      revenue_estimate: null,
      revenue_actual: null,
    } as EarningsSummary['history'][number],
  ],
  yfinance_snapshot: Array.from({ length: 12 }, (_, i) => ({
    event_date: `20${24 + Math.floor(i / 4)}-${String(((i % 4) * 3) + 2).padStart(2, '0')}-20`,
    bmo_amc: 'amc',
    eps_estimate: 1,
    eps_actual: 1.06,
  })),
}

function renderTab(catalysts: CatalystOut[], data: EarningsSummary = summary) {
  vi.mocked(useEarnings).mockReturnValue({
    data,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never)
  vi.mocked(useCatalysts).mockReturnValue({ data: catalysts } as never)
  return renderWithProviders(<EarningsTab ticker={data.ticker} />)
}

function comparisonSummary(available: boolean): EarningsSummary {
  return {
    ticker: 'ANY',
    next: null,
    yfinance_snapshot: [],
    history: [{
      ...summary.history[0],
      id: 1,
      ticker: 'ANY',
      event_date: '2026-09-29',
      bmo_amc: 'bmo',
      eps_actual: -0.10,
      eps_estimate: -0.0471,
      revenue_actual: 17050000,
      revenue_estimate: 4545000,
      eps_comparison_available: available,
      eps_comparison_basis: available ? 'provider_reported' : null,
      eps_comparison_actual: available ? -0.12 : null,
      eps_comparison_estimate: available ? -0.05 : null,
      eps_comparison_source_url: available ? 'https://finance.yahoo.com/quote/ANY/earnings/' : null,
    }],
  }
}

test('shows the DB comparison with its source and discloses differing provider actuals', () => {
  renderTab([], comparisonSummary(true))

  expect(screen.getByText('Miss -140%')).toBeInTheDocument()
  expect(screen.getByText('Yahoo EPS estimate / actual: -0.05 / -0.12')).toBeInTheDocument()
  expect(screen.getByText(/Sources report different EPS actuals/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Yahoo earnings source' })).toHaveAttribute(
    'href', 'https://finance.yahoo.com/quote/ANY/earnings/',
  )
  expect(screen.queryByText(/GAAP EPS:/)).not.toBeInTheDocument()
})

test('shows pending when the DB has no Yahoo comparison for this release', () => {
  renderTab([], comparisonSummary(false))

  expect(screen.getByText(/Yahoo EPS comparison pending/)).toBeInTheDocument()
  expect(screen.queryByText(/Miss -/)).not.toBeInTheDocument()
})

test('describes the longer earnings history and names its source', () => {
  renderTab([])

  expect(screen.getByText('12 of last 12')).toBeInTheDocument()
  expect(screen.getByText('Yahoo Finance history')).toBeInTheDocument()
  expect(screen.queryByText(/last 1 quarters/)).not.toBeInTheDocument()
})

test('shows per-share money with two decimals', () => {
  renderTab([])

  expect(screen.getByText('$2.53')).toBeInTheDocument()
  expect(screen.getByText('$2.14 / $2.22')).toBeInTheDocument()
})

test('lists other upcoming events but not the earnings date twice', () => {
  renderTab([
    { catalyst_type: 'earnings', event_date: '2026-11-17', description: 'Earnings (amc)', source: 'finnhub' },
    { catalyst_type: 'dividend', event_date: '2026-12-04', description: 'Dividend $0.01', source: 'yfinance' },
  ])

  expect(screen.getByText('Other upcoming events')).toBeInTheDocument()
  expect(screen.getByText('Dividend')).toBeInTheDocument()
  expect(screen.queryByText('Earnings (amc)')).not.toBeInTheDocument()
})

test('omits the events card when only the earnings date is known', () => {
  renderTab([
    { catalyst_type: 'earnings', event_date: '2026-11-17', description: 'Earnings (amc)', source: 'finnhub' },
  ])

  expect(screen.queryByText('Other upcoming events')).not.toBeInTheDocument()
})
