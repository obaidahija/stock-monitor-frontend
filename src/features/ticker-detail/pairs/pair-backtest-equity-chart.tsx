import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { formatDate } from '@/lib/format'
import type { PairBacktestOut, PairEquityPointOut } from '@/types/pair-backtest'
import { formatBacktestMoney, formatBacktestPercent } from './pair-backtest-format'
import { niceAxis } from './pair-scatter-geometry'

const DASH = '—'

const chartConfig: ChartConfig = {
  // The foreground colour flips with the theme, so the curve keeps its contrast in both.
  equity: { label: 'Illustrative equity', color: 'var(--foreground)' },
}

function formatShortDate(value: string) {
  // A plain calendar date: parsed as local components so it never shifts a day.
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * A padded vertical axis around the saved equity and the starting capital. Zero is
 * included only when equity actually fell below it, so a normal curve is not
 * flattened against an empty axis, and a flat curve still gets a visible range.
 */
function equityAxis(points: readonly PairEquityPointOut[], initial: number) {
  const values = [initial, ...points.map((point) => point.equity)]
  let low = Math.min(...values)
  let high = Math.max(...values)
  if (low < 0) high = Math.max(high, 0)
  const span = high - low
  const pad = span > 1e-9 ? span * 0.08 : Math.max(1, Math.abs(high) * 0.01)
  low -= pad
  high += pad
  return niceAxis([low, high])
}

export function EquityTooltipContent({
  active,
  payload,
}: {
  active?: boolean
  payload?: readonly { payload?: unknown }[]
}) {
  const point = payload?.[0]?.payload as PairEquityPointOut | undefined
  if (!active || !point) return null
  return (
    <div className="border-border bg-background grid gap-0.5 rounded-md border px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium">{formatDate(point.date)}</p>
      <p>Equity: {formatBacktestMoney(point.equity)}</p>
      <p>Realized net P&amp;L: {formatBacktestMoney(point.realized_net_pnl, { signed: true })}</p>
      <p>Unrealized net P&amp;L: {formatBacktestMoney(point.unrealized_net_pnl, { signed: true })}</p>
      <p>Drawdown: {formatBacktestPercent(point.drawdown)}</p>
    </div>
  )
}

/**
 * The saved daily equity of one backtest's long/short simulation: every evaluated
 * close, exactly as saved. It never fetches prices or recalculates anything.
 */
export function PairBacktestEquityChart({ report }: { report: PairBacktestOut }) {
  const { calculation, parameters } = report
  const target = report.ticker
  const candidate = report.candidate_ticker
  const points = calculation.equity_curve
  if (calculation.status !== 'completed' || points.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No equity curve: the price history does not cover the backtest period.
      </p>
    )
  }

  const initial = parameters.initial_capital
  const axis = equityAxis(points, initial)
  const wentNegative = points.some((point) => point.equity < 0)

  return (
    <figure
      aria-label={`Illustrative equity of the ${target}/${candidate} pair simulation`}
      className="space-y-2"
    >
      <figcaption className="text-muted-foreground space-y-0.5 text-xs">
        <p>
          Marked at each of the {points.length} evaluated closes,{' '}
          <time dateTime={points[0].date}>{formatDate(points[0].date)}</time> –{' '}
          <time dateTime={points[points.length - 1].date}>
            {formatDate(points[points.length - 1].date)}
          </time>
          , from {formatBacktestMoney(initial)} of illustrative capital (dashed line). Includes the
          open trade&apos;s unrealized P&amp;L and every fee and borrow cost already incurred.
        </p>
        {wentNegative && (
          <p>Equity went below zero; once insolvent, the simulation enters no new trades.</p>
        )}
      </figcaption>
      <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={formatShortDate} minTickGap={24} />
          <YAxis
            domain={axis.domain}
            ticks={axis.ticks}
            width={72}
            tickFormatter={(value: number) => formatBacktestMoney(value)}
          />
          <ReferenceLine
            y={initial}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            strokeOpacity={0.8}
          />
          {axis.domain[0] < 0 && <ReferenceLine y={0} stroke="var(--muted-foreground)" />}
          <ChartTooltip content={<EquityTooltipContent />} />
          <Line
            dataKey="equity"
            name="Illustrative equity"
            stroke="var(--color-equity)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
      <div
        role="region"
        aria-label="Daily equity values"
        tabIndex={0}
        className="focus-visible:ring-ring max-h-64 overflow-auto rounded-md focus-visible:ring-2 focus-visible:outline-none"
      >
        <table
          aria-label={`Daily illustrative equity of ${target} against ${candidate}`}
          className="w-full text-xs tabular-nums"
        >
          <thead>
            <tr className="text-muted-foreground text-left">
              <th scope="col" className="py-1 pr-3 font-medium">
                Date
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                Equity
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                Realized net P&amp;L
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                Unrealized net P&amp;L
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                Drawdown
              </th>
              <th scope="col" className="py-1 font-medium">
                Open trade
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.date} className="border-border border-t">
                <td className="py-1 pr-3">{formatDate(point.date)}</td>
                <td className="py-1 pr-3">{formatBacktestMoney(point.equity)}</td>
                <td className="py-1 pr-3">
                  {formatBacktestMoney(point.realized_net_pnl, { signed: true })}
                </td>
                <td className="py-1 pr-3">
                  {formatBacktestMoney(point.unrealized_net_pnl, { signed: true })}
                </td>
                <td className="py-1 pr-3">{formatBacktestPercent(point.drawdown)}</td>
                <td className="py-1">{point.open_trade_id ?? DASH}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
