import { CalendarClock, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { formatCompactCurrency, formatDate, formatSignedPct } from '@/lib/format'
import {
  classifyEarnings,
  EARNINGS_RESULT_BADGE_CLASSES,
  EARNINGS_RESULT_DOT_CLASSES,
  EARNINGS_RESULT_LABEL,
} from '@/lib/earnings-colors'
import { cn } from '@/lib/utils'
import { EpsTrendChart } from './eps-trend-chart'
import { useEarnings, useRefreshEarnings } from './hooks'
import type { EarningsEventOut, EarningsResult } from '@/types/api'

function toneClass(pct: number | null): string {
  if (pct === null || pct === 0) return 'text-muted-foreground'
  return pct > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
}

function revenueSurprisePct(actual: number | null, estimate: number | null): number | null {
  if (actual === null || estimate === null || estimate === 0) return null
  return ((actual - estimate) / Math.abs(estimate)) * 100
}

// A quarter's actual lands exactly on a calendar day boundary, so a plain
// day-count diff (no time-of-day component) reads right even when "today" is
// mid-session.
function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function countdownLabel(dateStr: string): { label: string; urgent: boolean } {
  const days = daysUntil(dateStr)
  if (days <= 0) return { label: 'Today', urgent: true }
  if (days === 1) return { label: 'Tomorrow', urgent: true }
  return { label: `In ${days} days`, urgent: days <= 3 }
}

function ResultBadge({
  result,
  surprisePct,
}: {
  result: EarningsResult
  surprisePct: number | null
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        EARNINGS_RESULT_BADGE_CLASSES[result],
      )}
    >
      {result === 'beat' && <TrendingUp className="size-3" />}
      {result === 'miss' && <TrendingDown className="size-3" />}
      {EARNINGS_RESULT_LABEL[result]}
      {surprisePct !== null && ` ${formatSignedPct(surprisePct, 1)}`}
    </span>
  )
}

// Diverging bar centered on zero, capped at SURPRISE_CAP_PCT magnitude so one
// outlier quarter doesn't flatten every other bar's scale.
const SURPRISE_CAP_PCT = 20

function SurpriseBar({ pct, result }: { pct: number; result: EarningsResult | null }) {
  const magnitudePct = Math.min(100, (Math.abs(pct) / SURPRISE_CAP_PCT) * 100)
  const barClass =
    result === 'beat' ? 'bg-emerald-500' : result === 'miss' ? 'bg-red-500' : 'bg-muted-foreground/40'
  return (
    <div className="bg-muted relative h-1.5 w-full overflow-hidden rounded-full">
      <div className="bg-border absolute inset-y-0 left-1/2 w-px" />
      <div
        className={cn('absolute inset-y-0 rounded-full', barClass)}
        style={
          pct >= 0
            ? { left: '50%', width: `${magnitudePct / 2}%` }
            : { right: '50%', width: `${magnitudePct / 2}%` }
        }
      />
    </div>
  )
}

type TrackRecord = {
  quarters: { event: EarningsEventOut; result: EarningsResult; surprisePct: number | null }[]
  beats: number
  beatRatePct: number
  avgSurprisePct: number
  streak: number
}

function computeTrackRecord(history: EarningsEventOut[]): TrackRecord | null {
  const quarters = history
    .map((event) => ({ event, ...classifyEarnings(event.eps_actual, event.eps_estimate) }))
    .filter((q): q is typeof q & { result: EarningsResult } => q.result !== null)
  if (quarters.length === 0) return null

  const beats = quarters.filter((q) => q.result === 'beat').length
  const surprises = quarters.map((q) => q.surprisePct).filter((p): p is number => p !== null)
  const avgSurprisePct = surprises.length
    ? surprises.reduce((sum, p) => sum + p, 0) / surprises.length
    : 0

  let streak = 0
  for (const q of quarters) {
    if (q.result !== 'beat') break
    streak += 1
  }

  return { quarters, beats, beatRatePct: (beats / quarters.length) * 100, avgSurprisePct, streak }
}

