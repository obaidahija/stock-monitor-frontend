import { useMemo, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useUniverse } from './hooks'
import type { UniverseTickerOut } from '@/types/api'

// Universe is capped at ~508 rows server-side, so one unpaginated fetch
// covers the full set for grouping — same underlying query UniverseTable
// pages through, just a separate cache entry via a different queryKey.
const FULL_UNIVERSE_LIMIT = 508
const MAX_ABS_CHANGE_PCT = 5

interface SectorSummary {
  sector: string
  avgChangePct: number | null
  count: number
}

function summarizeBySector(items: UniverseTickerOut[]): SectorSummary[] {
  const bySector = new Map<string, { sum: number; withChange: number; count: number }>()

  for (const item of items) {
    if (!item.sector) continue
    const entry = bySector.get(item.sector) ?? { sum: 0, withChange: 0, count: 0 }
    entry.count += 1
    if (item.change_pct !== null) {
      entry.sum += item.change_pct
      entry.withChange += 1
    }
    bySector.set(item.sector, entry)
  }

  return Array.from(bySector.entries())
    .map(([sector, { sum, withChange, count }]) => ({
      sector,
      avgChangePct: withChange > 0 ? sum / withChange : null,
      count,
    }))
    .sort((a, b) => (b.avgChangePct ?? -Infinity) - (a.avgChangePct ?? -Infinity))
}

function tileStyle(avgChangePct: number | null): CSSProperties {
  if (avgChangePct === null) return {}
  const intensity = Math.min(Math.abs(avgChangePct) / MAX_ABS_CHANGE_PCT, 1)
  const alpha = 0.08 + intensity * 0.35
  const [r, g, b] = avgChangePct >= 0 ? [16, 185, 129] : [239, 68, 68]
  return { backgroundColor: `rgba(${r}, ${g}, ${b}, ${alpha})` }
}

export function SectorHeatmap() {
  const { data, isPending, isError, error, refetch } = useUniverse({
    sort: 'ticker',
    order: 'asc',
    limit: FULL_UNIVERSE_LIMIT,
  })
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSector = searchParams.get('sector')

  const sectors = useMemo(() => (data ? summarizeBySector(data.items) : []), [data])

  /** Clicking a tile filters the tracked-universe table below to that
   * sector (shared via the `sector` URL param, same pattern UniverseTable
   * uses for its own filters); clicking the already-active tile clears it. */
  function toggleSector(sector: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (activeSector === sector) {
        next.delete('sector')
      } else {
        next.set('sector', sector)
      }
      next.delete('page')
      return next
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sector heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending && <Skeleton className="h-40 rounded-xl" />}
        {isError && <ErrorState error={error} onRetry={() => refetch()} />}
        {data && sectors.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Sectors populate once universe_score has run.
          </p>
        )}
        {sectors.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {sectors.map((s) => {
              const isActive = activeSector === s.sector
              return (
                <button
                  key={s.sector}
                  type="button"
                  onClick={() => toggleSector(s.sector)}
                  aria-pressed={isActive}
                  className={cn(
                    'border-border cursor-pointer rounded-lg border p-3 text-left transition-shadow hover:shadow-sm',
                    isActive && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                  )}
                  style={tileStyle(s.avgChangePct)}
                >
                  <p className="truncate text-sm font-medium">{s.sector}</p>
                  <p
                    className={cn(
                      'text-lg font-semibold tabular-nums',
                      s.avgChangePct === null
                        ? 'text-muted-foreground'
                        : s.avgChangePct >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400',
                    )}
                  >
                    {formatSignedPct(s.avgChangePct)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {s.count} ticker{s.count === 1 ? '' : 's'}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
