import type {
  StockPairBusinessClaimOut,
  StockPairBusinessEvidenceOut,
  StockPairItemOut,
  StockPairReturnPointOut,
  StockPairScatterOut,
  StockPairsOut,
  StockPairWindowOut,
} from '@/types/api'
import type {
  ForwardHorizonStatsOut,
  PairBacktestCalculationOut,
  PairBacktestEventOut,
  PairBacktestOut,
  PairBacktestParametersOut,
  PairBacktestTradeOut,
  PairEntryModelOut,
  PairEquityPointOut,
  PairForwardOutcomeOut,
} from '@/types/pair-backtest'
import type {
  PairStrategyCalculationOut,
  PairStrategyDiagnosticsOut,
  PairStrategyOut,
  PairStrategyPointOut,
} from '@/types/pair-strategy'

export const sixMonth: StockPairWindowOut = {
  start_date: '2026-04-08',
  end_date: '2026-09-30',
  sample_size: 120,
  correlation: 0.8213,
  target_up_days: 70,
  both_up_days: 56,
  candidate_up_days: 66,
  up_day_agreement_pct: 80,
  baseline_up_day_pct: 55,
  up_day_improvement_pp: 25,
  market_check: {
    status: 'available',
    correlation: 0.1234,
    sample_size: 118,
    start_date: '2026-04-08',
    end_date: '2026-09-30',
    reason: null,
  },
  scatter: null,
}

export const threeMonth: StockPairWindowOut = {
  start_date: '2026-07-02',
  end_date: '2026-09-30',
  sample_size: 63,
  correlation: 0.6512,
  target_up_days: 35,
  both_up_days: 25,
  candidate_up_days: 33,
  up_day_agreement_pct: 71.4286,
  baseline_up_day_pct: 52.381,
  up_day_improvement_pp: 19.0476,
  market_check: {
    status: 'unavailable',
    correlation: null,
    sample_size: 30,
    start_date: '2026-08-12',
    end_date: '2026-09-30',
    reason: 'Only 30 aligned SPY returns (minimum 40).',
  },
  scatter: null,
}

export const seagate: StockPairItemOut = {
  ticker: 'STX',
  company_name: 'Seagate Technology Holdings plc',
  exchange: 'NASDAQ',
  explanation: 'Duopoly in enterprise hard drives',
  strength: 'moderate',
  evidence_status: 'computed',
  reasons: [],
  three_month: threeMonth,
  six_month: sixMonth,
  business_evidence: null,
}

export const newListing: StockPairItemOut = {
  ticker: 'NEWC',
  company_name: 'New Storage Co',
  exchange: 'NYSE',
  explanation: 'Recently listed storage supplier',
  strength: 'not_confirmed',
  evidence_status: 'insufficient_data',
  reasons: ['3 months: only 33 aligned daily returns (minimum 40).'],
  three_month: {
    ...threeMonth,
    sample_size: 33,
    correlation: null,
    up_day_agreement_pct: null,
    up_day_improvement_pp: null,
  },
  six_month: null,
  business_evidence: null,
}

// Saved before evidence and scatter plots existed: the new fields are absent.
export const fund: StockPairItemOut = {
  ticker: 'QQQ',
  company_name: 'Invesco QQQ Trust',
  exchange: 'NASDAQ',
  explanation: 'Tracks large technology stocks',
  strength: 'not_confirmed',
  evidence_status: 'invalid_security',
  reasons: ['QQQ is listed as ETF, not a common stock.'],
  three_month: null,
  six_month: null,
}

