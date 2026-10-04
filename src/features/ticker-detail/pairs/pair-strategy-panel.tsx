import { useId, useState } from 'react'
import { ChartLine, RefreshCw } from 'lucide-react'
import { pairTicker } from '@/api/stock-pairs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ApiError } from '@/lib/api-client'
import { formatDate } from '@/lib/format'
import type { PairStrategyOut } from '@/types/pair-strategy'
import { PairSpreadChart } from './pair-spread-chart'
import { formatHedgeRatio, formatPValue, formatZScore } from './pair-strategy-format'
import { useAnalyzePairStrategy, usePairStrategy } from './pair-strategy-hooks'

const DASH = '—'

type BadgeVariant = 'default' | 'secondary' | 'outline'

/** The ordered pair's status: which stock is relatively low, never "undervalued". */
function strategyStatus(report: PairStrategyOut): { label: string; variant: BadgeVariant } {
  const { evidence_status: status, signal } = report.calculation
  const target = report.ticker
  const candidate = report.candidate_ticker
  if (status === 'supported') {
    if (signal === 'target_low') {
      return { label: `${target} relatively low vs ${candidate}`, variant: 'default' }
    }
    if (signal === 'candidate_low') {
      return { label: `${candidate} relatively low vs ${target}`, variant: 'default' }
    }
    return { label: 'No unusual divergence', variant: 'secondary' }
  }
  if (status === 'not_supported') return { label: 'Relationship not supported', variant: 'outline' }
  if (status === 'insufficient_data') return { label: 'Insufficient data', variant: 'outline' }
  return { label: 'Analysis unavailable', variant: 'outline' }
}

function formatFixed(value: number | null, digits: number) {
  return value === null ? DASH : value.toFixed(digits)
}

function formatTimestamp(value: string) {
  // The viewer's own locale and time zone, with the zone named.
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value))
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError && typeof error.detail === 'string') return error.detail
  return error instanceof Error ? error.message : 'The strategy analysis failed. Please try again.'
}

function Measurement({ label, value }: { label: string; value: string }) {
  return (
    <li>
      <span className="text-muted-foreground block text-xs">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </li>
  )
}

function TestRow({ label, value, needed }: { label: string; value: string; needed: string }) {
  return (
    <tr className="border-border border-t">
      <th scope="row" className="py-1 pr-3 text-left font-normal">
        {label}
      </th>
      <td className="py-1 pr-3 text-right tabular-nums">{value}</td>
      <td className="text-muted-foreground py-1 text-right">{needed}</td>
    </tr>
  )
}

