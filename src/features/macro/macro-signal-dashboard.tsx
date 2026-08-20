import { useState } from 'react'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { MACRO_CATEGORIES, macroCategoryColor, macroCategoryLabel } from './constants'
import { useMacroSignal } from './hooks'

const WINDOW_HOURS = 24

function StatTile({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {caption && <p className="text-muted-foreground mt-0.5 text-xs">{caption}</p>}
    </div>
  )
}

// Horizontal bar chart, one row per category in a fixed order (identity, not
// magnitude-sorted, so a category doesn't jump position run to run). Bars
// direct-label both the category name and its count -- with 7 categories in
// play, color alone isn't a reliable identity channel (dataviz series-count
// ladder: 4+ series requires direct labels), so labels carry the read, color
// is the secondary/legend channel.
function CategoryBarChart() {
  const { data, isPending, isError, error, refetch } = useMacroSignal(WINDOW_HOURS)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [hovered, setHovered] = useState<string | null>(null)

  if (isPending) return <Skeleton className="h-64 rounded-lg" />
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />

  const counts = MACRO_CATEGORIES.map((category) => data.categories[category]?.count ?? 0)
  const maxCount = Math.max(1, ...counts)
  const hoveredSignal = hovered ? data.categories[hovered] : null

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {MACRO_CATEGORIES.map((category) => {
          const signal = data.categories[category]
          const count = signal?.count ?? 0
          const widthPct = (count / maxCount) * 100
          const isHovered = hovered === category
          const color = macroCategoryColor(category, isDark)

          return (
            <div
              key={category}
              className="flex items-center gap-3"
              onPointerEnter={() => setHovered(category)}
              onPointerLeave={() => setHovered((h) => (h === category ? null : h))}
              onFocus={() => setHovered(category)}
              onBlur={() => setHovered((h) => (h === category ? null : h))}
              tabIndex={0}
              role="img"
              aria-label={`${macroCategoryLabel(category)}: ${count} item${count === 1 ? '' : 's'}`}
            >
              <span className="flex w-36 shrink-0 items-center gap-1.5 text-sm">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span className="truncate">{macroCategoryLabel(category)}</span>
              </span>
              <div className="bg-muted h-6 min-w-0 flex-1 overflow-hidden rounded-sm">
                <div
                  className={cn('h-full rounded-sm transition-opacity', isHovered && 'opacity-80')}
                  style={{ width: `${Math.max(widthPct, count > 0 ? 3 : 0)}%`, backgroundColor: color }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-sm font-medium tabular-nums">{count}</span>
            </div>
          )
        })}
      </div>
      <p className="text-muted-foreground text-xs">
        {hoveredSignal
          ? `${hoveredSignal.count} item${hoveredSignal.count === 1 ? '' : 's'} in the last ${WINDOW_HOURS}h` +
            (hoveredSignal.avg_sentiment_score !== null
              ? ` · avg sentiment confidence ${hoveredSignal.avg_sentiment_score.toFixed(2)}`
              : '')
          : `Hover or focus a row for details. Item counts, last ${WINDOW_HOURS}h.`}
      </p>
    </div>
  )
}

export function MacroSignalDashboard() {
  const { data, isPending, isError, error, refetch } = useMacroSignal(WINDOW_HOURS)

  const topCategory = data
    ? MACRO_CATEGORIES.map((c) => ({ c, count: data.categories[c]?.count ?? 0 }))
        .filter((x) => x.count > 0)
        .sort((a, b) => b.count - a.count)[0]
    : undefined
  const activeCategoryCount = data
    ? MACRO_CATEGORIES.filter((c) => (data.categories[c]?.count ?? 0) > 0).length
    : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-baseline justify-between gap-3">
          <span>Macro signal</span>
          {data && (
            <span className="text-muted-foreground text-xs font-normal">
              updated {formatRelativeTime(data.generated_at)}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isPending && <Skeleton className="h-40 rounded-xl" />}
        {isError && <ErrorState error={error} onRetry={() => refetch()} />}
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile label={`Items, ${WINDOW_HOURS}h`} value={data.total_items.toLocaleString()} />
              <StatTile
                label="Active categories"
                value={`${activeCategoryCount} / ${MACRO_CATEGORIES.length}`}
              />
              <StatTile
                label="Most active"
                value={topCategory ? macroCategoryLabel(topCategory.c) : '—'}
                caption={topCategory ? `${topCategory.count} items` : 'No items yet'}
              />
            </div>
            <CategoryBarChart />
          </>
        )}
      </CardContent>
    </Card>
  )
}
