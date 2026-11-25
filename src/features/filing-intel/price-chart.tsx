import { useState } from 'react'
import { Area, ComposedChart, ReferenceArea, ReferenceDot, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEasternDateTime, formatEasternTime } from '@/lib/format'
import type { FilingIntelFilingOut, PricePoint, QuoteOut } from '@/types/filing-intel'
import { useFilingChart } from './hooks'
import {
  entryPrice,
  extendedHours,
  filingIndex,
  nearestIndex,
  priceSteps,
  type FilingPriceOverride,
} from './price-chart-model'
import { changeClass, MARKER_COLOR, PriceSteps, signed } from './price-steps'

const chartConfig: ChartConfig = { price: { label: 'Price', color: 'var(--foreground)' } }

/**
 * A filing not caught live has no detection quote: its entry is the last 5-minute trade before
 * acceptance, when the bars reach back that far.
 */
function lastTradeBefore(
  points: PricePoint[],
  filing: FilingIntelFilingOut,
  interval: '5m' | '1d' | undefined,
): FilingPriceOverride | undefined {
  if (filing.entry_price != null || filing.pre_filing_price != null || filing.detected_price != null || interval !== '5m') {
    return undefined
  }
  const filed = filingIndex(points, filing.accepted_at)
  if (filed === null || filed === 0) return undefined
  const before = points[filed - 1]
  return { price: before.price, time: before.t, hint: 'Your entry: the last 5-minute trade before the filing (it was not caught live)' }
}

function tickLabel(points: PricePoint[], index: number, interval: '5m' | '1d'): string {
  const point = points[index]
  if (!point) return ''
  const date = new Date(point.t).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })
  return interval === '1d' ? date : `${date} ${formatEasternTime(point.t)}`
}

/** Ticks at each new trading day (5-minute bars) or about six evenly spread (daily). */
function ticks(points: PricePoint[], interval: '5m' | '1d'): number[] {
  if (interval === '1d') {
    const step = Math.max(1, Math.round(points.length / 6))
    return points.map((_, i) => i).filter((i) => i % step === 0)
  }
  const day = (p: PricePoint) => new Date(p.t).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
  return points.map((p, i) => (i === 0 || day(p) !== day(points[i - 1]) ? i : -1)).filter((i) => i >= 0)
}

function ChartTooltip({ active, payload, base }: { active?: boolean; payload?: readonly { payload?: unknown }[]; base: number | null }) {
  const point = payload?.[0]?.payload as (PricePoint & { i: number }) | undefined
  if (!active || !point) return null
  const change = base ? (point.price / base - 1) * 100 : null
  return (
    <div className="border-border bg-background rounded-md border px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium">{formatEasternDateTime(point.t)}</p>
      <p className="tabular-nums">
        ${point.price.toFixed(2)} <span className={changeClass(change)}>{signed(change)}</span>
      </p>
      {point.session !== 'regular' && <p className="text-muted-foreground">{point.session === 'pre' ? 'Pre-market' : 'After-hours'}</p>}
    </div>
  )
}

/**
 * The stock around a filing: the price line (5-minute bars with pre/after-market for recent
 * filings, daily closes otherwise), a line where the filing went public, the stretch after it
 * tinted by the move, and dots for the five steps above.
 */
