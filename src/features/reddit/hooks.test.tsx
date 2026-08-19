import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { RedditPageOut, RedditSearchResultOut } from '@/types/api'
import { useRedditFeed, useRedditSearch } from './hooks'

const api = vi.hoisted(() => ({
  getRedditFeed: vi.fn(),
  getRedditSearch: vi.fn(),
}))

vi.mock('@/api/reddit', async (loadOriginal) => ({
  ...(await loadOriginal<typeof import('@/api/reddit')>()),
  ...api,
}))

const pendingPost = { id: 'pending', sentiment_label: null }

function page(sentimentPending: boolean): RedditPageOut {
  return {
    items: [pendingPost] as RedditPageOut['items'],
    sentiment_pending: sentimentPending,
    total: 1,
    page: 1,
    page_size: 25,
    generated_at: '2026-08-17T12:00:00Z',
    stale: false,
    reason: null,
  }
}

function searchResult(sentimentPending: boolean): RedditSearchResultOut {
  return {
    items: [pendingPost] as RedditSearchResultOut['items'],
    sentiment_pending: sentimentPending,
    generated_at: '2026-08-17T12:00:00Z',
    cache_age_seconds: 0,
    operation: null,
    stale: false,
    stale_reason: null,
  }
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

test('feed polls every 30 seconds only while sentiment is pending', async () => {
  api.getRedditFeed
    .mockResolvedValueOnce(page(true))
    .mockResolvedValueOnce(page(false))
  const { result } = renderHook(
    () => useRedditFeed({ filter: 'all', sort: 'signal', page: 1 }),
    { wrapper: createWrapper() },
  )
  await vi.waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(api.getRedditFeed).toHaveBeenCalledTimes(1)
  expect(result.current.data?.items[0]?.id).toBe('pending')

  await act(async () => vi.advanceTimersByTimeAsync(30_000))
  expect(api.getRedditFeed).toHaveBeenCalledTimes(2)
  expect(result.current.data?.items[0]?.id).toBe('pending')

  await act(async () => vi.advanceTimersByTimeAsync(60_000))
  expect(api.getRedditFeed).toHaveBeenCalledTimes(2)
})

test('ticker search polls every 30 seconds only while sentiment is pending', async () => {
  api.getRedditSearch
    .mockResolvedValueOnce(searchResult(true))
    .mockResolvedValueOnce(searchResult(false))
  const { result } = renderHook(() => useRedditSearch('NVDA'), {
    wrapper: createWrapper(),
  })
  await vi.waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(api.getRedditSearch).toHaveBeenCalledTimes(1)
  expect(result.current.data?.items[0]?.id).toBe('pending')

  await act(async () => vi.advanceTimersByTimeAsync(30_000))
  expect(api.getRedditSearch).toHaveBeenCalledTimes(2)
  expect(result.current.data?.items[0]?.id).toBe('pending')

  await act(async () => vi.advanceTimersByTimeAsync(60_000))
  expect(api.getRedditSearch).toHaveBeenCalledTimes(2)
})
