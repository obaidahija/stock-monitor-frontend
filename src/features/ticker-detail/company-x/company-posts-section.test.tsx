import { act, cleanup, render as renderComponent, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getTwitterOperation } from '@/api/twitter'
import {
  ensureCompanyPosts,
  getCompanyAccount,
  getCompanyPosts,
  refreshCompanyPosts,
  removeCompanyAccount,
  confirmCompanyAccount,
  validateCompanyAccount,
} from '@/api/twitter-company'
import { renderWithProviders } from '@/test/render'
import type { CompanyAccountOut, CompanyPostsPageOut } from '@/types/twitter-company'
import { CompanyPostsSection } from './company-posts-section'
import { companyAccount, companyPage, companyPost, twitterOperation } from './test-fixtures'
import { companyPostsKey } from './hooks'

vi.mock('@/api/twitter', () => ({ getTwitterOperation: vi.fn() }))
vi.mock('@/api/twitter-company', () => ({
  getCompanyAccount: vi.fn(),
  getCompanyPosts: vi.fn(),
  saveCompanyAccount: vi.fn(),
  confirmCompanyAccount: vi.fn(),
  removeCompanyAccount: vi.fn(),
  validateCompanyAccount: vi.fn(),
  ensureCompanyPosts: vi.fn(),
  refreshCompanyPosts: vi.fn(),
}))

let account: CompanyAccountOut
let page: CompanyPostsPageOut

