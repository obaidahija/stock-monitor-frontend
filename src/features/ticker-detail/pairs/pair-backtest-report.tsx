import { useId, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import type {
  ForwardHorizonStatsOut,
  PairBacktestDirection,
  PairBacktestOut,
  PairBacktestTradeOut,
  PairForwardOutcomeOut,
  PairTradeExitReason,
} from '@/types/pair-backtest'
import { PairBacktestEquityChart } from './pair-backtest-equity-chart'
import {
  formatBacktestMoney,
  formatBacktestPercent,
  formatBacktestRate,
  formatBacktestReturn,
} from './pair-backtest-format'
import { formatHedgeRatio } from './pair-strategy-format'

const DASH = '—'
const PENDING = 'Pending'

const EXIT_REASONS: Record<PairTradeExitReason, string> = {
  reversion: 'Reversion',
  stop: 'Stop',
  max_hold: 'Time limit',
  insolvency: 'Insolvency',
}

function directionLabel(direction: PairBacktestDirection, target: string, candidate: string) {
  return direction === 'target_low'
    ? `Long ${target} / short ${candidate}`
    : `Long ${candidate} / short ${target}`
}

/** A sample statistic, or why there is none: no signals at all, or none matured yet. */
function sampleValue(stats: ForwardHorizonStatsOut, value: string) {
  if (stats.event_count === 0) return DASH
  if (stats.completed_count === 0) return PENDING
  return value
}

function Toggle({
  open,
  onToggle,
  controls,
  children,
}: {
  open: boolean
  onToggle: () => void
  controls: string
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
    >
      {children}
    </Button>
  )
}

function Measurement({ label, value }: { label: string; value: string }) {
  return (
    <li>
      <span className="text-muted-foreground block text-xs">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </li>
  )
}

/** A table that scrolls sideways on narrow screens and can be reached with the keyboard. */
function ScrollTable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={`${label} (scrollable)`}
      tabIndex={0}
      className="focus-visible:ring-ring max-h-80 overflow-auto rounded-md focus-visible:ring-2 focus-visible:outline-none"
    >
      <table aria-label={label} className="w-full min-w-max text-xs tabular-nums">
        {children}
      </table>
    </div>
  )
}

function HeaderCells({ names }: { names: string[] }) {
  return (
    <thead>
      <tr className="text-muted-foreground text-left">
        {names.map((name) => (
          <th key={name} scope="col" className="py-1 pr-3 font-medium whitespace-nowrap">
            {name}
          </th>
        ))}
      </tr>
    </thead>
  )
}