export const savedReport: StockPairsOut = {
  snapshot_id: 7,
  ticker: 'WDC',
  question: 'As of 2026-10-01 (UTC), list up to 5 current US-listed common stocks…',
  answer_markdown: 'Seagate (**STX**) shares the hard-drive cycle with Western Digital.',
  sources: [
    {
      title: 'Storage stocks move together',
      publisher: 'Example News',
      url: 'https://example.com/storage-peers',
    },
  ],
  source: {
    name: 'google_finance',
    ok: true,
    fetched_at: '2026-10-01T12:01:30Z',
    error: null,
    latency_ms: 4200,
  },
  generated_at: '2026-10-01T12:01:30Z',
  verified_at: '2026-10-01T12:02:05Z',
  data_through: '2026-09-30',
  method_version: 'stock-pairs-v1',
  items: [seagate, newListing, fund],
  warnings: [],
  cached: true,
  caveat: 'Historical co-movement; this does not predict future prices.',
}

const seagateSource = {
  title: 'Seagate investors',
  publisher: 'Seagate',
  url: 'https://www.seagate.com/investors/overview',
}
const westernDigitalSource = {
  title: 'About Western Digital',
  publisher: null,
  url: 'https://www.westerndigital.com/company/about',
}

export const seagateClaim: StockPairBusinessClaimOut = {
  kind: 'shared_product',
  subject: 'STX',
  fact: 'Seagate sells mass-capacity hard drives.',
  proposed_excerpt: 'Seagate Technology is a leading provider of mass-capacity data storage.',
  reported_source_date: '2026-08-01',
  source: seagateSource,
  check_status: 'matched',
  checked_excerpt: 'Seagate Technology is a leading provider of mass-capacity data storage.',
  checked_at: '2026-10-01T12:02:00Z',
  source_published_at: '2026-07-30T09:00:00Z',
  final_url: 'https://www.seagate.com/investors/overview',
  content_sha256: 'a'.repeat(64),
  reason: null,
}

export const westernDigitalClaim: StockPairBusinessClaimOut = {
  ...seagateClaim,
  subject: 'WDC',
  fact: 'Western Digital sells hard drives to cloud customers.',
  proposed_excerpt: 'Western Digital builds high-capacity hard drives for cloud customers.',
  reported_source_date: null,
  source: westernDigitalSource,
  checked_excerpt: 'Western Digital builds high-capacity hard drives for cloud customers.',
  source_published_at: null,
  final_url: 'https://www.westerndigital.com/company/about',
}

export const checkedEvidence: StockPairBusinessEvidenceOut = {
  hypothesis: 'Duopoly in enterprise hard drives',
  status: 'source_checked',
  claims: [seagateClaim, westernDigitalClaim],
  reason: null,
}

export const partialEvidence: StockPairBusinessEvidenceOut = {
  ...checkedEvidence,
  status: 'partial',
  claims: [
    seagateClaim,
    {
      ...westernDigitalClaim,
      check_status: 'mismatch',
      checked_excerpt: null,
      reason: "The quoted sentence was not found in the page's article text.",
    },
  ],
  reason: 'Passages were found for only one company.',
}

export const unretrievedEvidence: StockPairBusinessEvidenceOut = {
  ...checkedEvidence,
  status: 'unverified',
  claims: [
    {
      ...seagateClaim,
      check_status: 'unavailable',
      checked_excerpt: null,
      source_published_at: null,
      final_url: null,
      content_sha256: null,
      reason: 'The source returned HTTP 403.',
    },
  ],
  reason:
    'The cited pages could not be retrieved, so their passages were neither confirmed nor contradicted.',
}

/** Deterministic daily returns (fractions) on consecutive dates, for plot fixtures. */
function returnPoints(count: number, start: string, slope: number): StockPairReturnPointOut[] {
  const first = Date.parse(`${start}T00:00:00Z`)
  return Array.from({ length: count }, (_, index) => {
    const target = (((index * 7) % 11) - 5) / 1000
    const noise = (((index * 3) % 5) - 2) / 2000
    return {
      date: new Date(first + index * 86_400_000).toISOString().slice(0, 10),
      target_return: target,
      candidate_return: slope * target + noise,
    }
  })
}

export const sixMonthScatter: StockPairScatterOut = {
  status: 'available',
  points: returnPoints(120, '2026-04-08', 1.2),
  intercept: 0.0001,
  slope: 1.2,
  reason: null,
}

