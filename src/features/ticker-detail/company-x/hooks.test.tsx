import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  confirmCompanyAccount,
  ensureCompanyPosts,
  getCompanyAccount,
  getCompanyPosts,
  refreshCompanyPosts,
  saveCompanyAccount,
  validateCompanyAccount,
} from '@/api/twitter-company'
import { ApiError } from '@/lib/api-client'
import type { CompanyAccountOut, CompanyPostsPageOut } from '@/types/twitter-company'
import {
  useCompanyAccount,
  useCompanyPosts,
  useConfirmCompanyAccount,
  useSaveCompanyAccount,
} from './hooks'

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

function account(revision: number, overrides: Partial<CompanyAccountOut> = {}): CompanyAccountOut {
  return {
    ticker: 'GOOG',
    company_name: 'Alphabet Inc.',
    mapping_revision: revision,
    username: 'Google',
    confirmation_state: 'confirmed',
    confirmation_basis: 'company_source',
    confirmed_at: '2026-10-07T00:00:00Z',
    account_type: 'brand',
    source_urls: [],
    candidates: [],
    notes: null,
    profile: null,
    runtime_state: 'available',
    public_error_code: null,
    public_error_message: null,
    auth: { state: 'valid', checked_at: null, public_message: null, cooldown_until: null },
    ...overrides,
  }
}

function page(revision: number, pageNumber = 1, ids: string[] = []): CompanyPostsPageOut {
  return {
    account: account(revision),
    items: ids.map((id) => ({
      id,
      text: `post ${id}`,
      author_id: '20536157',
      author_username: 'Google',
      author_name: 'Google',
      author_verified: true,
      created_at: '2026-10-08T10:00:00Z',
      url: `https://x.com/Google/status/${id}`,
      urls: [],
      quote: null,
      metrics: { views: null, likes: 0, retweets: null, replies: null, quotes: null, bookmarks: null },
    })),
    total: ids.length,
    page: pageNumber,
    page_size: 25,
    mapping_revision: revision,
    window_start: null,
    window_end: null,
    cache_fetched_at: null,
    cache_age_seconds: null,
    cache_state: ids.length ? 'ready' : 'missing',
    is_fresh: false,
    is_truncated: false,
    phase: null,
    operation: null,
    public_error_code: null,
    public_error_message: null,
  }
}

let queryClient: QueryClient

function wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  vi.mocked(getCompanyAccount).mockResolvedValue(account(1))
  vi.mocked(getCompanyPosts).mockImplementation(async (_ticker, pageNumber = 1) =>
    page(1, pageNumber, [`p${pageNumber}`]),
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  queryClient.clear()
})

function expectNoCollection() {
  expect(ensureCompanyPosts).not.toHaveBeenCalled()
  expect(refreshCompanyPosts).not.toHaveBeenCalled()
  expect(validateCompanyAccount).not.toHaveBeenCalled()
}

test('pending AI polls passive reads only while active', async () => {
  vi.mocked(getCompanyPosts).mockResolvedValue({ ...page(1, 1, ['p1']), analysis_pending_count: 1 })
  const hook = renderHook(({ active }) => useCompanyPosts('GOOG', 1, 1, { active }), { wrapper, initialProps: { active: true } })
  await waitFor(() => expect(hook.result.current.data?.analysis_pending_count).toBe(1))
  await waitFor(() => expect(getCompanyPosts).toHaveBeenCalledTimes(2), { timeout: 4500 })
  hook.rerender({ active: false })
  const count = vi.mocked(getCompanyPosts).mock.calls.length
  await new Promise((resolve) => setTimeout(resolve, 3200))
  expect(getCompanyPosts).toHaveBeenCalledTimes(count)
  expectNoCollection()
}, 9000)

test('reads, refetches, pages and invalidations never send a collection request', async () => {
  const accountHook = renderHook(() => useCompanyAccount('GOOG'), { wrapper })
  const postsHook = renderHook(({ pageNumber }) => useCompanyPosts('GOOG', 1, pageNumber), {
    wrapper,
    initialProps: { pageNumber: 1 },
  })
  await waitFor(() => expect(postsHook.result.current.data?.items[0].id).toBe('p1'))
  expect(accountHook.result.current.data?.mapping_revision).toBe(1)

  postsHook.rerender({ pageNumber: 2 })
  await waitFor(() => expect(postsHook.result.current.data?.items[0].id).toBe('p2'))
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ['twitter'] })
  })
  act(() => {
    focusManager.setFocused(false)
    focusManager.setFocused(true)
  })
  await waitFor(() => expect(getCompanyPosts).toHaveBeenCalledWith('GOOG', 2, 'newest', 'all'))

  expect(getCompanyAccount).toHaveBeenCalledWith('GOOG')
  expectNoCollection()
})

