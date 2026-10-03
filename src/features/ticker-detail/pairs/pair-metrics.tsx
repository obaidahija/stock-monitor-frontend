import { formatDate } from '@/lib/format'
import type { StockPairItemOut, StockPairMarketCheckOut } from '@/types/api'

export type PairWindow = 'three_month' | 'six_month'

const WINDOW_NAMES: Record<PairWindow, string> = {
  three_month: '3-month',
  six_month: '6-month',
}
const DASH = '—'

// A correlation is a coefficient, never a percentage.
function formatCorrelation(value: number | null) {
  return value === null ? DASH : value.toFixed(2)
}

// A historical frequency, not a forecast probability.
function formatHistoricalPct(value: number | null) {
  return value === null ? DASH : `${Math.round(value)}%`
}

function formatPoints(value: number | null) {
  if (value === null) return DASH
  const magnitude = Math.abs(value).toFixed(1).replace(/\.0$/, '')
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${magnitude} percentage points`
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium tabular-nums">
        {value}
        {detail && <span className="text-muted-foreground ml-1 text-xs font-normal">({detail})</span>}
      </dd>
    </div>
  )
}

function MarketCheck({ check }: { check: StockPairMarketCheckOut }) {
  const value =
    check.status === 'available'
      ? formatCorrelation(check.correlation)
      : `${check.status === 'undefined' ? 'Undefined' : 'Unavailable'}: ${check.reason ?? 'no reason given.'}`
  return (
    <div className="sm:col-span-2">
      <dt className="text-muted-foreground text-xs">
        Correlation after removing SPY&apos;s market movement
      </dt>
      <dd className="font-medium tabular-nums">
        {value}
        {check.status === 'available' && (
          <span className="text-muted-foreground ml-1 text-xs font-normal">
            ({check.sample_size} daily returns with SPY)
          </span>
        )}
      </dd>
    </div>
  )
}

export function PairMetrics({ item, window }: { item: StockPairItemOut; window: PairWindow }) {
  const measured = item[window]
  if (!measured) {
    return (
      <p className="text-muted-foreground text-sm">
        No {WINDOW_NAMES[window]} measurement for {item.ticker}.
      </p>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">
        {measured.sample_size} daily returns · {formatDate(measured.start_date)} –{' '}
        {formatDate(measured.end_date)}
      </p>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Metric label="Correlation of daily returns" value={formatCorrelation(measured.correlation)} />
        <Metric
          label="Rose on days the selected stock rose"
          value={formatHistoricalPct(measured.up_day_agreement_pct)}
          detail={`${measured.both_up_days} of ${measured.target_up_days} up days`}
        />
        <Metric
          label={`${item.ticker}'s usual up-day rate`}
          value={formatHistoricalPct(measured.baseline_up_day_pct)}
          detail={`${measured.candidate_up_days} of ${measured.sample_size} days`}
        />
        <Metric
          label="Difference from its usual rate"
          value={formatPoints(measured.up_day_improvement_pp)}
        />
        <MarketCheck check={measured.market_check} />
      </dl>
    </div>
  )
}
