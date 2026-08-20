import { useState } from 'react'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { cn } from '@/lib/utils'
import type { MacroBucketGranularity, MacroSignalHistoryBucketOut } from '@/types/api'
import { MACRO_CATEGORIES, macroCategoryColor, macroCategoryLabel } from './constants'
import { useMacroSignalHistory } from './hooks'

// "Did this persist, and for how long" is the question this chart answers --
// the Aug 2026 Hormuz/rates episode this whole feature was built to catch
// was a multi-day pattern (see the macro-news plan), not visible from the
// single trailing-24h snapshot MacroSignalDashboard shows.
const PERIOD_OPTIONS: { label: string; bucket: MacroBucketGranularity; periods: number }[] = [
  { label: '48h', bucket: 'hour', periods: 48 },
  { label: '7d', bucket: 'day', periods: 7 },
  { label: '14d', bucket: 'day', periods: 14 },
  { label: '30d', bucket: 'day', periods: 30 },
]
const DEFAULT_OPTION_INDEX = 2 // 14d

const CHART_WIDTH = 640
const CHART_HEIGHT = 160
const BAR_GAP = 3
const MAX_BAR_THICKNESS = 32
const SEGMENT_GAP = 2
const AXIS_Y = CHART_HEIGHT - 4
const PLOT_HEIGHT = AXIS_Y - 6

function formatBucketLabel(bucketStart: string, bucket: MacroBucketGranularity): string {
  const d = new Date(bucketStart)
  if (bucket === 'hour') return d.toLocaleTimeString('en-US', { hour: 'numeric' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function HistoryBucketDetail({
  bucket,
  granularity,
}: {
  bucket: MacroSignalHistoryBucketOut | null
  granularity: MacroBucketGranularity
}) {
  if (!bucket) {
    return (
      <p className="text-muted-foreground text-xs">Hover or focus a bar for a per-category breakdown.</p>
    )
  }
  if (bucket.total === 0) {
    return (
      <p className="text-xs">
        <span className="font-medium">{formatBucketLabel(bucket.bucket_start, granularity)}</span>
        <span className="text-muted-foreground"> — no items</span>
      </p>
    )
  }
  const active = MACRO_CATEGORIES.map((c) => ({ c, count: bucket.categories[c] ?? 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
  return (
    <p className="text-xs">
      <span className="font-medium">{formatBucketLabel(bucket.bucket_start, granularity)}</span>
      <span className="text-muted-foreground">
        {' '}
        — {bucket.total} item{bucket.total === 1 ? '' : 's'} ·{' '}
        {active.map((x) => `${macroCategoryLabel(x.c)} ${x.count}`).join(', ')}
      </span>
    </p>
  )
}

export function MacroHistoryChart() {
  const [optionIndex, setOptionIndex] = useState(DEFAULT_OPTION_INDEX)
  const option = PERIOD_OPTIONS[optionIndex]
  const { data, isPending, isError, error, refetch } = useMacroSignalHistory(
    option.bucket,
    option.periods,
  )
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const barSlot = CHART_WIDTH / option.periods
  const barWidth = Math.max(1, Math.min(MAX_BAR_THICKNESS, barSlot - BAR_GAP))
  const maxTotal = data ? Math.max(1, ...data.map((b) => b.total)) : 1
  const hoveredBucket = data && hoveredIndex !== null ? data[hoveredIndex] : null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Signal history</CardTitle>
        <div className="flex items-center gap-1">
          {PERIOD_OPTIONS.map((opt, i) => (
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
        {isPending && <Skeleton className="h-40 rounded-lg" />}
        {isError && <ErrorState error={error} onRetry={() => refetch()} />}

        {data && (
          <>
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="w-full"
              role="img"
              aria-label={`Macro category signal history, last ${option.label}`}
            >
              <line x1={0} y1={AXIS_Y} x2={CHART_WIDTH} y2={AXIS_Y} className="stroke-border" strokeWidth={1} />
              {data.map((bucket, i) => {
                const x = i * barSlot + (barSlot - barWidth) / 2
                const isHovered = hoveredIndex === i

                if (bucket.total === 0) {
                  return (
                    <circle
                      key={bucket.bucket_start}
                      cx={x + barWidth / 2}
                      cy={AXIS_Y}
                      r={2}
                      className={cn('fill-muted-foreground/40', isHovered && 'fill-muted-foreground')}
                      tabIndex={0}
                      onPointerEnter={() => setHoveredIndex(i)}
                      onPointerLeave={() => setHoveredIndex((h) => (h === i ? null : h))}
                      onFocus={() => setHoveredIndex(i)}
                      onBlur={() => setHoveredIndex((h) => (h === i ? null : h))}
                    />
                  )
                }

                let yCursor = AXIS_Y
                return (
                  <g
                    key={bucket.bucket_start}
                    tabIndex={0}
                    onPointerEnter={() => setHoveredIndex(i)}
                    onPointerLeave={() => setHoveredIndex((h) => (h === i ? null : h))}
                    onFocus={() => setHoveredIndex(i)}
                    onBlur={() => setHoveredIndex((h) => (h === i ? null : h))}
                    className={cn(isHovered && 'opacity-80')}
                  >
                    {MACRO_CATEGORIES.map((category) => {
                      const count = bucket.categories[category] ?? 0
                      if (count === 0) return null
                      const height = Math.max((count / maxTotal) * PLOT_HEIGHT, 2)
                      yCursor -= height + SEGMENT_GAP
                      return (
                        <rect
                          key={category}
                          x={x}
                          y={yCursor + SEGMENT_GAP}
                          width={barWidth}
                          height={height}
                          rx={1}
                          style={{ fill: macroCategoryColor(category, isDark) }}
                        />
                      )
                    })}
                  </g>
                )
              })}
            </svg>
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>{formatBucketLabel(data[0].bucket_start, option.bucket)}</span>
              <span>{formatBucketLabel(data[data.length - 1].bucket_start, option.bucket)}</span>
            </div>
            <HistoryBucketDetail bucket={hoveredBucket} granularity={option.bucket} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
