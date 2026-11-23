// Mirrors app/filing_intel/schemas.py (/v1/filing-intel).

export type ExpectedForm = '8-K 2.02' | '10-Q' | '10-K'
export type ExpectedBasis = 'earnings_calendar' | 'issuer_history' | 'statutory_deadline'
export type ExpectedConfidence = 'high' | 'medium' | 'low'
export type ExpectedStatus = 'expected' | 'filed' | 'late'
/** tracked = in your ticker universe; extended = untracked US common stock above the market-cap floor. */
export type Coverage = 'tracked' | 'extended'
export type PriceSession = 'pre' | 'regular' | 'post'

export interface QuoteOut {
  ticker: string
  price: number
  session: PriceSession
  time: string | null
}

export interface ExpectedFilingOut {
  ticker: string
  form: ExpectedForm
  expected_date: string
  window_start: string
  window_end: string
  window_start_et: string
  window_end_et: string
  basis: ExpectedBasis
  confidence: ExpectedConfidence
  status: ExpectedStatus
  matched_accession: string | null
  coverage: Coverage
  detail: Record<string, unknown>
}

export interface FilingEvidenceOut {
  field: string
  text: string
  document: string | null
}

export interface FilingEventOut {
  event_type: string
  item: string | null
  topic: string | null
  direction: 'positive' | 'negative' | 'mixed' | null
  method: 'rule' | 'llm'
  fields: Record<string, unknown>
  evidence: FilingEvidenceOut[]
}

export interface FilingFactOut {
  metric: string
  value: string
  unit: string
  period_start: string | null
  period_end: string | null
  period_kind: string | null
  basis: 'gaap' | 'adjusted'
  source: 'xbrl' | 'release'
  concept: string | null
  dimensions: Record<string, unknown>
  provenance: string | null
}

export type FilingFeatures = Record<string, string | number | boolean>

export type SignalSource = 'disclosed' | 'results' | 'tone'

/** One positive/negative read per filing (app/filing_intel/signal.py). */
export interface FilingSignal {
  label: 'positive' | 'negative' | 'mixed'
  strength: 'strong' | 'weighed' | 'single'
  /** Each reason with the evidence behind it: quoted sentences, or actual vs expected figures. */
  reasons: { source: SignalSource; direction: 'positive' | 'negative'; detail: string; evidence: string[] }[]
  version: number
}

export interface FilingIntelFilingOut {
  accession: string
  ticker: string | null
  cik: string
  form: string
  item_codes: string[]
  accepted_at: string | null
  detected_at: string | null
  detected_via: 'feed' | 'analyze' | 'backfill'
  coverage: Coverage
  detection_lag_seconds: number | null
  period_of_report: string | null
  status: 'pending' | 'extracted' | 'failed'
  error_code: string | null
  summary: string | null
  extraction_version: number | null
  extract_ms: number | null
  warnings: string[]
  documents: Record<string, string>
  /** Quote taken right after live detection; null for backfilled or older filings. */
  detected_price: number | null
  detected_price_session: PriceSession | null
  detected_price_time: string | null
  /** Daily closes around the filing: last close before it was public, first and fifth after. */
  ref_close: number | null
  ref_close_date: string | null
  close_1d: number | null
  close_1d_date: string | null
  close_5d: number | null
  close_5d_date: string | null
  url: string
  events: FilingEventOut[]
  facts: FilingFactOut[]
  features: FilingFeatures
  signal: FilingSignal | null
}

export interface AnalyzeIn {
  tickers?: string[]
  accessions?: string[]
  days?: number
  per_ticker?: number
  force?: boolean
}

export interface AnalyzeOut {
  requested: number
  elapsed_ms: number
  outcomes: { accession: string; status: 'extracted' | 'cached' | 'failed'; error_code?: string }[]
  errors: { ticker?: string; accession?: string; error_code: string }[]
  filings: FilingIntelFilingOut[]
}

export interface FilingEpisodeOut {
  ticker: string
  start: string
  end: string
  filings: { accession: string; form: string; accepted_at: string; summary: string | null }[]
}