export function FilingPriceChart({ filing, now }: { filing: FilingIntelFilingOut; now: QuoteOut | undefined }) {
  const [interval, setInterval] = useState<'auto' | '5m' | '1d'>('auto')
  const query = useFilingChart(filing.ticker ? filing.accession : null, interval)
  const points = query.data?.points ?? []
  const override = lastTradeBefore(points, filing, query.data?.interval)
  const steps = priceSteps(filing, now, override)
  const base = override?.price ?? entryPrice(filing)
  const shown = query.data?.interval ?? (interval === 'auto' ? null : interval)
  const data = points.map((p, i) => ({ ...p, i }))
  const filed = filingIndex(points, filing.accepted_at)
  const last = points.at(-1)?.price ?? null
  const afterMove = base && last ? last / base - 1 : 0
  const prices = points.map((p) => p.price).concat(steps.flatMap((s) => (s.price ? [s.price] : [])))
  const [low, high] = prices.length ? [Math.min(...prices), Math.max(...prices)] : [0, 1]
  const pad = (high - low) * 0.08 || high * 0.02

  return (
    <section className="space-y-3" aria-label="Price around the filing">
      <PriceSteps steps={steps} />
      {base !== null && (
        <p className="text-muted-foreground text-xs">
          Moves after the filing are measured from the price at filing (${base.toFixed(2)}): what you would have
          if you had acted on it.
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {shown === '5m' ? '5-minute bars, pre-market and after-hours shaded' : shown === '1d' ? 'Daily closes' : ''}
        </span>
        <div className="flex gap-1" role="group" aria-label="Chart interval">
          {(['5m', '1d'] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={shown === value ? 'default' : 'outline'}
              className="h-7 px-2 text-xs"
              aria-pressed={shown === value}
              onClick={() => setInterval(value)}
            >
              {value === '5m' ? 'Intraday' : 'Daily'}
            </Button>
          ))}
        </div>
      </div>
      {query.isPending && <Skeleton className="h-56 w-full" />}
      {query.isError && <p className="text-muted-foreground text-sm">The price history could not be loaded right now.</p>}
      {query.isSuccess && points.length < 2 && <p className="text-muted-foreground text-sm">No price history for this period.</p>}
      {query.isSuccess && points.length >= 2 && shown && (
        <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
          <ComposedChart data={data} margin={{ top: 18, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="filing-price-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.12} />
                <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
              </linearGradient>
            </defs>
            {shown === '5m' &&
              extendedHours(points).map((run) => (
                <ReferenceArea key={run.from} x1={run.from} x2={run.to} fill="var(--muted-foreground)" fillOpacity={0.07} strokeOpacity={0} />
              ))}
            {filed !== null && (
              <ReferenceArea
                x1={filed}
                x2={points.length - 1}
                fill={afterMove >= 0 ? '#10b981' : '#ef4444'}
                fillOpacity={0.06}
                strokeOpacity={0}
              />
            )}
            <XAxis
              dataKey="i"
              type="number"
              domain={[0, points.length - 1]}
              ticks={ticks(points, shown)}
              tickFormatter={(i: number) => tickLabel(points, i, shown).split(' ').slice(0, 2).join(' ')}
              tickLine={false}
              axisLine={false}
              fontSize={11}
            />
            <YAxis
              domain={[low - pad, high + pad]}
              tickFormatter={(v: number) => `$${v.toFixed(v >= 100 ? 0 : 2)}`}
              width={52}
              tickLine={false}
              axisLine={false}
              fontSize={11}
            />
            <Tooltip content={<ChartTooltip base={base} />} />
            {base !== null && <ReferenceLine y={base} stroke="#64748b" strokeDasharray="2 3" strokeOpacity={0.7} />}
            <Area type="linear" dataKey="price" stroke="var(--foreground)" strokeWidth={1.5} fill="url(#filing-price-fill)" isAnimationActive={false} dot={false} />
            {filed !== null && (
              <ReferenceLine
                x={filed}
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                label={{ value: `Filed ${formatEasternTime(filing.accepted_at)}`, position: 'top', fontSize: 11, fill: '#f59e0b' }}
              />
            )}
            {steps.map((step) => {
              const i = step.price !== null ? nearestIndex(points, step.time) : null
              if (i === null || step.price === null) return null
              return (
                <ReferenceDot key={step.key} x={i} y={step.price} r={4.5} fill={MARKER_COLOR[step.key]} stroke="var(--background)" strokeWidth={1.5} />
              )
            })}
          </ComposedChart>
        </ChartContainer>
      )}
    </section>
  )
}
