import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useScoreHistory } from './hooks'

const WINDOW_DAYS = 90

export function ScoreHistoryChart({ ticker }: { ticker: string }) {
  const { data, isLoading } = useScoreHistory(ticker, WINDOW_DAYS)
  const points = data ?? []

  // One point is a dot, not a trend -- and history only starts accruing from
  // the first universe_score run after this feature deploys, so every ticker
  // legitimately looks like this at first. Say so rather than drawing an
  // empty axis the reader has to interpret.
  if (isLoading || points.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Score history</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {isLoading
              ? 'Loading score history…'
              : 'Not enough score history yet — a point is recorded each day the universe is scored.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  const latest = points[points.length - 1]
  const change = latest.score - points[0].score
  const changeLabel = `${change >= 0 ? '+' : ''}${change.toFixed(1)}`

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Score history</CardTitle>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tabular-nums">{latest.score}</span>
          <span
            className={
              change >= 0
                ? 'text-sm tabular-nums text-emerald-600 dark:text-emerald-400'
                : 'text-sm tabular-nums text-red-600 dark:text-red-400'
            }
          >
            {changeLabel}
          </span>
        </div>
      </CardHeader>
      <CardContent className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points}>
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              formatter={(value) => [`${value}`, 'Score']}
              labelFormatter={(_label, payload) => payload?.[0]?.payload?.captured_on ?? ''}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="currentColor"
              className="text-primary"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
