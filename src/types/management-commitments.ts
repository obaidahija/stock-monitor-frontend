import type { SourceStatus } from './api'

/**
 * Mirrors app/schemas/management_commitments.py.
 *
 * Every number that is a guidance amount, bound or result is a `string` here,
 * not a `number`. That is deliberate and load-bearing: a revenue target runs
 * into the hundreds of millions and a JSON `number` past 2^53 loses precision
 * silently. These strings are passed through to display and back to the API
 * untouched; the browser never does decimal arithmetic on them, and outcome
 * labels always come from the backend.
 */

export type MetricKey = 'revenue' | 'gross_margin' | 'operating_margin'
export type MetricBasis = 'gaap' | 'non_gaap' | 'unspecified'
export type MetricUnit = 'currency' | 'percentage_points'
export type PeriodKind = 'quarter' | 'year'
export type TargetOperator = 'range' | 'eq' | 'gte' | 'lte'

export type LifecycleKind =
  | 'issued'
  | 'revised'
  | 'reaffirmed'
  | 'withdrawn'
  | 'reinstated'
  | 'actual'
export type EventKind = LifecycleKind | 'correction'

export type ComparisonOutcome = 'met' | 'below' | 'exceeded' | 'above_limit' | 'not_comparable'
export type CommitmentStatus =
  | 'open'
  | 'awaiting_result'
  | 'resolved'
  | 'withdrawn'
  | 'needs_review'
export type CandidateState = 'pending' | 'accepted' | 'rejected'
export type CandidateOrigin = 'model' | 'manual'
export type ExtractionStatus = 'running' | 'ready' | 'failed'
export type DocumentContentState =
  | 'never_checked'
  | 'ready'
  | 'unsupported'
  | 'too_large'
  | 'ambiguous'
  | 'unavailable'
export type BlockKind = 'heading' | 'paragraph' | 'table_row'

export const METRIC_LABELS: Record<MetricKey, string> = {
  revenue: 'Revenue',
  gross_margin: 'Gross margin',
  operating_margin: 'Operating margin',
}

export const BASIS_LABELS: Record<MetricBasis, string> = {
  gaap: 'GAAP',
  non_gaap: 'Non-GAAP',
  unspecified: 'Basis not stated',
}

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  issued: 'Guidance issued',
  revised: 'Guidance revised',
  reaffirmed: 'Guidance reaffirmed',
  withdrawn: 'Guidance withdrawn',
  reinstated: 'Guidance reinstated',
  actual: 'Result reported',
  correction: 'Record corrected',
}

/**
 * Wording is chosen so a label can never read as a verdict on the company.
 * "Awaiting result" in particular must not suggest a missed commitment: the
 * period simply ended without a comparable reported figure yet.
 */
export const STATUS_LABELS: Record<CommitmentStatus, string> = {
  open: 'Period in progress',
  awaiting_result: 'Awaiting result',
  resolved: 'Result recorded',
  withdrawn: 'Guidance withdrawn',
  needs_review: 'Needs review',
}

export const OUTCOME_LABELS: Record<ComparisonOutcome, string> = {
  met: 'Met',
  below: 'Below',
  exceeded: 'Exceeded',
  above_limit: 'Above limit',
  not_comparable: 'Not comparable',
}

export interface NumericTarget {
  operator: TargetOperator
  lower: string | null
  upper: string | null
}

export interface MetricIdentity {
  metric: MetricKey
  basis: MetricBasis
  scope: 'consolidated'
  currency: string | null
  unit: MetricUnit
  period_start: string
  period_end: string
  period_kind: PeriodKind
  fiscal_label: string | null
  definition: string
}

export interface EvidenceRef {
  document_id: number
  content_hash: string
  block_id: string
  start: number
  end: number
  quote: string
}

/** Evidence before it is bound to a document version -- what a reviewer edits. */
export interface ProposedEvidence {
  block_id: string
  start: number
  end: number
  quote: string
}

export interface EventPayload {
  kind: LifecycleKind
  statement_date: string
  evidence: EvidenceRef[]
  target: NumericTarget | null
  actual_value: string | null
  actual_basis: MetricBasis | null
  actual_definition: string | null
  note: string | null
}

export interface EventInput {
  kind: EventKind
  payload: EventPayload
  supersedes_event_id?: number | null
  note?: string | null
}

export interface EventOut {
  id: number
  sequence: number
  kind: EventKind
  payload: EventPayload
  supersedes_event_id: number | null
  superseded_by_event_id: number | null
  note: string | null
  origin: CandidateOrigin
  candidate_id: number | null
  request_uuid: string
  recorded_at: string
}

export interface TargetSnapshotOut {
  event_id: number
  sequence: number
  kind: LifecycleKind
  statement_date: string
  target: NumericTarget
  evidence: EvidenceRef[]
}

export interface ActualSnapshotOut {
  event_id: number
  sequence: number
  statement_date: string
  value: string
  basis: MetricBasis
  definition: string
  evidence: EvidenceRef[]
}

export interface ComparisonOut {
  outcome: ComparisonOutcome
  target: NumericTarget | null
  target_event_id: number | null
  actual_value: string | null
  actual_event_id: number | null
  reason: string | null
}

export interface CommitmentProjection {
  status: CommitmentStatus
  as_of: string
  original: TargetSnapshotOut | null
  latest: TargetSnapshotOut | null
  actual: ActualSnapshotOut | null
  original_comparison: ComparisonOut | null
  latest_comparison: ComparisonOut | null
  withdrawn: boolean
  withdrawn_event_id: number | null
  revision_count: number
  reaffirmation_count: number
  effective_event_ids: number[]
  superseded_event_ids: number[]
  notices: string[]
}

