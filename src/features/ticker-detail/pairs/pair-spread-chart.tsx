import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { formatDate } from '@/lib/format'
import type { PairStrategyOut } from '@/types/pair-strategy'
import { spreadAxis } from './pair-spread-geometry'
import { formatHedgeRatio, formatZScore } from './pair-strategy-format'

const DASH = '—'

const chartConfig: ChartConfig = {
  // The foreground colour flips with the theme, so the spread keeps its contrast in both.
  spread: { label: 'Spread', color: 'var(--foreground)' },
  mean: { label: 'Mean of the previous spreads', color: '#3b82f6' },
  upper: { label: 'Upper band', color: '#f59e0b' },
  lower: { label: 'Lower band', color: '#f59e0b' },
}

/** One saved observation; a missing baseline stays null, so its lines break instead of dropping to zero. */
interface SpreadDatum {
  date: string
  spread: number
  mean: number | null
  lower: number | null
  upper: number | null
  z: number | null
}

function formatSpread(value: number | null, precision = 2) {
  if (value === null) return DASH
  // Keep tiny nonzero values visible even when they are smaller than an axis step.
  if (value !== 0 && Math.abs(value) < 0.01) return String(Number(value.toPrecision(4)))
  return value.toFixed(precision)
}

function formatShortDate(value: string) {
  // A plain calendar date: parsed as local components so it never shifts a day.
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function SpreadTooltipContent({
  active,
  payload,
  entryZ,
  precision = 2,
}: {
  active?: boolean
  payload?: readonly { payload?: unknown }[]
  entryZ: number
  precision?: number
}) {
  const datum = payload?.[0]?.payload as SpreadDatum | undefined
  if (!active || !datum) return null
  const bands =
    datum.lower === null || datum.upper === null
      ? DASH
      : `${formatSpread(datum.lower, precision)} to ${formatSpread(datum.upper, precision)}`
  return (
    <div className="border-border bg-background grid gap-0.5 rounded-md border px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium">{formatDate(datum.date)}</p>
      <p>Spread: {formatSpread(datum.spread, precision)}</p>
      <p>Mean: {formatSpread(datum.mean, precision)}</p>
      <p>Bands: {bands}</p>
      <p>z-score: {formatZScore(datum.z, entryZ)}</p>
    </div>
  )
}

/**
 * The saved observation-period spread of one ordered pair, with the trailing mean
 * and bands the backend calculated. Drawn from saved points only: it never fetches
 * prices or recalculates a statistic, and it is not a backtest.
 */
export function PairSpreadChart({ report }: { report: PairStrategyOut }) {
  const { calculation, parameters } = report
  const target = report.ticker
  const candidate = report.candidate_ticker
  const { alpha, hedge_ratio: beta, points } = calculation
  if (points.length === 0 || alpha === null || beta === null) {
    const reason =
      calculation.evidence_status === 'insufficient_data'
        ? 'there is not enough shared history to fit the relationship.'
        : 'the spread could not be measured for these prices.'
    return <p className="text-muted-foreground text-sm">No spread chart: {reason}</p>
  }

  const data: SpreadDatum[] = points.map((point) => ({
    date: point.date,
    spread: point.spread,
    mean: point.mean,
    lower: point.lower_band,
    upper: point.upper_band,
    z: point.z_score,
  }))
  const axis = spreadAxis(points)
  const baseline = parameters.baseline_sessions

  return (
    <figure aria-label={`Adjusted-price spread of ${target} against ${candidate}`} className="space-y-2">
      <figcaption className="text-muted-foreground space-y-0.5 text-xs">
        <p className="text-foreground font-mono">
          {`Spread = ${target} − (${alpha.toFixed(2)} + ${formatHedgeRatio(beta)} × ${candidate})`}
        </p>
        <p>
          Hedge ratio fitted on the formation period,{' '}
          <time dateTime={calculation.formation_start}>{formatDate(calculation.formation_start)}</time> –{' '}
          <time dateTime={calculation.formation_end}>{formatDate(calculation.formation_end)}</time>, and
          held fixed.
        </p>
        <p>
          Plotted:{' '}
          <time dateTime={calculation.observation_start}>
            {formatDate(calculation.observation_start)}
          </time>{' '}
          – <time dateTime={calculation.observation_end}>{formatDate(calculation.observation_end)}</time>
          , the {points.length}-session observation period.
        </p>
        <p>
          Solid: spread. Dashed: mean of the previous {baseline} sessions&apos; spreads. Dotted: ±
          {parameters.entry_z} standard deviations of those spreads. One historical fit across one
          period, not a backtest or a series of trade signals.
        </p>
        {calculation.evidence_status !== 'supported' && (
          <p>
            {calculation.evidence_status === 'not_supported'
              ? 'Relationship not supported'
              : 'Analysis unavailable'}
            : the spread is descriptive only.
          </p>
        )}
      </figcaption>
      <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={formatShortDate} minTickGap={16} />
          <YAxis
            domain={axis.domain}
            ticks={axis.ticks}
            tickFormatter={(value: number) => String(Number(formatSpread(value, axis.precision)))}
            label={{ value: 'Adjusted-price spread', angle: -90, position: 'insideLeft' }}
          />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.7} />
          <ChartTooltip content={<SpreadTooltipContent entryZ={parameters.entry_z} precision={axis.precision} />} />
          <Line
            dataKey="upper"
            name="Upper band"
            stroke="var(--color-upper)"
            strokeDasharray="2 4"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="lower"
            name="Lower band"
            stroke="var(--color-lower)"
            strokeDasharray="2 4"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="mean"
            name="Mean"
            stroke="var(--color-mean)"
            strokeDasharray="6 4"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="spread"
            name="Spread"
            stroke="var(--color-spread)"
            strokeWidth={2}
            dot={{ r: 2.5 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
      <p className="text-muted-foreground text-xs">
        Values are in {target}&apos;s adjusted-price units; they describe the past and are not the
        dollar result of any trade.
      </p>
      <div
        role="region"
        aria-label="Daily spread values"
        tabIndex={0}
        className="focus-visible:ring-ring max-h-64 overflow-auto rounded-md focus-visible:ring-2 focus-visible:outline-none"
      >
        <table aria-label={`Daily spread of ${target} against ${candidate}`} className="w-full text-xs tabular-nums">
          <thead>
            <tr className="text-muted-foreground text-left">
              <th scope="col" className="py-1 pr-3 font-medium">
                Date
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                Spread
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                {`Mean (previous ${baseline})`}
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                Lower band
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                Upper band
              </th>
              <th scope="col" className="py-1 font-medium">
                z-score
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((datum) => (
              <tr key={datum.date} className="border-border border-t">
                <td className="py-1 pr-3">{formatDate(datum.date)}</td>
                <td className="py-1 pr-3">{formatSpread(datum.spread, axis.precision)}</td>
                <td className="py-1 pr-3">{formatSpread(datum.mean, axis.precision)}</td>
                <td className="py-1 pr-3">{formatSpread(datum.lower, axis.precision)}</td>
                <td className="py-1 pr-3">{formatSpread(datum.upper, axis.precision)}</td>
                <td className="py-1">{formatZScore(datum.z, parameters.entry_z)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
