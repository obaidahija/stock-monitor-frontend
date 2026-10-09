import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import type { TwitterPageOut, TwitterPostOut } from '@/types/api'
import { TwitterPage } from './twitter-page'

vi.mock('@/features/twitter/top-mentions-strip', () => ({ TopMentionsStrip: () => null }))

let paths: string[]

function post(id: string): TwitterPostOut {
  return {
    id,
    text: `Feed post ${id}`,
    author_id: '42',
    author_username: 'marketdesk',
    author_name: 'Market Desk',
    author_verified: false,
    created_at: '2026-10-08T11:00:00Z',
    url: `https://x.com/marketdesk/status/${id}`,
    ticker_matches: [],
    metrics: { views: 0, likes: 0, retweets: 0, replies: 0, quotes: 0, bookmarks: 0 },
    is_trusted: true,
    is_viral: false,
    link_domains: [],
    signal_score: null,
    sentiment_label: null,
    sentiment_score: null,
    tweet_type: null,
    tweet_type_score: null,
  } as TwitterPostOut
}

beforeEach(() => {
  paths = []
  vi.spyOn(apiClient, 'get').mockImplementation(async (path: string) => {
    paths.push(path)
    if (path.startsWith('/v1/twitter/trusted-accounts')) return [] as never
    if (path.startsWith('/v1/twitter/feed')) {
      const page: TwitterPageOut = {
        items: [post('1')],
        total: 1,
        page: 1,
        page_size: 25,
        generated_at: '2026-10-08T12:00:00Z',
        stale: false,
        reason: null,
      }
      return page as never
    }
    return {} as never
  })
  vi.spyOn(apiClient, 'post').mockImplementation(async (path: string) => {
    paths.push(`POST ${path}`)
    return { trusted_operations: [] } as never
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test('the general feed never requests the company-post cache', async () => {
  const user = userEvent.setup()
  renderWithProviders(<TwitterPage />)
  expect(await screen.findByText('Feed post 1')).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Trusted' }))
  await waitFor(() => expect(paths.some((path) => path.includes('filter=trusted'))).toBe(true))
  await user.click(screen.getByRole('button', { name: 'Viral' }))
  await waitFor(() => expect(paths.some((path) => path.includes('filter=viral'))).toBe(true))

  expect(paths.filter((path) => path.includes('company-accounts'))).toEqual([])
  expect(paths.every((path) => !path.includes('/posts/ensure'))).toBe(true)
})
