import { StrictMode, type PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getTwitterOperation } from '@/api/twitter'
import {
  ensureCompanyPosts,
  getCompanyAccount,
  getCompanyPosts,
  refreshCompanyPosts,
} from '@/api/twitter-company'
import type { TwitterOperationOut } from '@/types/api'
import type {
  CompanyAccountOut,
  CompanyCollectionPhase,
  CompanyPostsPageOut,
} from '@/types/twitter-company'
import { useCompanyAccount, companyPostsKey } from './hooks'
import { useCompanyCollection } from './use-company-collection'

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

test('ensure invalidates an already viewed page two so analysis can update', async () => {
  const owner = account('GOOG', 1)
  let finish!: (value: CompanyPostsPageOut) => void
  vi.mocked(ensureCompanyPosts).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  const pageTwoKey = companyPostsKey('GOOG', 1, 2)
  queryClient.setQueryData(pageTwoKey, { ...response(owner), page: 2, analysis_pending_count: 0 })
  renderHook(() => useCompanyCollection({ ticker: 'GOOG', account: owner, active: true }), { wrapper })
  await waitFor(() => expect(ensureCompanyPosts).toHaveBeenCalledTimes(1))
  await act(async () => finish({ ...response(owner), analysis_pending_count: 30 }))
  await waitFor(() => expect(queryClient.getQueryState(pageTwoKey)?.isInvalidated).toBe(true))
})

function account(
  ticker: string,
  revision: number,
  overrides: Partial<CompanyAccountOut> = {},
): CompanyAccountOut {
  return {
    ticker,
    company_name: null,
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

function operation(id: string, status: TwitterOperationOut['status'], kind: string): TwitterOperationOut {
  return {
    id,
    kind,
    status,
    priority: 90,
    attempts: 0,
    max_attempts: 3,
    created_at: '2026-10-08T12:00:00Z',
    started_at: null,
    finished_at: null,
    public_error_code: null,
    public_error_message: null,
  }
}

function response(
  owner: CompanyAccountOut,
  work: { phase: CompanyCollectionPhase; operation: TwitterOperationOut } | null = null,
): CompanyPostsPageOut {
  return {
    account: owner,
    items: [],
    total: 0,
    page: 1,
    page_size: 25,
    mapping_revision: owner.mapping_revision,
    window_start: null,
    window_end: null,
    cache_fetched_at: work ? null : '2026-10-08T12:00:00Z',
    cache_age_seconds: work ? null : 10,
    cache_state: work ? 'missing' : 'empty',
    is_fresh: work === null,
    is_truncated: false,
    phase: work?.phase ?? null,
    operation: work?.operation ?? null,
    public_error_code: null,
    public_error_message: null,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => (resolve = done))
  return { promise, resolve }
}

let queryClient: QueryClient
let directory: Record<string, CompanyAccountOut>

function wrapper({ children }: PropsWithChildren) {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </StrictMode>
  )
}

/** Reads the directory like the real section does, then activates collection. */
function useHarness({ ticker, active }: { ticker: string; active: boolean }) {
  const { data } = useCompanyAccount(ticker)
  return useCompanyCollection({ ticker, account: data, active })
}

function mount(initial: { ticker: string; active: boolean } = { ticker: 'GOOG', active: true }) {
  return renderHook((props: { ticker: string; active: boolean }) => useHarness(props), {
    wrapper,
    initialProps: initial,
  })
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  directory = { GOOG: account('GOOG', 1), MSFT: account('MSFT', 1, { username: 'Microsoft' }) }
  vi.mocked(getCompanyAccount).mockImplementation(async (ticker) => directory[ticker])
  vi.mocked(getCompanyPosts).mockImplementation(async (ticker) => response(directory[ticker]))
  vi.mocked(ensureCompanyPosts).mockImplementation(async (ticker) => response(directory[ticker]))
  vi.mocked(refreshCompanyPosts).mockImplementation(async (ticker) => response(directory[ticker]))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
  queryClient.clear()
})

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}

test('a confirmed mapping ensures exactly once per activation in Strict Mode', async () => {
  mount()
  await waitFor(() => expect(ensureCompanyPosts).toHaveBeenCalledTimes(1))
  await settle()
  expect(ensureCompanyPosts).toHaveBeenCalledWith('GOOG', 1)
  expect(refreshCompanyPosts).not.toHaveBeenCalled()
})

test.each([
  ['unverified', { confirmation_state: 'unverified' as const, confirmation_basis: null }],
  ['missing', { confirmation_state: 'missing' as const, username: null, mapping_revision: 0 }],
])('a %s mapping never collects', async (_label, overrides) => {
  directory.GOOG = account('GOOG', 1, overrides)
  const hook = mount()
  await settle()
  expect(ensureCompanyPosts).not.toHaveBeenCalled()
  act(() => hook.result.current.refresh())
  await settle()
  expect(refreshCompanyPosts).not.toHaveBeenCalled()
})

