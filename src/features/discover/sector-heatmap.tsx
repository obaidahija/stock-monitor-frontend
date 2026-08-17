import type { CSSProperties } from 'react'
import { useSearchParams } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSectorHeatmap } from './hooks'

const MAX_ABS_CHANGE_PCT = 5

function tileStyle(avgChangePct: number | null): CSSProperties {
  if (avgChangePct === null) return {}
  const intensity = Math.min(Math.abs(avgChangePct) / MAX_ABS_CHANGE_PCT, 1)
  const alpha = 0.08 + intensity * 0.35
  const [r, g, b] = avgChangePct >= 0 ? [16, 185, 129] : [239, 68, 68]
  return { backgroundColor: `rgba(${r}, ${g}, ${b}, ${alpha})` }
}

export function SectorHeatmap() {
  const { data, isPending, isError, error, refetch } = useSectorHeatmap()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSector = searchParams.get('sector')

  const sectors = data?.items ?? []

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
        <CardTitle className="flex items-baseline justify-between gap-3">
          <span>Sector heatmap</span>
          {data && (
            <span className="text-muted-foreground text-xs font-normal">
              {data.total_tickers.toLocaleString()} tickers
            </span>
          )}
        </CardTitle>
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
                  style={tileStyle(s.avg_change_pct)}
                >
                  <p className="truncate text-sm font-medium">{s.sector}</p>
                  <p
                    className={cn(
                      'text-lg font-semibold tabular-nums',
                      s.avg_change_pct === null
                        ? 'text-muted-foreground'
                        : s.avg_change_pct >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400',
                    )}
                  >
                    {formatSignedPct(s.avg_change_pct)}
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
