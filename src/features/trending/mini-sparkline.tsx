import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'
import type { TrendingSparklinePointOut } from '@/types/api'

// Twitter (unique authors) and Reddit (mention count) are different units,
// so each series is normalized to its own max within this ticker's window
// before plotting -- this shows each platform's day-to-day attention shape,
// not a (misleading) direct magnitude comparison between the two.
function normalize(values: (number | null)[]): (number | null)[] {
  const max = Math.max(1, ...values.filter((value): value is number => value !== null))
  return values.map((value) => (value === null ? null : (value / max) * 100))
}

interface MiniSparklineProps {
  points: TrendingSparklinePointOut[]
  className?: string
}

export function MiniSparkline({ points, className }: MiniSparklineProps) {
  if (points.length < 2) {
    return <span className={cn('text-muted-foreground text-xs', className)}>—</span>
  }

  const twitter = normalize(points.map((point) => point.twitter_unique_authors))
  const reddit = normalize(points.map((point) => point.reddit_mention_count))
  const data = points.map((point, index) => ({
    date: point.date,
    twitter: twitter[index],
    reddit: reddit[index],
  }))

  return (
    <div className={cn('h-8 w-24', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Area
            type="monotone"
            dataKey="twitter"
            stroke="var(--trending-twitter)"
            fill="var(--trending-twitter)"
            fillOpacity={0.12}
            strokeWidth={1.5}
            connectNulls
            dot={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="reddit"
            stroke="var(--trending-reddit)"
            fill="var(--trending-reddit)"
            fillOpacity={0.12}
            strokeWidth={1.5}
            connectNulls
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