export const threeMonthScatter: StockPairScatterOut = {
  status: 'available',
  points: returnPoints(63, '2026-07-02', 0.8),
  intercept: -0.0002,
  slope: 0.8,
  reason: null,
}

export const plottedSeagate: StockPairItemOut = {
  ...seagate,
  three_month: { ...threeMonth, scatter: threeMonthScatter },
  six_month: { ...sixMonth, scatter: sixMonthScatter },
  business_evidence: checkedEvidence,
}

export const enhancedReport: StockPairsOut = {
  ...savedReport,
  items: [plottedSeagate, newListing, fund],
}

// --- manual pair strategy (WDC against STX) -------------------------------------

// The 21 XNYS sessions of September 2026 (Labor Day closed).
export const observationDates = [
  '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-08', '2026-09-09',
  '2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17',
  '2026-09-18', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25',
  '2026-09-28', '2026-09-29', '2026-09-30',
]

const BASELINE_MEAN = 0.1
const BASELINE_STD = 0.6

/** A measured observation: z = (spread - 0.1) / 0.6, bands 0.1 ± 1.2. */
export function strategyPoint(index: number, spread: number): PairStrategyPointOut {
  return {
    date: observationDates[index],
    spread,
    mean: BASELINE_MEAN,
    std: BASELINE_STD,
    lower_band: BASELINE_MEAN - 2 * BASELINE_STD,
    upper_band: BASELINE_MEAN + 2 * BASELINE_STD,
    z_score: (spread - BASELINE_MEAN) / BASELINE_STD,
  }
}

/** Twenty ordinary observations followed by ``finalSpread``. */
export function strategyPoints(finalSpread: number): PairStrategyPointOut[] {
  return [
    ...Array.from({ length: 20 }, (_, index) => strategyPoint(index, ((index % 5) - 2) * 0.4)),
    strategyPoint(20, finalSpread),
  ]
}

const emptyDiagnostics: PairStrategyDiagnosticsOut = {
  target_level_adf_pvalue: null,
  target_diff_adf_pvalue: null,
  candidate_level_adf_pvalue: null,
  candidate_diff_adf_pvalue: null,
  cointegration_statistic: null,
  cointegration_pvalue: null,
  assumptions_supported: null,
}

function measured(finalSpread: number) {
  const points = strategyPoints(finalSpread)
  const final = points[points.length - 1]
  return {
    points,
    spread: final.spread,
    spread_mean: final.mean,
    spread_std: final.std,
    z_score: final.z_score,
  }
}

export const supportedCalculation: PairStrategyCalculationOut = {
  evidence_status: 'supported',
  signal: 'within_range',
  reasons: [
    'Both price series passed the I(1) screen, and the Engle-Granger test found a cointegrating ' +
      'relationship (p-value below 0.05) with a positive hedge ratio during the formation period.',
  ],
  alpha: 7.12,
  hedge_ratio: 1.4931,
  ...measured(-0.8),
  diagnostics: {
    target_level_adf_pvalue: 0.6214,
    target_diff_adf_pvalue: 0.0001,
    candidate_level_adf_pvalue: 0.4807,
    candidate_diff_adf_pvalue: 0,
    cointegration_statistic: -4.731,
    cointegration_pvalue: 0.0012,
    assumptions_supported: true,
  },
  formation_start: '2025-08-28',
  formation_end: '2026-08-31',
  observation_start: '2026-09-01',
  observation_end: '2026-09-30',
  formation_sample_size: 252,
  observation_sample_size: 21,
  warnings: [],
}

export const strategyCaveat =
  'Historical relative-price analysis, not a prediction that either stock will rise. ' +
  'The relationship can break; this is not a backtested trading recommendation.'

