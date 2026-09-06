import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  compareAnnualFilings,
  explainFilingChanges,
  getFilingChangePage,
  getFilingChanges,
} from '@/api/filing-changes'
import { DEFAULT_FILING_CHANGE_FILTERS } from '@/types/filing-changes'
import type { FilingComparisonOut } from '@/types/filing-changes'
import {
  useCompareAnnualFilings,
  useExplainFilingChanges,
  useFilingChangePage,
  useFilingChanges,
} from './hooks'

vi.mock('@/api/filing-changes', () => ({
  getFilingChanges: vi.fn(),
  compareAnnualFilings: vi.fn(),
  getFilingChangePage: vi.fn(),
  explainFilingChanges: vi.fn(),
}))

const comparison = (overrides: Partial<FilingComparisonOut> = {}): FilingComparisonOut => ({
  id: 7,
  ticker: 'NVDA',
  before: {
    accession_number: '0001045810-24-000029',
    form_type: '10-K',
    report_date: '2024-01-28',
    filed_date: '2024-02-21',
    filing_url: 'https://www.sec.gov/before.htm',
  },
  after: {
    accession_number: '0001045810-25-000023',
    form_type: '10-K',
    report_date: '2025-01-26',
    filed_date: '2025-02-26',
    filing_url: 'https://www.sec.gov/after.htm',
  },
  status: 'ready',
  coverage: {},
  notices: [],
  counts: { added: 1, removed: 0, modified: 2 },
  routine_count: 1,
  explained_count: 0,
  generated_at: '2026-09-06T12:00:00Z',
  metadata_checked_at: '2026-09-06T12:00:00Z',
  ai_status: 'not_requested',
  ai_error: null,
  usage: null,
  ...overrides,
})

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, wrapper }
}

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

test('a late explanation cannot replace a newer annual comparison', async () => {
  const { queryClient, wrapper } = makeWrapper()
  queryClient.setQueryData(['filing-changes', 'NVDA'], comparison({ id: 8 }))
  vi.mocked(explainFilingChanges).mockResolvedValue({
    comparison: comparison({ id: 7, ai_status: 'ready', explained_count: 2 }),
    source: { name: 'llm', ok: true, fetched_at: null, error: null, latency_ms: null },
  })
  const { result } = renderHook(() => useExplainFilingChanges('NVDA', 7), { wrapper })
  await act(async () => { await result.current.mutateAsync() })
  expect(queryClient.getQueryData(['filing-changes', 'NVDA'])).toMatchObject({ id: 8 })
})

test('mounting performs only the cache-only read', async () => {
  vi.mocked(getFilingChanges).mockResolvedValue(null)
  const { wrapper } = makeWrapper()

  const { result } = renderHook(() => useFilingChanges('NVDA'), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))

  expect(getFilingChanges).toHaveBeenCalledWith('NVDA')
  expect(compareAnnualFilings).not.toHaveBeenCalled()
  expect(explainFilingChanges).not.toHaveBeenCalled()
})

test('the change page is not requested until a comparison exists', async () => {
  vi.mocked(getFilingChangePage).mockResolvedValue({
    items: [],
    total: 0,
    offset: 0,
    limit: 25,
  })
  const { wrapper } = makeWrapper()

  const { result, rerender } = renderHook(
    ({ id }: { id: number | undefined }) =>
      useFilingChangePage('NVDA', id, DEFAULT_FILING_CHANGE_FILTERS),
    { wrapper, initialProps: { id: undefined as number | undefined } },
  )
  expect(result.current.fetchStatus).toBe('idle')
  expect(getFilingChangePage).not.toHaveBeenCalled()

  rerender({ id: 7 })
  await waitFor(() => expect(getFilingChangePage).toHaveBeenCalledTimes(1))
  expect(getFilingChangePage).toHaveBeenCalledWith('NVDA', 7, DEFAULT_FILING_CHANGE_FILTERS)
})

