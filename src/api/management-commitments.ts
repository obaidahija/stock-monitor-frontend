import { apiClient } from '@/lib/api-client'
import type {
  AppendEventIn,
  ArchiveCommitmentIn,
  CandidateOut,
  CandidateReviewIn,
  CandidateReviewOut,
  CandidateState,
  CandidatesPageOut,
  CommitmentDetailOut,
  CommitmentFilters,
  CommitmentSummaryRefreshOut,
  CommitmentsPageOut,
  ExtractionOut,
  ManualCandidateIn,
  PageParams,
  SourceCheckOut,
  SourceDocumentOut,
  SourcesPageOut,
} from '@/types/management-commitments'
import type { InsightSummaryOut } from '@/types/insight-summary'

function base(ticker: string) {
  return `/v1/stocks/${encodeURIComponent(ticker.toUpperCase())}/commitments`
}

function page(params: PageParams) {
  const search = new URLSearchParams()
  search.set('offset', String(params.offset))
  search.set('limit', String(params.limit))
  return search
}

/** Cache-only. Safe on mount: performs no SEC request and no generation. */
export function getCommitments(ticker: string, filters: CommitmentFilters) {
  const params = page(filters)
  if (filters.status) params.set('status', filters.status)
  if (filters.metric) params.set('metric', filters.metric)
  // Only sent when true: the backend default is already false, which keeps the
  // query key and the URL readable.
  if (filters.include_archived) params.set('include_archived', 'true')
  return apiClient.get<CommitmentsPageOut>(`${base(ticker)}?${params.toString()}`)
}

/** Cache-only compact insight. */
export function getCommitmentSummary(ticker: string) {
  return apiClient.get<InsightSummaryOut | null>(`${base(ticker)}/summary`)
}

/** Explicit one-click SEC, extraction, verification, and summary refresh. */
export function refreshCommitmentSummary(ticker: string) {
  return apiClient.post<CommitmentSummaryRefreshOut>(`${base(ticker)}/summary/refresh`)
}

/** Cache-only. */
export function getCommitment(ticker: string, commitmentId: number) {
  return apiClient.get<CommitmentDetailOut>(`${base(ticker)}/${commitmentId}`)
}

/** Cache-only: saved source metadata plus the coverage of the last check. */
export function getCommitmentSources(ticker: string, params: PageParams) {
  return apiClient.get<SourcesPageOut>(`${base(ticker)}/sources?${page(params).toString()}`)
}

/** Explicit user action: one bounded SEC discovery sweep. */
export function checkCommitmentSources(ticker: string) {
  return apiClient.post<SourceCheckOut>(`${base(ticker)}/sources/check`)
}

/** Explicit user action: fetch and parse one document. Never calls a model. */
export function loadCommitmentSource(ticker: string, documentId: number, params: PageParams) {
  return apiClient.post<SourceDocumentOut>(
    `${base(ticker)}/sources/${documentId}/load?${page(params).toString()}`,
  )
}

/** Cache-only: saved blocks for one document. */
export function getCommitmentSource(ticker: string, documentId: number, params: PageParams) {
  return apiClient.get<SourceDocumentOut>(
    `${base(ticker)}/sources/${documentId}?${page(params).toString()}`,
  )
}

/** Explicit user action: propose statements from one document. */
export function extractCommitmentSource(ticker: string, documentId: number) {
  return apiClient.post<ExtractionOut>(`${base(ticker)}/sources/${documentId}/extract`)
}

/** Cache-only. */
export function getCommitmentCandidates(
  ticker: string,
  params: PageParams & { state?: CandidateState | null },
) {
  const search = page(params)
  if (params.state) search.set('state', params.state)
  return apiClient.get<CandidatesPageOut>(`${base(ticker)}/candidates?${search.toString()}`)
}

export function createManualCommitmentCandidate(ticker: string, body: ManualCandidateIn) {
  return apiClient.post<CandidateOut>(`${base(ticker)}/candidates`, body)
}

export function reviewCommitmentCandidate(
  ticker: string,
  candidateId: number,
  body: CandidateReviewIn,
) {
  return apiClient.post<CandidateReviewOut>(
    `${base(ticker)}/candidates/${candidateId}/review`,
    body,
  )
}

export function appendCommitmentEvent(
  ticker: string,
  commitmentId: number,
  body: AppendEventIn,
) {
  return apiClient.post<CommitmentDetailOut>(`${base(ticker)}/${commitmentId}/events`, body)
}

export function archiveCommitment(
  ticker: string,
  commitmentId: number,
  body: ArchiveCommitmentIn,
) {
  return apiClient.post<CommitmentDetailOut>(`${base(ticker)}/${commitmentId}/archive`, body)
}
