import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { RedditPage } from './reddit-page'

const api = vi.hoisted(() => ({
  getRedditFeed: vi.fn(),
  getTrustedSubreddits: vi.fn(),
  getTrustedRedditAuthors: vi.fn(),
}))

vi.mock('@/api/reddit', async (loadOriginal) => ({
  ...(await loadOriginal<typeof import('@/api/reddit')>()),
  ...api,
}))

beforeEach(() => {
  cleanup()
  api.getRedditFeed.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    page_size: 25,
    generated_at: '2026-08-16T12:00:00Z',
    stale: false,
    reason: null,
  })
  api.getTrustedSubreddits.mockResolvedValue([])
  api.getTrustedRedditAuthors.mockResolvedValue([])
})

// The page title and Reddit login status live in the Social page header (see routes.test.tsx).
test('renders Reddit parity controls with sources folded away', async () => {
  const user = userEvent.setup()
  renderWithProviders(<RedditPage />, ['/social/reddit'])
  expect(screen.getByRole('button', { name: 'Refresh feed' })).toBeInTheDocument()
  expect(screen.getByLabelText('Search Reddit by ticker')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Trusted subreddits' })).not.toBeInTheDocument()

  await user.click(await screen.findByRole('button', { name: /^Sources/ }))

  expect(await screen.findByRole('heading', { name: 'Trusted subreddits' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Trusted authors' })).toBeInTheDocument()
})

test('sources sit above the feed', async () => {
  renderWithProviders(<RedditPage />, ['/social/reddit'])

  const sources = await screen.findByRole('button', { name: /^Sources/ })
  const feed = screen.getByRole('heading', { name: 'Feed' })
  expect(sources.compareDocumentPosition(feed) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('a subreddit filter stays visible after the sources panel is closed', async () => {
  const user = userEvent.setup()
  api.getTrustedSubreddits.mockResolvedValue([
    { name: 'stocks', enabled: true, default_sort: 'new', post_limit: null, last_successful_fetch_at: null, operation: null },
  ])
  renderWithProviders(<RedditPage />, ['/social/reddit'])

  const sources = await screen.findByRole('button', { name: /^Sources/ })
  await user.click(sources)
  await user.click(await screen.findByRole('button', { name: 'Filter feed by r/stocks' }))
  await user.click(sources)

  expect(screen.getByRole('button', { name: 'Stop filtering by r/stocks' })).toBeInTheDocument()
})

test('removing the subreddit chip stops filtering the feed', async () => {
  const user = userEvent.setup()
  renderWithProviders(<RedditPage />, ['/social/reddit?subreddits=stocks'])
  await waitFor(() =>
    expect(api.getRedditFeed).toHaveBeenCalledWith(expect.objectContaining({ subreddits: ['stocks'] })),
  )

  await user.click(await screen.findByRole('button', { name: 'Stop filtering by r/stocks' }))

  await waitFor(() =>
    expect(api.getRedditFeed).toHaveBeenLastCalledWith(expect.objectContaining({ subreddits: [] })),
  )
  expect(screen.queryByRole('button', { name: 'Stop filtering by r/stocks' })).not.toBeInTheDocument()
})
