import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { AnalysisTab } from './analysis-tab'
import { useAnalysis, useRefreshUniverseScore, useUniverseScore } from './hooks'

vi.mock('./hooks', () => ({
  useAnalysis: vi.fn(),
  useUniverseScore: vi.fn(),
  useRefreshUniverseScore: vi.fn(),
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

function renderAnalysisTab(analysis: Record<string, unknown>) {
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
  return renderWithProviders(<AnalysisTab ticker="NVDA" />)
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
