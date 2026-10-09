import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError, apiClient } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import type { TwitterPageOut, TwitterPostOut } from '@/types/api'
import type { CompanyAccountOut, CompanyPostsPageOut } from '@/types/twitter-company'
import {
  companyAccount,
  companyPage,
  companyPost,
} from './company-x/test-fixtures'
import { TwitterTab } from './twitter-tab'

type Call = { method: string; path: string; body?: unknown }

let calls: Call[]
let account: CompanyAccountOut | Error
let posts: CompanyPostsPageOut
let trusted: TwitterPageOut

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

beforeEach(() => {
  calls = []
  account = companyAccount({ mapping_revision: 2 })
  posts = companyPage(account as CompanyAccountOut, { items: [companyPost('901')] })
  trusted = trustedPage([trustedPost('501')])
  vi.spyOn(apiClient, 'get').mockImplementation(async (path: string) => {
    calls.push({ method: 'GET', path })
    if (path.startsWith('/v1/twitter/company-accounts/')) {
      if (path.includes('/posts')) return posts as never
      if (account instanceof Error) throw account
      return account as never
    }
    if (path.startsWith('/v1/twitter/feed')) return trusted as never
    return {} as never
  })
  vi.spyOn(apiClient, 'post').mockImplementation(async (path: string, body?: unknown) => {
    calls.push({ method: 'POST', path, body })
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
  for (const call of calls) {
    expect(call.path).not.toContain('/v1/twitter/searches')
    expect(JSON.stringify(call.body ?? null)).not.toContain('min_views')
  }
  expect(screen.queryByText(/minimum views/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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