export const supportedStrategy: PairStrategyOut = {
  report_id: 11,
  ticker: 'WDC',
  candidate_ticker: 'STX',
  source_pair_report_id: 7,
  source_pair_verified_at: '2026-10-01T12:02:05Z',
  generated_at: '2026-10-01T13:00:00Z',
  data_through: '2026-09-30',
  method_version: 'pair-strategy-v1',
  price_basis: 'split_dividend_adjusted',
  parameters: {
    formation_sessions: 252,
    observation_sessions: 21,
    baseline_sessions: 20,
    entry_z: 2,
    significance: 0.05,
    ddof: 1,
    maxlag: 10,
    autolag: 'aic',
  },
  calculation: supportedCalculation,
  cached: true,
  caveat: strategyCaveat,
}

export function strategyWith(
  calculation: Partial<PairStrategyCalculationOut>,
  report: Partial<PairStrategyOut> = {},
): PairStrategyOut {
  return {
    ...supportedStrategy,
    ...report,
    calculation: { ...supportedCalculation, ...calculation },
  }
}

// z = (-1.5 - 0.1) / 0.6 = -2.67: WDC unusually low relative to STX.
export const targetLowStrategy = strategyWith({ signal: 'target_low', ...measured(-1.5) })

// z = (1.7 - 0.1) / 0.6 = +2.67: STX unusually low relative to WDC.
export const candidateLowStrategy = strategyWith({ signal: 'candidate_low', ...measured(1.7) })

// A large gap without a supported relationship publishes no signal.
export const notSupportedStrategy = strategyWith({
  evidence_status: 'not_supported',
  signal: 'unavailable',
  reasons: [
    'The Engle-Granger test did not find a cointegrating relationship in the formation ' +
      'period (p-value not below 0.05).',
  ],
  ...measured(1.7),
  diagnostics: { ...supportedCalculation.diagnostics, cointegration_pvalue: 0.4112 },
})

export const insufficientStrategy = strategyWith({
  evidence_status: 'insufficient_data',
  signal: 'unavailable',
  reasons: [
    'STX has adjusted closes for 180 of the 252 formation sessions (2025-08-28 to 2026-08-31).',
    'Both stocks need an adjusted close on all 273 sessions; missing dates are never filled ' +
      'or bridged.',
  ],
  alpha: null,
  hedge_ratio: null,
  spread: null,
  spread_mean: null,
  spread_std: null,
  z_score: null,
  diagnostics: emptyDiagnostics,
  formation_sample_size: 180,
  points: [],
})

export const undefinedStrategy = strategyWith({
  evidence_status: 'undefined',
  signal: 'unavailable',
  reasons: [
    'statsmodels flagged the formation prices as almost perfectly collinear, so the ' +
      'Engle-Granger test is not reliable.',
  ],
  diagnostics: {
    ...supportedCalculation.diagnostics,
    cointegration_statistic: null,
    cointegration_pvalue: null,
  },
})

// --- manual pair backtests ------------------------------------------------------------

function weekdaysEnding(end: string, count: number): string[] {
  const dates: string[] = []
  const day = new Date(`${end}T00:00:00Z`)
  while (dates.length < count) {
    const weekday = day.getUTCDay()
    if (weekday !== 0 && weekday !== 6) dates.unshift(day.toISOString().slice(0, 10))
    day.setUTCDate(day.getUTCDate() - 1)
  }
  return dates
}

/** The 252 evaluated sessions (weekdays standing in for exchange sessions). */
export const backtestDates = weekdaysEnding('2026-09-30', 252)

export const backtestCaveat =
  'Retrospective test of a pair selected today, using adjusted-price proxies and assumed ' +
  'costs. Historical outcomes are not a prediction; actual fills, borrow availability and ' +
  'costs can differ.'

export const overlapNotice =
  "Stock A outcomes are measured separately for each episode from the next session's " +
  'close; horizons and nearby episodes overlap, so they are not an independent portfolio ' +
  'or independent experiments, and the unconditional comparison is descriptive only.'

