import { useState } from 'react'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { SectorRotationEntryOut } from '@/types/api'
import { useSectorRotation } from './hooks'

const WINDOWS = [5, 20] as const

// rank_change is rank_prior - rank, so POSITIVE means the sector climbed.
function RankChange({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-muted-foreground text-sm">n/a</span>
  }
  if (value === 0) {
    return (
      <span className="text-muted-foreground flex items-center gap-1 text-sm tabular-nums">
        <Minus className="size-3.5" aria-hidden="true" />—
      </span>
    )
  }
  const improved = value > 0
  const Icon = improved ? ArrowUp : ArrowDown
  return (
    <span
      className={cn(
        'flex items-center gap-1 text-sm font-medium tabular-nums',
        improved ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {Math.abs(value)}
    </span>
  )
}

function RotationRow({ entry }: { entry: SectorRotationEntryOut }) {
  return (
    <div
      data-testid="rotation-row"
      className="border-border flex items-center gap-3 border-b py-2 last:border-b-0"
    >
      <span className="w-10 shrink-0 text-sm font-medium tabular-nums">#{entry.rank}</span>
      <span className="min-w-0 flex-1 truncate text-sm">{entry.sector}</span>
      <span className="text-muted-foreground w-16 shrink-0 text-right text-sm tabular-nums">
        {entry.trend_pct.toFixed(1)}%
      </span>
      <span className="flex w-16 shrink-0 justify-end">
        <RankChange value={entry.rank_change} />
      </span>
    </div>
  )
}

export function SectorRotation() {
  // Named windowDays, not window: a state variable called `window` shadows the
  // global inside this component, which is legal but reads as a bug.
  const [windowDays, setWindowDays] = useState<(typeof WINDOWS)[number]>(5)
  const { data, isLoading } = useSectorRotation(windowDays)

  // Risers first: the delta is the entire point of this card, so ordering by
  // current rank would just repeat what the sector-impact card already shows.
  // Nulls sink to the bottom rather than sorting as zero.
  const rows = [...(data?.sectors ?? [])].sort((a, b) => {
    if (a.rank_change === null) return 1
    if (b.rank_change === null) return -1
    return b.rank_change - a.rank_change
  })

  const daysAvailable = data?.history_days_available ?? 0
  const hasComparison = data ? data.prior_as_of !== null : false

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle>Sector rotation</CardTitle>
        <div className="flex gap-1">
          {WINDOWS.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={windowDays === value ? 'default' : 'outline'}
              onClick={() => setWindowDays(value)}
            >
              {value}d
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && !data ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : !hasComparison ? (
          <p className="text-muted-foreground text-sm">
            Not enough history for a {windowDays}-day comparison yet — {daysAvailable} day
            {daysAvailable === 1 ? '' : 's'} collected so far. Sector momentum accrues every 30
            minutes, so this fills in on its own.
          </p>
        ) : (
          <div>
            {rows.map((row) => (
              <RotationRow key={row.etf_symbol} entry={row} />
            ))}
          </div>
        )}
        {data?.caveat ? <p className="text-muted-foreground mt-4 text-xs">{data.caveat}</p> : null}
      </CardContent>
    </Card>
  )
}
