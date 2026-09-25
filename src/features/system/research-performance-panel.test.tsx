import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { ResearchMetricOut, ResearchPerformanceOut } from '@/types/api'
import { ResearchPerformancePanel } from './research-performance-panel'
import { useResearchObservations, useResearchPerformance } from './hooks'

vi.mock('./hooks', () => ({
  useResearchPerformance: vi.fn(),
  useResearchObservations: vi.fn(),
}))

function metric(overrides: Partial<ResearchMetricOut> = {}): ResearchMetricOut {
  return {
    n: 72,
    unavailable: 0,
    mean: 0.42,
    equal_date_mean: 0.31,
    median: 0.2,
    positive: 43,
    zero: 2,
    negative: 27,
    positive_rate: 43 / 72,
    ...overrides,
  }
}

const group = {
  key: 'overall',
  coverage: { recorded: 100, matured: 80, evaluated: 72, missing: 8 },
  decision_sessions: 7,
  metrics: {
    raw_return_pct: metric(),
    side_return_pct: metric({ n: 0, unavailable: 72, mean: null, equal_date_mean: null, median: null, positive: 0, zero: 0, negative: 0, positive_rate: null }),
    cost_adjusted_return_pct: metric({ n: 0, unavailable: 72, mean: null, equal_date_mean: null, median: null, positive: 0, zero: 0, negative: 0, positive_rate: null }),
    excess_return_pct: metric({ n: 70, unavailable: 2, positive: 40, positive_rate: 40 / 70 }),
    favorable_move_pct: metric({ n: 60, unavailable: 12 }),
    adverse_move_pct: metric({ n: 60, unavailable: 12, mean: -1.4 }),
  },
  path_order_counts: { ambiguous: 3, unknown: 4 },
}

const report: ResearchPerformanceOut = {
  cohort: {
    horizon_sessions: 5,
    source_kind: 'composite_daily',
    rule_version: 'composite-observed-v1',
    side: null,
    origin: null,
    status: null,
    extends_beyond_setup_expiry: null,
    from: '2024-10-31',
    to: '2026-10-30',
  },
  measurement_definition: {
    measurement_version: 'future-close-v1',
    baseline: 'first complete session close strictly after the decision became available',
    exit: 'close H exchange sessions after the baseline',
    benchmark: 'SPY over the same exact baseline and exit sessions',
    nature: 'future close-to-close observations; not fills and not trading performance',
  },
  costs: {
    name: 'research-flat-10bps-per-side-v1',
    per_side_bps: 10,
    round_trip_bps: 20,
    excludes: ['dividends', 'borrow'],
  },
  coverage: { recorded: 100, matured: 80, evaluated: 72, missing: 8 },
  corrections: 3,
  date_counts: { decision_sessions: 7, first: '2026-09-21', last: '2026-09-29' },
  provisional: true,
  overall: group,
  by_rule: [{ ...group, key: 'composite-observed-v1' }],
  by_side: [{ ...group, key: 'unassigned' }],
  by_calendar_month: [{ ...group, key: '2026-09' }],
  collection_enabled: false,
  generated_at: '2026-10-30T12:00:00Z',
}

function mockReport(state: Partial<ReturnType<typeof useResearchPerformance>>) {
  vi.mocked(useResearchPerformance).mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...state,
  } as never)
}

beforeEach(() => {
  vi.mocked(useResearchObservations).mockReturnValue({
    data: { items: [], total: 0, page: 1, page_size: 50 },
    isPending: false,
    isError: false,
  } as never)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test('shows every coverage count instead of only the evaluated rows', () => {
  mockReport({ data: report })
  renderWithProviders(<ResearchPerformancePanel />)

  expect(screen.getByText('100 recorded')).toBeInTheDocument()
  expect(screen.getByText(/ambiguous 3/)).toBeInTheDocument()
  expect(screen.getByText('80 mature')).toBeInTheDocument()
  expect(screen.getByText('72 evaluated')).toBeInTheDocument()
  expect(screen.getByText('8 missing')).toBeInTheDocument()
  expect(screen.getByText('Provisional sample')).toBeInTheDocument()
  expect(screen.getByText(/7 decision sessions/)).toBeInTheDocument()
  expect(screen.getByText(/research-flat-10bps-per-side-v1/)).toBeInTheDocument()
})

test('each metric shows its own denominator, including a missing benchmark', () => {
  mockReport({ data: report })
  renderWithProviders(<ResearchPerformancePanel />)

  const benchmarkRow = screen.getByRole('row', { name: /beat spy/i })
  expect(benchmarkRow).toHaveTextContent('70')
  expect(benchmarkRow).toHaveTextContent('2 unavailable')
  // Unassigned observations have no side view -- shown as not applicable, not 0%.
  const sideRow = screen.getByRole('row', { name: /positive side return/i })
  expect(sideRow).toHaveTextContent('—')
})

test('collection being off still shows recorded history', () => {
  mockReport({ data: report })
  renderWithProviders(<ResearchPerformancePanel />)
  expect(screen.getByText(/collection is off/i)).toBeInTheDocument()
})

test('changing the horizon is part of the query identity', () => {
  mockReport({ data: report })
  renderWithProviders(<ResearchPerformancePanel />)

  // Radix tabs activate on mouse down.
  fireEvent.mouseDown(screen.getByRole('tab', { name: '3 sessions' }))

  expect(useResearchPerformance).toHaveBeenLastCalledWith(
    expect.objectContaining({ horizon_sessions: 3, source_kind: 'composite_daily' }),
  )
})

test('origin is only offered for follow-through', () => {
  mockReport({ data: report })
  renderWithProviders(<ResearchPerformancePanel />)
  expect(screen.queryByLabelText('Origin')).not.toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'follow_through' } })

  expect(screen.getByLabelText('Origin')).toBeInTheDocument()
})

test('missing rows can be drilled into', () => {
  mockReport({ data: report })
  renderWithProviders(<ResearchPerformancePanel />)

  fireEvent.click(screen.getByRole('button', { name: /show missing rows/i }))

  expect(useResearchObservations).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: 'missing_data' }),
    1,
    50,
    true,
  )
})

test('loading and error states are explicit', () => {
  mockReport({ isPending: true })
  const { unmount } = renderWithProviders(<ResearchPerformancePanel />)
  expect(screen.getByText(/loading prospective results/i)).toBeInTheDocument()
  unmount()

  mockReport({ isError: true, error: new Error('boom') })
  renderWithProviders(<ResearchPerformancePanel />)
  expect(screen.getByText(/could not load prospective results/i)).toBeInTheDocument()
})

test('an empty cohort explains what will accrue', () => {
  mockReport({
    data: {
      ...report,
      coverage: { recorded: 0, matured: 0, evaluated: 0, missing: 0 },
      date_counts: { decision_sessions: 0, first: null, last: null },
    },
  })
  renderWithProviders(<ResearchPerformancePanel />)
  expect(screen.getByText(/no prospective observations recorded/i)).toBeInTheDocument()
})
