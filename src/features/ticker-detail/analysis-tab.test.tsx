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
