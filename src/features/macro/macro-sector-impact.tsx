import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/shared/error-state'
import { ApiError } from '@/lib/api-client'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MacroSectorImpactBucketOut } from '@/types/api'
import { macroCategoryLabel } from './constants'
import { useMacroSectorImpact, useMacroSectorImpactDates, useRefreshMacroSectorImpact } from './hooks'

const NET_BADGE_CLASSES: Record<MacroSectorImpactBucketOut['net'], string> = {
  positive: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent',
  negative: 'bg-red-500/15 text-red-600 dark:text-red-400 border-transparent',
  mixed: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent',
  neutral: 'bg-muted text-muted-foreground border-transparent',
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-card rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

// One diverging bar per sector, split from a center axis -- negative count
// grows left (red), positive count grows right (emerald), same polarity
// pair the app already uses for bullish/bearish elsewhere (lean-colors.ts).
// A tornado-style leaderboard (most-bullish sector on top) reads faster than
// a fixed alphabetical order for a "what's under pressure right now" view.
function SectorRow({
  sector,
  bucket,
  maxCount,
}: {
  sector: string
  bucket: MacroSectorImpactBucketOut
  maxCount: number
}) {
  const [expanded, setExpanded] = useState(false)
  const negPct = (bucket.negative_count / maxCount) * 100
  const posPct = (bucket.positive_count / maxCount) * 100

  return (
    <div className="border-border rounded-lg border">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="hover:bg-muted/50 flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        )}
        <span className="w-36 shrink-0 truncate text-sm font-medium">{sector}</span>
        <div className="flex h-5 min-w-0 flex-1 items-center">
          <div className="flex h-full flex-1 items-center justify-end overflow-hidden">
            <div
              className="h-full rounded-l-sm bg-red-500/70"
              style={{ width: `${Math.max(negPct, bucket.negative_count > 0 ? 4 : 0)}%` }}
            />
          </div>
          <div className="bg-border h-6 w-px shrink-0" aria-hidden="true" />
          <div className="flex h-full flex-1 items-center overflow-hidden">
            <div
              className="h-full rounded-r-sm bg-emerald-500/70"
              style={{ width: `${Math.max(posPct, bucket.positive_count > 0 ? 4 : 0)}%` }}
            />
          </div>
        </div>
        <span className="w-20 shrink-0 text-right text-xs tabular-nums">
          <span className="text-red-600 dark:text-red-400">-{bucket.negative_count}</span>
          <span className="text-muted-foreground"> / </span>
          <span className="text-emerald-600 dark:text-emerald-400">+{bucket.positive_count}</span>
        </span>
        <Badge className={cn('w-16 shrink-0 justify-center capitalize', NET_BADGE_CLASSES[bucket.net])}>
          {bucket.net}
        </Badge>
      </button>
      {expanded && (
        <div className="border-border divide-border space-y-3 divide-y border-t px-3 py-2.5">
          {bucket.items.map((item) => (
            <div key={`${item.id}-${item.via_category ?? item.category}`} className="space-y-1 pt-3 first:pt-0">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <Badge
                  className={cn(
                    'border-transparent capitalize',
                    item.direction === 'positive'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-500/15 text-red-600 dark:text-red-400',
                  )}
                >
                  {item.direction}
                </Badge>
                <span className="text-muted-foreground">
                  {macroCategoryLabel(item.category)}
                  {item.via_category && ` → ${macroCategoryLabel(item.via_category)}`}
                </span>
                <span className="text-muted-foreground" aria-hidden="true">
                  ·
                </span>
                <span className="text-muted-foreground capitalize">
                  {item.stance} / {item.magnitude}
                </span>
              </div>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block text-sm leading-snug font-medium hover:underline"
              >
                {item.title}
              </a>
              {item.direction_note && (
                <p className="text-muted-foreground text-xs">{item.direction_note}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// `selectedDate: null` means "today" (no ?date= param -- backend resolves
// the ET calendar date itself). History nav below resolves a concrete date
// once available (from the loaded snapshot or the dates list) so prev/next
// can walk the list even before today's row exists.
export function MacroSectorImpact() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const { data, isPending, isError, error } = useMacroSectorImpact(selectedDate ?? undefined)
  const { data: dates = [] } = useMacroSectorImpactDates(30)
  const refresh = useRefreshMacroSectorImpact()

  // A 404 means "no snapshot computed for this date yet" -- an expected,
  // non-error state (today before the first refresh, or a past date the
  // sync job never ran for), not something to show ErrorState/retry for.
  const isNotFound = isError && error instanceof ApiError && error.status === 404
  const isRealError = isError && !isNotFound

  const isToday = selectedDate === null
  const anchorDate = data?.impact_date ?? dates[0]?.impact_date ?? null
  const anchorIndex = anchorDate ? dates.findIndex((d) => d.impact_date === anchorDate) : -1
  const olderDate = anchorIndex === -1 ? dates[0]?.impact_date : dates[anchorIndex + 1]?.impact_date
  const canGoOlder = Boolean(olderDate)
  const canGoNewer = !isToday && anchorIndex > 0

  const sortedSectors = data
    ? Object.entries(data.sectors).sort(
        ([, a], [, b]) =>
          b.positive_count - b.negative_count - (a.positive_count - a.negative_count),
      )
    : []
  const maxCount = Math.max(
    1,
    ...sortedSectors.flatMap(([, bucket]) => [bucket.positive_count, bucket.negative_count]),
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Sector impact</CardTitle>
        {isToday && (
          <Button
            size="sm"
            variant="outline"
            disabled={refresh.isPending}
            onClick={() => refresh.mutate()}
          >
            <Sparkles className={cn(refresh.isPending && 'animate-pulse')} aria-hidden="true" />
            {refresh.isPending ? 'Resolving…' : data ? 'Refresh' : 'Run analysis'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button
            size="sm"
            variant="ghost"
            disabled={!canGoOlder}
            onClick={() => olderDate && setSelectedDate(olderDate)}
          >
            <ChevronLeft aria-hidden="true" />
            Older
          </Button>
          <span className="text-muted-foreground text-sm font-medium">
            {isToday ? `Today${anchorDate ? ` · ${formatDate(anchorDate)}` : ''}` : formatDate(selectedDate)}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={!canGoNewer}
            onClick={() =>
              setSelectedDate(anchorIndex === 1 ? null : (dates[anchorIndex - 1]?.impact_date ?? null))
            }
          >
            Newer
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>

        {isNotFound && !isPending && isToday && (
          <p className="text-muted-foreground text-sm">
            Resolves each candidate item's stance via a local LLM call, then applies static
            transmission rules to estimate which sector ETFs are pressured which way over the
            last 24h. Informational, not backtested — refresh can take 20-40s the first time new
            items show up, near-instant once nothing's changed.
          </p>
        )}

        {isNotFound && !isPending && !isToday && (
          <p className="text-muted-foreground text-sm">No snapshot was computed for this date.</p>
        )}

        {(isPending || refresh.isPending) && (
          <div className="border-border flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <Sparkles className="text-muted-foreground size-5 animate-pulse" aria-hidden="true" />
            <p className="text-muted-foreground text-sm">
              {refresh.isPending ? 'Resolving stance for each new candidate item…' : 'Loading…'}
            </p>
          </div>
        )}

        {isRealError && <ErrorState error={error} />}
        {refresh.isError && <ErrorState error={refresh.error} onRetry={() => refresh.mutate()} />}

        {data && !isPending && !refresh.isPending && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="Considered" value={String(data.items_considered)} />
              <StatTile label="Resolved" value={String(data.items_resolved)} />
              <StatTile label="Sectors flagged" value={String(sortedSectors.length)} />
            </div>

            {sortedSectors.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No relevant macro items resolved to a directional sector signal in the last{' '}
                {data.window_hours}h.
              </p>
            ) : (
              <div className="space-y-1.5">
                {sortedSectors.map(([sector, bucket]) => (
                  <SectorRow key={sector} sector={sector} bucket={bucket} maxCount={maxCount} />
                ))}
              </div>
            )}

            <p className="text-muted-foreground text-xs">
              Generated {formatRelativeTime(data.generated_at)}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
