import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError, apiClient } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import type { TwitterOperationOut, TwitterPageOut, TwitterPostOut, TwitterSearchResultOut } from '@/types/api'
import type { CompanyAccountOut, CompanyPostsPageOut } from '@/types/twitter-company'
import {
  companyAccount,
  companyPage,
  companyPost,
  twitterOperation,
} from './company-x/test-fixtures'
import { TwitterTab } from './twitter-tab'

type Call = { method: string; path: string; body?: unknown }

let calls: Call[]
let account: CompanyAccountOut | Error
let posts: CompanyPostsPageOut
let trusted: TwitterPageOut
let crowd: TwitterSearchResultOut
let searchOperation: TwitterOperationOut | null
let searchPollError: ApiError | null

function trustedPost(id: string, overrides: Partial<TwitterPostOut> = {}): TwitterPostOut {
  return {
    id,
    text: `Trusted mention ${id}`,
    author_id: '42',
    author_username: 'marketdesk',
    author_name: 'Market Desk',
    author_verified: false,
    created_at: '2026-10-08T11:00:00Z',
    url: `https://x.com/marketdesk/status/${id}`,
    ticker_matches: [{ ticker: 'GOOG', match_kind: 'cashtag', relevance_points: 25 }],
    metrics: { views: 0, likes: 0, retweets: 0, replies: 0, quotes: 0, bookmarks: 0 },
    is_trusted: true,
    is_viral: false,
    link_domains: [],
    signal_score: null,
    sentiment_label: null,
    sentiment_score: null,
    tweet_type: null,
    tweet_type_score: null,
    ...overrides,
  } as TwitterPostOut
}

function trustedPage(items: TwitterPostOut[], total = items.length): TwitterPageOut {
  return {
    items,
    total,
    page: 1,
    page_size: 25,
    generated_at: '2026-10-08T12:00:00Z',
    stale: false,
    reason: null,
  }
}

function crowdResult(
  items: TwitterPostOut[],
  fetchedAt: string | null = '2026-10-08T11:30:00Z',
): TwitterSearchResultOut {
  return {
    items,
    cache_fetched_at: fetchedAt,
    cache_age_seconds: fetchedAt ? 1800 : null,
    operation: null,
    stale: false,
    stale_reason: null,
  }
}

