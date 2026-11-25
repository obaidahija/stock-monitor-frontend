import type { EarningsResultOut } from './earnings-release'

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

export type SignalSource = 'disclosed' | 'results' | 'tone' | 'offering'

/** earnings = Item 2.02 (or a 7.01/8.01 release reporting results); event = any other 8-K news. */
export type FilingKind = 'earnings' | 'guidance' | 'event' | 'periodic_report' | 'offering' | 'other'

/** One positive/negative read per filing (app/filing_intel/signal.py). */
/**
 * A finding shown beside the label but not counted in it: guidance vs next-quarter consensus,
 * a full-year raise smaller than the quarter's beat, a one-off inside this quarter's EPS, or a
 * deal's stated terms (size vs market cap, cash, use of proceeds, expected close).
 */
export interface SignalContextItem {
  source: 'guidance_vs_consensus' | 'beat_vs_raise' | 'one_time_item' | 'deal_terms' | 'portfolio_change' | 'release_highlight' | 'restatement' | 'segment_decline' | 'amendment'
  direction: 'positive' | 'negative' | 'neutral'
  detail: string
  evidence: string[]
  counted: false
}

export interface FilingSignal {
  /** null when nothing voted but there is context to show. */
  label: 'positive' | 'negative' | 'mixed' | null
  strength: 'strong' | 'weighed' | 'single' | null
  /** Each reason with the evidence behind it: quoted sentences, or actual vs expected figures. */
  reasons: { source: SignalSource; direction: 'positive' | 'negative'; detail: string; evidence: string[] }[]
  context?: SignalContextItem[]
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
  /** The reference close came from the detection quote; the evening closes job confirms it. */
  ref_close_provisional?: boolean
  close_1d: number | null
  close_1d_date: string | null
  close_5d: number | null
  close_5d_date: string | null
  /** Issuer market cap at read time. */
  market_cap?: number | null
  /** Detection quote stamped at/before acceptance: the price before the filing was public (news out before EDGAR). */
  pre_filing_price?: number | null
  /** Move from the last close to that price, %. */
  pre_filing_move_pct?: number | null
  /** The price at filing every later move is measured from, and its source. */
  entry_price?: number | null
  entry_price_time?: string | null
  entry_price_source?: 'pre_filing_quote' | 'detection_quote' | 'last_trade_before' | null
  url: string
  events: FilingEventOut[]
  facts: FilingFactOut[]
  features: FilingFeatures
  signal: FilingSignal | null
  kind: FilingKind | null
  /** Separate news an earnings 8-K also carries, e.g. "executive change". */
  other_events: string[]
  /** Earnings release figures and any consensus snapshot saved with the extraction. */
  earnings_result: EarningsResultOut | null
  /** Its row in /v1/stocks/{ticker}/filings, for the on-demand analysis. */
  filing_id?: number | null
  /** A 10-Q/10-K filed after the issuer's results release: that release, whose label replaces its own. */
  follows_release?: LinkedFiling | null
  /** On a results release: the 10-Q/10-K that followed it (folded into this row). */
  periodic_report?: LinkedFiling | null
  /** On a results release: the 10-K/A and 10-Q/As filed with it, each with its note. */
  amendments?: (LinkedFiling & { note: string | null })[]
}

export interface LinkedFiling {
  accession: string
  form: string
  accepted_at: string | null
  label: 'positive' | 'negative' | 'mixed' | null
  strength: string | null
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

/** Prices around a filing for its chart (GET /v1/filing-intel/filings/{accession}/chart). */
export interface PricePoint {
  t: string
  price: number
  session: 'pre' | 'regular' | 'post'
}

export interface PriceSeriesOut {
  ticker: string
  interval: '5m' | '1d'
  accepted_at: string
  points: PricePoint[]
}
