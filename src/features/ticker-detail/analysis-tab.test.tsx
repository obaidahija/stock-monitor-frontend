import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { AnalysisTab } from './analysis-tab'
import {
  useAnalysis,
  useAnalystPriceTargetHistory,
  useRefreshUniverseScore,
  useUniverseScore,
} from './hooks'

vi.mock('./hooks', () => ({
  useAnalysis: vi.fn(),
  useAnalystPriceTargetHistory: vi.fn(() => ({ data: undefined, isFetching: false })),
  useUniverseScore: vi.fn(),
  useRefreshUniverseScore: vi.fn(),
}))

const researchCapabilities = vi.hoisted(() => ({ swing: false }))

vi.mock('@/features/research/hooks', () => ({
  useResearchCapabilities: () => ({
    data: {
      swing_research_enabled: researchCapabilities.swing,
      research_outcomes_v2_enabled: false,
      catalyst_scanner_enabled: false,
      follow_through_enabled: false,
      event_window_v2_enabled: false,
      research_intraday_enabled: false,
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

vi.mock('./sentiment-trend-chart', () => ({
  SentimentTrendChart: () => null,
}))

vi.mock('./chart-pattern-card', () => ({
  ChartPatternCard: () => null,
}))

vi.mock('./score-history-chart', () => ({
  ScoreHistoryChart: () => null,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  researchCapabilities.swing = false
})

test('does not render a forecast control in stock analysis', () => {
  const analysis = {
    ticker: 'NVDA',
    lean: 'neutral',
    overall_score: 0,
    components: [],
    price_levels: null,
    reversal_setup: null,
    analyst_detail: null,
    chart_pattern: null,
    caveats: [],
    generated_at: '2026-08-26T12:00:00Z',
  }
  vi.mocked(useAnalysis).mockImplementation((_ticker, _extras, enabled = true) =>
    ({
      data: enabled ? analysis : undefined,
      isPending: false,
      isError: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    }) as never,
  )
  vi.mocked(useUniverseScore).mockReturnValue({ data: null, isPending: false } as never)
  vi.mocked(useRefreshUniverseScore).mockReturnValue({
    isPending: false,
    mutate: vi.fn(),
  } as never)

  renderWithProviders(<AnalysisTab ticker="NVDA" />)

  expect(screen.queryByText('Price forecast')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /generate forecast/i })).not.toBeInTheDocument()
  expect(useAnalysis).toHaveBeenNthCalledWith(
    2,
    'NVDA',
    { includeChartPattern: false },
    false,
  )
})

const baseAnalysis = {
  ticker: 'NVDA',
  lean: 'neutral',
  overall_score: 0,
  components: [],
  price_levels: null,
  reversal_setup: null,
  analyst_detail: null,
  chart_pattern: null,
  short_interest: null,
  peer_rank: null,
  caveats: [],
  generated_at: '2026-08-26T12:00:00Z',
}

function renderAnalysisTab(analysis: Record<string, unknown>, initialEntries = ['/']) {
  vi.mocked(useAnalysis).mockImplementation((_ticker, _extras, enabled = true) =>
    ({
      data: enabled ? analysis : undefined,
      isPending: false,
      isError: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    }) as never,
  )
  vi.mocked(useUniverseScore).mockReturnValue({ data: null, isPending: false } as never)
  vi.mocked(useRefreshUniverseScore).mockReturnValue({
    isPending: false,
    mutate: vi.fn(),
  } as never)
  return renderWithProviders(<AnalysisTab ticker="NVDA" />, initialEntries)
}

test('shows the peer rank and short interest when present', async () => {
  renderAnalysisTab({
    ...baseAnalysis,
    peer_rank: {
      group_kind: 'sector',
      group_label: 'Technology',
      rank: 7,
      group_size: 63,
      percentile: 90.3,
    },
    short_interest: {
      short_percent_of_float: 23.45,
      short_ratio: 4.2,
      float_shares: 51_000_000,
      held_percent_institutions: 74.12,
      held_percent_insiders: 1.83,
    },
  })

  expect(await screen.findByText(/#7 of 63 in Technology/)).toBeInTheDocument()
  expect(await screen.findByText('Short interest & ownership')).toBeInTheDocument()
})

test('omits both sections when the API returns null', async () => {
  renderAnalysisTab({ ...baseAnalysis, peer_rank: null, short_interest: null })

  expect(await screen.findByText(/Score factors/)).toBeInTheDocument()
  expect(screen.queryByText('Short interest & ownership')).not.toBeInTheDocument()
  expect(screen.queryByText(/ in Technology/)).not.toBeInTheDocument()
})

test('labels a zero-weight factor as not scored instead of neutral', async () => {
  renderAnalysisTab({
    ...baseAnalysis,
    components: [
      {
        name: 'insider',
        score: 0,
        weight: 0,
        explanation: 'No scoreable insider decisions in the selected window.',
      },
    ],
  })

  expect(await screen.findByText('Insider')).toBeInTheDocument()
  expect(screen.getByText('Not scored')).toBeInTheDocument()
})

test('shows the expected move and reachability beside the reference levels', async () => {
  renderAnalysisTab({
    ...baseAnalysis,
    price_levels: {
      support: 165.2,
      support_label: '20-day low',
      resistance: 188.37,
      resistance_label: '20-day high',
      position: 'mid_range',
      note: 'Currently $173.72.',
      atr_pct: 4.1,
      expected_move_1d_pct: 4.7,
      expected_move_5d_pct: 10.4,
      expected_move_7d_pct: 12.3,
      distance_to_resistance_pct: 8.4,
      resistance_distance_atr: 2.1,
      resistance_reachability: 'reachable',
    },
  })

  expect(await screen.findByText(/10\.4% \(5 trading sessions\)/)).toBeInTheDocument()
  expect(await screen.findByText(/2\.1 ATR away/)).toBeInTheDocument()
  expect(await screen.findByText('Reachable')).toBeInTheDocument()
})

test('omits the volatility rows when the backend reported none', async () => {
  renderAnalysisTab({
    ...baseAnalysis,
    price_levels: {
      support: 90,
      support_label: '20-day low',
      resistance: 120,
      resistance_label: '52-week high',
      position: 'mid_range',
      note: 'Currently $100.00.',
      atr_pct: null,
      expected_move_1d_pct: null,
      expected_move_5d_pct: null,
      expected_move_7d_pct: null,
      distance_to_resistance_pct: null,
      resistance_distance_atr: null,
      resistance_reachability: null,
    },
  })

  expect(await screen.findByText('Reference price levels')).toBeInTheDocument()
  expect(screen.queryByText('Typical move')).not.toBeInTheDocument()
})

const selectedWindow = {
  starts_at: '2026-09-21T18:00:00Z',
  anchor_session: '2026-09-21',
  horizon_sessions: 3,
  expires_at: '2026-09-23T20:00:00Z',
  expires_on: '2026-09-23',
  calendar: 'XNYS',
  window_version: 'swing-window-v1',
}

function selectedVolatility(overrides: Record<string, unknown> = {}) {
  return {
    horizon_sessions: 3,
    move_pct: null,
    sample_count: 60,
    reason: 'unknown_price_basis',
    quality: {
      status: 'unavailable',
      as_of: '2026-09-18T20:00:00Z',
      fetched_at: '2026-09-21T12:00:00Z',
      sources: [{ name: 'ticker_analysis_snapshot', status: 'ok' }],
      reasons: ['unknown_price_basis'],
      price_basis: 'unknown',
      market_session: null,
    },
    ...overrides,
  }
}

test('keeps the legacy request while swing research is off', async () => {
  renderAnalysisTab(baseAnalysis, ['/stocks/NVDA?horizon_sessions=3'])

  expect(await screen.findByText(/Score factors/)).toBeInTheDocument()
  expect(useAnalysis).toHaveBeenNthCalledWith(1, 'NVDA', {}, true)
  expect(screen.queryByLabelText('Research window')).not.toBeInTheDocument()
})

test('sends the URL research window and shows the server expiry', async () => {
  researchCapabilities.swing = true
  renderAnalysisTab(
    { ...baseAnalysis, research_window: selectedWindow, selected_volatility: selectedVolatility() },
    ['/stocks/NVDA?tab=analysis&horizon_sessions=3'],
  )

  expect(await screen.findByText('Expires Wed, Sep 23, 4:00 PM ET')).toBeInTheDocument()
  expect(useAnalysis).toHaveBeenNthCalledWith(1, 'NVDA', { horizonSessions: 3 }, true)
  expect((screen.getByLabelText('Research window') as HTMLSelectElement).value).toBe('3')
  expect(screen.getByText(/price adjustment basis unknown/i)).toBeInTheDocument()
  // The selection changes the reference only; the composite score is unchanged.
  expect(screen.getByText(/does not change the composite score/i)).toBeInTheDocument()
})

test('shows selected-window calendar coverage from the analysis response', async () => {
  researchCapabilities.swing = true
  renderAnalysisTab({
    ...baseAnalysis,
    research_window: selectedWindow,
    event_window: {
      window: selectedWindow,
      events: [], near_after_expiry: [], highest_severity: null,
      coverage_status: 'unavailable', coverage_sources: [], conflicts: [],
      evaluated_at: '2026-09-21T18:00:00Z', collection_enabled: false,
      historical_knowledge: false,
    },
  }, ['/stocks/NVDA?horizon_sessions=3'])

  expect(await screen.findByText('Events in this window')).toBeInTheDocument()
  expect(screen.getByText(/Calendar coverage incomplete/)).toBeInTheDocument()
})

test('an invalid URL window falls back to five sessions', async () => {
  researchCapabilities.swing = true
  renderAnalysisTab(baseAnalysis, ['/stocks/NVDA?horizon_sessions=9'])

  expect(await screen.findByText(/Score factors/)).toBeInTheDocument()
  expect(useAnalysis).toHaveBeenNthCalledWith(1, 'NVDA', { horizonSessions: 5 }, true)
})

test('changing the window requests the new selection', async () => {
  researchCapabilities.swing = true
  renderAnalysisTab(baseAnalysis, ['/stocks/NVDA?horizon_sessions=3'])

  fireEvent.change(await screen.findByLabelText('Research window'), { target: { value: '7' } })

  expect(useAnalysis).toHaveBeenLastCalledWith(
    'NVDA',
    { includeChartPattern: false, horizonSessions: 7 },
    false,
  )
  expect(useAnalysis).toHaveBeenCalledWith('NVDA', { horizonSessions: 7 }, true)
})

test('shows a computed selected-horizon move with its sample size', async () => {
  researchCapabilities.swing = true
  renderAnalysisTab(
    {
      ...baseAnalysis,
      research_window: selectedWindow,
      selected_volatility: selectedVolatility({
        move_pct: 1.7234,
        reason: null,
        quality: { ...selectedVolatility().quality, status: 'ok', reasons: [] },
      }),
    },
    ['/stocks/NVDA?horizon_sessions=3'],
  )

  expect(await screen.findByText(/±1\.72%/)).toBeInTheDocument()
  expect(screen.getByText(/60 daily returns/)).toBeInTheDocument()
})

const baseAnalystDetail = {
  strong_buy: null,
  buy: null,
  hold: null,
  sell: null,
  strong_sell: null,
  price_target_low: null,
  price_target_high: null,
  price_target_mean: null,
  price_target_median: null,
  num_analysts: null,
  recent_actions: [],
  recent_price_target_change: null,
}

test('labels a same-grade action as Reiterated, not "Buy → Buy"', () => {
  vi.mocked(useAnalystPriceTargetHistory).mockReturnValue({
    data: [
      {
        firm: 'Rosenblatt',
        action_at: '2026-09-17T14:00:00Z',
        price_target_action: 'Maintains',
        current_price_target: 525.0,
        prior_price_target: 525.0,
        pct_change: 0,
        action: 'reit',
        from_grade: 'Buy',
        to_grade: 'Buy',
        is_qualifying_change: false,
      },
    ],
    isFetching: false,
  } as never)

  renderAnalysisTab({ ...baseAnalysis, analyst_detail: baseAnalystDetail })

  expect(screen.getByText('Reiterated')).toBeInTheDocument()
  expect(screen.queryByText(/Buy → Buy/)).not.toBeInTheDocument()
  expect(screen.getByText('Buy')).toBeInTheDocument()
})

test('labels an upgrade/downgrade and a target-only revision distinctly', () => {
  vi.mocked(useAnalystPriceTargetHistory).mockReturnValue({
    data: [
      {
        firm: 'Keybanc',
        action_at: '2026-09-28T10:03:05Z',
        price_target_action: null,
        current_price_target: null,
        prior_price_target: null,
        pct_change: null,
        action: 'up',
        from_grade: 'Underweight',
        to_grade: 'Sector Weight',
        is_qualifying_change: false,
      },
      {
        firm: 'Piper Sandler',
        action_at: '2026-09-30T12:04:06Z',
        price_target_action: 'Lowers',
        current_price_target: 251.0,
        prior_price_target: 260.0,
        pct_change: -3.46,
        action: 'main',
        from_grade: 'Overweight',
        to_grade: 'Overweight',
        is_qualifying_change: false,
      },
    ],
    isFetching: false,
  } as never)

  renderAnalysisTab({ ...baseAnalysis, analyst_detail: baseAnalystDetail })

  expect(screen.getByText('Upgraded')).toBeInTheDocument()
  expect(screen.getByText('Underweight → Sector Weight')).toBeInTheDocument()
  expect(screen.getByText('Price target revised')).toBeInTheDocument()
  expect(screen.getByText(/\$260\.00 → \$251\.00/)).toBeInTheDocument()
})

test('falls back to the capped live list while history has not loaded', () => {
  vi.mocked(useAnalystPriceTargetHistory).mockReturnValue({
    data: undefined,
    isFetching: true,
  } as never)

  renderAnalysisTab({
    ...baseAnalysis,
    analyst_detail: {
      ...baseAnalystDetail,
      recent_actions: [
        {
          firm: 'BMO Capital',
          action: 'up',
          from_grade: 'Market Perform',
          to_grade: 'Outperform',
          date: '2026-08-27',
          price_target_action: 'Raises',
          current_price_target: 263.0,
          prior_price_target: 237.0,
        },
      ],
    },
  })

  expect(screen.getByText('BMO Capital')).toBeInTheDocument()
  expect(screen.getByText('Upgraded')).toBeInTheDocument()
  expect(screen.getByText(/refreshing…/)).toBeInTheDocument()
})
