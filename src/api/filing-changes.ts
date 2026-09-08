import { apiClient } from '@/lib/api-client'
import type {
  FilingChangeFilters,
  FilingChangesPageOut,
  FilingCompareResult,
  FilingComparisonOut,
  FilingExplainResult,
  FilingSummaryRefreshOut,
} from '@/types/filing-changes'
import type { InsightSummaryOut } from '@/types/insight-summary'

function base(ticker: string) {
  return `/v1/stocks/${encodeURIComponent(ticker.toUpperCase())}/filing-changes`
}

/** Cache-only. Safe to call on mount: performs no SEC request and no generation. */
export function getFilingChanges(ticker: string) {
  return apiClient.get<FilingComparisonOut | null>(base(ticker))
}

/** Cache-only compact business-impact summary. */
export function getFilingInsightSummary(ticker: string) {
  return apiClient.get<InsightSummaryOut | null>(`${base(ticker)}/summary`)
}

/** Explicit one-click compare and impact assessment. */
export function refreshFilingInsightSummary(ticker: string) {
  return apiClient.post<FilingSummaryRefreshOut>(`${base(ticker)}/summary/refresh`)
}

/** Explicit user action: checks EDGAR and computes or reuses the comparison. */
export function compareAnnualFilings(ticker: string) {
  return apiClient.post<FilingCompareResult>(`${base(ticker)}/compare`)
}

export function getFilingChangePage(
  ticker: string,
  comparisonId: number,
  filters: FilingChangeFilters,
) {
  const params = new URLSearchParams()
  if (filters.section) params.set('section', filters.section)
  if (filters.kind) params.set('kind', filters.kind)
  if (filters.topic) params.set('topic', filters.topic)
  // Sent only when true: the backend default is already false, and omitting it
  // keeps the query key and the URL readable.
  if (filters.include_routine) params.set('include_routine', 'true')
  params.set('offset', String(filters.offset))
  params.set('limit', String(filters.limit))
  return apiClient.get<FilingChangesPageOut>(
    `${base(ticker)}/${comparisonId}/changes?${params.toString()}`,
  )
}

/** Explicit user action: bounded AI enrichment of an existing comparison. */
export function explainFilingChanges(ticker: string, comparisonId: number) {
  return apiClient.post<FilingExplainResult>(`${base(ticker)}/${comparisonId}/explain`)
}