export interface CommitmentSummaryOut {
  id: number
  ticker: string
  identity: MetricIdentity
  version: number
  archived: boolean
  archive_reason: string | null
  related_commitment_id: number | null
  projection: CommitmentProjection
  event_count: number
  created_at: string
  updated_at: string | null
}

export interface CommitmentDetailOut extends CommitmentSummaryOut {
  events: EventOut[]
  superseded_events: EventOut[]
}

export interface SourceCoverageOut {
  checked_at: string | null
  window_days: number | null
  window_start: string | null
  window_end: string | null
  filings_scanned: number
  documents_listed: number
  oldest_filing_date: string | null
  newest_filing_date: string | null
  truncated: boolean
  complete: boolean
  notices: string[]
}

export interface CommitmentsPageOut {
  items: CommitmentSummaryOut[]
  total: number
  pending_count: number
  offset: number
  limit: number
  coverage: SourceCoverageOut
}

export interface SourceRefOut {
  document_id: number
  accession_number: string
  filename: string
  form_type: string
  description: string | null
  source_date: string
  url: string
  content_state: DocumentContentState
  content_hash: string | null
  content_version: number
  is_amendment: boolean
  supported: boolean
  block_count: number
  fetched_at: string | null
}

export interface SourcesPageOut {
  items: SourceRefOut[]
  total: number
  offset: number
  limit: number
  coverage: SourceCoverageOut
}

export interface SourceCheckOut {
  status: 'ready' | 'partial' | 'unavailable'
  reason: string | null
  sources: SourcesPageOut
  source: SourceStatus
}

export interface SourceBlock {
  block_id: string
  order: number
  kind: BlockKind
  text: string
  headers: string[]
}

export interface SourceDocumentOut {
  document: SourceRefOut
  blocks: SourceBlock[]
  total_blocks: number
  offset: number
  limit: number
  notices: string[]
  source: SourceStatus | null
}

export interface SelectedBlocksOut {
  blocks: SourceBlock[]
  omitted_block_ids: string[]
  total_chars: number
  complete: boolean
}

/**
 * A proposed statement. Every identity field is nullable because an extraction
 * that could not resolve a fiscal period is still worth showing -- it becomes
 * an explicitly incomplete candidate a reviewer can finish, rather than being
 * dropped or silently guessed at.
 */
export interface CandidateProposal {
  kind: LifecycleKind
  metric: MetricKey
  basis: MetricBasis
  scope: 'consolidated'
  currency: string | null
  unit: MetricUnit | null
  period_start: string | null
  period_end: string | null
  period_kind: PeriodKind | null
  fiscal_label: string | null
  definition: string
  statement_date: string | null
  target: NumericTarget | null
  actual_value: string | null
  actual_basis: MetricBasis | null
  actual_definition: string | null
  evidence: ProposedEvidence[]
  model_note: string | null
}

export interface CandidateOut {
  id: number
  document_id: number
  extraction_id: number | null
  origin: CandidateOrigin
  state: CandidateState
  proposal: CandidateProposal
  unresolved: string[]
  suggested_commitment_ids: number[]
  accepted_event_id: number | null
  accepted_commitment_id: number | null
  review_note: string | null
  created_at: string
  reviewed_at: string | null
}

export interface CandidatesPageOut {
  items: CandidateOut[]
  total: number
  pending_count: number
  offset: number
  limit: number
}

export interface ExtractionOut {
  status: ExtractionStatus
  extraction_id: number | null
  document_id: number
  reason: string | null
  candidates: CandidateOut[]
  candidate_count: number
  notices: string[]
  coverage: SelectedBlocksOut | null
  source: SourceStatus | null
  ai: SourceStatus | null
}

export interface ManualCandidateIn {
  document_id: number
  proposal: CandidateProposal
}

export interface CandidateReviewIn {
  action: 'accept' | 'reject'
  request_uuid: string
  commitment_id?: number | null
  expected_version?: number | null
  proposal?: CandidateProposal | null
  note?: string | null
}

export interface CandidateReviewOut {
  candidate: CandidateOut
  commitment: CommitmentDetailOut | null
}

export interface AppendEventIn {
  request_uuid: string
  expected_version: number
  event: EventInput
}

export interface ArchiveCommitmentIn {
  request_uuid: string
  expected_version: number
  archived: boolean
  reason: string
}

export interface CommitmentFilters {
  status?: CommitmentStatus | null
  metric?: MetricKey | null
  include_archived: boolean
  offset: number
  limit: number
}

export const DEFAULT_COMMITMENT_FILTERS: CommitmentFilters = {
  status: null,
  metric: null,
  include_archived: false,
  offset: 0,
  limit: 25,
}

export interface PageParams {
  offset: number
  limit: number
}

export const DEFAULT_PAGE_PARAMS: PageParams = { offset: 0, limit: 25 }

/** Field names the backend reports as unresolved, in reviewer-facing wording. */
export const UNRESOLVED_FIELD_LABELS: Record<string, string> = {
  period_start: 'Fiscal period start',
  period_end: 'Fiscal period end',
  period_kind: 'Period type',
  statement_date: 'Statement date',
  currency: 'Currency',
  target: 'Target',
  actual_value: 'Reported result',
}
