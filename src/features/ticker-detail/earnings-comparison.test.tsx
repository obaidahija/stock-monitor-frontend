import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { EarningsTab } from './earnings-tab'

const state = vi.hoisted(() => ({ available: true }))
vi.mock('./hooks', () => ({
  useEarnings: () => ({ data: {
    ticker: 'ANY', next: null, yfinance_snapshot: [], history: [{
      id: 1, ticker: 'ANY', event_date: '2026-09-29', bmo_amc: 'bmo',
      eps_actual: -0.10, eps_estimate: -0.0471,
      revenue_actual: 17050000, revenue_estimate: 4545000,
      eps_comparison_available: state.available,
      eps_comparison_basis: state.available ? 'provider_reported' : null,
      eps_comparison_actual: state.available ? -0.12 : null,
      eps_comparison_estimate: state.available ? -0.05 : null,
      eps_comparison_source_url: state.available ? 'https://finance.yahoo.com/quote/ANY/earnings/' : null,
    }],
  }, isPending: false, isError: false }),
  useEarningsReaction: () => ({}),
  useCatalysts: () => ({ data: [] }),
  useRefreshEarnings: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('./earnings-playbook-card', () => ({ EarningsPlaybookCard: () => null }))
vi.mock('./eps-trend-chart', () => ({ EpsTrendChart: () => null }))
afterEach(() => { cleanup(); state.available = true })

it('shows the DB comparison with its source and discloses differing provider actuals', () => {
  render(<EarningsTab ticker="ANY" />)
  expect(screen.getByText('Miss -140%')).toBeInTheDocument()
  expect(screen.getByText('Yahoo EPS estimate / actual: -0.05 / -0.12')).toBeInTheDocument()
  expect(screen.getByText(/Sources report different EPS actuals/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Yahoo earnings source' })).toHaveAttribute(
    'href', 'https://finance.yahoo.com/quote/ANY/earnings/',
  )
  expect(screen.queryByText(/GAAP EPS:/)).not.toBeInTheDocument()
})

it('shows pending when the DB has no Yahoo comparison for this release', () => {
  state.available = false
  render(<EarningsTab ticker="ANY" />)
  expect(screen.getByText(/Yahoo EPS comparison pending/)).toBeInTheDocument()
  expect(screen.queryByText(/Miss -/)).not.toBeInTheDocument()
})
