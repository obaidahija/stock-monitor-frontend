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
    ...overrides,
  }
}

function renderNews(clusters: NewsClusterOut[]) {
  vi.mocked(useNews).mockReturnValue({
    data: clusters,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never)
  return renderWithProviders(<NewsTab ticker="NVDA" />)
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

test('counts sentiment for the stories on screen', () => {
  renderNews([cluster(1), cluster(2, { sentiment_label: 'negative' }), cluster(3, { sentiment_label: null })])

  expect(screen.getByText('3 stories · 1 positive · 1 negative · 0 neutral · 1 unscored')).toBeInTheDocument()
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