export const backtestParameters: PairBacktestParametersOut = {
  evaluation_sessions: 252,
  warmup_sessions: 273,
  formation_sessions: 252,
  observation_sessions: 21,
  baseline_sessions: 20,
  forward_horizons: [3, 5, 10, 20],
  fill_model: 'next_session_close',
  entry_z: 2,
  reversion_z: 0.5,
  stop_z: 3.5,
  max_hold_sessions: 20,
  initial_capital: 10000,
  fee_bps_per_fill: 10,
  annual_borrow_rate: 0.03,
  low_sample_closed_trades: 20,
  price_model: 'adjusted_total_return_proxy',
}

const firstModel: PairEntryModelOut = {
  alpha: 7.12,
  hedge_ratio: 1.49,
  spread_mean: 0.1,
  spread_std: 0.6,
  signal_z: -2.41,
}

const secondModel: PairEntryModelOut = {
  alpha: 6.9,
  hedge_ratio: 1.49,
  spread_mean: -0.2,
  spread_std: 0.7,
  signal_z: 2.27,
}

export const backtestEvents: PairBacktestEventOut[] = [
  {
    event_id: `${backtestDates[100]}:target_low`,
    signal_date: backtestDates[100],
    direction: 'target_low',
    entry_date: backtestDates[101],
    model: firstModel,
  },
  {
    event_id: `${backtestDates[240]}:candidate_low`,
    signal_date: backtestDates[240],
    direction: 'candidate_low',
    entry_date: backtestDates[241],
    model: secondModel,
  },
]

// WDC long 49 units, STX short 73.01: entered at 100/66, exited at 104/67.
export const closedTrade: PairBacktestTradeOut = {
  trade_id: 'trade-1',
  event_id: backtestEvents[0].event_id,
  direction: 'target_low',
  signal_date: backtestDates[100],
  entry_date: backtestDates[101],
  exit_date: backtestDates[104],
  exit_signal_date: backtestDates[103],
  exit_reason: 'reversion',
  pending_exit_reason: null,
  status: 'closed',
  model: firstModel,
  target_units: 49,
  candidate_units: -73.01,
  entry_gross_notional: 9718.66,
  entry_target_price: 100,
  entry_candidate_price: 66,
  last_mark_date: backtestDates[104],
  last_target_price: 104,
  last_candidate_price: 67,
  exit_target_price: 104,
  exit_candidate_price: 67,
  gross_pnl: 122.99,
  transaction_cost: 19.71,
  borrow_cost: 0.6,
  net_pnl: 102.68,
  return_on_entry_gross: 102.68 / 9718.66,
  holding_sessions: 3,
  calendar_days: 5,
}

// STX long 74.5 units, WDC short 50: still open at the cutoff.
export const openTrade: PairBacktestTradeOut = {
  trade_id: 'trade-2',
  event_id: backtestEvents[1].event_id,
  direction: 'candidate_low',
  signal_date: backtestDates[240],
  entry_date: backtestDates[241],
  exit_date: null,
  exit_signal_date: null,
  exit_reason: null,
  pending_exit_reason: null,
  status: 'open',
  model: secondModel,
  target_units: -50,
  candidate_units: 74.5,
  entry_gross_notional: 10715,
  entry_target_price: 110,
  entry_candidate_price: 70,
  last_mark_date: backtestDates[251],
  last_target_price: 111,
  last_candidate_price: 70.2,
  exit_target_price: null,
  exit_candidate_price: null,
  gross_pnl: -35.1,
  transaction_cost: 10.7,
  borrow_cost: 0.4,
  net_pnl: -46.2,
  return_on_entry_gross: -46.2 / 10715,
  holding_sessions: 10,
  calendar_days: 14,
}

function curvePoint(
  index: number,
  realized: number,
  unrealized: number,
  peak: number,
  openTradeId: string | null,
): PairEquityPointOut {
  const equity = 10000 + realized + unrealized
  const runningPeak = Math.max(peak, equity)
  return {
    date: backtestDates[index],
    equity,
    realized_net_pnl: realized,
    unrealized_net_pnl: unrealized,
    drawdown: (runningPeak - equity) / runningPeak,
    open_trade_id: openTradeId,
  }
}