test('posts are keyed by ticker, mapping revision and page', async () => {
  const hook = renderHook(({ revision }) => useCompanyPosts('GOOG', revision, 1), {
    wrapper,
    initialProps: { revision: 1 },
  })
  await waitFor(() => expect(hook.result.current.data?.items).toHaveLength(1))
  expect(queryClient.getQueryData(['twitter', 'company-posts', 'GOOG', 1, 1, 'newest', 'all'])).toBeDefined()

  // A replacement mapping never shows the former mapping's posts while loading.
  let resolveNext: (value: CompanyPostsPageOut) => void = () => {}
  vi.mocked(getCompanyPosts).mockImplementationOnce(
    () => new Promise((resolve) => (resolveNext = resolve)),
  )
  hook.rerender({ revision: 2 })
  expect(hook.result.current.data).toBeUndefined()
  resolveNext(page(2, 1, []))
  await waitFor(() => expect(hook.result.current.data?.mapping_revision).toBe(2))
})

test('a page change keeps the same mapping visible while the next page loads', async () => {
  const hook = renderHook(({ pageNumber }) => useCompanyPosts('GOOG', 1, pageNumber), {
    wrapper,
    initialProps: { pageNumber: 1 },
  })
  await waitFor(() => expect(hook.result.current.data?.items[0].id).toBe('p1'))
  vi.mocked(getCompanyPosts).mockImplementationOnce(() => new Promise(() => {}))
  hook.rerender({ pageNumber: 2 })
  expect(hook.result.current.data?.items[0].id).toBe('p1')
  expect(hook.result.current.isPlaceholderData).toBe(true)
})

test('a successful save replaces the directory and drops cached posts for the ticker', async () => {
  queryClient.setQueryData(['twitter', 'company-account', 'GOOG'], account(1))
  queryClient.setQueryData(['twitter', 'company-posts', 'GOOG', 1, 1, 'newest', 'all'], page(1, 1, ['old']))
  vi.mocked(saveCompanyAccount).mockResolvedValue(
    account(2, { username: 'Alphabet', confirmation_state: 'unverified', confirmation_basis: null }),
  )
  const hook = renderHook(() => useSaveCompanyAccount('GOOG'), { wrapper })

  await act(async () => {
    await hook.result.current.mutateAsync({
      selection: 'Alphabet',
      account_type: 'corporate',
      source_urls: [],
      expected_revision: 1,
      confirm_account: false,
    })
  })

  const cached = queryClient.getQueryData<CompanyAccountOut>(['twitter', 'company-account', 'GOOG'])
  expect(cached?.username).toBe('Alphabet')
  expect(cached?.mapping_revision).toBe(2)
  expect(queryClient.getQueryState(['twitter', 'company-posts', 'GOOG', 1, 1, 'newest', 'all'])?.isInvalidated).toBe(
    true,
  )
  expectNoCollection()
})

test('a stale confirmation reloads the directory instead of guessing', async () => {
  queryClient.setQueryData(['twitter', 'company-account', 'GOOG'], account(3))
  vi.mocked(confirmCompanyAccount).mockRejectedValue(
    new ApiError(409, { code: 'revision_conflict', current_revision: 4 }),
  )
  vi.mocked(getCompanyAccount).mockResolvedValue(account(4, { username: 'Alphabet' }))
  const reader = renderHook(() => useCompanyAccount('GOOG'), { wrapper })
  const hook = renderHook(() => useConfirmCompanyAccount('GOOG'), { wrapper })

  await act(async () => {
    await hook.result.current
      .mutateAsync({ selected_handle: 'Google', expected_revision: 3, confirm_account: true })
      .catch(() => undefined)
  })

  await waitFor(() => expect(reader.result.current.data?.mapping_revision).toBe(4))
  expect(reader.result.current.data?.username).toBe('Alphabet')
})
