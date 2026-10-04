import { History, RefreshCw } from 'lucide-react'
import { pairTicker } from '@/api/stock-pairs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ApiError } from '@/lib/api-client'
import { formatDate } from '@/lib/format'
import type { PairBacktestOut } from '@/types/pair-backtest'
import { usePairBacktest, useRunPairBacktest } from './pair-backtest-hooks'
import { PairBacktestReport } from './pair-backtest-report'

/** What the replay found, as a count: never a success or failure verdict. */
function backtestStatus(report: PairBacktestOut): string {
  const { calculation } = report
  if (calculation.status === 'insufficient_data') return 'Insufficient history'
  const count = calculation.events.length
  if (count === 0) return 'No qualifying historical signals'
  return `${count} historical signal${count === 1 ? '' : 's'}`
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
  return error instanceof Error ? error.message : 'The backtest failed. Please try again.'
}

function BacktestSummary({ report }: { report: PairBacktestOut }) {
  const { calculation, parameters } = report
  return (
    <div className="space-y-2">
      <Badge variant="secondary">{backtestStatus(report)}</Badge>
      <div className="text-muted-foreground space-y-0.5 text-xs">
        <p>
          Backtested: <time dateTime={report.generated_at}>{formatTimestamp(report.generated_at)}</time>
        </p>
        <p>
          Evaluated:{' '}
          <time dateTime={calculation.evaluation_start}>{formatDate(calculation.evaluation_start)}</time>{' '}
          – <time dateTime={calculation.evaluation_end}>{formatDate(calculation.evaluation_end)}</time> ·{' '}
          {parameters.evaluation_sessions} sessions, after {parameters.warmup_sessions} warmup sessions
        </p>
        <p>
          Prices through: <time dateTime={report.data_through}>{formatDate(report.data_through)}</time>{' '}
          (adjusted daily closes)
        </p>
      </div>
      <p className="text-muted-foreground text-xs">{report.caveat}</p>
      {/* Keyed by run, so a refresh replaces the whole report and its open details. */}
      <PairBacktestReport key={report.run_id} report={report} />
    </div>
  )
}

export function PairBacktestPanel({
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
  const query = usePairBacktest(target, candidate, !disabled)
  const run = useRunPairBacktest(target, candidate)
  // Only this ordered pair's backtest is ever shown here.
  const report =
    query.data && query.data.ticker === target && query.data.candidate_ticker === candidate
      ? query.data
      : null
  const readFailed = query.isError && report === null
  const loading = query.isLoading && !disabled
  const pendingText = report ? 'Refreshing backtest…' : 'Running backtest…'

  return (
    <section
      aria-label={`Historical backtest: ${target} against ${candidate}`}
      className="border-border space-y-3 rounded-md border border-dashed p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Historical performance with assumed costs</p>
          <p className="text-muted-foreground text-xs">
            Replays the strategy check over the past year: how {target} moved after each past
            signal, and how a long/short pair trade would have fared. Independent of today&apos;s
            analysis. Manual and saved until you refresh it.
          </p>
        </div>
        {!readFailed && !loading && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || run.isPending}
            onClick={() => run.mutate(report !== null)}
          >
            {run.isPending ? <Spinner aria-hidden /> : report ? <RefreshCw /> : <History />}
            {run.isPending ? pendingText : report ? 'Refresh backtest' : 'Backtest pair'}
          </Button>
        )}
      </div>

      {disabled && (
        <p className="text-muted-foreground text-xs">Backtest unavailable: {disabledReason}</p>
      )}
      {loading && <p className="text-muted-foreground text-xs">Loading saved backtest…</p>}
      {readFailed && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-muted-foreground text-xs">
            The saved backtest could not be loaded: {errorMessage(query.error)}
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}>
            Retry loading
          </Button>
        </div>
      )}
      {run.isPending && (
        <p role="status" className="text-muted-foreground text-xs">
          {pendingText}
        </p>
      )}
      {!run.isPending && run.isError && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {errorMessage(run.error)}
        </p>
      )}

      {report && <BacktestSummary report={report} />}
    </section>
  )
}
