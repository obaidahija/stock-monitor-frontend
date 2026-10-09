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
    ticker: 'SQZ',
    side: 'long',
    origin: null,
    source_key: 'SQZ:2026-10-05',
    rule_version: 'short-squeeze-daily-v1',
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
    signal_session: '2026-10-05',
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

const scannerFilters = { horizon_sessions: 5, source_kind: 'short_squeeze' } as const

test('scanner rows show the signal session apart from the measurement baseline', () => {
  rows([row()])
  renderWithProviders(<ResearchObservationsTable filters={scannerFilters} />)

  expect(screen.getByRole('columnheader', { name: 'Signal session' })).toBeInTheDocument()
  const line = screen.getByRole('row', { name: /SQZ/ })
  expect(line).toHaveTextContent('2026-10-05')
  expect(line).toHaveTextContent('2026-10-06 → 2026-10-13')
  expect(line).toHaveTextContent('Stop/target order unavailable')
  expect(line).toHaveTextContent('Favorable +7.10% · adverse -1.20%')
})

test('a scanner row with missing path bars says so', () => {
  rows([
    row({
      favorable_move_pct: null,
      adverse_move_pct: null,
      path_status: 'incomplete',
      path_coverage: { expected_bars: 5, usable_bars: 3, status: 'incomplete' },
    }),
  ])
  renderWithProviders(<ResearchObservationsTable filters={scannerFilters} />)
  expect(screen.getByRole('row', { name: /SQZ/ })).toHaveTextContent('3/5 bars covered')
})

test('other sources keep their columns, and rows from an older backend still render', () => {
  const older = row({ ticker: 'CAT', target_stop_order: 'neither' })
  delete (older as Partial<ResearchObservationRowOut>).signal_session
  rows([older])
  renderWithProviders(
    <ResearchObservationsTable filters={{ horizon_sessions: 5, source_kind: 'catalyst' }} />,
  )
  expect(screen.queryByRole('columnheader', { name: 'Signal session' })).not.toBeInTheDocument()
  expect(screen.getByRole('row', { name: /CAT/ })).toHaveTextContent('neither')
})