function OutcomeDetails({ report }: { report: PairBacktestOut }) {
  const { calculation, benchmark_ticker: benchmark } = report
  const signalDates = new Map(calculation.events.map((event) => [event.event_id, event.signal_date]))
  const outcomes = [...calculation.forward_outcomes].sort(
    (left, right) =>
      (signalDates.get(left.event_id) ?? '').localeCompare(signalDates.get(right.event_id) ?? '') ||
      left.horizon_sessions - right.horizon_sessions,
  )
  const pending = (outcome: PairForwardOutcomeOut, value: string) =>
    outcome.status === 'pending' ? PENDING : value
  return (
    <ScrollTable label={`${report.ticker} outcome after each signal`}>
      <HeaderCells
        names={[
          'Signal',
          'Horizon',
          'Entry',
          'Outcome date',
          'Gross',
          'Net',
          `${benchmark} net`,
          'Excess',
          'Spread converged',
        ]}
      />
      <tbody>
        {outcomes.map((outcome) => (
          <tr key={`${outcome.event_id}:${outcome.horizon_sessions}`} className="border-border border-t">
            <th scope="row" className="py-1 pr-3 text-left font-normal">
              {formatDate(signalDates.get(outcome.event_id) ?? null)}
            </th>
            <td className="py-1 pr-3">{outcome.horizon_sessions} sessions</td>
            <td className="py-1 pr-3">{outcome.entry_date ? formatDate(outcome.entry_date) : PENDING}</td>
            <td className="py-1 pr-3">{pending(outcome, formatDate(outcome.outcome_date))}</td>
            <td className="py-1 pr-3">{pending(outcome, formatBacktestReturn(outcome.gross_return))}</td>
            <td className="py-1 pr-3">{pending(outcome, formatBacktestReturn(outcome.net_return))}</td>
            <td className="py-1 pr-3">
              {pending(outcome, formatBacktestReturn(outcome.benchmark_net_return))}
            </td>
            <td className="py-1 pr-3">
              {pending(outcome, formatBacktestReturn(outcome.excess_net_return))}
            </td>
            <td className="py-1">
              {pending(
                outcome,
                outcome.converged
                  ? `${formatDate(outcome.first_convergence_date)} (${outcome.convergence_sessions} sessions)`
                  : 'No',
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </ScrollTable>
  )
}

function StockAOutcomes({ report }: { report: PairBacktestOut }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const detailsId = useId()
  const { calculation, parameters, benchmark_ticker: benchmark } = report
  const target = report.ticker
  const candidate = report.candidate_ticker
  const targetLow = calculation.events.filter((event) => event.direction === 'target_low').length
  return (
    <section aria-label="Stock A outcomes" className="space-y-2">
      <p className="text-sm font-medium">1. {target} alone</p>
      <p className="text-muted-foreground text-xs">
        Each time {target} was flagged as relatively low against {candidate} ({targetLow} of the{' '}
        {calculation.events.length} historical signals), {target} is held alone from the next
        session&apos;s close for {parameters.forward_horizons.join(', ')} sessions, net of{' '}
        {parameters.fee_bps_per_fill} bps per fill. Individual returns are in the details.
      </p>
      {targetLow === 0 && (
        <p className="text-xs">
          No signal flagged {target} in this period, so there are no {target} outcomes to show;
          the usual {target} return is still listed for comparison.
        </p>
      )}
      <ScrollTable label={`${target} outcomes by horizon`}>
        <HeaderCells
          names={[
            'Horizon',
            'Signals',
            'Mean gross',
            'Mean net',
            'Median net',
            'Positive net',
            `Usual ${target}`,
            `vs ${benchmark}`,
            `Beat ${benchmark}`,
            'Spread converged',
          ]}
        />
        <tbody>
          {calculation.forward_stats.map((stats) => (
            <tr key={stats.horizon_sessions} className="border-border border-t">
              <th scope="row" className="py-1 pr-3 text-left font-normal">
                {stats.horizon_sessions} sessions
              </th>
              <td className="py-1 pr-3">
                {`${stats.completed_count} of ${stats.event_count}`}
                {stats.pending_count > 0 && ` · ${stats.pending_count} pending`}
              </td>
              <td className="py-1 pr-3">
                {sampleValue(stats, formatBacktestReturn(stats.mean_gross_return))}
              </td>
              <td className="py-1 pr-3">
                {sampleValue(stats, formatBacktestReturn(stats.mean_net_return))}
              </td>
              <td className="py-1 pr-3">
                {sampleValue(stats, formatBacktestReturn(stats.median_net_return))}
              </td>
              <td className="py-1 pr-3">
                {sampleValue(stats, formatBacktestRate(stats.positive_net_rate))}
              </td>
              <td className="py-1 pr-3">
                {stats.baseline_count === 0
                  ? DASH
                  : `${formatBacktestReturn(stats.baseline_mean_net_return)} (${stats.baseline_count})`}
              </td>
              <td className="py-1 pr-3">
                {sampleValue(
                  stats,
                  stats.benchmark_matched_count === 0
                    ? `${DASH} (no ${benchmark} match)`
                    : `${formatBacktestReturn(stats.mean_excess_net_return)} (${stats.benchmark_matched_count} matched)`,
                )}
              </td>
              <td className="py-1 pr-3">
                {sampleValue(
                  stats,
                  stats.benchmark_matched_count === 0
                    ? `${DASH} (no ${benchmark} match)`
                    : `${formatBacktestRate(stats.positive_excess_rate)} (${stats.benchmark_matched_count} matched)`,
                )}
              </td>
              <td className="py-1">
                {sampleValue(
                  stats,
                  `${formatBacktestRate(stats.convergence_rate)} of ${stats.completed_count}` +
                    (stats.mean_convergence_sessions === null
                      ? ''
                      : `, avg ${stats.mean_convergence_sessions.toFixed(1)} sessions (${stats.converged_count} converged)`),
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>
      <ul className="text-muted-foreground list-disc space-y-0.5 pl-5 text-xs">
        <li>
          Pending: the horizon ends after the data cutoff. It is left out of every mean and rate,
          never counted as zero.
        </li>
        <li>
          Usual {target}: the same entry rule, horizon and costs from every evaluated date, signal
          or not (count in brackets). A descriptive comparison only.
        </li>
        <li>
          vs {benchmark}: {target}&apos;s net return minus {benchmark}&apos;s over the same dates,
          averaged only where {benchmark} has both closes. Beat {benchmark}: the percentage of
          those matched outcomes with a higher net return than {benchmark}.
        </li>
        <li>
          Spread converged: for a {target}-low signal, the frozen z-score reached or crossed
          -{parameters.reversion_z} by the horizon&apos;s end; a jump above the baseline also counts.
          Average time uses only converged outcomes (count shown).
        </li>
      </ul>
      <p className="text-xs">
        A gain on the pair trade below does not mean {target} rose: the gap can close because{' '}
        {candidate} fell further. Only this table answers what {target} did on its own.
      </p>
      {calculation.forward_outcomes.length > 0 && (
        <div className="space-y-2">
          <Toggle
            open={detailsOpen}
            onToggle={() => setDetailsOpen((open) => !open)}
            controls={detailsId}
          >
            {detailsOpen ? `Hide ${target} signal details` : `Show ${target} signal details`}
          </Toggle>
          <div id={detailsId}>{detailsOpen && <OutcomeDetails report={report} />}</div>
        </div>
      )}
    </section>
  )
}

function TradeLog({ report }: { report: PairBacktestOut }) {
  const target = report.ticker
  const candidate = report.candidate_ticker
  const exitCell = (trade: PairBacktestTradeOut) =>
    trade.status === 'closed'
      ? formatDate(trade.exit_date)
      : `Open, marked ${formatDate(trade.last_mark_date)}`
  const reasonCell = (trade: PairBacktestTradeOut) => {
    if (trade.status === 'closed' && trade.exit_reason) return EXIT_REASONS[trade.exit_reason]
    if (trade.pending_exit_reason) return `Queued: ${EXIT_REASONS[trade.pending_exit_reason]}`
    return DASH
  }
  return (
    <ScrollTable label="Simulated trades">
      <HeaderCells
        names={[
          'Trade',
          'Direction',
          'Signal',
          'Entry',
          'Exit',
          'Exit reason',
          'Hedge ratio (β)',
          'Gross P&L',
          'Fees',
          'Borrow',
          'Net P&L',
          'Return on gross',
        ]}
      />
      <tbody>
        {report.calculation.trades.map((trade) => (
          <tr key={trade.trade_id} className="border-border border-t">
            <th scope="row" className="py-1 pr-3 text-left font-normal">
              {trade.trade_id}
            </th>
            <td className="py-1 pr-3">{directionLabel(trade.direction, target, candidate)}</td>
            <td className="py-1 pr-3">{formatDate(trade.signal_date)}</td>
            <td className="py-1 pr-3">{formatDate(trade.entry_date)}</td>
            <td className="py-1 pr-3">{exitCell(trade)}</td>
            <td className="py-1 pr-3">{reasonCell(trade)}</td>
            <td className="py-1 pr-3">{formatHedgeRatio(trade.model.hedge_ratio)}</td>
            <td className="py-1 pr-3">{formatBacktestMoney(trade.gross_pnl, { signed: true })}</td>
            <td className="py-1 pr-3">{formatBacktestMoney(trade.transaction_cost)}</td>
            <td className="py-1 pr-3">{formatBacktestMoney(trade.borrow_cost)}</td>
            <td className="py-1 pr-3">{formatBacktestMoney(trade.net_pnl, { signed: true })}</td>
            <td className="py-1">{formatBacktestReturn(trade.return_on_entry_gross)}</td>
          </tr>
        ))}
      </tbody>
    </ScrollTable>
  )
}

function PairSimulation({ report }: { report: PairBacktestOut }) {
  const [equityOpen, setEquityOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const equityId = useId()
  const logId = useId()
  const { calculation, parameters } = report
  const portfolio = calculation.portfolio
  if (portfolio === null) return null
  const trades = calculation.trades
  const openTrade = trades.find((trade) => trade.status === 'open')
  const final = calculation.equity_curve[calculation.equity_curve.length - 1]
  const closed = portfolio.closed_trades
  const skipped = portfolio.skipped_position_events + portfolio.skipped_insolvency_events
  const closedRate = (value: number | null) =>
    closed === 0 ? DASH : `${formatBacktestRate(value)} of ${closed}`
  return (
    <section aria-label="Pair simulation" className="space-y-2">
      <p className="text-sm font-medium">2. Long/short pair simulation</p>
      <p className="text-muted-foreground text-xs">
        Each signal goes long the relatively low stock and short its partner at the frozen hedge
        ratio, from the next session&apos;s close. Simulated in adjusted units (a price proxy, not
        broker shares) from {formatBacktestMoney(parameters.initial_capital)} of illustrative
        capital, one position at a time.
      </p>
      <ul
        aria-label="Pair simulation results"
        className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4"
      >
        <Measurement
          label="Total net return (marked)"
          value={formatBacktestReturn(portfolio.total_net_return)}
        />
        <Measurement label="Maximum drawdown" value={formatBacktestPercent(portfolio.max_drawdown)} />
        <Measurement label="Final equity" value={formatBacktestMoney(portfolio.final_equity)} />
        <Measurement label="Closed trades" value={String(closed)} />
        <Measurement label="Open trades" value={String(portfolio.open_trades)} />
        <Measurement label="Pending entries" value={String(portfolio.pending_entries)} />
        <Measurement label="Skipped episodes" value={String(skipped)} />
        <Measurement label="Net win rate (closed trades)" value={closedRate(portfolio.net_win_rate)} />
        <Measurement
          label="Reversion exits (closed trades)"
          value={closedRate(portfolio.reversion_exit_rate)}
        />
        <Measurement
          label="Average hold (closed trades)"
          value={
            portfolio.mean_closed_holding_sessions === null
              ? DASH
              : `${portfolio.mean_closed_holding_sessions.toFixed(1)} sessions`
          }
        />
      </ul>
      <ul className="text-muted-foreground list-disc space-y-0.5 pl-5 text-xs">
        {trades.length === 0 && <li>No simulated trades</li>}
        {openTrade && final && (
          <li>
            The total includes{' '}
            {formatBacktestMoney(final.unrealized_net_pnl, { signed: true })} of unrealized net P&amp;L
            from the open trade, marked at the {formatDate(final.date)} close; it is not a filled
            exit.
          </li>
        )}
        {portfolio.pending_entries > 0 && (
          <li>
            A signal on the final session would be entered at the next close, after the data
            cutoff, so it is not counted as a trade.
          </li>
        )}
        {portfolio.skipped_position_events > 0 && (
          <li>
            {portfolio.skipped_position_events} episode
            {portfolio.skipped_position_events === 1 ? '' : 's'} started while a position was open
            and {portfolio.skipped_position_events === 1 ? 'was' : 'were'} skipped; their{' '}
            {report.ticker} outcomes still appear above.
          </li>
        )}
        {portfolio.insolvent && (
          <li>
            Simulated equity fell to zero or below.{' '}
            {openTrade
              ? "The position remains open at the data cutoff; liquidation is queued for the next session's close."
              : 'The position was closed.'}{' '}
            {portfolio.skipped_insolvency_events} later episode
            {portfolio.skipped_insolvency_events === 1 ? ' was' : 's were'} not entered.
          </li>
        )}
        {closed < parameters.low_sample_closed_trades && (
          <li>
            Only {closed} closed trade{closed === 1 ? '' : 's'}: fewer than{' '}
            {parameters.low_sample_closed_trades} closed trades is too small a sample to judge this
            simulation.
          </li>
        )}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Toggle open={equityOpen} onToggle={() => setEquityOpen((open) => !open)} controls={equityId}>
          {equityOpen ? 'Hide equity curve' : 'Show equity curve'}
        </Toggle>
        {trades.length > 0 && (
          <Toggle open={logOpen} onToggle={() => setLogOpen((open) => !open)} controls={logId}>
            {logOpen ? 'Hide trade log' : `Show trade log (${trades.length})`}
          </Toggle>
        )}
      </div>
      {/* Each mounted only while open. */}
      <div id={equityId}>{equityOpen && <PairBacktestEquityChart report={report} />}</div>
      <div id={logId}>{logOpen && trades.length > 0 && <TradeLog report={report} />}</div>
    </section>
  )
}

function Assumptions({ report }: { report: PairBacktestOut }) {
  const { calculation, parameters } = report
  return (
    <section aria-label="Backtest assumptions" className="space-y-1 text-xs">
      <p className="text-sm font-medium">Assumptions and limits</p>
      <ul className="text-muted-foreground list-disc space-y-0.5 pl-5">
        {calculation.status === 'completed' && (
          <li>
            Signals: the {report.strategy_method_version} check replayed on each of the{' '}
            {parameters.evaluation_sessions} evaluated sessions with only prices up to that date (
            {calculation.supported_days} supported, {calculation.not_supported_days} not supported,{' '}
            {calculation.undefined_days} undefined).
          </li>
        )}
        <li>
          Entry: a new supported signal at |z| ≥ {parameters.entry_z}, filled at the next
          session&apos;s close, never at the signal day&apos;s own close.
        </li>
        <li>
          Reversion: the frozen z-score reaches or rises above -{parameters.reversion_z} for a{' '}
          {report.ticker}-low signal, or reaches or falls below +{parameters.reversion_z} for a{' '}
          {report.candidate_ticker}-low signal. Overshoots count; the exit fills at the following
          session&apos;s close.
        </li>
        <li>
          Stop: the frozen z-score reaches or falls below -{parameters.stop_z} for a{' '}
          {report.ticker}-low signal, or reaches or rises above +{parameters.stop_z} for a{' '}
          {report.candidate_ticker}-low signal. Stop and insolvency exits fill at the following
          session&apos;s close.
        </li>
        <li>
          Time limit: the exit is queued after {parameters.max_hold_sessions - 1} elapsed sessions
          and fills after {parameters.max_hold_sessions} elapsed sessions from entry, if that close
          is within the data cutoff. Any unfilled exit remains pending.
        </li>
        <li>
          Costs: {parameters.fee_bps_per_fill} bps of each filled leg&apos;s notional per fill;
          short borrow at {formatBacktestRate(parameters.annual_borrow_rate)} a year over calendar
          days. No margin, financing or borrow-availability limits are modelled.
        </li>
        <li>
          Capital: {formatBacktestMoney(parameters.initial_capital)} of illustrative capital, one
          position at a time, sized so fees never add leverage.
        </li>
        <li>
          Prices: split- and dividend-adjusted daily closes, a total-return proxy. Yahoo history
          can be restated; this is not a point-in-time archive.
        </li>
        <li>
          Selection: this pair was selected today; the replay does not show whether it would have
          been chosen at the time.
        </li>
      </ul>
      {calculation.warnings.length > 0 && (
        <ul aria-label="Backtest notes" className="text-muted-foreground space-y-0.5">
          {calculation.warnings.map((warning, index) => (
            <li key={`${index}-${warning}`}>{warning}</li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground">
        Method {report.method_version} (strategy {report.strategy_method_version}) · run{' '}
        {report.run_id}
      </p>
    </section>
  )
}

/** The saved backtest: Stock A alone first, then the pair simulation, then assumptions. */
export function PairBacktestReport({ report }: { report: PairBacktestOut }) {
  const { calculation, parameters } = report
  const sessions = parameters.warmup_sessions + parameters.evaluation_sessions
  return (
    <div className="space-y-4">
      {calculation.reasons.length > 0 && (
        <ul className="text-muted-foreground list-disc space-y-0.5 pl-5 text-xs">
          {calculation.reasons.map((reason, index) => (
            <li key={`${index}-${reason}`}>{reason}</li>
          ))}
        </ul>
      )}
      {calculation.status === 'insufficient_data' ? (
        <p className="text-muted-foreground text-xs">
          Coverage: {report.ticker} has {calculation.target_sample_size} and{' '}
          {report.candidate_ticker} has {calculation.candidate_sample_size} of the {sessions}{' '}
          sessions needed; nothing was replayed or simulated.
        </p>
      ) : (
        <>
          <StockAOutcomes report={report} />
          <PairSimulation report={report} />
        </>
      )}
      <Assumptions report={report} />
    </div>
  )
}
