import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useAnalyzeNewsItem, useNewsItemAnalysis } from './hooks'
import { renderWithProviders } from '@/test/render'
import type { NewsItemAnalysisOut } from '@/types/api'
import { NewsAnalysisSheet } from './news-analysis-sheet'

vi.mock('./hooks', () => ({
  useNewsItemAnalysis: vi.fn(),
  useAnalyzeNewsItem: vi.fn(),
}))

afterEach(cleanup)

const ANALYSIS: NewsItemAnalysisOut = {
  item: {
    id: 7,
    source: 'yahoo',
    url: 'https://finance.yahoo.com/a',
    title: 'Nike beats on revenue',
    summary: null,
    ai_summary: null,
    published_at: '2026-11-26T12:00:00Z',
    fetched_at: '2026-11-26T12:01:00Z',
    sentiment_label: null,
    sentiment_score: null,
    sentiment_classified_at: null,
    event_category: null,
    is_material: true,
  },
  status: 'readable',
  error_code: null,
  label: 'strong_positive',
  net_score: 0.8,
  positive_count: 1,
  negative_count: 1,
  neutral_count: 0,
  factors: [
    {
      span_id: 0,
      paragraph_id: 'P1',
      evidence: 'Revenue rose 4% to $11.7 billion.',
      direction: 'positive',
      claim_type: 'reported',
      event_type: 'earnings_revenue',
      materiality: 'high',
      score: 0.97,
    },
    {
      span_id: 3,
      paragraph_id: 'P2',
      evidence: 'Tariffs could squeeze margins next quarter.',
      direction: 'negative',
      claim_type: 'conditional',
      event_type: 'costs_margins',
      materiality: 'medium',
      score: 0.9,
    },
  ],
  hidden_low_factors: 2,
  price_moves: [{ span_id: 5, paragraph_id: 'P3', evidence: 'Shares rose 6% after hours.' }],
  overview: { text: 'Nike revenue rose while tariffs weigh.', method: 'bart-large-cnn', unsupported_numbers: [] },
  relevance: { score: 90, level: 'direct', relevant_paragraphs: 9, paragraphs: 10 },
  resolved_url: null,
  model_version: 'news-analysis-v2@v1',
  analyzed_at: '2026-11-26T12:05:00Z',
  seconds: 1.2,
}

function renderPage(data: NewsItemAnalysisOut | null, mutate = vi.fn()) {
  vi.mocked(useNewsItemAnalysis).mockReturnValue({
    data,
    isPending: false,
    isSuccess: true,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never)
  vi.mocked(useAnalyzeNewsItem).mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    mutate,
  } as never)
  renderWithProviders(<NewsAnalysisSheet ticker="NKE" itemId={7} title="Loading title" onOpenChange={vi.fn()} />)
  return mutate
}

test('shows the label, overview, factors by direction and the price move', () => {
  renderPage(ANALYSIS)

  expect(screen.getByText('Nike beats on revenue')).toBeInTheDocument()
  expect(screen.getByText('Strong positive')).toBeInTheDocument()
  expect(screen.getByText('Nike revenue rose while tariffs weigh.')).toBeInTheDocument()
  expect(screen.getByText('Positive business factors')).toBeInTheDocument()
  expect(screen.getByText('“Revenue rose 4% to $11.7 billion.”')).toBeInTheDocument()
  expect(screen.getByText('Negative business factors')).toBeInTheDocument()
  expect(screen.queryByText('Neutral / unresolved')).not.toBeInTheDocument()
  expect(screen.getByText('“Shares rose 6% after hours.”')).toBeInTheDocument()
  expect(screen.getByText(/2 low-materiality factors are not shown/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Original/ })).toHaveAttribute('href', 'https://finance.yahoo.com/a')
})

test('analyzes on open when there is no saved analysis', () => {
  const mutate = renderPage(null)

  expect(mutate).toHaveBeenCalledWith(false)
  expect(screen.getByText('Loading title')).toBeInTheDocument()
})

test('explains an unreadable article', () => {
  renderPage({ ...ANALYSIS, status: 'unreadable', error_code: 'non_extractable', factors: [] })

  expect(screen.getByText('This article could not be read')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument()
})
