import { CartesianGrid, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { formatDate } from '@/lib/format'
import type { StockPairItemOut } from '@/types/api'
import type { PairWindow } from './pair-metrics'
import { fittedLine, niceAxis, paddedDomain } from './pair-scatter-geometry'

const WINDOW_NAMES: Record<PairWindow, string> = {
  three_month: '3-month',
  six_month: '6-month',
}
// The fewest aligned returns each window's correlation needs to be compared.
const MIN_RETURNS: Record<PairWindow, number> = { three_month: 40, six_month: 100 }

const chartConfig: ChartConfig = {
  // The foreground colour flips with the theme, so dots keep their contrast in both.
  points: { label: 'Daily returns', color: 'var(--foreground)' },
  fit: { label: 'Fitted line', color: '#3b82f6' },
}

/** One observation in display units: percentage returns. */
interface PlotPoint {
  date: string
  x: number
  y: number
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`
}

export function ScatterTooltipContent({
  active,
  payload,
  targetTicker,
  candidateTicker,
}: {
  active?: boolean
  payload?: readonly { payload?: unknown }[]
  targetTicker: string
  candidateTicker: string
}) {
  const point = payload?.[0]?.payload as PlotPoint | undefined
  if (!active || !point) return null
  return (
    <div className="border-border bg-background grid gap-0.5 rounded-md border px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium">{formatDate(point.date)}</p>
      <p>
        {targetTicker}: {formatPercent(point.x)}
      </p>
      <p>
        {candidateTicker}: {formatPercent(point.y)}
      </p>
    </div>
  )
}

function fitDescription(candidate: string, target: string, intercept: number, slope: number) {
  const sign = slope < 0 ? '−' : '+'
  return `${candidate} ≈ ${formatPercent(100 * intercept)} ${sign} ${Math.abs(slope).toFixed(2)} × ${target}`
}

/**
 * The selected window's exact daily-return observations -- the ones its
 * correlation was computed from -- with a descriptive least-squares line.
 * Consumes saved report data only; never fetches prices.
 */
export function PairScatterPlot({
  targetTicker,
  item,
  window,
}: {
  targetTicker: string
  item: StockPairItemOut
  window: PairWindow
}) {
  const measured = item[window]
  const name = WINDOW_NAMES[window]
  if (!measured) {
    return <p className="text-muted-foreground text-sm">No {name} measurement to plot.</p>
  }
  const scatter = measured.scatter
  if (!scatter) {
    return (
      <p className="text-muted-foreground text-sm">
        No plot was saved for this window; refresh to create one.
      </p>
    )
  }
  if (scatter.status === 'unavailable' || scatter.points.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Plot unavailable: {scatter.reason ?? 'no observations were saved.'}
      </p>
    )
  }

  const points: PlotPoint[] = scatter.points.map((point) => ({
    date: point.date,
    x: 100 * point.target_return,
    y: 100 * point.candidate_return,
  }))
  const xAxis = niceAxis(paddedDomain(points.map((point) => point.x)))
  const line = fittedLine(scatter, xAxis.domain)
  const yAxis = niceAxis(
    paddedDomain([...points.map((point) => point.y), ...(line ? [line[0].y, line[1].y] : [])]),
  )
  const count = scatter.points.length
  const insufficient = measured.sample_size < MIN_RETURNS[window]
  const correlation =
    measured.correlation === null ? 'undefined' : measured.correlation.toFixed(2)

  return (
    <figure
      aria-label={`${name} daily returns of ${item.ticker} against ${targetTicker}`}
      className="space-y-2"
    >
      <figcaption className="text-muted-foreground space-y-0.5 text-xs">
        <p>
          {name} window: {count} daily returns, {formatDate(measured.start_date)} –{' '}
          {formatDate(measured.end_date)}; correlation {correlation}.
        </p>
        {insufficient && (
          <p>
            Insufficient data: at least {MIN_RETURNS[window]} daily returns are needed for a {name}{' '}
            correlation.
          </p>
        )}
        {measured.correlation === null && <p>Correlation undefined: the returns did not vary.</p>}
        {scatter.intercept !== null && scatter.slope !== null ? (
          <p>
            Dashed line: descriptive least-squares fit,{' '}
            {fitDescription(item.ticker, targetTicker, scatter.intercept, scatter.slope)} (percent
            returns). It summarizes the past and is not a forecast.
          </p>
        ) : (
          <p>No fitted line: {scatter.reason ?? 'there are too few varying observations.'}</p>
        )}
        <p>One dot per trading day; every observation is shown, including outliers.</p>
      </figcaption>
      <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 24, left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name={targetTicker}
            domain={xAxis.domain}
            ticks={xAxis.ticks}
            tickFormatter={(value: number) => String(Number(value.toFixed(2)))}
            label={{
              value: `${targetTicker} daily return (%)`,
              position: 'insideBottom',
              offset: -16,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={item.ticker}
            domain={yAxis.domain}
            ticks={yAxis.ticks}
            tickFormatter={(value: number) => String(Number(value.toFixed(2)))}
            label={{ value: `${item.ticker} daily return (%)`, angle: -90, position: 'insideLeft' }}
          />
          <ReferenceLine x={0} stroke="var(--muted-foreground)" strokeOpacity={0.7} />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.7} />
          <ChartTooltip
            cursor={false}
            content={
              <ScatterTooltipContent targetTicker={targetTicker} candidateTicker={item.ticker} />
            }
          />
          <Scatter
            data={points}
            fill="var(--color-points)"
            fillOpacity={0.45}
            isAnimationActive={false}
          />
          {line && (
            <ReferenceLine
              segment={[line[0], line[1]]}
              stroke="var(--color-fit)"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          )}
        </ScatterChart>
      </ChartContainer>
      <details className="text-xs">
        <summary className="cursor-pointer font-medium">
          Show the {count} daily returns as a table
        </summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table
            aria-label={`Daily returns of ${targetTicker} and ${item.ticker}`}
            className="w-full tabular-nums"
          >
            <thead>
              <tr className="text-muted-foreground text-left">
                <th scope="col" className="py-1 pr-3 font-medium">
                  Date
                </th>
                <th scope="col" className="py-1 pr-3 font-medium">
                  {targetTicker}
                </th>
                <th scope="col" className="py-1 font-medium">
                  {item.ticker}
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date} className="border-border border-t">
                  <td className="py-1 pr-3">{formatDate(point.date)}</td>
                  <td className="py-1 pr-3">{formatPercent(point.x)}</td>
                  <td className="py-1">{formatPercent(point.y)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
