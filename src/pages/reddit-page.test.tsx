import { cleanup, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { RedditPage } from './reddit-page'

const api = vi.hoisted(() => ({
  getRedditAuth: vi.fn(),
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
  api.getRedditAuth.mockResolvedValue({
    state: 'valid',
    checked_at: null,
    username: 'market_user',
    public_message: 'Connected',
    cooldown_until: null,
    public_reads_available: true,
  })
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

test('renders Reddit parity controls and Reddit-native source sections', async () => {
  renderWithProviders(<RedditPage />, ['/reddit'])
  expect(await screen.findByRole('heading', { name: /^Reddit/ })).toBeInTheDocument()
  expect(await screen.findByText('Connected')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Trusted subreddits' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Trusted authors' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Refresh feed' })).toBeInTheDocument()
  expect(screen.getByLabelText('Search Reddit by ticker')).toBeInTheDocument()
})

test('disabled state keeps the page visible and shows a Disabled status', async () => {
  api.getRedditAuth.mockResolvedValue({
    state: 'unavailable',
    checked_at: null,
    username: null,
    public_message: 'reddit_intelligence_disabled',
    cooldown_until: null,
    public_reads_available: false,
  })
  renderWithProviders(<RedditPage />, ['/reddit'])
  expect(await screen.findByText('Disabled')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /^Reddit/ })).toBeInTheDocument()
})
