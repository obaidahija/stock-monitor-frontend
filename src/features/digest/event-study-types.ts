export type Direction = 'down' | 'flat' | 'up'
export const categoryLabel = (category: string) => category.replaceAll('_', ' ')

export interface StudyModelMetrics {
  accuracy: number
  balanced_accuracy: number
  macro_f1: number
  confusion_matrix: number[][]
  class_support: Record<Direction, number>
  calibration_error?: number
  multiclass_brier?: number
  uncertainty?: { status?: string; dates?: number }
  cost_sensitivity: Record<string, { signals: number; mean_net_return_pct: number | null; win_fraction: number | null }>
}

export interface EventStudy {
  study_id: string
  status: 'experimental_unvalidated'
  evaluation_status: string
  generated_at: string
  start: string
  end: string
  stock_count: number
  outcome_count: number
  tickers: string[]
  horizons: Array<{
    horizon: number
    historical_confirmation?: Record<string, Omit<StudyModelMetrics, "cost_sensitivity">>
    deployment?: { enabled: boolean; reasons: string[]; supported_categories: string[] }
    selected_model: string
    split_counts: Record<string, number>
    models: Record<string, StudyModelMetrics>
  }>
  audit: {
    original_retained_facts: number
    retained_after_checks_and_review: number
    review_verdicts: Record<string, number>
  }
  limitations: string[]
  confirmation: string
  label_definition: string
  entry_definition: string
}

export interface FilingFact {
  category: string
  quote: string
  method?: string
}

export interface HistoricalFacts {
  ticker: string
  entry_session: string
  facts: FilingFact[]
  source_urls: string[]
}

export interface FilingEstimate {
  ticker: string
  status: 'not_started' | 'queued' | 'running' | 'complete' | 'unavailable' | 'error'
  phase?: string | null
  reason?: string | null
  filing_url?: string | null
  public_at?: string | null
  timing_source?: string | null
  form?: string | null
  entry_session?: string | null
  decision_at?: string | null
  generated_at?: string | null
  feature_last_session?: string | null
  preliminary: boolean
  retrospective: boolean
  facts: FilingFact[]
  rule_facts: FilingFact[]
  warnings: string[]
  estimates: Array<{
    horizon: number
    direction: Direction | null
    withheld_reasons?: string[]
    probabilities: Partial<Record<Direction, number>>
    model: string
    overlaps_training_period: boolean
    status: 'experimental_unvalidated'
    test_events: number
  }>
}
