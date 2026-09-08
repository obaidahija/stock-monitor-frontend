import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  appendCommitmentEvent,
  checkCommitmentSources,
  createManualCommitmentCandidate,
  extractCommitmentSource,
  getCommitmentCandidates,
  getCommitmentSummary,
  getCommitmentSources,
  getCommitments,
  reviewCommitmentCandidate,
  refreshCommitmentSummary,
} from '@/api/management-commitments'
import { DEFAULT_COMMITMENT_FILTERS } from '@/types/management-commitments'
import {
  commitmentCandidatesKey,
  commitmentListKey,
  commitmentsKey,
  useAppendCommitmentEvent,
  useCheckCommitmentSources,
  useCommitmentCandidates,
  useCommitments,
  useCommitmentSummary,
  useCreateManualCandidate,
  useExtractCommitmentSource,
  useReviewCommitmentCandidate,
  useRefreshCommitmentSummary,
  commitmentSummaryKey,
} from './hooks'

vi.mock('@/api/management-commitments', () => ({
  getCommitments: vi.fn(),
  getCommitment: vi.fn(),
  getCommitmentSources: vi.fn(),
  getCommitmentSource: vi.fn(),
  getCommitmentCandidates: vi.fn(),
  checkCommitmentSources: vi.fn(),
  loadCommitmentSource: vi.fn(),
  extractCommitmentSource: vi.fn(),
  createManualCommitmentCandidate: vi.fn(),
  reviewCommitmentCandidate: vi.fn(),
  appendCommitmentEvent: vi.fn(),
  archiveCommitment: vi.fn(),
  getCommitmentSummary: vi.fn(),
  refreshCommitmentSummary: vi.fn(),
}))

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  vi.mocked(getCommitments).mockResolvedValue({
    items: [],
    total: 0,
    pending_count: 0,
    offset: 0,
    limit: 25,
    coverage: {
      checked_at: null,
      window_days: null,
      window_start: null,
      window_end: null,
      filings_scanned: 0,
      documents_listed: 0,
      oldest_filing_date: null,
      newest_filing_date: null,
      truncated: false,
      complete: false,
      notices: [],
    },
  })
  vi.mocked(getCommitmentCandidates).mockResolvedValue({
    items: [],
    total: 0,
    pending_count: 0,
    offset: 0,
    limit: 25,
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test('the cache key starts with the uppercased ticker prefix', () => {
  expect(commitmentsKey('acme')).toEqual(['management-commitments', 'ACME'])
  expect(commitmentListKey('acme', DEFAULT_COMMITMENT_FILTERS)).toEqual([
    'management-commitments',
    'ACME',
    'list',
    DEFAULT_COMMITMENT_FILTERS,
  ])
  expect(commitmentCandidatesKey('acme', { offset: 0, limit: 25 })).toEqual([
    'management-commitments',
    'ACME',
    'candidates',
    { offset: 0, limit: 25 },
  ])
})

test('mounting the ledger reads and never posts', async () => {
  renderHook(() => useCommitments('ACME', DEFAULT_COMMITMENT_FILTERS), { wrapper })
  await waitFor(() => expect(getCommitments).toHaveBeenCalledTimes(1))
  expect(checkCommitmentSources).not.toHaveBeenCalled()
  expect(extractCommitmentSource).not.toHaveBeenCalled()
  expect(createManualCommitmentCandidate).not.toHaveBeenCalled()
})

test('mounting the candidate list reads and never posts', async () => {
  renderHook(() => useCommitmentCandidates('ACME', { offset: 0, limit: 25 }), { wrapper })
  await waitFor(() => expect(getCommitmentCandidates).toHaveBeenCalledTimes(1))
  expect(extractCommitmentSource).not.toHaveBeenCalled()
})

test('an accepted review invalidates the whole ticker prefix', async () => {
  vi.mocked(reviewCommitmentCandidate).mockResolvedValue({
    candidate: {} as never,
    commitment: null,
  })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const { result } = renderHook(() => useReviewCommitmentCandidate('ACME'), { wrapper })

  await act(async () => {
    await result.current.mutateAsync({
      candidateId: 1,
      body: { action: 'accept', request_uuid: 'r' },
    })
  })

  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['management-commitments', 'ACME'] })
})

test('an appended event invalidates the whole ticker prefix', async () => {
  vi.mocked(appendCommitmentEvent).mockResolvedValue({} as never)
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const { result } = renderHook(() => useAppendCommitmentEvent('ACME'), { wrapper })

  await act(async () => {
    await result.current.mutateAsync({
      commitmentId: 3,
      body: { request_uuid: 'r', expected_version: 1, event: {} as never },
    })
  })

  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['management-commitments', 'ACME'] })
})

test('a source check refreshes the ticker prefix, since coverage is shown on the ledger', async () => {
  vi.mocked(checkCommitmentSources).mockResolvedValue({} as never)
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const { result } = renderHook(() => useCheckCommitmentSources('ACME'), { wrapper })

  await act(async () => {
    await result.current.mutateAsync()
  })

  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['management-commitments', 'ACME'] })
})

test('a manual candidate invalidates so the pending count updates', async () => {
  vi.mocked(createManualCommitmentCandidate).mockResolvedValue({} as never)
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const { result } = renderHook(() => useCreateManualCandidate('ACME'), { wrapper })

  await act(async () => {
    await result.current.mutateAsync({ document_id: 1, proposal: {} as never })
  })

  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['management-commitments', 'ACME'] })
})

test('a failed extraction is not retried behind one click', async () => {
  vi.mocked(extractCommitmentSource).mockRejectedValue(new Error('boom'))
  const { result } = renderHook(() => useExtractCommitmentSource('ACME'), { wrapper })

  await act(async () => {
    await result.current.mutateAsync(4).catch(() => undefined)
  })

  expect(extractCommitmentSource).toHaveBeenCalledTimes(1)
})

test('two tickers do not share a cache entry', async () => {
  renderHook(() => useCommitments('ACME', DEFAULT_COMMITMENT_FILTERS), { wrapper })
  renderHook(() => useCommitments('OTHR', DEFAULT_COMMITMENT_FILTERS), { wrapper })
  await waitFor(() => expect(getCommitments).toHaveBeenCalledTimes(2))
  expect(vi.mocked(getCommitments).mock.calls.map((call) => call[0])).toEqual(['ACME', 'OTHR'])
  expect(getCommitmentSources).not.toHaveBeenCalled()
})

test('summary mount is cache-only and uses an uppercase key', async () => {
  vi.mocked(getCommitmentSummary).mockResolvedValue(null)
  const { result } = renderHook(() => useCommitmentSummary('acme'), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(commitmentSummaryKey('acme')).toEqual(['commitment-summary', 'ACME'])
  expect(getCommitmentSummary).toHaveBeenCalledWith('acme')
  expect(refreshCommitmentSummary).not.toHaveBeenCalled()
})

test('refresh updates summary and invalidates ledger after automatic acceptance', async () => {
  const summary = { headline: 'Short result' } as never
  vi.mocked(refreshCommitmentSummary).mockResolvedValue({
    status: 'ready',
    reason: null,
    summary,
    source: {} as never,
    ai: null,
    diagnostics: { auto_accepted: 2 },
  } as never)
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const { result } = renderHook(() => useRefreshCommitmentSummary('acme'), { wrapper })
  await act(async () => { await result.current.mutateAsync() })
  expect(queryClient.getQueryData(commitmentSummaryKey('ACME'))).toBe(summary)
  expect(invalidate).toHaveBeenCalledWith({ queryKey: commitmentsKey('ACME') })
})
