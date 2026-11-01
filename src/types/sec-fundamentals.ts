export type FinancialPeriod = 'quarterly' | 'annual'
export type FinancialRefreshState = 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'disabled'

export interface FinancialSource {
  fact_id: string
  concept: string
  accession: string
  form: string
  filed: string
  accepted_at: string | null
  available_at: string
  availability_precision: string
  source_url: string
}

export interface FinancialMetric {
  value: string | null
  unit: 'USD' | 'percent'
  method: 'reported' | 'derived'
  comparability: 'same_filing' | 'mixed_filings' | 'unknown'
  reasons: string[]
  sources: FinancialSource[]
}

export interface FinancialPeriodRow {
  period_start: string | null
  period_end: string
  fiscal_label: string | null
  period_type: FinancialPeriod
  metrics: Record<string, FinancialMetric>
}

export interface FinancialQuality {
  status: 'ok' | 'partial' | 'stale' | 'unavailable' | 'unsupported' | 'empty'
  reasons: string[]
}

export interface FinancialRefresh {
  request_id: string | null
  requested_at?: string | null
  state: FinancialRefreshState
  error: string | null
  snapshot_id: number | null
}

export interface FinancialRefreshResult extends FinancialRefresh {
  ticker: string
  cik: string | null
}

export interface FinancialHistoryOut {
  ticker: string
  cik: string | null
  snapshot_id: number | null
  publication_id: number | null
  normalizer_version: string | null
  currency: string
  period: FinancialPeriod
  periods: FinancialPeriodRow[]
  quality: FinancialQuality
  coverage: { annual_periods: number; quarterly_periods: number; metrics_available: number; metrics_expected: number }
  latest_period_end: string | null
  latest_filing_date: string | null
  checked_at: string | null
  observed_at: string | null
  published_at: string | null
  pending_filings: string[]
  collection_enabled: boolean
  refresh: FinancialRefresh
}

export interface SecFundamentalsInputs {
  snapshot_id: number
  publication_id: number
  cutoff: string
  context: string
  quality: FinancialQuality
  selected_periods: FinancialPeriodRow[]
}