test('an open tab never collects again on a timer', async () => {
  mount()
  await waitFor(() => expect(ensureCompanyPosts).toHaveBeenCalledTimes(1))
  await settle()
  vi.useFakeTimers()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3 * 60 * 60 * 1000)
  })
  vi.useRealTimers()
  expect(ensureCompanyPosts).toHaveBeenCalledTimes(1)
  expect(refreshCompanyPosts).not.toHaveBeenCalled()
})

test('a successful lookup while active chains exactly one ensure, then refreshes the cache', async () => {
  const lookup = operation('lookup-1', 'queued', 'company_account_validate')
  const fetch = operation('fetch-1', 'queued', 'company_posts_fetch')
  vi.mocked(ensureCompanyPosts)
    .mockResolvedValueOnce(response(directory.GOOG, { phase: 'account_lookup', operation: lookup }))
    .mockResolvedValueOnce(response(directory.GOOG, { phase: 'posts_fetch', operation: fetch }))
  vi.mocked(getTwitterOperation).mockImplementation(async (id) =>
    operation(id, 'succeeded', id.startsWith('lookup') ? 'company_account_validate' : 'company_posts_fetch'),
  )
  const hook = mount()

  await waitFor(() => expect(ensureCompanyPosts).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(hook.result.current.operation).toBeNull())
  await settle()
  expect(ensureCompanyPosts).toHaveBeenNthCalledWith(2, 'GOOG', 1)
  expect(refreshCompanyPosts).not.toHaveBeenCalled()
  expect(hook.result.current.isCollecting).toBe(false)
  // The directory is re-read before chaining, and again with the cache once the
  // fetch finishes.
  const reads = vi.mocked(getCompanyAccount).mock.invocationCallOrder
  const ensures = vi.mocked(ensureCompanyPosts).mock.invocationCallOrder
  expect(reads).toHaveLength(3)
  expect(reads[1]).toBeLessThan(ensures[1])
  expect(reads[2]).toBeGreaterThan(ensures[1])
  expect(queryClient.getQueryState(['twitter', 'company-posts', 'GOOG', 1, 1, 'newest', 'all'])).toBeDefined()
})

test('a manual refresh keeps its force intent through the account lookup', async () => {
  const hook = mount()
  await waitFor(() => expect(ensureCompanyPosts).toHaveBeenCalledTimes(1))
  await settle()

  const lookup = operation('lookup-2', 'queued', 'company_account_validate')
  vi.mocked(refreshCompanyPosts).mockResolvedValueOnce(
    response(directory.GOOG, { phase: 'account_lookup', operation: lookup }),
  )
  vi.mocked(getTwitterOperation).mockResolvedValue(
    operation('lookup-2', 'succeeded', 'company_account_validate'),
  )
  act(() => hook.result.current.refresh())

  await waitFor(() => expect(refreshCompanyPosts).toHaveBeenCalledTimes(2))
  await settle()
  expect(ensureCompanyPosts).toHaveBeenCalledTimes(1)
})

test('a double click sends one refresh', async () => {
  const hook = mount()
  await waitFor(() => expect(ensureCompanyPosts).toHaveBeenCalledTimes(1))
  await settle()
  const slow = deferred<CompanyPostsPageOut>()
  vi.mocked(refreshCompanyPosts).mockReturnValueOnce(slow.promise)
  act(() => {
    hook.result.current.refresh()
    hook.result.current.refresh()
  })
  await settle()
  expect(refreshCompanyPosts).toHaveBeenCalledTimes(1)
  slow.resolve(response(directory.GOOG))
  await settle()
})

test('a failed lookup chains nothing', async () => {
  const lookup = operation('lookup-3', 'queued', 'company_account_validate')
  vi.mocked(ensureCompanyPosts).mockResolvedValueOnce(
    response(directory.GOOG, { phase: 'account_lookup', operation: lookup }),
  )
  vi.mocked(getTwitterOperation).mockResolvedValue({
    ...operation('lookup-3', 'failed', 'company_account_validate'),
    public_error_code: 'not_found',
  })
  const hook = mount()
  await waitFor(() => expect(getTwitterOperation).toHaveBeenCalled())
  await waitFor(() => expect(hook.result.current.isCollecting).toBe(false))
  await settle()
  expect(ensureCompanyPosts).toHaveBeenCalledTimes(1)
})

