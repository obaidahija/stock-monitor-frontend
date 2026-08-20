import type { CSSProperties } from 'react'
import { useSearchParams } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSectorHeatmap } from './hooks'
import type { SectorSummaryOut } from '@/types/api'

const MAX_ABS_CHANGE_PCT = 5

function tileStyle(avgChangePct: number | null): CSSProperties {
  if (avgChangePct === null) return {}
  const intensity = Math.min(Math.abs(avgChangePct) / MAX_ABS_CHANGE_PCT, 1)
  const alpha = 0.1 + intensity * 0.45
  const [r, g, b] = avgChangePct >= 0 ? [16, 185, 129] : [239, 68, 68]
  return { backgroundColor: `rgba(${r}, ${g}, ${b}, ${alpha})` }
}

export function SectorHeatmap() {
  const { data, isPending, isError, error, refetch } = useSectorHeatmap()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSector = searchParams.get('sector')

  const sectors = data?.items ?? []
  const maxCount = Math.max(1, ...sectors.map((s) => s.count))

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
          <div className="grid auto-rows-fr grid-flow-row-dense grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {sectors.map((s) => (
              <SectorTile
                key={s.sector}
                sector={s}
                isActive={activeSector === s.sector}
                // Sectors covering a large share of the universe get a wider
                // tile — a coarse treemap so tile size also carries meaning,
                // not just color, and the biggest sectors aren't squeezed
                // into the same box as a 2-ticker one.
                isBig={sectors.length > 3 && s.count >= maxCount * 0.6}
                onToggle={() => toggleSector(s.sector)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SectorTile({
  sector: s,
  isActive,
  isBig,
  onToggle,
}: {
  sector: SectorSummaryOut
  isActive: boolean
  isBig: boolean
  onToggle: () => void
}) {
  const breadthTotal = s.advancers + s.decliners
  const advancerPct = breadthTotal > 0 ? (s.advancers / breadthTotal) * 100 : 50

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isActive}
      className={cn(
        'border-border flex cursor-pointer flex-col rounded-lg border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md',
        isActive && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
        isBig && 'sm:col-span-2',
      )}
      style={tileStyle(s.avg_change_pct)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-medium">{s.sector}</p>
        <p
          className={cn(
            'shrink-0 text-lg font-semibold tabular-nums',
            s.avg_change_pct === null
              ? 'text-muted-foreground'
              : s.avg_change_pct >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400',
          )}
        >
          {formatSignedPct(s.avg_change_pct)}
        </p>
      </div>

      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        {breadthTotal > 0 && (
          <>
            <div className="h-full bg-emerald-500" style={{ width: `${advancerPct}%` }} />
            <div className="h-full bg-red-500" style={{ width: `${100 - advancerPct}%` }} />
          </>
        )}
      </div>

      <div className="mt-2 flex flex-1 items-end justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {s.count} ticker{s.count === 1 ? '' : 's'}
          {breadthTotal > 0 && (
            <>
              {' '}
              ·{' '}
              <span className="text-emerald-600 dark:text-emerald-400">{s.advancers}↑</span>{' '}
              <span className="text-red-600 dark:text-red-400">{s.decliners}↓</span>
            </>
          )}
        </p>
        {s.top_ticker && (
          <span
            className={cn(
              'shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
              s.top_ticker_change_pct !== null && s.top_ticker_change_pct >= 0
                ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'border-red-500/30 text-red-600 dark:text-red-400',
            )}
          >
            {s.top_ticker} {formatSignedPct(s.top_ticker_change_pct)}
          </span>
        )}
      </div>
    </button>
  )
}