function completedCurve(): PairEquityPointOut[] {
  const points: PairEquityPointOut[] = []
  let peak = 10000
  backtestDates.forEach((_, index) => {
    let point: PairEquityPointOut
    if (index <= 100) point = curvePoint(index, 0, 0, peak, null)
    else if (index === 101) point = curvePoint(index, 0, -9.72, peak, 'trade-1')
    else if (index === 102) point = curvePoint(index, 0, 40, peak, 'trade-1')
    else if (index === 103) point = curvePoint(index, 0, 90, peak, 'trade-1')
    else if (index <= 240) point = curvePoint(index, 102.68, 0, peak, null)
    else if (index === 241) point = curvePoint(index, 102.68, -10.7, peak, 'trade-2')
    else if (index < 251) point = curvePoint(index, 102.68, -20, peak, 'trade-2')
    else point = curvePoint(index, 102.68, -46.2, peak, 'trade-2')
    peak = Math.max(peak, point.equity)
    points.push(point)
  })
  return points
}

const completedEquity = completedCurve()

function horizonStats(
  horizon: number,
  gross: number,
  net: number,
  excess: number | null,
  baselineCount: number,
): ForwardHorizonStatsOut {
  return {
    horizon_sessions: horizon,
    event_count: 1,
    completed_count: 1,
    pending_count: 0,
    converged_count: 1,
    mean_gross_return: gross,
    mean_net_return: net,
    median_net_return: net,
    positive_net_rate: net > 0 ? 1 : 0,
    convergence_rate: 1,
    mean_convergence_sessions: 2,
    baseline_count: baselineCount,
    baseline_mean_net_return: 0.0021,
    benchmark_matched_count: excess === null ? 0 : 1,
    mean_excess_net_return: excess,
    positive_excess_rate: excess === null ? null : excess > 0 ? 1 : 0,
  }
}

function forwardOutcome(
  horizon: number,
  endIndex: number,
  gross: number,
  net: number,
  benchmark: number | null,
): PairForwardOutcomeOut {
  return {
    event_id: backtestEvents[0].event_id,
    horizon_sessions: horizon,
    status: 'complete',
    entry_date: backtestDates[101],
    outcome_date: backtestDates[endIndex],
    gross_return: gross,
    net_return: net,
    benchmark_net_return: benchmark,
    excess_net_return: benchmark === null ? null : net - benchmark,
    first_convergence_date: backtestDates[103],
    convergence_sessions: 2,
    converged: true,
  }
}

export const completedBacktestCalculation: PairBacktestCalculationOut = {
  status: 'completed',
  reasons: [],
  warnings: [overlapNotice],
  warmup_start: '2024-08-21',
  warmup_end: '2025-09-30',
  evaluation_start: backtestDates[0],
  evaluation_end: backtestDates[251],
  target_sample_size: 525,
  candidate_sample_size: 525,
  supported_days: 230,
  not_supported_days: 15,
  undefined_days: 7,
  events: backtestEvents,
  forward_stats: [
    horizonStats(3, 0.04, 0.03796, 0.02796, 248),
    horizonStats(5, 0.03, 0.02797, 0.01597, 246),
    horizonStats(10, -0.02, -0.02298, -0.03798, 241),
    horizonStats(20, -0.05, -0.05195, null, 231),
  ],
  forward_outcomes: [
    forwardOutcome(3, 104, 0.04, 0.03796, 0.01),
    forwardOutcome(5, 106, 0.03, 0.02797, 0.012),
    forwardOutcome(10, 111, -0.02, -0.02298, 0.015),
    forwardOutcome(20, 121, -0.05, -0.05195, null),
  ],
  trades: [closedTrade, openTrade],
  equity_curve: completedEquity,
  portfolio: {
    initial_equity: 10000,
    final_equity: completedEquity[251].equity,
    total_net_return: completedEquity[251].equity / 10000 - 1,
    max_drawdown: Math.max(...completedEquity.map((point) => point.drawdown)),
    closed_trades: 1,
    open_trades: 1,
    pending_entries: 0,
    skipped_position_events: 0,
    skipped_insolvency_events: 0,
    winning_closed_trades: 1,
    net_win_rate: 1,
    reversion_exit_rate: 1,
    mean_closed_holding_sessions: 3,
    insolvent: false,
  },
}

