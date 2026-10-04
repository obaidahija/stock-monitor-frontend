/**
 * Manual pair strategy analysis: a fixed-hedge adjusted-price spread between the
 * selected stock (A, `ticker`) and one candidate (B, `candidate_ticker`). The order
 * is part of the identity; B/A is a separate analysis. Historical and descriptive
 * only -- never a forecast, a backtest or a trading recommendation.
 */

export type PairStrategyEvidenceStatus =
  | 'supported'
  | 'not_supported'
  | 'insufficient_data'
  | 'undefined'

// target_low: A is unusually low relative to its modelled relationship with B;
// candidate_low: B is. Published only with supported relationship evidence.
export type PairStrategySignal = 'target_low' | 'candidate_low' | 'within_range' | 'unavailable'

/** One observation date's spread against the previous 20 spreads. */
export interface PairStrategyPointOut {
  date: string
  spread: number
  mean: number | null
  std: number | null
  lower_band: number | null
  upper_band: number | null
  z_score: number | null
}

/** Formation-period test results; null means not evaluated or undefined. */
export interface PairStrategyDiagnosticsOut {
  target_level_adf_pvalue: number | null
  target_diff_adf_pvalue: number | null
  candidate_level_adf_pvalue: number | null
  candidate_diff_adf_pvalue: number | null
  cointegration_statistic: number | null
  cointegration_pvalue: number | null
  assumptions_supported: boolean | null
}

export interface PairStrategyCalculationOut {
  evidence_status: PairStrategyEvidenceStatus
  signal: PairStrategySignal
  reasons: string[]
  alpha: number | null
  hedge_ratio: number | null
  // The final observation's values.
  spread: number | null
  spread_mean: number | null
  spread_std: number | null
  z_score: number | null
  diagnostics: PairStrategyDiagnosticsOut
  // Requested exchange-session windows.
  formation_start: string
  formation_end: string
  observation_start: string
  observation_end: string
  // Sessions both stocks actually traded.
  formation_sample_size: number
  observation_sample_size: number
  points: PairStrategyPointOut[]
  warnings: string[]
}

/** The fixed settings a result was calculated with; not request inputs. */
export interface PairStrategyParametersOut {
  formation_sessions: number
  observation_sessions: number
  baseline_sessions: number
  entry_z: number
  significance: number
  ddof: number
  maxlag: number
  autolag: string
}

export interface PairStrategyOut {
  report_id: number
  ticker: string
  candidate_ticker: string
  source_pair_report_id: number
  source_pair_verified_at: string
  generated_at: string
  data_through: string
  method_version: string
  price_basis: string
  parameters: PairStrategyParametersOut
  calculation: PairStrategyCalculationOut
  cached: boolean
  caveat: string
}