test.each([
  ['unmounting', 'unmount'],
  ['switching platform', 'deactivate'],
  ['switching ticker', 'ticker'],
  ['replacing the mapping', 'revision'],
])('%s during the lookup prevents the second phase', async (_label, change) => {
  const lookup = operation('lookup-4', 'queued', 'company_account_validate')
  vi.mocked(ensureCompanyPosts).mockResolvedValueOnce(
    response(directory.GOOG, { phase: 'account_lookup', operation: lookup }),
  )
  const lookupResult = deferred<TwitterOperationOut>()
  vi.mocked(getTwitterOperation).mockReturnValue(lookupResult.promise)
  const hook = mount()
  await waitFor(() => expect(getTwitterOperation).toHaveBeenCalledWith('lookup-4'))

  if (change === 'unmount') hook.unmount()
  if (change === 'deactivate') hook.rerender({ ticker: 'GOOG', active: false })
  if (change === 'ticker') hook.rerender({ ticker: 'MSFT', active: true })
  if (change === 'revision') {
    directory.GOOG = account('GOOG', 2)
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['twitter', 'company-account', 'GOOG'] })
    })
  }
  await settle()
  lookupResult.resolve(operation('lookup-4', 'succeeded', 'company_account_validate'))
  await settle()

  const goog = vi.mocked(ensureCompanyPosts).mock.calls.filter(([ticker]) => ticker === 'GOOG')
  if (change === 'revision') {
    // Only the replacement mapping's own activation, never a chain for revision 1.
    expect(goog).toEqual([
      ['GOOG', 1],
      ['GOOG', 2],
    ])
  } else {
    expect(goog).toEqual([['GOOG', 1]])
  }
  if (change === 'ticker') expect(ensureCompanyPosts).toHaveBeenCalledWith('MSFT', 1)
})

test('a canonical merge re-reads the directory and activates only the new revision', async () => {
  const lookup = operation('lookup-5', 'queued', 'company_account_validate')
  vi.mocked(ensureCompanyPosts).mockResolvedValueOnce(
    response(directory.GOOG, { phase: 'account_lookup', operation: lookup }),
  )
  vi.mocked(getTwitterOperation).mockImplementation(async () => {
    // The lookup merged a duplicate account row: the binding's revision moved on.
    directory.GOOG = account('GOOG', 2)
    return operation('lookup-5', 'succeeded', 'company_account_validate')
  })
  mount()

  await waitFor(() => expect(ensureCompanyPosts).toHaveBeenCalledTimes(2))
  await settle()
  expect(vi.mocked(ensureCompanyPosts).mock.calls).toEqual([
    ['GOOG', 1],
    ['GOOG', 2],
  ])
})

test('a merge that leaves the mapping unconfirmed confirms nothing implicitly', async () => {
  const lookup = operation('lookup-6', 'queued', 'company_account_validate')
  vi.mocked(ensureCompanyPosts).mockResolvedValueOnce(
    response(directory.GOOG, { phase: 'account_lookup', operation: lookup }),
  )
  vi.mocked(getTwitterOperation).mockImplementation(async () => {
    directory.GOOG = account('GOOG', 2, { confirmation_state: 'unverified', confirmation_basis: null })
    return operation('lookup-6', 'succeeded', 'company_account_validate')
  })
  mount()
  await waitFor(() => expect(getTwitterOperation).toHaveBeenCalled())
  await settle()
  expect(ensureCompanyPosts).toHaveBeenCalledTimes(1)
})

test.each(['queued', 'running', 'deferred'] as const)(
  'a %s operation counts as collecting',
  async (status) => {
    const fetch = operation('fetch-7', 'queued', 'company_posts_fetch')
    vi.mocked(ensureCompanyPosts).mockResolvedValueOnce(
      response(directory.GOOG, { phase: 'posts_fetch', operation: fetch }),
    )
    vi.mocked(getTwitterOperation).mockResolvedValue(
      operation('fetch-7', status, 'company_posts_fetch'),
    )
    const hook = mount()
    await waitFor(() => expect(getTwitterOperation).toHaveBeenCalled())
    await settle()
    expect(hook.result.current.isCollecting).toBe(true)
    expect(hook.result.current.operation?.status).toBe(status)
  },
)

test('reopening the tab ensures again, and a fresh empty cache does not loop', async () => {
  const first = mount()
  await waitFor(() => expect(ensureCompanyPosts).toHaveBeenCalledTimes(1))
  await settle()
  first.unmount()
  mount()
  await waitFor(() => expect(ensureCompanyPosts).toHaveBeenCalledTimes(2))
  await settle()
  expect(ensureCompanyPosts).toHaveBeenCalledTimes(2)
})

test('reactivating the same mounted tab ensures again', async () => {
  const hook = mount()
  await waitFor(() => expect(ensureCompanyPosts).toHaveBeenCalledTimes(1))
  hook.rerender({ ticker: 'GOOG', active: false })
  await settle()
  hook.rerender({ ticker: 'GOOG', active: true })
  await waitFor(() => expect(ensureCompanyPosts).toHaveBeenCalledTimes(2))
})

test('a directory refetch with the same revision never collects again', async () => {
  mount()
  await waitFor(() => expect(ensureCompanyPosts).toHaveBeenCalledTimes(1))
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ['twitter'] })
  })
  await settle()
  expect(ensureCompanyPosts).toHaveBeenCalledTimes(1)
})