export const completedBacktest: PairBacktestOut = {
  run_id: '6f1c2b8e-2d61-4f0f-9c2a-55a1e3f0b001',
  ticker: 'WDC',
  candidate_ticker: 'STX',
  benchmark_ticker: 'SPY',
  source_pair_report_id: 7,
  source_pair_verified_at: '2026-10-01T12:02:05Z',
  generated_at: '2026-10-01T13:10:00Z',
  data_through: '2026-09-30',
  method_version: 'pair-backtest-v1',
  strategy_method_version: 'pair-strategy-v1',
  price_basis: 'split_dividend_adjusted',
  parameters: backtestParameters,
  calculation: completedBacktestCalculation,
  cached: true,
  caveat: backtestCaveat,
}

export function backtestWith(
  calculation: Partial<PairBacktestCalculationOut>,
  report: Partial<PairBacktestOut> = {},
): PairBacktestOut {
  return {
    ...completedBacktest,
    ...report,
    calculation: { ...completedBacktestCalculation, ...calculation },
  }
}

export const flatEquityCurve: PairEquityPointOut[] = backtestDates.map((date) => ({
  date,
  equity: 10000,
  realized_net_pnl: 0,
  unrealized_net_pnl: 0,
  drawdown: 0,
  open_trade_id: null,
}))

export const noSignalBacktest = backtestWith({
  reasons: [
    'No qualifying historical signals: no supported relatively-low signal started during ' +
      'the 252 evaluated sessions. This is not evidence for or against the strategy.',
  ],
  events: [],
  forward_outcomes: [],
  forward_stats: [3, 5, 10, 20].map((horizon) => ({
    horizon_sessions: horizon,
    event_count: 0,
    completed_count: 0,
    pending_count: 0,
    converged_count: 0,
    mean_gross_return: null,
    mean_net_return: null,
    median_net_return: null,
    positive_net_rate: null,
    convergence_rate: null,
    mean_convergence_sessions: null,
    baseline_count: 251 - horizon,
    baseline_mean_net_return: 0.0021,
    benchmark_matched_count: 0,
    mean_excess_net_return: null,
    positive_excess_rate: null,
  })),
  trades: [],
  equity_curve: flatEquityCurve,
  portfolio: {
    initial_equity: 10000,
    final_equity: 10000,
    total_net_return: 0,
    max_drawdown: 0,
    closed_trades: 0,
    open_trades: 0,
    pending_entries: 0,
    skipped_position_events: 0,
    skipped_insolvency_events: 0,
    winning_closed_trades: 0,
    net_win_rate: null,
    reversion_exit_rate: null,
    mean_closed_holding_sessions: null,
    insolvent: false,
  },
})

export const insufficientBacktest = backtestWith({
  status: 'insufficient_data',
  reasons: [
    'STX has adjusted closes for 400 of the 525 sessions (2024-08-21 to 2026-09-30).',
    'Both stocks need an adjusted close on all 525 sessions -- 273 warmup and 252 ' +
      'evaluated; missing dates are never filled or bridged, and the period is never shortened.',
  ],
  warnings: [],
  candidate_sample_size: 400,
  supported_days: 0,
  not_supported_days: 0,
  undefined_days: 0,
  events: [],
  forward_stats: [],
  forward_outcomes: [],
  trades: [],
  equity_curve: [],
  portfolio: null,
})

