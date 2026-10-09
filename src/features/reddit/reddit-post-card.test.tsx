import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { RedditPostOut } from '@/types/api'
import { RedditPostCard } from './reddit-post-card'

afterEach(cleanup)

const post = {
  id: 'p1',
  subreddit: 'stocks',
  author: 'investor',
  created_at: '2026-10-07T15:00:00Z',
  title: 'NVDA thread',
  selftext: 'Body text',
  over_18: false,
  ticker_matches: [{ ticker: 'NVDA' }],
  is_trusted: true,
  is_viral: false,
  sentiment_label: 'positive',
  post_type: 'news',
  metrics: { score: 1, num_comments: 12 },
  signal_score: { final_score: 84.4 },
} as unknown as RedditPostOut

test('reads like a Twitter row: score badge, trusted pill, singular counts', () => {
  renderWithProviders(<RedditPostCard post={post} onSelect={vi.fn()} />)

  expect(screen.getByText('84')).toBeInTheDocument()
  expect(screen.getByText('Trusted')).toBeInTheDocument()
  expect(screen.getByText('1 point')).toBeInTheDocument()
  expect(screen.getByText('12 comments')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '$NVDA' })).toHaveAttribute('href', '/stocks/NVDA')
})