beforeEach(() => {
  calls = []
  searchOperation = null
  searchPollError = null
  account = companyAccount({ mapping_revision: 2 })
  posts = companyPage(account as CompanyAccountOut, { items: [companyPost('901')] })
  trusted = trustedPage([trustedPost('501')])
  crowd = crowdResult([
    trustedPost('801', { text: 'Crowd chatter 801', is_trusted: false, author_username: 'anyone' }),
  ])
  vi.spyOn(apiClient, 'get').mockImplementation(async (path: string) => {
    calls.push({ method: 'GET', path })
    if (path.startsWith('/v1/twitter/company-accounts/')) {
      if (path.includes('/posts')) return posts as never
      if (account instanceof Error) throw account
      return account as never
    }
    if (path.startsWith('/v1/twitter/feed')) return trusted as never
    if (path.startsWith('/v1/twitter/operations/')) {
      if (searchPollError) throw searchPollError
      return searchOperation as never
    }
    if (path.startsWith('/v1/twitter/searches/')) return crowd as never
    return {} as never
  })
  vi.spyOn(apiClient, 'post').mockImplementation(async (path: string, body?: unknown) => {
    calls.push({ method: 'POST', path, body })
    if (path.startsWith('/v1/twitter/searches')) return crowd as never
    return posts as never
  })
  vi.spyOn(apiClient, 'put').mockImplementation(async (path: string, body?: unknown) => {
    calls.push({ method: 'PUT', path, body })
    return account as never
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const posts_ = () => calls.filter((call) => call.method === 'POST')
const feedRequests = () => calls.filter((call) => call.path.startsWith('/v1/twitter/feed'))

test('shows company posts first, then trusted-account mentions, with one ensure', async () => {
  renderWithProviders(<TwitterTab ticker="GOOG" />)

  expect(await screen.findByText('Company update 901')).toBeVisible()
  expect(await screen.findByText('Trusted mention 501')).toBeVisible()
  const headings = screen.getAllByRole('heading').map((heading) => heading.textContent)
  expect(headings.indexOf('Company posts')).toBeLessThan(
    headings.indexOf('Trusted-account mentions'),
  )
  await waitFor(() =>
    expect(posts_()).toEqual([
      {
        method: 'POST',
        path: '/v1/twitter/company-accounts/GOOG/posts/ensure',
        body: { expected_revision: 2 },
      },
    ]),
  )
  expect(feedRequests()[0].path).toBe('/v1/twitter/feed?filter=trusted&sort=signal&page=1&tickers=GOOG')
})

test('company Refresh goes to its own endpoint with the confirmed revision', async () => {
  const user = userEvent.setup()
  renderWithProviders(<TwitterTab ticker="GOOG" />)
  await screen.findByText('Company update 901')
  await waitFor(() => expect(posts_()).toHaveLength(1))

  await user.click(screen.getByRole('button', { name: 'Refresh company posts' }))

  await waitFor(() => expect(posts_()).toHaveLength(2))
  expect(posts_()[1]).toEqual({
    method: 'POST',
    path: '/v1/twitter/company-accounts/GOOG/posts/refresh',
    body: { expected_revision: 2 },
  })
  // Refreshing company posts never starts a cashtag search.
  for (const call of posts_()) {
    expect(call.path).not.toContain('/v1/twitter/searches')
    expect(JSON.stringify(call.body ?? null)).not.toContain('min_views')
  }
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('crowd posts show the last X search without starting one', async () => {
  renderWithProviders(<TwitterTab ticker="GOOG" />)
  const section = await screen.findByRole('region', { name: 'X search' })
  expect(await within(section).findByText('Crowd chatter 801')).toBeVisible()
  expect(calls.some((call) => call.path === '/v1/twitter/searches/GOOG?sort=signal')).toBe(true)
  await waitFor(() => expect(posts_()).toHaveLength(1)) // the company ensure only
  expect(posts_().some((call) => call.path.startsWith('/v1/twitter/searches'))).toBe(false)
})

test('Search X runs one explicit cashtag search with the chosen minimum views', async () => {
  const user = userEvent.setup()
  renderWithProviders(<TwitterTab ticker="GOOG" />)
  const section = await screen.findByRole('region', { name: 'X search' })
  await within(section).findByText('Crowd chatter 801')

  await user.click(within(section).getByRole('combobox', { name: 'Minimum views' }))
  await user.click(screen.getByRole('option', { name: '5,000 views' }))
  await user.click(within(section).getByRole('button', { name: 'Search X for $GOOG' }))

  await waitFor(() =>
    expect(posts_().filter((call) => call.path.startsWith('/v1/twitter/searches'))).toEqual([
      {
        method: 'POST',
        path: '/v1/twitter/searches?sort=signal',
        body: { ticker: 'GOOG', min_views: 5000 },
      },
    ]),
  )
})

test('a ticker never searched explains how to search', async () => {
  crowd = crowdResult([], null)
  renderWithProviders(<TwitterTab ticker="GOOG" />)
  const section = await screen.findByRole('region', { name: 'X search' })
  expect(await within(section).findByText('X has not been searched for $GOOG yet.')).toBeVisible()
})

test('a completed X search replaces an initial cache read still pending after a sort change', async () => {
  const user = userEvent.setup()
  const previousSearch = crowd
  let finishInitialRead!: (response: TwitterSearchResultOut) => void
  const initialRead = new Promise<TwitterSearchResultOut>((resolve) => { finishInitialRead = resolve })
  let finishOperation!: (operation: TwitterOperationOut) => void
  const operationRead = new Promise<TwitterOperationOut>((resolve) => { finishOperation = resolve })
  let initialReadStarted = false
  const defaultGet = vi.mocked(apiClient.get).getMockImplementation()!
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === '/v1/twitter/searches/GOOG?sort=newest' && !initialReadStarted) {
      calls.push({ method: 'GET', path })
      initialReadStarted = true
      return initialRead as never
    }
    if (path === '/v1/twitter/operations/search-race') {
      calls.push({ method: 'GET', path })
      return operationRead as never
    }
    return defaultGet(path) as never
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false } },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TwitterTab ticker="GOOG" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  try {
    const section = await screen.findByRole('region', { name: 'X search' })
    await within(section).findByText('Crowd chatter 801')
    searchOperation = twitterOperation('search-race', 'queued', 'stock_search')
    crowd = { ...crowd, operation: searchOperation }
    await user.click(within(section).getByRole('button', { name: 'Search X for $GOOG' }))
    await waitFor(() => expect(calls.some((call) => call.path.endsWith('/operations/search-race'))).toBe(true))
    await user.click(within(section).getByRole('button', { name: 'Newest' }))
    await waitFor(() => expect(initialReadStarted).toBe(true))

    crowd = crowdResult([trustedPost('802', { text: 'Finished crowd search' })], '2026-10-08T12:00:00Z')
    await act(async () => finishOperation({ ...searchOperation!, status: 'succeeded' }))
    await waitFor(() => expect(within(section).getByRole('button', { name: 'Search X for $GOOG' })).toBeEnabled())
    // The old HTTP response can still arrive after cancellation: it must never
    // replace the passive read made after the search completed.
    await act(async () => finishInitialRead(previousSearch))

    expect(await within(section).findByText('Finished crowd search')).toBeVisible()
    expect(within(section).queryByText('Crowd chatter 801')).not.toBeInTheDocument()
    expect(queryClient.getQueryData(['twitter', 'search', 'GOOG', 'newest'])).toMatchObject({
      cache_fetched_at: '2026-10-08T12:00:00Z',
      items: [{ id: '802' }],
    })
    expect(posts_().filter((call) => call.path.startsWith('/v1/twitter/searches'))).toHaveLength(1)
  } finally {
    view.unmount()
    queryClient.clear()
  }
})

test('an X search status error offers a passive retry', async () => {
  const user = userEvent.setup()
  searchOperation = twitterOperation('search-status-error', 'queued', 'stock_search')
  searchPollError = new ApiError(503, 'Search status temporarily unavailable')
  crowd = { ...crowd, operation: searchOperation }
  renderWithProviders(<TwitterTab ticker="GOOG" />)
  const section = await screen.findByRole('region', { name: 'X search' })
  await user.click(within(section).getByRole('button', { name: 'Search X for $GOOG' }))
  expect(await within(section).findByText('Search status temporarily unavailable')).toBeVisible()
  expect(within(section).getByRole('button', { name: 'Search X for $GOOG' })).toBeDisabled()

  searchPollError = null
  searchOperation = { ...searchOperation, status: 'succeeded' }
  crowd = crowdResult([trustedPost('completed-retry', { text: 'Recovered search results' })])
  await user.click(within(section).getByRole('button', { name: 'Retry' }))
  expect(await within(section).findByText('Recovered search results')).toBeVisible()
  expect(within(section).getByRole('button', { name: 'Search X for $GOOG' })).toBeEnabled()
  expect(posts_().filter((call) => call.path.startsWith('/v1/twitter/searches'))).toHaveLength(1)
})

test('an expired X search permits a new explicit search after returning to the tab', async () => {
  const user = userEvent.setup()
  searchOperation = twitterOperation('expired-search', 'queued', 'stock_search')
  searchPollError = new ApiError(404, 'operation not found')
  crowd = { ...crowd, operation: searchOperation }
  const view = renderWithProviders(<TwitterTab ticker="GOOG" />)
  let section = await screen.findByRole('region', { name: 'X search' })
  await user.click(within(section).getByRole('button', { name: 'Search X for $GOOG' }))
  expect(await within(section).findByText('operation not found')).toBeVisible()
  expect(within(section).getByRole('button', { name: 'Search X for $GOOG' })).toBeEnabled()
  view.rerender(<div>Another tab</div>)
  view.rerender(<TwitterTab ticker="GOOG" />)
  section = await screen.findByRole('region', { name: 'X search' })
  expect(await within(section).findByText('operation not found')).toBeVisible()
  expect(within(section).getByRole('button', { name: 'Search X for $GOOG' })).toBeEnabled()
  expect(posts_().filter((call) => call.path.startsWith('/v1/twitter/searches'))).toHaveLength(1)

  searchPollError = null
  searchOperation = twitterOperation('replacement-search', 'succeeded', 'stock_search')
  crowd = {
    ...crowdResult([trustedPost('replacement', { text: 'Replacement search results' })]),
    operation: { ...searchOperation, status: 'queued' },
  }
  await user.click(within(section).getByRole('button', { name: 'Search X for $GOOG' }))
  expect(await within(section).findByText('Replacement search results')).toBeVisible()
  await waitFor(() => expect(within(section).getByRole('button', { name: 'Search X for $GOOG' })).toBeEnabled())
  expect(within(section).queryByText('operation not found')).not.toBeInTheDocument()
  expect(posts_().filter((call) => call.path.startsWith('/v1/twitter/searches'))).toHaveLength(2)
})

test.each(['queued', 'deferred', 'succeeded', 'failed'] as const)(
  'resumes an X search after the tab remounts with status %s',
  async (status) => {
    const user = userEvent.setup()
    searchOperation = twitterOperation('search-1', 'queued', 'stock_search')
    const view = renderWithProviders(<TwitterTab ticker="GOOG" />)
    const section = await screen.findByRole('region', { name: 'X search' })
    await within(section).findByText('Crowd chatter 801')
    crowd = { ...crowd, operation: searchOperation }
    await user.click(within(section).getByRole('button', { name: 'Search X for $GOOG' }))
    await waitFor(() => expect(within(section).getByText('Searching X…')).toBeVisible())
    await waitFor(() => expect(calls.some((call) => call.path.endsWith('/operations/search-1'))).toBe(true))
    view.rerender(<div>Another tab</div>)

    // Passive search reads never return an operation. The client must remember it
    // independently of these reads and of the component's mutation observer.
    searchOperation = {
      ...searchOperation,
      status,
      public_error_message: status === 'failed' ? 'Search failed after switching tabs.' : null,
    }
    crowd = crowdResult([trustedPost('802', { text: 'Finished crowd search' })])
    const before = calls.filter((call) => call.path.endsWith('/operations/search-1')).length
    view.rerender(<TwitterTab ticker="GOOG" />)
    const returned = await screen.findByRole('region', { name: 'X search' })
    await waitFor(() => expect(
      calls.filter((call) => call.path.endsWith('/operations/search-1')).length,
    ).toBeGreaterThan(before), { timeout: 3500 })
    if (status === 'queued' || status === 'deferred') {
      expect(within(returned).getByRole('button', { name: 'Search X for $GOOG' })).toBeDisabled()
      expect(within(returned).getByText('Searching X…')).toBeVisible()
    } else {
      expect(await within(returned).findByText('Finished crowd search')).toBeVisible()
      if (status === 'failed') {
        expect(await within(returned).findByText('Search failed after switching tabs.')).toBeVisible()
      }
    }
    expect(posts_().filter((call) => call.path.startsWith('/v1/twitter/searches'))).toHaveLength(1)
  },
)

test('keeps a pending search request disabled across a tab switch before its response', async () => {
  const user = userEvent.setup()
  let finishRequest!: (response: TwitterSearchResultOut) => void
  const request = new Promise<TwitterSearchResultOut>((resolve) => { finishRequest = resolve })
  vi.mocked(apiClient.post).mockImplementation((path: string, body?: unknown) => {
    calls.push({ method: 'POST', path, body })
    return (path.startsWith('/v1/twitter/searches') ? request : Promise.resolve(posts)) as never
  })
  const view = renderWithProviders(<TwitterTab ticker="GOOG" />)
  await screen.findByText('Crowd chatter 801')
  await user.click(screen.getByRole('button', { name: 'Search X for $GOOG' }))
  view.rerender(<div>Another tab</div>)
  view.rerender(<TwitterTab ticker="MSFT" />)
  expect(await screen.findByRole('button', { name: 'Search X for $MSFT' })).toBeEnabled()
  view.rerender(<TwitterTab ticker="GOOG" />)
  expect(await screen.findByRole('button', { name: 'Search X for $GOOG' })).toBeDisabled()
  searchOperation = twitterOperation('search-1', 'queued', 'stock_search')
  finishRequest({ ...crowd, operation: searchOperation })
  await waitFor(() => expect(calls.some((call) => call.path.endsWith('/operations/search-1'))).toBe(true))
  expect(posts_().filter((call) => call.path.startsWith('/v1/twitter/searches'))).toHaveLength(1)
})

test.each([
  [
    'missing',
    () =>
      companyAccount({
        mapping_revision: 0,
        username: null,
        confirmation_state: 'missing',
        confirmation_basis: null,
        confirmed_at: null,
        account_type: null,
      }),
  ],
  [
    'unverified',
    () => companyAccount({ confirmation_state: 'unverified', confirmation_basis: null }),
  ],
  ['failing', () => new ApiError(500, 'Internal Server Error')],
])('trusted mentions still load when the company section is %s', async (_label, make) => {
  account = make()
  renderWithProviders(<TwitterTab ticker="GOOG" />)
  expect(await screen.findByText('Trusted mention 501')).toBeVisible()
  expect(posts_()).toEqual([])
})

test('a zero-engagement, unscored trusted mention is visible by default', async () => {
  trusted = trustedPage([
    trustedPost('777', {
      signal_score: { final_score: 0 } as TwitterPostOut['signal_score'],
    }),
  ])
  renderWithProviders(<TwitterTab ticker="GOOG" />)
  expect(await screen.findByText('Trusted mention 777')).toBeVisible()
})

test('the old cashtag-search guidance is gone', async () => {
  trusted = trustedPage([])
  renderWithProviders(<TwitterTab ticker="GOOG" />)
  expect(
    await screen.findByText('No trusted-account mentions of GOOG in the last 72 hours.'),
  ).toBeVisible()
  expect(screen.queryByText(/search X directly/i)).not.toBeInTheDocument()
})

test('trusted sort and type changes and company paging only read', async () => {
  const user = userEvent.setup()
  posts = companyPage(account as CompanyAccountOut, {
    items: Array.from({ length: 25 }, (_, index) => companyPost(String(1000 + index))),
    total: 40,
  })
  renderWithProviders(<TwitterTab ticker="GOOG" />)
  await screen.findByText('Company update 1000')
  await waitFor(() => expect(posts_()).toHaveLength(1))

  const mentions = screen.getByRole('region', { name: 'Trusted-account mentions' })
  await user.click(within(mentions).getByRole('button', { name: 'Newest' }))
  await user.click(within(mentions).getByRole('button', { name: 'News' }))
  const company = screen.getByRole('region', { name: 'Company posts' })
  await user.click(within(company).getByRole('button', { name: 'Next page' }))

  await waitFor(() =>
    expect(calls.some((call) => call.path === '/v1/twitter/company-accounts/GOOG/posts?page=2&sort=newest&view=all')).toBe(
      true,
    ),
  )
  expect(feedRequests().map((call) => call.path)).toContain(
    '/v1/twitter/feed?filter=trusted&sort=newest&page=1&tickers=GOOG&tweet_types=news',
  )
  expect(posts_()).toHaveLength(1)
})

test('switching ticker resets the trusted page and sort', async () => {
  const user = userEvent.setup()
  trusted = trustedPage(
    Array.from({ length: 25 }, (_, index) => trustedPost(String(600 + index))),
    60,
  )
  const view = renderWithProviders(<TwitterTab ticker="GOOG" />)
  await screen.findByText('Trusted mention 600')
  const mentions = screen.getByRole('region', { name: 'Trusted-account mentions' })
  await user.click(within(mentions).getByRole('button', { name: 'Newest' }))
  await user.click(within(mentions).getByRole('button', { name: 'Next page' }))
  await waitFor(() =>
    expect(feedRequests().at(-1)?.path).toBe(
      '/v1/twitter/feed?filter=trusted&sort=newest&page=2&tickers=GOOG',
    ),
  )

  account = companyAccount({ ticker: 'MSFT', username: 'Microsoft', mapping_revision: 1 })
  view.rerender(<TwitterTab ticker="MSFT" />)
  await waitFor(() =>
    expect(feedRequests().at(-1)?.path).toBe(
      '/v1/twitter/feed?filter=trusted&sort=signal&page=1&tickers=MSFT',
    ),
  )
})