function pendingHorizon(horizon: number): ForwardHorizonStatsOut {
  return {
    horizon_sessions: horizon,
    event_count: 1,
    completed_count: 0,
    pending_count: 1,
    converged_count: 0,
    mean_gross_return: null,
    mean_net_return: null,
    median_net_return: null,
    positive_net_rate: null,
    convergence_rate: null,
    mean_convergence_sessions: null,
    baseline_count: 251 - horizon,
    baseline_mean_net_return: 0.0021,
    benchmark_matched_count: 0,
    mean_excess_net_return: null,
    positive_excess_rate: null,
  }
}

// One signal on the cutoff session: its entry and every outcome are still pending.
export const pendingBacktest = backtestWith({
  events: [
    {
      event_id: `${backtestDates[251]}:target_low`,
      signal_date: backtestDates[251],
      direction: 'target_low',
      entry_date: null,
      model: firstModel,
    },
  ],
  forward_stats: [3, 5, 10, 20].map(pendingHorizon),
  forward_outcomes: [3, 5, 10, 20].map((horizon) => ({
    event_id: `${backtestDates[251]}:target_low`,
    horizon_sessions: horizon,
    status: 'pending' as const,
    entry_date: null,
    outcome_date: null,
    gross_return: null,
    net_return: null,
    benchmark_net_return: null,
    excess_net_return: null,
    first_convergence_date: null,
    convergence_sessions: null,
    converged: null,
  })),
  trades: [],
  equity_curve: flatEquityCurve,
  portfolio: {
    initial_equity: 10000,
    final_equity: 10000,
    total_net_return: 0,
    max_drawdown: 0,
    closed_trades: 0,
    open_trades: 0,
    pending_entries: 1,
    skipped_position_events: 0,
    skipped_insolvency_events: 0,
    winning_closed_trades: 0,
    net_win_rate: null,
    reversion_exit_rate: null,
    mean_closed_holding_sessions: null,
    insolvent: false,
  },
})

// The short leg quadrupled: liquidated below zero, then a later episode was skipped.
export const insolventTrade: PairBacktestTradeOut = {
  ...closedTrade,
  exit_reason: 'insolvency',
  exit_date: backtestDates[103],
  exit_signal_date: backtestDates[102],
  last_mark_date: backtestDates[103],
  last_target_price: 100,
  last_candidate_price: 220,
  exit_target_price: 100,
  exit_candidate_price: 220,
  gross_pnl: -11170.3,
  transaction_cost: 25.7,
  borrow_cost: 4,
  net_pnl: -11200,
  return_on_entry_gross: -11200 / 9718.66,
  holding_sessions: 2,
  calendar_days: 2,
}

function insolventCurve(): PairEquityPointOut[] {
  return backtestDates.map((date, index) => {
    let realized = 0
    let unrealized = 0
    let open: string | null = null
    if (index === 101) [unrealized, open] = [-9.72, 'trade-1']
    else if (index === 102) [unrealized, open] = [-11000, 'trade-1']
    else if (index >= 103) realized = -11200
    const equity = 10000 + realized + unrealized
    return {
      date,
      equity,
      realized_net_pnl: realized,
      unrealized_net_pnl: unrealized,
      drawdown: (10000 - equity) / 10000,
      open_trade_id: open,
    }
  })
}

const insolventEquity = insolventCurve()

export const insolventBacktest = backtestWith({
  trades: [insolventTrade],
  equity_curve: insolventEquity,
  portfolio: {
    initial_equity: 10000,
    final_equity: -1200,
    total_net_return: -1.12,
    max_drawdown: 1.12,
    closed_trades: 1,
    open_trades: 0,
    pending_entries: 0,
    skipped_position_events: 0,
    skipped_insolvency_events: 1,
    winning_closed_trades: 0,
    net_win_rate: 0,
    reversion_exit_rate: 0,
    mean_closed_holding_sessions: 2,
    insolvent: true,
  },
})
