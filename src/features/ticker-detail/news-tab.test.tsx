import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { NewsClusterOut } from '@/types/api'
import { useNews } from './hooks'
import { NewsTab } from './news-tab'

vi.mock('./hooks', () => ({
  useNews: vi.fn(),
  useRefreshNews: () => ({ isPending: false, mutate: vi.fn() }),
}))
vi.mock('./sentiment-trend-chart', () => ({ SentimentTrendChart: () => <div>Sentiment trend chart</div> }))
vi.mock('./news-cluster-detail-dialog', () => ({ NewsClusterDetailDialog: () => null }))
vi.mock('./news-weekly-card', () => ({ NewsWeeklyCard: () => null }))
vi.mock('./news-analysis-sheet', () => ({
  NewsAnalysisSheet: ({ itemId, title }: { itemId: number | null; title?: string }) =>
    itemId === null ? null : <div>Analysis panel for {itemId}: {title}</div>,
}))

afterEach(cleanup)

function cluster(id: number, overrides: Partial<NewsClusterOut> = {}): NewsClusterOut {
  return {
    id,
    ticker: 'NVDA',
    representative_title: `Story ${id}`,
    first_seen_at: '2026-10-07T12:00:00Z',
    last_seen_at: '2026-10-07T12:00:00Z',
    source_count: 1,
    item_count: 1,
    sources: ['google_news'],
    sentiment_label: 'positive',
    sentiment_net_score: 1,
    event_category: null,
    is_material: true,
    analysis: { status: 'readable', item_id: id * 10, label: 'positive' },
    ...overrides,
  }
}

function renderNews(clusters: NewsClusterOut[], initialEntries = ['/']) {
  vi.mocked(useNews).mockReturnValue({
    data: clusters,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never)
  return renderWithProviders(<NewsTab ticker="NVDA" />, initialEntries)
}

test('opens with the sentiment trend above the headlines', () => {
  renderNews([cluster(1)])

  const chart = screen.getByText('Sentiment trend chart')
  expect(chart.compareDocumentPosition(screen.getByText('Story 1')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('names sources the way a reader knows them', () => {
  renderNews([cluster(1, { sources: ['finviz:TIKR', 'finnhub:Yahoo', 'google_news'] })])

  expect(screen.getByText('TIKR, Yahoo, Google News')).toBeInTheDocument()
})

test('counts article labels for the stories on screen', () => {
  renderNews([
    cluster(1, { analysis: { status: 'readable', item_id: 10, label: 'strong_positive' } }),
    cluster(2, { analysis: { status: 'readable', item_id: 20, label: 'negative' } }),
    cluster(3, { analysis: { status: 'pending', item_id: 30 } }),
  ])

  expect(
    screen.getByText('3 stories · 1 positive · 1 negative · 0 neutral · 1 not analyzed yet'),
  ).toBeInTheDocument()
  expect(screen.getByText('Strong positive')).toBeInTheDocument()
  expect(screen.getByText('Not analyzed yet')).toBeInTheDocument()
})

test('opens the analysis in a side panel for a story', async () => {
  const user = userEvent.setup()
  renderNews([cluster(4)])

  expect(screen.queryByText(/Analysis panel/)).not.toBeInTheDocument()
  await user.click(screen.getByText('Story 4'))

  expect(screen.getByText('Analysis panel for 40: Story 4')).toBeInTheDocument()
})

test('reopens the article named in the URL, e.g. after a refresh', () => {
  renderNews([cluster(4)], ['/stocks/NVDA?tab=news&article=40'])

  expect(screen.getByText('Analysis panel for 40: Story 4')).toBeInTheDocument()
})

test('ignores a malformed article link', () => {
  renderNews([cluster(4)], ['/stocks/NVDA?tab=news&article=abc'])

  expect(screen.queryByText(/Analysis panel/)).not.toBeInTheDocument()
})

test('Material only hides routine stories', async () => {
  const user = userEvent.setup()
  renderNews([cluster(1), cluster(2, { is_material: false })])

  await user.click(screen.getByRole('button', { name: 'Material only' }))

  expect(screen.getByText('Story 1')).toBeInTheDocument()
  expect(screen.queryByText('Story 2')).not.toBeInTheDocument()
  expect(screen.getByText('1 story · 1 positive · 0 negative · 0 neutral')).toBeInTheDocument()
})

test('says when Material only leaves nothing', async () => {
  const user = userEvent.setup()
  renderNews([cluster(1, { is_material: false })])

  await user.click(screen.getByRole('button', { name: 'Material only' }))

  expect(screen.getByText('No material news in this window')).toBeInTheDocument()
})

test('pages long lists 20 at a time', async () => {
  const user = userEvent.setup()
  renderNews(Array.from({ length: 25 }, (_, i) => cluster(i + 1)))

  expect(screen.getByText('Showing 1–20 of 25')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  expect(screen.getByText('Story 21')).toBeInTheDocument()
  expect(screen.queryByText('Story 1')).not.toBeInTheDocument()
})
