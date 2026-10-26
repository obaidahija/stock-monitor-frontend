import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { redditOperation, redditPost, redditSearch } from '@/test/reddit-fixtures'
import type { RedditOperationOut, RedditPostOut, RedditSearchResultOut } from '@/types/api'
import { RedditPage } from './reddit-page'

const api = vi.hoisted(() => ({
  getRedditFeed: vi.fn(),
  getTrustedSubreddits: vi.fn(),
  getTrustedRedditAuthors: vi.fn(),
  getRedditSearch: vi.fn(),
  searchRedditTicker: vi.fn(),
  getRedditOperation: vi.fn(),
}))

const discover = vi.hoisted(() => ({ searchUniverse: vi.fn() }))

vi.mock('@/api/reddit', async (loadOriginal) => ({
  ...(await loadOriginal<typeof import('@/api/reddit')>()),
  ...api,
}))

vi.mock('@/api/discover', async (loadOriginal) => ({
  ...(await loadOriginal<typeof import('@/api/discover')>()),
  ...discover,
}))

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

beforeEach(() => {
  cleanup()
  discover.searchUniverse.mockImplementation(async (q: string) => [
    { ticker: q.toUpperCase(), company_name: null },
  ])
  api.getRedditSearch.mockResolvedValue(redditSearch([]))
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

// Each ticker's collection runs as its own durable operation; the backend answers the
// search POST with 202 and the cache read only ever reports the latest *succeeded* one.
function backend(cached: Record<string, RedditPostOut[]> = {}) {
  const collected = new Map<string, boolean>()
  const operations = new Map<string, RedditOperationOut>()
  const read = (ticker: string) =>
    redditSearch(
      collected.get(ticker)
        ? [redditPost(`${ticker}-1`, `$${ticker} collected post`)]
        : (cached[ticker] ?? []),
    )
  api.getRedditSearch.mockImplementation(async (ticker: string) => read(ticker))
  // The 202 answer carries whatever is cached right now, plus the queued operation.
  api.searchRedditTicker.mockImplementation(async (ticker: string): Promise<RedditSearchResultOut> => {
    const operation = redditOperation(`op-${ticker}`, 'queued')
    operations.set(operation.id, operation)
    return { ...read(ticker), operation }
  })
  api.getRedditOperation.mockImplementation(async (id: string) => operations.get(id))
  return {
    set(ticker: string, status: RedditOperationOut['status'], message: string | null = null) {
      const id = `op-${ticker}`
      if (status === 'succeeded') collected.set(ticker, true)
      operations.set(id, redditOperation(id, status, { public_error_message: message }))
    },
    polls(ticker: string) {
      return api.getRedditOperation.mock.calls.filter(([id]) => id === `op-${ticker}`).length
    },
    reads(ticker: string) {
      return api.getRedditSearch.mock.calls.filter(([value]) => value === ticker).length
    },
  }
}

async function addTicker(user: ReturnType<typeof userEvent.setup>, ticker: string) {
  await user.type(screen.getByLabelText('Search Reddit by ticker'), ticker)
  await user.click(await screen.findByRole('button', { name: ticker }))
}

function results(ticker: string) {
  return within(screen.getByRole('region', { name: `$${ticker}` }))
}

async function advance(ms: number) {
  await act(async () => vi.advanceTimersByTimeAsync(ms))
}

function setup() {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

test('a queued ticker search fills in its results without a manual refresh', async () => {
  const user = setup()
  const server = backend()
  renderWithProviders(<RedditPage />, ['/social/reddit'])

  await addTicker(user, 'NVDA')

  expect(await results('NVDA').findByText(/queued/i)).toHaveAttribute('role', 'status')
  server.set('NVDA', 'running')
  await advance(2_000)
  expect(await results('NVDA').findByText(/Searching Reddit/i)).toBeInTheDocument()
  const feedReads = api.getRedditFeed.mock.calls.length

  server.set('NVDA', 'succeeded')
  await advance(2_000)

  expect(await results('NVDA').findByText('$NVDA collected post')).toBeInTheDocument()
  expect(results('NVDA').queryByRole('status')).not.toBeInTheDocument()
  await waitFor(() => expect(api.getRedditFeed.mock.calls.length).toBeGreaterThan(feedReads))
  expect(api.getRedditFeed).toHaveBeenLastCalledWith(expect.objectContaining({ tickers: ['NVDA'] }))
})

test('a deferred search says it will retry and still completes', async () => {
  const user = setup()
  const server = backend()
  renderWithProviders(<RedditPage />, ['/social/reddit'])
  await addTicker(user, 'NVDA')

  server.set('NVDA', 'deferred')
  await advance(2_000)
  expect(await results('NVDA').findByText(/retry/i)).toBeInTheDocument()

  server.set('NVDA', 'succeeded')
  await advance(2_000)
  expect(await results('NVDA').findByText('$NVDA collected post')).toBeInTheDocument()
})

test('concurrent ticker searches complete independently and a removed one stops', async () => {
  const user = setup()
  const server = backend()
  renderWithProviders(<RedditPage />, ['/social/reddit'])
  await addTicker(user, 'NVDA')
  await addTicker(user, 'AAPL')
  await addTicker(user, 'TSLA')
  server.set('NVDA', 'running')
  server.set('AAPL', 'running')
  server.set('TSLA', 'running')
  await advance(2_000)
  expect(await results('TSLA').findByText(/Searching Reddit/i)).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Remove TSLA filter' }))
  const tslaPolls = server.polls('TSLA')
  const aaplReads = server.reads('AAPL')
  server.set('NVDA', 'succeeded')
  server.set('TSLA', 'succeeded')
  await advance(4_000)

  expect(await results('NVDA').findByText('$NVDA collected post')).toBeInTheDocument()
  expect(results('AAPL').getByText(/Searching Reddit/i)).toBeInTheDocument()
  expect(server.reads('AAPL')).toBe(aaplReads)
  expect(server.polls('TSLA')).toBe(tslaPolls)
  expect(screen.queryByRole('region', { name: '$TSLA' })).not.toBeInTheDocument()

  server.set('AAPL', 'succeeded')
  await advance(2_000)
  expect(await results('AAPL').findByText('$AAPL collected post')).toBeInTheDocument()
})

test('a failed ticker search keeps cached results visible and retries on request', async () => {
  const user = setup()
  const server = backend({ NVDA: [redditPost('old', '$NVDA cached post')] })
  renderWithProviders(<RedditPage />, ['/social/reddit'])
  await addTicker(user, 'NVDA')

  server.set('NVDA', 'failed', 'Reddit is rate limiting requests')
  await advance(2_000)

  const alert = await results('NVDA').findByRole('alert')
  expect(alert).toHaveTextContent('Reddit is rate limiting requests')
  expect(results('NVDA').getByText('$NVDA cached post')).toBeInTheDocument()
  const polls = server.polls('NVDA')
  await advance(10_000)
  expect(server.polls('NVDA')).toBe(polls)

  await user.click(within(alert).getByRole('button', { name: 'Retry search' }))
  expect(api.searchRedditTicker).toHaveBeenLastCalledWith('NVDA', true)
})

test('an immediate cached answer shows results without following anything', async () => {
  const user = setup()
  const fresh = redditSearch([redditPost('p1', '$NVDA fresh post')])
  api.getRedditSearch.mockResolvedValue(fresh)
  api.searchRedditTicker.mockResolvedValue(fresh)
  renderWithProviders(<RedditPage />, ['/social/reddit'])

  await addTicker(user, 'NVDA')
  await advance(10_000)

  expect(await results('NVDA').findByText('$NVDA fresh post')).toBeInTheDocument()
  expect(results('NVDA').queryByRole('status')).not.toBeInTheDocument()
  expect(api.getRedditOperation).not.toHaveBeenCalled()
})
