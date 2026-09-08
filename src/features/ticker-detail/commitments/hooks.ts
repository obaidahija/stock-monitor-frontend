import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  appendCommitmentEvent,
  archiveCommitment,
  checkCommitmentSources,
  createManualCommitmentCandidate,
  extractCommitmentSource,
  getCommitment,
  getCommitmentCandidates,
  getCommitmentSource,
  getCommitmentSources,
  getCommitmentSummary,
  getCommitments,
  loadCommitmentSource,
  reviewCommitmentCandidate,
  refreshCommitmentSummary,
} from '@/api/management-commitments'
import type { InsightSummaryOut } from '@/types/insight-summary'
import {
  DEFAULT_PAGE_PARAMS,
  type AppendEventIn,
  type ArchiveCommitmentIn,
  type CandidateReviewIn,
  type CandidateState,
  type CommitmentFilters,
  type ManualCandidateIn,
  type PageParams,
} from '@/types/management-commitments'

/**
 * Every key starts with the ticker prefix so one `invalidateQueries` after an
 * accepted review refreshes the ledger, the candidate list and any open detail
 * together -- a review can change all three, and refreshing only the one the
 * user is looking at is how a stale pending count survives on screen.
 */
export const commitmentsKey = (ticker: string) =>
  ['management-commitments', ticker.toUpperCase()] as const

export const commitmentSummaryKey = (ticker: string) =>
  ['commitment-summary', ticker.toUpperCase()] as const

export const commitmentListKey = (ticker: string, filters: CommitmentFilters) =>
  [...commitmentsKey(ticker), 'list', filters] as const

export const commitmentDetailKey = (ticker: string, commitmentId: number | undefined) =>
  [...commitmentsKey(ticker), 'detail', commitmentId] as const

export const commitmentSourcesKey = (ticker: string, params: PageParams) =>
  [...commitmentsKey(ticker), 'sources', params] as const

export const commitmentSourceKey = (
  ticker: string,
  documentId: number | undefined,
  params: PageParams,
) => [...commitmentsKey(ticker), 'source', documentId, params] as const

export const commitmentCandidatesKey = (
  ticker: string,
  params: PageParams & { state?: CandidateState | null },
) => [...commitmentsKey(ticker), 'candidates', params] as const

/**
 * Cache-only read of the ledger. Mounting the tab does exactly this and
 * nothing else: no SEC request, no generation, no spend.
 */
export function useCommitments(ticker: string, filters: CommitmentFilters) {
  return useQuery({
    queryKey: commitmentListKey(ticker, filters),
    queryFn: () => getCommitments(ticker, filters),
  })
}

export function useCommitmentSummary(ticker: string) {
  return useQuery({
    queryKey: commitmentSummaryKey(ticker),
    queryFn: () => getCommitmentSummary(ticker),
  })
}

export function useRefreshCommitmentSummary(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => refreshCommitmentSummary(ticker),
    retry: false,
    onSuccess: async (result) => {
      if (result.summary) {
        await queryClient.cancelQueries({ queryKey: commitmentSummaryKey(ticker), exact: true })
        queryClient.setQueryData<InsightSummaryOut | null>(
          commitmentSummaryKey(ticker),
          result.summary,
        )
      }
      if (result.diagnostics.auto_accepted > 0) {
        queryClient.invalidateQueries({ queryKey: commitmentsKey(ticker) })
      }
    },
  })
}

export function useCommitment(ticker: string, commitmentId: number | undefined) {
  return useQuery({
    queryKey: commitmentDetailKey(ticker, commitmentId),
    queryFn: () => getCommitment(ticker, commitmentId as number),
    enabled: commitmentId !== undefined,
  })
}

export function useCommitmentSources(ticker: string, params: PageParams = DEFAULT_PAGE_PARAMS) {
  return useQuery({
    queryKey: commitmentSourcesKey(ticker, params),
    queryFn: () => getCommitmentSources(ticker, params),
  })
}

export function useCommitmentSource(
  ticker: string,
  documentId: number | undefined,
  params: PageParams = DEFAULT_PAGE_PARAMS,
) {
  return useQuery({
    queryKey: commitmentSourceKey(ticker, documentId, params),
    queryFn: () => getCommitmentSource(ticker, documentId as number, params),
    enabled: documentId !== undefined,
  })
}

export function useCommitmentCandidates(
  ticker: string,
  params: PageParams & { state?: CandidateState | null } = DEFAULT_PAGE_PARAMS,
) {
  return useQuery({
    queryKey: commitmentCandidatesKey(ticker, params),
    queryFn: () => getCommitmentCandidates(ticker, params),
  })
}

function useTickerInvalidation(ticker: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: commitmentsKey(ticker) })
}

/**
 * Explicit user action. `retry: false` throughout this file: every mutation
 * here is either an SEC sweep, a generation or a ledger write, and silently
 * repeating one behind a single click is exactly the behaviour the request-id
 * idempotency exists to make unnecessary.
 */
export function useCheckCommitmentSources(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => checkCommitmentSources(ticker),
    retry: false,
    onSuccess: () => {
      // Sources change; the ledger does not. But a check also refreshes the
      // coverage block the ledger page renders, so invalidate the prefix.
      queryClient.invalidateQueries({ queryKey: commitmentsKey(ticker) })
    },
  })
}

export function useLoadCommitmentSource(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      documentId,
      params = DEFAULT_PAGE_PARAMS,
    }: {
      documentId: number
      params?: PageParams
    }) => loadCommitmentSource(ticker, documentId, params),
    retry: false,
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: [...commitmentsKey(ticker), 'sources'],
      })
      queryClient.invalidateQueries({
        queryKey: [...commitmentsKey(ticker), 'source', result.document.document_id],
      })
    },
  })
}

export function useExtractCommitmentSource(ticker: string) {
  const invalidate = useTickerInvalidation(ticker)
  return useMutation({
    mutationFn: (documentId: number) => extractCommitmentSource(ticker, documentId),
    retry: false,
    onSuccess: () => invalidate(),
  })
}

export function useCreateManualCandidate(ticker: string) {
  const invalidate = useTickerInvalidation(ticker)
  return useMutation({
    mutationFn: (body: ManualCandidateIn) => createManualCommitmentCandidate(ticker, body),
    retry: false,
    onSuccess: () => invalidate(),
  })
}

export function useReviewCommitmentCandidate(ticker: string) {
  const invalidate = useTickerInvalidation(ticker)
  return useMutation({
    mutationFn: ({ candidateId, body }: { candidateId: number; body: CandidateReviewIn }) =>
      reviewCommitmentCandidate(ticker, candidateId, body),
    retry: false,
    onSuccess: () => invalidate(),
  })
}

export function useAppendCommitmentEvent(ticker: string) {
  const invalidate = useTickerInvalidation(ticker)
  return useMutation({
    mutationFn: ({ commitmentId, body }: { commitmentId: number; body: AppendEventIn }) =>
      appendCommitmentEvent(ticker, commitmentId, body),
    retry: false,
    onSuccess: () => invalidate(),
  })
}

export function useArchiveCommitment(ticker: string) {
  const invalidate = useTickerInvalidation(ticker)
  return useMutation({
    mutationFn: ({
      commitmentId,
      body,
    }: {
      commitmentId: number
      body: ArchiveCommitmentIn
    }) => archiveCommitment(ticker, commitmentId, body),
    retry: false,
    onSuccess: () => invalidate(),
  })
}