beforeEach(() => {
  account = companyAccount()
  page = companyPage(account, { items: [companyPost('101'), companyPost('102')] })
  vi.mocked(getCompanyAccount).mockImplementation(async () => account)
  vi.mocked(getCompanyPosts).mockImplementation(async () => page)
  vi.mocked(ensureCompanyPosts).mockImplementation(async () => page)
  vi.mocked(refreshCompanyPosts).mockImplementation(async () => page)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function render(ticker = 'GOOG') {
  return renderWithProviders(<CompanyPostsSection ticker={ticker} />)
}

test('importance and company-news views change only passive reads', async () => {
  render()
  await screen.findByText('Company posts')
  await userEvent.click(screen.getByRole('combobox', { name: 'Sort company posts' }))
  await userEvent.click(screen.getByRole('option', { name: 'Importance' }))
  await waitFor(() => expect(getCompanyPosts).toHaveBeenLastCalledWith('GOOG', 1, 'importance', 'all'))
  await userEvent.click(screen.getByRole('combobox', { name: 'Company posts view' }))
  await userEvent.click(screen.getByRole('option', { name: 'Company news' }))
  await waitFor(() => expect(getCompanyPosts).toHaveBeenLastCalledWith('GOOG', 1, 'importance', 'company_news'))
  expect(ensureCompanyPosts).toHaveBeenCalledTimes(1)
  expect(refreshCompanyPosts).not.toHaveBeenCalled()
})

test('shrinking news results return to a valid page and load its remaining post', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let finished = false
  page = companyPage(account, { items: [companyPost('first')], total: 30, analysis_pending_count: 30 })
  vi.mocked(getCompanyPosts).mockImplementation(async (_ticker, requestedPage) => companyPage(account, {
    page: requestedPage,
    total: finished ? 1 : 30,
    cache_state: 'ready',
    analysis_pending_count: finished ? 0 : 30,
    items: finished
      ? requestedPage === 1 ? [companyPost('surviving-news')] : []
      : [companyPost(requestedPage === 1 ? 'first' : 'pending-page-two')],
  }))
  renderComponent(<QueryClientProvider client={client}><MemoryRouter><CompanyPostsSection ticker="GOOG" /></MemoryRouter></QueryClientProvider>)
  const user = userEvent.setup()
  await screen.findByText('Company update first')
  await user.click(screen.getByRole('combobox', { name: 'Company posts view' }))
  await user.click(screen.getByRole('option', { name: 'Company news' }))
  await user.click(await screen.findByRole('button', { name: 'Next page' }))
  await screen.findByText('Company update pending-page-two')
  finished = true
  await act(async () => {
    await client.refetchQueries({ queryKey: companyPostsKey('GOOG', 1, 2, 'newest', 'company_news') })
  })
  expect(await screen.findByText('Company update surviving-news')).toBeVisible()
  expect(screen.getByText('Showing 1–1 of 1')).toBeVisible()
  expect(ensureCompanyPosts).toHaveBeenCalledTimes(1)
  expect(refreshCompanyPosts).not.toHaveBeenCalled()
  client.clear()
})

test('a missing mapping offers Add account and never collects', async () => {
  account = companyAccount({
    mapping_revision: 0,
    username: null,
    confirmation_state: 'missing',
    confirmation_basis: null,
    confirmed_at: null,
    account_type: null,
    source_urls: [],
    notes: null,
  })
  page = companyPage(account, { cache_state: 'blocked', cache_fetched_at: null })
  render()

  expect(await screen.findByText('No official X account has been added for GOOG.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Add account' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument()
  expect(ensureCompanyPosts).not.toHaveBeenCalled()
})

test('candidate leads are shown as unconfirmed, never as official', async () => {
  account = companyAccount({
    mapping_revision: 1,
    username: null,
    confirmation_state: 'missing',
    confirmation_basis: null,
    confirmed_at: null,
    account_type: null,
    candidates: [
      {
        handle: 'GoogleLead',
        source_url: 'http://www.wikidata.org/entity/Q95',
        evidence_type: 'wikidata_discovery_only',
        company_name: 'Google',
        account_type: null,
        excluded: false,
        notes: null,
      },
    ],
  })
  page = companyPage(account, { cache_state: 'blocked', cache_fetched_at: null })
  render()

  expect(await screen.findByText('The company account has not been confirmed.')).toBeVisible()
  const lead = screen.getByRole('link', { name: '@GoogleLead' })
  expect(lead).toHaveAttribute('href', 'https://x.com/GoogleLead')
  expect(screen.queryByText(/official/i)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add account' })).toBeEnabled()
  expect(ensureCompanyPosts).not.toHaveBeenCalled()
})

test('an unverified selection warns, shows no posts and offers review actions', async () => {
  account = companyAccount({
    confirmation_state: 'unverified',
    confirmation_basis: null,
    confirmed_at: null,
  })
  page = companyPage(account, { cache_state: 'blocked', items: [], cache_fetched_at: null })
  render()

  expect(
    await screen.findByText(
      'This account needs your confirmation. Company posts will load after you confirm it.',
    ),
  ).toBeVisible()
  for (const name of ['Review account', 'Confirm account', 'Change account']) {
    expect(screen.getByRole('button', { name })).toBeEnabled()
  }
  expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument()
  expect(screen.queryByText('Company update 101')).not.toBeInTheDocument()
  expect(ensureCompanyPosts).not.toHaveBeenCalled()
})

test('a confirmed mapping shows its source, posts and a revision-bound Refresh', async () => {
  const user = userEvent.setup()
  account = companyAccount({ mapping_revision: 3 })
  page = companyPage(account, { items: [companyPost('101'), companyPost('102')] })
  render()

  expect(await screen.findByText('Company update 101')).toBeVisible()
  expect(screen.getByRole('link', { name: '@Google' })).toHaveAttribute(
    'href',
    'https://x.com/Google',
  )
  expect(screen.getByText('Brand/subsidiary')).toBeVisible()
  expect(screen.getByText('Confirmed from company source')).toBeVisible()
  await waitFor(() => expect(ensureCompanyPosts).toHaveBeenCalledWith('GOOG', 3))

  await user.click(screen.getByRole('button', { name: 'Refresh company posts' }))
  await waitFor(() => expect(refreshCompanyPosts).toHaveBeenCalledWith('GOOG', 3))
})

test('a user-confirmed mapping says so in its source details', async () => {
  const user = userEvent.setup()
  account = companyAccount({ confirmation_basis: 'user_confirmation', account_type: 'corporate' })
  page = companyPage(account, { items: [companyPost('101')] })
  render()

  expect(await screen.findByText('Confirmed by you')).toBeVisible()
  await user.click(screen.getByText('Source details'))
  const details = screen.getByTestId('company-source-details')
  expect(within(details).getByText(/Source may be historical/)).toBeVisible()
  expect(within(details).getByRole('link', { name: 'https://blog.google/' })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  )
})

test('zero and missing metrics never hide a post or invent a score', async () => {
  page = companyPage(account, {
    items: [
      companyPost('201', {
        metrics: { views: null, likes: 0, retweets: 0, replies: null, quotes: null, bookmarks: null },
      }),
    ],
  })
  render()

  expect(await screen.findByText('Company update 201')).toBeVisible()
  expect(screen.queryByText(/signal/i)).not.toBeInTheDocument()
  expect(screen.getByLabelText('Likes: 0')).toBeVisible()
  expect(screen.queryByLabelText(/^Views/)).not.toBeInTheDocument()
})

test('a successful empty refresh reads as no recent posts', async () => {
  page = companyPage(account, { items: [], cache_state: 'empty' })
  render()
  expect(await screen.findByText('No posts from @Google in the last seven days.')).toBeVisible()
})

test('the collection cap is disclosed with the exact copy', async () => {
  page = companyPage(account, { items: [companyPost('1')], is_truncated: true })
  render()
  expect(
    await screen.findByText('Showing up to 100 posts from the last seven days.'),
  ).toBeVisible()
})

test('a failed refresh keeps the last posts and offers Retry', async () => {
  const user = userEvent.setup()
  page = companyPage(account, {
    items: [companyPost('101')],
    is_fresh: false,
    public_error_code: 'transient_upstream',
    public_error_message: 'Twitter is temporarily unavailable.',
  })
  render()

  expect(await screen.findByText('Company update 101')).toBeVisible()
  expect(
    screen.getByText(/Couldn't refresh company posts: Twitter is temporarily unavailable\./),
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(refreshCompanyPosts).toHaveBeenCalled())
})

test.each([
  [
    'not_found',
    { runtime_state: 'not_found' as const, public_error_code: 'not_found' },
    "X couldn't find @Google. The handle may have changed.",
  ],
  [
    'unavailable',
    { runtime_state: 'unavailable' as const, public_error_code: 'unavailable' },
    "Couldn't check @Google on X right now.",
  ],
  [
    'identity_conflict',
    { runtime_state: 'identity_conflict' as const, public_error_code: 'identity_conflict' },
    '@Google now belongs to a different X account. Review and confirm the company account.',
  ],
  [
    'authentication',
    {
      auth: {
        state: 'invalid' as const,
        checked_at: null,
        public_message: 'Twitter authentication is invalid.',
        cooldown_until: null,
      },
    },
    "Twitter sign-in needs attention, so company posts can't refresh.",
  ],
])('the %s state has its own explanation', async (_label, overrides, copy) => {
  account = companyAccount(overrides)
  page = companyPage(account, {
    items: [],
    cache_state: account.runtime_state === 'identity_conflict' ? 'blocked' : 'missing',
    cache_fetched_at: null,
  })
  render()
  expect(await screen.findByText(copy)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Change account' })).toBeEnabled()
})

test('no cache while collecting shows a loading state, not an empty one', async () => {
  page = companyPage(account, {
    items: [],
    cache_state: 'missing',
    cache_fetched_at: null,
    phase: 'posts_fetch',
    operation: twitterOperation('fetch-1', 'queued'),
  })
  vi.mocked(getTwitterOperation).mockResolvedValue(twitterOperation('fetch-1', 'running'))
  render()
  expect(await screen.findByText('Collecting posts from @Google…')).toBeVisible()
  expect(screen.queryByText(/No posts from/)).not.toBeInTheDocument()
})

test('quote context is shown apart from the company text with safe links', async () => {
  page = companyPage(account, {
    items: [
      companyPost('301', {
        text: 'Proud of this team',
        urls: ['https://blog.google/launch'],
        quote: {
          id: '777',
          text: 'Original announcement',
          author_username: 'GoogleAI',
          author_name: 'Google AI',
          url: 'https://x.com/GoogleAI/status/777',
        },
      }),
    ],
  })
  render()

  expect(await screen.findByText('Proud of this team')).toBeVisible()
  const quote = screen.getByRole('figure', { name: 'Quoted post from @GoogleAI' })
  expect(within(quote).getByText('Original announcement')).toBeVisible()
  const link = screen.getByRole('link', { name: 'https://blog.google/launch' })
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')
})

test('removing the account asks first, sends the revision and clears former posts', async () => {
  const user = userEvent.setup()
  account = companyAccount({ mapping_revision: 4 })
  page = companyPage(account, { items: [companyPost('101')] })
  const cleared = companyAccount({
    mapping_revision: 5,
    username: null,
    confirmation_state: 'missing',
    confirmation_basis: null,
    confirmed_at: null,
    account_type: null,
  })
  vi.mocked(removeCompanyAccount).mockImplementation(async () => {
    account = cleared
    page = companyPage(cleared, { items: [], cache_state: 'blocked', cache_fetched_at: null })
    return cleared
  })
  render()
  expect(await screen.findByText('Company update 101')).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Remove account' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText(/@Google/)).toBeVisible()
  await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

  await waitFor(() => expect(removeCompanyAccount).toHaveBeenCalledWith('GOOG', 4))
  expect(await screen.findByText('No official X account has been added for GOOG.')).toBeVisible()
  expect(screen.queryByText('Company update 101')).not.toBeInTheDocument()
})

test('paging reads the cache only', async () => {
  const user = userEvent.setup()
  page = companyPage(account, {
    items: Array.from({ length: 25 }, (_, index) => companyPost(String(1000 + index))),
    total: 30,
  })
  render()
  expect(await screen.findByText('Company update 1000')).toBeVisible()
  await waitFor(() => expect(ensureCompanyPosts).toHaveBeenCalledTimes(1))

  await user.click(screen.getByRole('button', { name: 'Next page' }))
  await waitFor(() => expect(getCompanyPosts).toHaveBeenCalledWith('GOOG', 2, 'newest', 'all'))
  expect(ensureCompanyPosts).toHaveBeenCalledTimes(1)
  expect(refreshCompanyPosts).not.toHaveBeenCalled()
})

test('an identity conflict hides an already loaded cache before its refetch completes', async () => {
  const user = userEvent.setup()
  vi.mocked(validateCompanyAccount).mockResolvedValue(
    twitterOperation('conflict-lookup', 'queued', 'company_account_validate'),
  )
  vi.mocked(getTwitterOperation).mockImplementation(async () => {
    account = companyAccount({ runtime_state: 'identity_conflict' })
    return twitterOperation('conflict-lookup', 'failed', 'company_account_validate')
  })
  vi.mocked(getCompanyPosts).mockImplementation(async () => {
    if (account.runtime_state === 'identity_conflict') return new Promise(() => {})
    return page
  })
  render()
  expect(await screen.findByText('Company update 101')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Change account' }))
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Check profile' }))
  await waitFor(() => expect(getTwitterOperation).toHaveBeenCalled())
  await user.keyboard('{Escape}')
  expect(await screen.findByText(/now belongs to a different X account/)).toBeVisible()
  expect(screen.queryByText('Company update 101')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument()
  await waitFor(() => expect(getCompanyPosts).toHaveBeenCalledTimes(2))
})

test('a refresh transport error is shown while preserving permitted cached posts', async () => {
  const user = userEvent.setup()
  vi.mocked(refreshCompanyPosts).mockRejectedValue(new Error('Network connection failed'))
  render()
  expect(await screen.findByText('Company update 101')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Refresh company posts' }))
  expect(await screen.findByText('Network connection failed')).toBeVisible()
  expect(screen.getByText('Company update 101')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
})

test('a failed cache read shows its error instead of a missing-cache state', async () => {
  vi.mocked(getCompanyPosts).mockRejectedValue(new Error('Cache read failed'))
  vi.mocked(ensureCompanyPosts).mockRejectedValue(new Error('Collection request failed'))
  render()
  expect(await screen.findByText('Cache read failed')).toBeVisible()
  expect(screen.queryByText('No company posts collected yet.')).not.toBeInTheDocument()
})

test('an operation polling error has a read-only Retry action', async () => {
  const user = userEvent.setup()
  page = companyPage(account, {
    phase: 'posts_fetch', operation: twitterOperation('poll-retry', 'running'),
  })
  vi.mocked(getTwitterOperation).mockRejectedValue(new Error('Operation status failed'))
  render()
  expect(await screen.findByText('Operation status failed')).toBeVisible()
  vi.mocked(getTwitterOperation).mockResolvedValue(twitterOperation('poll-retry', 'running'))
  const reads = vi.mocked(getTwitterOperation).mock.calls.length
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(vi.mocked(getTwitterOperation).mock.calls.length).toBeGreaterThan(reads))
  expect(refreshCompanyPosts).not.toHaveBeenCalled()
  expect(ensureCompanyPosts).toHaveBeenCalledTimes(1)
})

test.each(['Confirm', 'Remove'] as const)('a failed %s action stays open with an explanation', async (action) => {
  const user = userEvent.setup()
  if (action === 'Confirm') {
    account = companyAccount({ confirmation_state: 'unverified', confirmation_basis: null })
    vi.mocked(confirmCompanyAccount).mockRejectedValue(new Error('Confirmation failed'))
  } else {
    vi.mocked(removeCompanyAccount).mockRejectedValue(new Error('Removal failed'))
  }
  render()
  await user.click(await screen.findByRole('button', { name: `${action} account` }))
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: action }))
  expect(await screen.findByText(action === 'Confirm' ? 'Confirmation failed' : 'Removal failed')).toBeVisible()
  expect(screen.getByRole('alertdialog')).toBeVisible()
})
