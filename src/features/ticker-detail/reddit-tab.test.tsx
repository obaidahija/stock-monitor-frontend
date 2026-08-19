import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { RedditPostOut } from '@/types/api'
import { RedditTab } from './reddit-tab'

const mutate = vi.fn()

vi.mock('@/features/reddit/hooks', () => ({
  useRedditSearch: vi.fn(() => ({
    data: {
      items: [
        {
          id: 'post-1',
          subreddit: 'stocks',
          author: 'investor',
          created_at: '2026-08-16T10:00:00Z',
          title: '$NVDA Reddit discussion',
          selftext: 'Cached analysis',
          over_18: false,
          ticker_matches: [{ ticker: 'NVDA' }],
          is_trusted: true,
          is_viral: false,
          sentiment_label: 'bullish',
          metrics: { score: 42, num_comments: 9 },
          signal_score: { final_score: 8.2 },
        } as RedditPostOut,
      ],
      generated_at: '2026-08-16T10:00:00Z',
      operation: null,
    },
    isPending: false,
    isError: false,
    error: null,
  })),
  useSearchRedditTicker: vi.fn(() => ({ mutate, isPending: false, data: null })),
  useRedditThread: vi.fn(() => ({ data: null })),
  useRefreshRedditThread: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

vi.mock('@/features/reddit/use-operation-poll', () => ({
  useRedditOperationPoll: vi.fn(() => ({ data: null })),
}))

beforeEach(() => mutate.mockReset())

test('shows cached Reddit results before an explicit refresh', async () => {
  const user = userEvent.setup()
  renderWithProviders(<RedditTab ticker="NVDA" />)

  expect(screen.getByText('$NVDA Reddit discussion')).toBeInTheDocument()
  expect(mutate).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'Refresh Reddit' }))
  expect(mutate).toHaveBeenCalledWith({ ticker: 'NVDA', force: true })
})
