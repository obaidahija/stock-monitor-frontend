import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { ResearchObservationRowOut } from '@/types/api'
import { useResearchObservations } from './hooks'
import { ResearchObservationsTable } from './research-observations-table'

vi.mock('./hooks', () => ({ useResearchObservations: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function row(overrides: Partial<ResearchObservationRowOut> = {}): ResearchObservationRowOut {
  return {
    observation_id: 1,
    ticker: 'CAT',
    side: 'long',
    origin: null,
    source_key: 'CAT:2026-10-05',
    rule_version: 'catalyst-daily-v3',
    decision_at: '2026-10-05T20:46:00Z',
    decision_session: '2026-10-06',
    horizon_sessions: 5,
    mature: true,
    status: 'evaluated',
    status_reason: null,
    revision: 1,
    baseline_session: '2026-10-06',
    exit_session: '2026-10-13',
    baseline_price: 11,
    exit_price: 11.55,
    raw_return_pct: 5,
    side_return_pct: 5,
    cost_adjusted_return_pct: 4.8,
    benchmark_return_pct: 1,
    excess_return_pct: 4,
    favorable_move_pct: 7.1,
    adverse_move_pct: -1.2,
    path_status: 'complete',
    target_stop_order: null,
    path_coverage: { expected_bars: 5, usable_bars: 5, status: 'complete' },
    extends_beyond_setup_expiry: null,
    headline: null,
    score: null,
    overall_score: null,
    lean: null,
    ...overrides,
  }
}

function rows(items: ResearchObservationRowOut[]) {
  vi.mocked(useResearchObservations).mockReturnValue({
    data: { items, total: items.length, page: 1, page_size: 50 },
    isPending: false,
    isError: false,
  } as never)
}

const catalystFilters = { horizon_sessions: 5, source_kind: 'catalyst' } as const

test('rows show the measurement window, path and excursions', () => {
  rows([row()])
  renderWithProviders(<ResearchObservationsTable filters={catalystFilters} />)

  const line = screen.getByRole('row', { name: /CAT/ })
  expect(line).toHaveTextContent('2026-10-06 → 2026-10-13')
  expect(line).toHaveTextContent('complete')
  expect(line).toHaveTextContent('Favorable +7.10% · adverse -1.20%')
})

test('a row with missing path bars says so', () => {
  rows([
    row({
      favorable_move_pct: null,
      adverse_move_pct: null,
      path_status: 'incomplete',
      path_coverage: { expected_bars: 5, usable_bars: 3, status: 'incomplete' },
    }),
  ])
  renderWithProviders(<ResearchObservationsTable filters={catalystFilters} />)
  expect(screen.getByRole('row', { name: /CAT/ })).toHaveTextContent('3/5 bars covered')
})

test('a known target/stop order is shown instead of the path status', () => {
  rows([row({ target_stop_order: 'neither' })])
  renderWithProviders(<ResearchObservationsTable filters={catalystFilters} />)
  expect(screen.getByRole('row', { name: /CAT/ })).toHaveTextContent('neither')
})
