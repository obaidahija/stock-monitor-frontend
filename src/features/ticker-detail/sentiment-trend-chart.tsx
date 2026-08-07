import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { cn } from '@/lib/utils'
import { useSentimentHistory } from './hooks'
import type { SentimentBucketGranularity, SentimentBucketOut } from '@/types/api'

const BUCKET_OPTIONS: {
  label: string
  bucket: SentimentBucketGranularity
  periods: number
}[] = [
  { label: '48h', bucket: 'hour', periods: 48 },
  { label: '30d', bucket: 'day', periods: 30 },
  { label: '12w', bucket: 'week', periods: 12 },
]

const CHART_WIDTH = 640
const CHART_HEIGHT = 120
const BAR_GAP = 2
const MAX_BAR_THICKNESS = 24
const MID_Y = CHART_HEIGHT / 2
const PLOT_HALF_HEIGHT = MID_Y - 10

function formatBucketLabel(bucketStart: string, bucket: SentimentBucketGranularity): string {
  const d = new Date(bucketStart)
  if (bucket === 'hour') return d.toLocaleTimeString('en-US', { hour: 'numeric' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function BucketDetail({
  bucket,
  granularity,
}: {
  bucket: SentimentBucketOut | null
  granularity: SentimentBucketGranularity
}) {
  if (!bucket) {
    return <p className="text-muted-foreground text-xs">Hover or focus a bar for details.</p>
  }
  if (bucket.avg_net_score === null) {
    return (
      <p className="text-xs">
        <span className="font-medium">{formatBucketLabel(bucket.bucket_start, granularity)}</span>
        <span className="text-muted-foreground"> — no news</span>
      </p>
    )
  }
  return (
    <p className="text-xs">
      <span className="font-medium">{formatBucketLabel(bucket.bucket_start, granularity)}</span>
      <span className="text-muted-foreground">
        {' '}
        — avg {bucket.avg_net_score >= 0 ? '+' : ''}
        {bucket.avg_net_score.toFixed(2)} · {bucket.positive_count} positive /{' '}
        {bucket.negative_count} negative / {bucket.neutral_count} neutral
      </span>
    </p>
  )
}

export function SentimentTrendChart({ ticker }: { ticker: string }) {
  const [optionIndex, setOptionIndex] = useState(1)
  const option = BUCKET_OPTIONS[optionIndex]
  const { data, isPending, isError, error, refetch } = useSentimentHistory(
    ticker,
    option.bucket,
    option.periods,
  )
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const barSlot = CHART_WIDTH / option.periods
  const barWidth = Math.max(1, Math.min(MAX_BAR_THICKNESS, barSlot - BAR_GAP))
  const hoveredBucket = data && hoveredIndex !== null ? data.buckets[hoveredIndex] : null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>News sentiment trend</CardTitle>
        <div className="flex items-center gap-1">
          {BUCKET_OPTIONS.map((opt, i) => (
            <Button
              key={opt.label}
              size="sm"
              variant={i === optionIndex ? 'secondary' : 'ghost'}
              onClick={() => {
                setOptionIndex(i)
                setHoveredIndex(null)
              }}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isPending && <Skeleton className="h-32 rounded-lg" />}
        {isError && <ErrorState error={error} onRetry={() => refetch()} />}

        {data && (
          <>
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="w-full"
              role="img"
              aria-label={`News sentiment trend for ${ticker}, last ${option.label}`}
            >
              <line
                x1={0}
                y1={MID_Y}
                x2={CHART_WIDTH}
                y2={MID_Y}
                className="stroke-border"
                strokeWidth={1}
              />
              {data.buckets.map((bucket, i) => {
                const x = i * barSlot + (barSlot - barWidth) / 2
                const isHovered = hoveredIndex === i

                if (bucket.avg_net_score === null) {
                  return (
                    <circle
                      key={bucket.bucket_start}
                      cx={x + barWidth / 2}
                      cy={MID_Y}
                      r={2}
                      className={cn(
                        'fill-muted-foreground/40',
                        isHovered && 'fill-muted-foreground',
                      )}
                      tabIndex={0}
                      onPointerEnter={() => setHoveredIndex(i)}
                      onPointerLeave={() => setHoveredIndex(null)}
                      onFocus={() => setHoveredIndex(i)}
                      onBlur={() => setHoveredIndex(null)}
                    />
                  )
                }

                const isPositive = bucket.avg_net_score >= 0
                const magnitude = Math.abs(bucket.avg_net_score) * PLOT_HALF_HEIGHT
                const height = Math.max(magnitude, 2)
                const y = isPositive ? MID_Y - height : MID_Y

                return (
                  <rect
                    key={bucket.bucket_start}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={height}
                    rx={2}
                    className={cn(
                      isPositive
                        ? 'fill-[#2a78d6] dark:fill-[#3987e5]'
                        : 'fill-[#e34948] dark:fill-[#e66767]',
                      isHovered && 'opacity-75',
                    )}
                    tabIndex={0}
                    onPointerEnter={() => setHoveredIndex(i)}
                    onPointerLeave={() => setHoveredIndex(null)}
                    onFocus={() => setHoveredIndex(i)}
                    onBlur={() => setHoveredIndex(null)}
                  />
                )
              })}
            </svg>
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>{formatBucketLabel(data.buckets[0].bucket_start, option.bucket)}</span>
              <span>
                {formatBucketLabel(data.buckets[data.buckets.length - 1].bucket_start, option.bucket)}
              </span>
            </div>
            <BucketDetail bucket={hoveredBucket} granularity={option.bucket} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
