import { Cell, Pie, PieChart } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { useTrendingSummary } from './hooks'

const chartConfig: ChartConfig = {
  bullish: { label: 'Bullish', color: '#10b981' },
  neutral: { label: 'Neutral', color: 'var(--chart-2)' },
  bearish: { label: 'Bearish', color: '#ef4444' },
}

export function TrendingSentimentGauge() {
  const query = useTrendingSummary()

  if (query.isPending) return <Skeleton className="h-40" aria-label="Loading crowd sentiment" />
  if (query.isError || !query.data) return null

  const { bullish_count, neutral_count, bearish_count } = query.data.sentiment_overview
  const total = bullish_count + neutral_count + bearish_count
  const data = [
    { key: 'bullish' as const, value: bullish_count },
    { key: 'neutral' as const, value: neutral_count },
    { key: 'bearish' as const, value: bearish_count },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Crowd sentiment</CardTitle>
        <CardDescription>Across today&apos;s trending tickers</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-muted-foreground text-sm">No sentiment data yet.</p>
        ) : (
          <div className="flex items-center gap-4">
            <ChartContainer config={chartConfig} className="mx-auto aspect-square h-32">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie data={data} dataKey="value" nameKey="key" innerRadius={28} outerRadius={48}>
                  {data.map((entry) => (
                    <Cell key={entry.key} fill={`var(--color-${entry.key})`} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="space-y-1 text-xs">
              {data.map((entry) => (
                <li key={entry.key} className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: `var(--color-${entry.key})` }}
                  />
                  <span className="capitalize">{entry.key}</span>: {entry.value} (
                  {Math.round((entry.value / total) * 100)}%)
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