test('comparing is explicit and updates the saved summary', async () => {
  vi.mocked(getFilingChanges).mockResolvedValue(null)
  vi.mocked(compareAnnualFilings).mockResolvedValue({
    status: 'ready',
    reason: null,
    comparison: comparison(),
    source: { name: 'edgar', ok: true, fetched_at: null, error: null, latency_ms: null },
  })
  const { queryClient, wrapper } = makeWrapper()

  const { result } = renderHook(() => useCompareAnnualFilings('NVDA'), { wrapper })
  expect(compareAnnualFilings).not.toHaveBeenCalled()

  await act(async () => {
    await result.current.mutateAsync()
  })

  expect(compareAnnualFilings).toHaveBeenCalledTimes(1)
  expect(queryClient.getQueryData(['filing-changes', 'NVDA'])).toMatchObject({ id: 7 })
})

test('a failed refresh keeps the saved comparison and surfaces the error', async () => {
  const { queryClient, wrapper } = makeWrapper()
  queryClient.setQueryData(['filing-changes', 'NVDA'], comparison())

  vi.mocked(compareAnnualFilings).mockResolvedValue({
    status: 'unavailable',
    reason: 'insufficient_history',
    comparison: null,
    source: {
      name: 'edgar',
      ok: false,
      fetched_at: null,
      error: 'insufficient_history',
      latency_ms: null,
    },
  })

  const { result } = renderHook(() => useCompareAnnualFilings('NVDA'), { wrapper })
  await act(async () => {
    await result.current.mutateAsync()
  })

  expect(queryClient.getQueryData(['filing-changes', 'NVDA'])).toMatchObject({ id: 7 })
  await waitFor(() => expect(result.current.data?.source.ok).toBe(false))
  expect(result.current.data?.reason).toBe('insufficient_history')
})

test('explaining does not recompare and only invalidates this comparison', async () => {
  vi.mocked(explainFilingChanges).mockResolvedValue({
    comparison: comparison({ ai_status: 'ready', explained_count: 2 }),
    source: { name: 'llm', ok: true, fetched_at: null, error: null, latency_ms: null },
  })
  const { queryClient, wrapper } = makeWrapper()
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

  const { result } = renderHook(() => useExplainFilingChanges('NVDA', 7), { wrapper })
  await act(async () => {
    await result.current.mutateAsync()
  })

  expect(compareAnnualFilings).not.toHaveBeenCalled()
  expect(queryClient.getQueryData(['filing-changes', 'NVDA'])).toMatchObject({
    ai_status: 'ready',
    explained_count: 2,
  })
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['filing-change-page', 'NVDA', 7],
  })
})

test('switching ticker never shows the previous ticker evidence', async () => {
  vi.mocked(getFilingChanges).mockImplementation(async (ticker: string) =>
    ticker === 'NVDA' ? comparison() : null,
  )
  const { wrapper } = makeWrapper()

  const { result, rerender } = renderHook(
    ({ ticker }: { ticker: string }) => useFilingChanges(ticker),
    { wrapper, initialProps: { ticker: 'NVDA' } },
  )
  await waitFor(() => expect(result.current.data?.ticker).toBe('NVDA'))

  rerender({ ticker: 'AAPL' })
  // The second ticker's query key is distinct, so its result can never be the
  // first ticker's stored comparison.
  expect(result.current.data?.ticker).not.toBe('NVDA')
  await waitFor(() => expect(result.current.data).toBeNull())
})

test('mutations do not retry automatically', async () => {
  vi.mocked(compareAnnualFilings).mockRejectedValue(new Error('network down'))
  const { wrapper } = makeWrapper()

  const { result } = renderHook(() => useCompareAnnualFilings('NVDA'), { wrapper })
  await act(async () => {
    await result.current.mutateAsync().catch(() => undefined)
  })

  expect(compareAnnualFilings).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(result.current.isError).toBe(true))
})
