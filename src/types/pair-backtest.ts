/**
 * Manual pair backtest: a retrospective replay of the pair-strategy-v1 signal for one
 * ordered pair -- the selected stock (A, `ticker`) against one candidate (B,
 * `candidate_ticker`) -- over the last 252 exchange sessions. Two separate questions:
 * what Stock A did after each signal that A was relatively low, and how an
 * illustrative fixed-hedge long/short simulation fared. A favourable pair result is
 * never evidence that A rose. Historical and descriptive only.
 *
 * Returns and rates are fractions (0.1 = 10%); money is illustrative units of
 * adjusted-price proxies. An empty sample's statistic is null, never zero.
 */

export type PairBacktestDirection = 'target_low' | 'candidate_low'
export type PairBacktestStatus = 'completed' | 'insufficient_data'
export type PairTradeExitReason = 'reversion' | 'stop' | 'max_hold' | 'insolvency'

/** The fixed settings a backtest was calculated with; not request inputs. */
export interface PairBacktestParametersOut {
  evaluation_sessions: number
  warmup_sessions: number
  formation_sessions: number
  observation_sessions: number
  baseline_sessions: number
  forward_horizons: number[]
  fill_model: 'next_session_close'
  entry_z: number
  reversion_z: number
  stop_z: number
  max_hold_sessions: number
  initial_capital: number
  fee_bps_per_fill: number
  annual_borrow_rate: number
  low_sample_closed_trades: number
  price_model: 'adjusted_total_return_proxy'
}

/** The relationship frozen on a signal date. */
export interface PairEntryModelOut {
  alpha: number
  hedge_ratio: number
  spread_mean: number
  spread_std: number
  signal_z: number
}

/** The first day of a supported relatively-low signal; entered at the next close. */
export interface PairBacktestEventOut {
  event_id: string
  signal_date: string
  direction: PairBacktestDirection
  entry_date: string | null
  model: PairEntryModelOut
}

/** Stock A's return over one horizon after one target-low signal. */
export interface PairForwardOutcomeOut {
  event_id: string
  horizon_sessions: number
  status: 'complete' | 'pending'
  entry_date: string | null
  outcome_date: string | null
  gross_return: number | null
  net_return: number | null
  benchmark_net_return: number | null
  excess_net_return: number | null
  first_convergence_date: string | null
  convergence_sessions: number | null
  converged: boolean | null
}

export interface ForwardHorizonStatsOut {
  horizon_sessions: number
  event_count: number
  completed_count: number
  pending_count: number
  converged_count: number
  mean_gross_return: number | null
  mean_net_return: number | null
  median_net_return: number | null
  positive_net_rate: number | null
  convergence_rate: number | null
  mean_convergence_sessions: number | null
  baseline_count: number
  baseline_mean_net_return: number | null
  benchmark_matched_count: number
  mean_excess_net_return: number | null
  positive_excess_rate: number | null
}

/** One simulated trade in adjusted units (a price proxy, not broker shares). */
export interface PairBacktestTradeOut {
  trade_id: string
  event_id: string
  direction: PairBacktestDirection
  signal_date: string
  entry_date: string
  exit_date: string | null
  exit_signal_date: string | null
  exit_reason: PairTradeExitReason | null
  pending_exit_reason: PairTradeExitReason | null
  status: 'open' | 'closed'
  model: PairEntryModelOut
  target_units: number
  candidate_units: number
  entry_gross_notional: number
  entry_target_price: number
  entry_candidate_price: number
  last_mark_date: string
  last_target_price: number
  last_candidate_price: number
  exit_target_price: number | null
  exit_candidate_price: number | null
  gross_pnl: number
  transaction_cost: number
  borrow_cost: number
  net_pnl: number
  return_on_entry_gross: number
  holding_sessions: number
  calendar_days: number
}

/** Illustrative equity at one evaluation close; drawdown is uncapped. */
export interface PairEquityPointOut {
  date: string
  equity: number
  realized_net_pnl: number
  unrealized_net_pnl: number
  drawdown: number
  open_trade_id: string | null
}

export interface PairPortfolioStatsOut {
  initial_equity: number
  final_equity: number
  total_net_return: number
  max_drawdown: number
  closed_trades: number
  open_trades: number
  pending_entries: number
  skipped_position_events: number
  skipped_insolvency_events: number
  winning_closed_trades: number
  net_win_rate: number | null
  reversion_exit_rate: number | null
  mean_closed_holding_sessions: number | null
  insolvent: boolean
}

export interface PairBacktestCalculationOut {
  status: PairBacktestStatus
  reasons: string[]
  warnings: string[]
  warmup_start: string
  warmup_end: string
  evaluation_start: string
  evaluation_end: string
  // Sessions with an adjusted close, of the 525 requested.
  target_sample_size: number
  candidate_sample_size: number
  supported_days: number
  not_supported_days: number
  undefined_days: number
  events: PairBacktestEventOut[]
  forward_stats: ForwardHorizonStatsOut[]
  forward_outcomes: PairForwardOutcomeOut[]
  trades: PairBacktestTradeOut[]
  equity_curve: PairEquityPointOut[]
  portfolio: PairPortfolioStatsOut | null
}

export interface PairBacktestOut {
  run_id: string
  ticker: string
  candidate_ticker: string
  benchmark_ticker: string
  source_pair_report_id: number
  source_pair_verified_at: string
  generated_at: string
  data_through: string
  method_version: string
  strategy_method_version: string
  price_basis: string
  parameters: PairBacktestParametersOut
  calculation: PairBacktestCalculationOut
  cached: boolean
  caveat: string
}
