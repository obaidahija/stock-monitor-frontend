import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { MacroNewsItemOut } from '@/types/api'
import { MacroNewsFeed } from './macro-news-feed'

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))

function item(id: number): MacroNewsItemOut {
  return {
    id,
    source: 'rss:cnbc_top_news',
    title: `Macro story ${id}`,
    url: `https://example.com/${id}`,
    summary: null,
    published_at: '2026-10-07T15:00:00Z',
    categories: [],
    sentiment_label: null,
    classification_pending: false,
  } as unknown as MacroNewsItemOut
}

vi.mock('./hooks', () => ({
  useMacroNews: () => ({
    data: Array.from({ length: 25 }, (_, i) => item(i + 1)),
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

afterEach(cleanup)

test('pages macro news 20 at a time with readable source names', () => {
  renderWithProviders(<MacroNewsFeed />)

  expect(screen.getByText('Showing 1–20 of 25')).toBeInTheDocument()
  expect(screen.queryByText('Macro story 21')).not.toBeInTheDocument()
  expect(screen.getAllByText('CNBC')).toHaveLength(20)
})
