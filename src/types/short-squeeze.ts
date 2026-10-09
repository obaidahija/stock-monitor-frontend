// Daily Short Squeeze scanner (/v1/discover/short-squeezes), rule short-squeeze-daily-v2.
// Mirrors the backend contracts; timestamps and dates arrive as ISO strings.
import type { SourceStatus } from './api'

export type ShortSqueezeStatus = 'matched' | 'excluded' | 'incomplete'
export type ShortSqueezeStatusFilter = 'matched' | 'incomplete' | 'all'
export type ShortSqueezeSort = 'move' | 'short_float' | 'days_to_cover' | 'ticker'
export type ShortSqueezeConditionState = 'pass' | 'fail' | 'unknown'
export type ShortSqueezeDataStatus = 'current' | 'stale' | 'not_collected'

export interface ShortSqueezeParams {
  status: ShortSqueezeStatusFilter
  sort: ShortSqueezeSort
  page: number
  pageSize: number
}

export interface ShortSqueezeConditionOut {
  state: ShortSqueezeConditionState
  value: number | null
  threshold: number | null
  comparison: string
  reason: string | null
}

export interface ShortSqueezeConditionsOut {
  short_float: ShortSqueezeConditionOut
  days_to_cover: ShortSqueezeConditionOut
  daily_gain: ShortSqueezeConditionOut
  /** Rule v2: the signal close at or above the prior 252-session high. */
  high_close?: ShortSqueezeConditionOut | null
  /** Stored rule v1 rows only: an intraday touch of that high. */
  high_touch?: ShortSqueezeConditionOut | null
  price_strength: ShortSqueezeConditionOut
}

/** Non-overlapping states; `missing_reason_counts` may overlap. */
export interface ShortSqueezeCoverageOut {
  evaluated: number
  matched: number
  incomplete: number
  excluded: number
  missing_reason_counts: Record<string, number>
}

export interface ShortSqueezeItemOut {
  evaluation_id: number
  ticker: string
  company_name: string | null
  status: ShortSqueezeStatus
  signal_session: string
  /** The dated reference a manual setup may start from; never a fill. */
  signal_close: number | null
  move_pct: number | null
  prior_high: number | null
  high_touched: boolean | null
  close_gap_to_high_pct: number | null
  relative_volume: number | null
  short_percent_of_float: number | null
  short_float_source?: 'yahoo_reported' | 'derived_shares_short_over_float' | null
  shares_short?: number | null
  short_ratio: number | null
  float_shares: number | null
  short_metadata_fetched_at: string | null
  short_report_date: string | null
  conditions: ShortSqueezeConditionsOut
  quality_reasons: string[]
  observation_id: number | null
  first_matched_at: string | null
  source_corrected: boolean
}

export interface ShortSqueezeFirstMatchOut {
  observation_id: number
  decision_at: string
  available_at: string
  signal_session: string
  /** Measurement starts at this session's close: the first close after discovery. */
  baseline_session: string
  rule_version: string
  signal_close: number | null
  conditions: ShortSqueezeConditionsOut
  metrics: Record<string, unknown>
}

export interface ShortSqueezeOutcomeOut {
  id: number
  horizon_sessions: number
  measurement_version: string
  revision: number
  status: 'pending' | 'evaluated' | 'missing_data' | 'corporate_action_unresolved'
  status_reason: string | null
  baseline_session: string
  exit_session: string
  expected_baseline_at: string
  expected_exit_at: string
  baseline_price: number | null
  exit_price: number | null
  raw_return_pct: number | null
  side_return_pct: number | null
  cost_adjusted_return_pct: number | null
  benchmark_return_pct: number | null
  excess_return_pct: number | null
  adverse_move_pct: number | null
  favorable_move_pct: number | null
  path_status: string | null
  target_stop_order: string | null
  extends_beyond_setup_expiry: boolean | null
  evaluated_at: string | null
}

export interface ShortSqueezeDetailOut extends ShortSqueezeItemOut {
  publication_id: number
  published_at: string
  rule_version: string
  constants: Record<string, unknown>
  evidence: Record<string, unknown>
  metrics: Record<string, unknown>
  first_match: ShortSqueezeFirstMatchOut | null
  outcomes: ShortSqueezeOutcomeOut[]
}

export interface ShortSqueezeListOut {
  items: ShortSqueezeItemOut[]
  total: number
  page: number
  page_size: number
  publication_id: number | null
  /** The evidence cutoff the published run read at. */
  generated_at: string | null
  published_at: string | null
  signal_session: string | null
  expected_signal_session: string | null
  stale: boolean
  data_status: ShortSqueezeDataStatus
  stale_reasons: string[]
  collection_enabled: boolean
  rule_version: string
  coverage: ShortSqueezeCoverageOut
  sources: SourceStatus[]
}
