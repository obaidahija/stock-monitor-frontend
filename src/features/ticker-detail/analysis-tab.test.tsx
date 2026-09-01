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
