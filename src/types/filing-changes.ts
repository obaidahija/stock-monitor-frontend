import type { LlmUsageSummaryOut, SourceStatus } from './api'
import type { InsightSummaryOut } from './insight-summary'

/**
 * Mirrors app/schemas/filing_changes.py. Dates and timestamps arrive as ISO
 * strings and costs as strings, matching the existing usage API representation.
 */

export type FilingSectionKey = 'risk_factors' | 'mda'
export type FilingChangeKind = 'added' | 'removed' | 'modified'
export type FilingSectionStatus = 'ok' | 'missing' | 'ambiguous' | 'too_large'
export type FilingAiStatus = 'not_requested' | 'ready' | 'partial' | 'unavailable'

export type FilingExplanationTopic =
  | 'liquidity'
  | 'demand'
  | 'margins'
  | 'competition'
  | 'regulation'
  | 'operations'
  | 'other'

/** Not a model-assigned topic: the filter meaning "no accepted annotation". */
export const UNCLASSIFIED_TOPIC = 'unclassified'

export const FILING_SECTION_LABELS: Record<FilingSectionKey, string> = {
  risk_factors: 'Item 1A. Risk Factors',
  mda: "Item 7. Management's Discussion and Analysis",
}

export interface FilingReferenceOut {
  accession_number: string
  form_type: '10-K'
  /** Fiscal period end -- what makes two filings comparable. */
  report_date: string
  /** EDGAR filingDate, a plain date: the API publishes no acceptance time. */
  filed_date: string
  filing_url: string
}

export interface SectionCoverageOut {
  status: FilingSectionStatus
  reason: string | null
  notes: string[]
}

export interface SectionCoveragePairOut {
  before: SectionCoverageOut
  after: SectionCoverageOut
}

export interface FilingChangeCountsOut {
  added: number
  removed: number
  modified: number
}

export interface FilingChangeAnnotation {
  id: string
  explanation: string
  topics: FilingExplanationTopic[]
}

export interface FilingPassage {
  id: string
  text: string
  heading: string | null
  anchor: string | null
  start: number
  end: number
}

export interface FilingDiffSpan {
  text: string
  changed: boolean
}

export interface FilingChangeOut {
  id: string
  section: FilingSectionKey
  kind: FilingChangeKind
  before: FilingPassage | null
  after: FilingPassage | null
  before_spans: FilingDiffSpan[]
  after_spans: FilingDiffSpan[]
  alignment_confidence: 'high' | 'low'
  routine_date_update: boolean
  annotation: FilingChangeAnnotation | null
}

export interface FilingComparisonOut {
  id: number
  ticker: string
  before: FilingReferenceOut
  after: FilingReferenceOut
  status: 'ready' | 'partial'
  coverage: Partial<Record<FilingSectionKey, SectionCoveragePairOut>>
  notices: string[]
  counts: FilingChangeCountsOut
  /** A subset of counts, hidden by the default page filter. */
  routine_count: number
  explained_count: number
  generated_at: string
  /** When SEC metadata last confirmed this pair; not a freshness guarantee. */
  metadata_checked_at: string
  ai_status: FilingAiStatus
  ai_error: string | null
  usage: LlmUsageSummaryOut | null
}

export interface FilingCompareResult {
  status: 'ready' | 'partial' | 'unavailable'
  reason: string | null
  /** May hold the previous cached result while source.ok is false. */
  comparison: FilingComparisonOut | null
  source: SourceStatus
}

export interface FilingExplainResult {
  comparison: FilingComparisonOut
  source: SourceStatus
}

export interface FilingChangesPageOut {
  items: FilingChangeOut[]
  total: number
  offset: number
  limit: number
}

export interface FilingChangeFilters {
  section?: FilingSectionKey
  kind?: FilingChangeKind
  topic?: FilingExplanationTopic | typeof UNCLASSIFIED_TOPIC
  include_routine: boolean
  offset: number
  limit: number
}

export const DEFAULT_FILING_CHANGE_FILTERS: FilingChangeFilters = {
  include_routine: false,
  offset: 0,
  limit: 25,
}

export interface FilingRefreshDiagnosticsOut {
  comparison_id: number | null
  comparison_changed: boolean
  finding_count: number
  cluster_count: number
  selected_count: number
  omitted_count: number
  provisional_count: number
  reason_codes: string[]
}

export interface FilingSummaryRefreshOut {
  status: 'ready' | 'partial' | 'unavailable'
  reason: string | null
  summary: InsightSummaryOut | null
  source: SourceStatus
  ai: SourceStatus | null
  diagnostics: FilingRefreshDiagnosticsOut
}
