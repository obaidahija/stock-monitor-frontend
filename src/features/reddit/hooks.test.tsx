import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { redditOperation, redditPost, redditSearch } from '@/test/reddit-fixtures'
import type { RedditPageOut, RedditSearchResultOut } from '@/types/api'
import {
  useRedditFeed,
  useRedditSearch,
  useRedditSearchFollow,
  useSearchRedditTicker,
} from './hooks'

const api = vi.hoisted(() => ({
  getRedditFeed: vi.fn(),
  getRedditSearch: vi.fn(),
  getRedditOperation: vi.fn(),
  searchRedditTicker: vi.fn(),
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
  vi.resetAllMocks()
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

// vi.waitFor advances fake timers synchronously, which never resolves the query promise
// chain; letting the clock run asynchronously for a moment does.
async function settle() {
  await act(async () => vi.advanceTimersByTimeAsync(50))
}

// Query results only re-render for properties read during render, so the copies here
// read every property the assertions use.
function useSearchScope(ticker: string) {
  return {
    start: useSearchRedditTicker(),
    signal: { ...useRedditSearch(ticker, 'signal') },
    newest: { ...useRedditSearch(ticker, 'newest') },
    feed: { ...useRedditFeed({ filter: 'all', sort: 'signal', page: 1, tickers: [ticker] }) },
    follow: useRedditSearchFollow(ticker),
  }
}

test('a queued search is followed to completion even after a cache read drops its handle', async () => {
  const post = redditPost('p1', '$NVDA collected later')
  let collected = false
  api.getRedditFeed.mockResolvedValue(page(false))
  // The cache read reports the latest *succeeded* operation, never the queued one.
  api.getRedditSearch.mockImplementation(async () => redditSearch(collected ? [post] : []))
  api.searchRedditTicker.mockResolvedValue(redditSearch([], redditOperation('op-1', 'queued')))
  api.getRedditOperation
    .mockResolvedValueOnce(redditOperation('op-1', 'queued'))
    .mockResolvedValueOnce(redditOperation('op-1', 'running'))
    .mockImplementation(async () => {
      collected = true
      return redditOperation('op-1', 'succeeded')
    })
  const { result } = renderHook(() => useSearchScope('NVDA'), { wrapper: createWrapper() })
  await vi.waitFor(() => expect(result.current.newest.isSuccess).toBe(true))

  await act(async () => result.current.start.mutate({ ticker: 'NVDA', force: true }))
  await vi.waitFor(() => expect(result.current.follow.operation?.status).toBe('queued'))
  // A cache read while the operation is still queued must not lose it.
  await act(async () => result.current.signal.refetch())
  await settle()
  expect(result.current.signal.data?.operation).toBeNull()
  expect(result.current.follow.operation?.status).toBe('queued')
  const feedCalls = api.getRedditFeed.mock.calls.length

  await act(async () => vi.advanceTimersByTimeAsync(2_000))
  await vi.waitFor(() => expect(result.current.follow.operation?.status).toBe('running'))
  await act(async () => vi.advanceTimersByTimeAsync(2_000))

  await vi.waitFor(() => expect(result.current.signal.data?.items).toEqual([post]))
  await vi.waitFor(() => expect(result.current.newest.data?.items).toEqual([post]))
  await vi.waitFor(() => expect(api.getRedditFeed.mock.calls.length).toBeGreaterThan(feedCalls))
  expect(result.current.follow.operation).toBeNull()

  const operationCalls = api.getRedditOperation.mock.calls.length
  await act(async () => vi.advanceTimersByTimeAsync(20_000))
  expect(api.getRedditOperation).toHaveBeenCalledTimes(operationCalls)
})

test('a fresh cache answers immediately and nothing is followed', async () => {
  const post = redditPost('p1', '$NVDA already cached')
  api.getRedditFeed.mockResolvedValue(page(false))
  api.getRedditSearch.mockResolvedValue(redditSearch([post]))
  api.searchRedditTicker.mockResolvedValue(redditSearch([post]))
  const { result } = renderHook(() => useSearchScope('NVDA'), { wrapper: createWrapper() })

  await act(async () => result.current.start.mutate({ ticker: 'NVDA', force: false }))
  await act(async () => vi.advanceTimersByTimeAsync(10_000))

  await vi.waitFor(() => expect(result.current.signal.data?.items).toEqual([post]))
  expect(result.current.follow.operation).toBeNull()
  expect(api.getRedditOperation).not.toHaveBeenCalled()
})

test('a failed search keeps its cached results and its failure until retried', async () => {
  const cached = redditPost('p0', '$NVDA from yesterday')
  api.getRedditFeed.mockResolvedValue(page(false))
  api.getRedditSearch.mockResolvedValue(redditSearch([cached]))
  api.searchRedditTicker.mockResolvedValue(redditSearch([cached], redditOperation('op-1', 'queued')))
  api.getRedditOperation.mockResolvedValue(
    redditOperation('op-1', 'failed', { public_error_message: 'Reddit is rate limiting requests' }),
  )
  const { result } = renderHook(() => useSearchScope('NVDA'), { wrapper: createWrapper() })

  await act(async () => result.current.start.mutate({ ticker: 'NVDA', force: true }))
  await vi.waitFor(() => expect(result.current.follow.operation?.status).toBe('failed'))
  await act(async () => vi.advanceTimersByTimeAsync(10_000))

  expect(result.current.follow.operation?.public_error_message).toBe('Reddit is rate limiting requests')
  expect(result.current.signal.data?.items).toEqual([cached])
  expect(api.getRedditOperation).toHaveBeenCalledTimes(1)
})