function TrackRecordSummary({ trackRecord }: { trackRecord: TrackRecord }) {
  return (
    <div className="border-border space-y-2 border-t pt-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span>
          Beat rate <span className="font-semibold">{trackRecord.beatRatePct.toFixed(0)}%</span>{' '}
          <span className="text-muted-foreground text-xs">
            ({trackRecord.beats}/{trackRecord.quarters.length})
          </span>
        </span>
        <span>
          Avg surprise{' '}
          <span className={cn('font-semibold', toneClass(trackRecord.avgSurprisePct))}>
            {formatSignedPct(trackRecord.avgSurprisePct, 1)}
          </span>
        </span>
        {trackRecord.streak > 0 && (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="size-3.5" />
            {trackRecord.streak} beat{trackRecord.streak > 1 ? 's' : ''} in a row
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {[...trackRecord.quarters].reverse().map((q) => (
          <span
            key={q.event.id}
            title={`${formatDate(q.event.event_date)}: ${EARNINGS_RESULT_LABEL[q.result]}${
              q.surprisePct !== null ? ` (${formatSignedPct(q.surprisePct, 1)})` : ''
            }`}
            className={cn('inline-block size-2.5 rounded-full', EARNINGS_RESULT_DOT_CLASSES[q.result])}
          />
        ))}
        <span className="text-muted-foreground text-xs">last {trackRecord.quarters.length} quarters</span>
      </div>
    </div>
  )
}

function NextEarningsCard({
  next,
  trackRecord,
}: {
  next: EarningsEventOut
  trackRecord: TrackRecord | null
}) {
  const countdown = countdownLabel(next.event_date)
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="text-muted-foreground size-4" />
          Next earnings
        </CardTitle>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold',
            countdown.urgent
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {countdown.label}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span className="font-medium">{formatDate(next.event_date)}</span>
          <span className="text-muted-foreground uppercase">{next.bmo_amc}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="border-border rounded-lg border px-3 py-2">
            <p className="text-muted-foreground text-xs">EPS estimate</p>
            <p className="text-sm font-medium">{next.eps_estimate ?? '—'}</p>
          </div>
          <div className="border-border rounded-lg border px-3 py-2">
            <p className="text-muted-foreground text-xs">Revenue estimate</p>
            <p className="text-sm font-medium">{formatCompactCurrency(next.revenue_estimate)}</p>
          </div>
        </div>
        {trackRecord && <TrackRecordSummary trackRecord={trackRecord} />}
      </CardContent>
    </Card>
  )
}

function HistoryQuarterCard({ event }: { event: EarningsEventOut }) {
  const { result, surprisePct } = classifyEarnings(event.eps_actual, event.eps_estimate)
  const revSurprisePct = revenueSurprisePct(event.revenue_actual, event.revenue_estimate)
  const hasRevenue = event.revenue_estimate !== null || event.revenue_actual !== null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-sm font-medium">
          {formatDate(event.event_date)}
          <span className="text-muted-foreground ml-2 text-xs font-normal uppercase">
            {event.bmo_amc}
          </span>
        </CardTitle>
        {result && <ResultBadge result={result} surprisePct={surprisePct} />}
      </CardHeader>
      <CardContent className="space-y-3">
        {surprisePct !== null && <SurpriseBar pct={surprisePct} result={result} />}
        <div className="grid grid-cols-2 gap-3">
          <div className="border-border rounded-lg border px-3 py-2">
            <p className="text-muted-foreground text-xs">EPS est. / actual</p>
            <p className="text-sm font-medium">
              {event.eps_estimate ?? '—'} / {event.eps_actual ?? '—'}
            </p>
          </div>
          {hasRevenue && (
            <div className="border-border rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-xs">Revenue est. / actual</p>
              <p className="text-sm font-medium">
                {formatCompactCurrency(event.revenue_estimate)} / {formatCompactCurrency(event.revenue_actual)}
              </p>
              {revSurprisePct !== null && (
                <p className={cn('text-xs', toneClass(revSurprisePct))}>
                  {formatSignedPct(revSurprisePct, 1)} vs. estimate
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function EarningsTab({ ticker }: { ticker: string }) {
  const { data, isPending, isError, error, refetch } = useEarnings(ticker)
  const refreshEarnings = useRefreshEarnings(ticker)

  function runRefresh() {
    refreshEarnings.mutate(undefined, {
      onSuccess: (result) => {
        if (result.error) {
          toast.error(`Failed to refresh earnings for ${result.ticker}: ${result.error}`)
        } else {
          toast.success(
            `Refreshed earnings for ${result.ticker}: ${result.new} new, ${result.updated} updated`,
          )
        }
      },
      onError: () => toast.error(`Failed to refresh earnings for ${ticker}`),
    })
  }

  const refreshButton = (
    <Button size="sm" variant="outline" disabled={refreshEarnings.isPending} onClick={runRefresh}>
      <RefreshCw className={cn(refreshEarnings.isPending && 'animate-spin')} />
      Refresh
    </Button>
  )

  if (isPending) return <Skeleton className="h-72 rounded-xl" />
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!data) return null

  const trackRecord = computeTrackRecord(data.history)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">{refreshButton}</div>

      {data.next ? (
        <NextEarningsCard next={data.next} trackRecord={trackRecord} />
      ) : (
        <EmptyState
          title="No upcoming earnings date known"
          description="This may be an ETF or a ticker outside the tracked universe — try refreshing to check Finnhub directly."
          action={refreshButton}
        />
      )}

      {data.history.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Recent quarters
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.history.map((event) => (
              <HistoryQuarterCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState title="No earnings history available" />
      )}

      <EpsTrendChart events={data.yfinance_snapshot} />
    </div>
  )
}