function StrategyDetails({ report }: { report: PairStrategyOut }) {
  const { calculation, parameters } = report
  const { diagnostics } = calculation
  const target = report.ticker
  const candidate = report.candidate_ticker
  const significance = parameters.significance
  const cutoff = `${significance}`
  const pvalue = (value: number | null) => formatPValue(value, significance)
  const integrationScreen =
    diagnostics.assumptions_supported === null
      ? 'Not evaluated'
      : diagnostics.assumptions_supported
        ? 'Passed'
        : 'Not passed'
  return (
    <div className="space-y-3 text-xs">
      <div className="text-muted-foreground space-y-0.5">
        <p>
          Formation period:{' '}
          <time dateTime={calculation.formation_start}>{formatDate(calculation.formation_start)}</time> –{' '}
          <time dateTime={calculation.formation_end}>{formatDate(calculation.formation_end)}</time> ·{' '}
          {calculation.formation_sample_size} of {parameters.formation_sessions} sessions (fits the
          hedge ratio and runs the tests)
        </p>
        <p>
          Observation period:{' '}
          <time dateTime={calculation.observation_start}>
            {formatDate(calculation.observation_start)}
          </time>{' '}
          – <time dateTime={calculation.observation_end}>{formatDate(calculation.observation_end)}</time>{' '}
          · {calculation.observation_sample_size} of {parameters.observation_sessions} sessions (spread
          and z-scores with that fixed fit)
        </p>
      </div>
      {calculation.alpha !== null && calculation.hedge_ratio !== null && (
        <p className="font-mono">
          {`${target} = ${calculation.alpha.toFixed(2)} + ${formatHedgeRatio(calculation.hedge_ratio)} × ${candidate} + spread`}
        </p>
      )}
      <PairSpreadChart report={report} />
      <table aria-label="Formation-period tests" className="w-full max-w-xl">
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="py-1 pr-3 text-left font-normal">
              Test
            </th>
            <th scope="col" className="py-1 pr-3 text-right font-normal">
              Value
            </th>
            <th scope="col" className="py-1 text-right font-normal">
              Needed for support
            </th>
          </tr>
        </thead>
        <tbody>
          <TestRow
            label={`${target} price level, ADF p-value`}
            value={pvalue(diagnostics.target_level_adf_pvalue)}
            needed={`≥ ${cutoff}`}
          />
          <TestRow
            label={`${target} daily changes, ADF p-value`}
            value={pvalue(diagnostics.target_diff_adf_pvalue)}
            needed={`< ${cutoff}`}
          />
          <TestRow
            label={`${candidate} price level, ADF p-value`}
            value={pvalue(diagnostics.candidate_level_adf_pvalue)}
            needed={`≥ ${cutoff}`}
          />
          <TestRow
            label={`${candidate} daily changes, ADF p-value`}
            value={pvalue(diagnostics.candidate_diff_adf_pvalue)}
            needed={`< ${cutoff}`}
          />
          <TestRow label="I(1) screen" value={integrationScreen} needed="Passed" />
          <TestRow
            label="Engle-Granger statistic"
            value={formatFixed(diagnostics.cointegration_statistic, 3)}
            needed={DASH}
          />
          <TestRow
            label="Engle-Granger p-value"
            value={pvalue(diagnostics.cointegration_pvalue)}
            needed={`< ${cutoff}`}
          />
          <TestRow
            label="Hedge ratio (β)"
            value={formatHedgeRatio(calculation.hedge_ratio)}
            needed="> 0"
          />
        </tbody>
      </table>
      <div className="text-muted-foreground space-y-1">
        <p>
          A relationship is supported only when both price levels pass the I(1) screen, the
          Engle-Granger test of the formation residuals has a p-value below {cutoff}, and the hedge
          ratio is positive. A p-value is not a confidence level, and checking many pairs produces
          chance findings.
        </p>
        <p>
          The z-score compares the latest spread with the mean and sample standard deviation of the
          previous {parameters.baseline_sessions} spreads; ±{parameters.entry_z} marks an unusual
          gap. Values are rounded only for display.
        </p>
      </div>
      {calculation.evidence_status === 'supported' && calculation.reasons.length > 0 && (
        <ul className="text-muted-foreground list-disc space-y-0.5 pl-5">
          {calculation.reasons.map((reason, index) => (
            <li key={`${index}-${reason}`}>{reason}</li>
          ))}
        </ul>
      )}
      {calculation.warnings.length > 0 && (
        <ul aria-label="Strategy warnings" className="text-muted-foreground space-y-0.5">
          {calculation.warnings.map((warning, index) => (
            <li key={`${index}-${warning}`}>{warning}</li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground">
        Business evidence for {candidate} is shown above; it is checked separately and does not
        validate this statistical relationship.
      </p>
      <p className="text-muted-foreground">
        Method {report.method_version} · split- and dividend-adjusted daily closes · from the pair
        report verified{' '}
        <time dateTime={report.source_pair_verified_at}>
          {formatTimestamp(report.source_pair_verified_at)}
        </time>
      </p>
    </div>
  )
}

function StrategySummary({ report }: { report: PairStrategyOut }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const detailsId = useId()
  const { calculation, parameters } = report
  const status = strategyStatus(report)
  return (
    <div className="space-y-2">
      <Badge variant={status.variant}>{status.label}</Badge>
      <div className="text-muted-foreground space-y-0.5 text-xs">
        <p>
          Analyzed: <time dateTime={report.generated_at}>{formatTimestamp(report.generated_at)}</time>
        </p>
        <p>
          Prices through: <time dateTime={report.data_through}>{formatDate(report.data_through)}</time>{' '}
          (adjusted daily closes)
        </p>
      </div>
      {calculation.evidence_status !== 'supported' && calculation.reasons.length > 0 && (
        <ul className="text-muted-foreground list-disc space-y-0.5 pl-5 text-xs">
          {calculation.reasons.map((reason, index) => (
            <li key={`${index}-${reason}`}>{reason}</li>
          ))}
        </ul>
      )}
      {calculation.hedge_ratio !== null && (
        <ul
          aria-label="Strategy measurements"
          className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3"
        >
          <Measurement label="Hedge ratio (β)" value={formatHedgeRatio(calculation.hedge_ratio)} />
          <Measurement
            label="Current z-score"
            value={formatZScore(calculation.z_score, parameters.entry_z)}
          />
          <Measurement
            label="Engle-Granger p-value"
            value={formatPValue(calculation.diagnostics.cointegration_pvalue, parameters.significance)}
          />
        </ul>
      )}
      <p className="text-muted-foreground text-xs">{report.caveat}</p>
      <div className="space-y-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-expanded={detailsOpen}
          aria-controls={detailsId}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          {detailsOpen ? 'Hide strategy details' : 'Show strategy details'}
        </Button>
        {/* Mounted only while open. */}
        <div id={detailsId}>{detailsOpen && <StrategyDetails report={report} />}</div>
      </div>
    </div>
  )
}

export function PairStrategyPanel({
  ticker,
  candidateTicker,
  disabledReason,
}: {
  ticker: string
  candidateTicker: string
  disabledReason?: string
}) {
  const target = pairTicker(ticker)
  const candidate = pairTicker(candidateTicker)
  const disabled = disabledReason !== undefined
  const query = usePairStrategy(target, candidate, !disabled)
  const analyze = useAnalyzePairStrategy(target, candidate)
  // Only this ordered pair's analysis is ever shown here.
  const report =
    query.data && query.data.ticker === target && query.data.candidate_ticker === candidate
      ? query.data
      : null
  const readFailed = query.isError && report === null
  const pendingText = report ? 'Refreshing analysis…' : 'Analyzing strategy…'

  return (
    <section
      aria-label={`Strategy check: ${target} against ${candidate}`}
      className="border-border space-y-3 rounded-md border border-dashed p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Relative-price strategy check</p>
          <p className="text-muted-foreground text-xs">
            Tests whether {target} and {candidate} prices have kept a stable relationship and how
            unusual today&apos;s gap is. Manual and saved until you refresh it.
          </p>
        </div>
        {!readFailed && !(query.isLoading && !disabled) && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || analyze.isPending}
            onClick={() => analyze.mutate(report !== null)}
          >
            {analyze.isPending ? <Spinner aria-hidden /> : report ? <RefreshCw /> : <ChartLine />}
            {analyze.isPending ? pendingText : report ? 'Refresh analysis' : 'Analyze strategy'}
          </Button>
        )}
      </div>

      {disabled && (
        <p className="text-muted-foreground text-xs">Strategy analysis unavailable: {disabledReason}</p>
      )}
      {query.isLoading && !disabled && (
        <p className="text-muted-foreground text-xs">Loading saved analysis…</p>
      )}
      {readFailed && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-muted-foreground text-xs">
            The saved strategy analysis could not be loaded: {errorMessage(query.error)}
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}>
            Retry loading
          </Button>
        </div>
      )}
      {analyze.isPending && (
        <p role="status" className="text-muted-foreground text-xs">
          {pendingText}
        </p>
      )}
      {!analyze.isPending && analyze.isError && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {errorMessage(analyze.error)}
        </p>
      )}

      {report && <StrategySummary report={report} />}
    </section>
  )
}
