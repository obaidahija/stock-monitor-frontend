import { useState } from 'react'
import {
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  Info,
  ListOrdered,
  Minus,
  MoveUp,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { formatDateTime, formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SectorRotationEntryOut } from '@/types/api'
import { useSectorRotation } from './hooks'

const WINDOWS = [5, 20] as const
type SortMode = 'rotation' | 'rank'

function describeRotation(entry: SectorRotationEntryOut): string {
  let rankStory = 'with no comparable prior rank'
  if (entry.rank_prior !== null && entry.rank_change !== null) {
    rankStory =
      entry.rank_change === 0
        ? `unchanged from #${entry.rank_prior}`
        : `${entry.rank_change > 0 ? 'up' : 'down'} ${Math.abs(entry.rank_change)} from #${entry.rank_prior}`
  }

  const momentumChange =
    entry.trend_pct_change === null
      ? '.'
      : `, ${entry.trend_pct_change > 0 ? '+' : ''}${entry.trend_pct_change.toFixed(1)} percentage points versus the prior reading.`

  return `${entry.sector} is #${entry.rank}, ${rankStory}. Momentum is ${formatSignedPct(entry.trend_pct, 1)}${momentumChange}`
}

function RankChange({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="bg-muted text-muted-foreground inline-flex rounded-full px-2 py-1 text-xs">
        New
      </span>
    )
  }
  if (value === 0) {
    return (
      <span
        className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium"
        aria-label="Rank unchanged"
      >
        <Minus className="size-3.5" aria-hidden="true" />
        <span>—</span>
        <span>Flat</span>
      </span>
    )
  }

  const improved = value > 0
  const Icon = improved ? ArrowUp : ArrowDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold tabular-nums',
        improved
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : 'bg-red-500/10 text-red-700 dark:text-red-400',
      )}
      aria-label={`${improved ? 'Rose' : 'Fell'} ${Math.abs(value)} ranks`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {Math.abs(value)}
    </span>
  )
}

function MomentumBar({ value, maxAbs }: { value: number; maxAbs: number }) {
  const width = Math.max(value === 0 ? 0 : 3, (Math.abs(value) / maxAbs) * 50)
  const isPositive = value >= 0

  return (
    <div className="bg-muted relative h-7 min-w-20 flex-1 overflow-hidden rounded-md">
      <div className="bg-border absolute inset-y-0 left-1/2 w-px" aria-hidden="true" />
      <div
        className={cn(
          'absolute inset-y-1 rounded-sm transition-all duration-300',
          isPositive ? 'left-1/2 bg-emerald-500/80' : 'right-1/2 bg-red-500/80',
        )}
        style={{ width: `${width}%` }}
        aria-hidden="true"
      />
    </div>
  )
}

function RotationBar({
  entry,
  maxAbs,
  isActive,
  onActiveChange,
}: {
  entry: SectorRotationEntryOut
  maxAbs: number
  isActive: boolean
  onActiveChange: (entry: SectorRotationEntryOut | null) => void
}) {
  return (
    <div
      data-testid="rotation-row"
      role="img"
      tabIndex={0}
      aria-label={describeRotation(entry)}
      onPointerEnter={() => onActiveChange(entry)}
      onPointerLeave={() => onActiveChange(null)}
      onFocus={() => onActiveChange(entry)}
      onBlur={() => onActiveChange(null)}
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-lg px-2 py-2 transition-colors md:grid-cols-[10rem_minmax(12rem,1fr)_4rem_5rem] md:gap-3',
        isActive && 'bg-background shadow-sm ring-1 ring-foreground/10',
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{entry.sector}</p>
        <p className="text-muted-foreground mt-0.5 truncate text-[11px] tabular-nums">
          {entry.etf_symbol} · {entry.rank_prior === null ? 'new' : `#${entry.rank_prior}`}
          <span className="mx-1" aria-hidden="true">→</span>#{entry.rank}
        </p>
      </div>

      <div className="order-3 col-span-2 flex min-w-0 items-center gap-3 md:order-none md:col-span-1">
        <MomentumBar value={entry.trend_pct} maxAbs={maxAbs} />
        <span
          className={cn(
            'w-14 shrink-0 text-right text-sm font-semibold tabular-nums',
            entry.trend_pct > 0
              ? 'text-emerald-700 dark:text-emerald-400'
              : entry.trend_pct < 0
                ? 'text-red-700 dark:text-red-400'
                : 'text-muted-foreground',
          )}
        >
          {formatSignedPct(entry.trend_pct, 1)}
        </span>
      </div>

      <span className="text-muted-foreground hidden text-right text-[11px] tabular-nums md:block">
        {entry.trend_pct_change === null
          ? '—'
          : `${entry.trend_pct_change > 0 ? '+' : ''}${entry.trend_pct_change.toFixed(1)} pp`}
      </span>

      <div className="flex justify-end">
        <RankChange value={entry.rank_change} />
      </div>
    </div>
  )
}

function SummaryTile({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string
  value: string
  detail: string
  icon: typeof TrendingUp
  tone?: 'positive' | 'neutral'
}) {
  return (
    <div className="border-border bg-background/70 rounded-lg border p-3.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex size-7 items-center justify-center rounded-md',
            tone === 'positive'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
      </div>
      <p className="mt-3 truncate text-base font-semibold">{value}</p>
      <p className="text-muted-foreground mt-0.5 truncate text-xs">{detail}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-9 rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

export function SectorRotation() {
  const [windowDays, setWindowDays] = useState<(typeof WINDOWS)[number]>(5)
  const [sortMode, setSortMode] = useState<SortMode>('rotation')
  const [activeSector, setActiveSector] = useState<SectorRotationEntryOut | null>(null)
  const { data, isLoading, isError, error, refetch } = useSectorRotation(windowDays)

  const daysAvailable = data?.history_days_available ?? 0
  const hasComparison = data ? data.prior_as_of !== null : false
  const sectors = data?.sectors ?? []
  const maxAbsMomentum = Math.max(1, ...sectors.map((entry) => Math.abs(entry.trend_pct)))

  const rows = [...sectors].sort((a, b) => {
    if (sortMode === 'rank') return a.rank - b.rank
    if (a.rank_change === null) return 1
    if (b.rank_change === null) return -1
    return b.rank_change - a.rank_change || a.rank - b.rank
  })

  const currentLeader = sectors.reduce<SectorRotationEntryOut | null>(
    (best, entry) => (!best || entry.rank < best.rank ? entry : best),
    null,
  )
  const strongestRiser = sectors.reduce<SectorRotationEntryOut | null>(
    (best, entry) =>
      entry.rank_change !== null &&
      entry.rank_change > 0 &&
      (!best || entry.rank_change > (best.rank_change ?? 0))
        ? entry
        : best,
    null,
  )
  const positiveCount = sectors.filter((entry) => entry.trend_pct > 0).length

  return (
    <Card className="gap-0">
      <CardHeader className="border-b pb-4 sm:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 gap-3">
          <span className="bg-primary text-primary-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg">
            <TrendingUp className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <CardTitle>Sector rotation</CardTitle>
            <CardDescription className="mt-1">
              Track leadership shifts across sector ETFs by momentum and rank migration.
            </CardDescription>
          </div>
        </div>

        <ButtonGroup className="mt-3 sm:mt-0" aria-label="Comparison window">
          {WINDOWS.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={windowDays === value ? 'default' : 'outline'}
              aria-pressed={windowDays === value}
              onClick={() => setWindowDays(value)}
            >
              {value} day
            </Button>
          ))}
        </ButtonGroup>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        {isLoading && !data && <LoadingState />}
        {isError && <ErrorState error={error} onRetry={() => refetch()} />}

        {data && !hasComparison && !isError && (
          <div className="border-border bg-muted/25 rounded-xl border border-dashed px-5 py-8 text-center">
            <span className="bg-background mx-auto flex size-10 items-center justify-center rounded-full border">
              <CalendarDays className="text-muted-foreground size-4" aria-hidden="true" />
            </span>
            <h3 className="mt-3 text-sm font-semibold">Not enough history yet</h3>
            <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm leading-relaxed">
              {daysAvailable} of {windowDays} calendar days collected. Sector momentum updates
              automatically every 30 minutes.
            </p>
            <div className="bg-muted mx-auto mt-4 h-1.5 max-w-xs overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-[width]"
                style={{ width: `${Math.min(100, (daysAvailable / windowDays) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {data && hasComparison && sectors.length === 0 && !isError && (
          <div className="border-border rounded-xl border border-dashed px-5 py-8 text-center">
            <p className="font-medium">No sector rotation data yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Sector rankings will appear after the next context sync.
            </p>
          </div>
        )}

        {data && hasComparison && sectors.length > 0 && !isError && (
          <>
            <section aria-label="Rotation overview" className="grid gap-3 sm:grid-cols-3">
              <SummaryTile
                label="Current leader"
                value={currentLeader?.sector ?? '—'}
                detail={
                  currentLeader
                    ? `${currentLeader.etf_symbol} · ${formatSignedPct(currentLeader.trend_pct, 1)}`
                    : 'No ranking available'
                }
                icon={TrendingUp}
                tone="positive"
              />
              <SummaryTile
                label="Strongest rotation"
                value={strongestRiser?.sector ?? 'No riser'}
                detail={
                  strongestRiser
                    ? `Up ${strongestRiser.rank_change} to rank #${strongestRiser.rank}`
                    : 'Ranks are unchanged'
                }
                icon={ArrowUpRight}
                tone={strongestRiser ? 'positive' : 'neutral'}
              />
              <SummaryTile
                label="Positive breadth"
                value={`${positiveCount} of ${sectors.length}`}
                detail={`${Math.round((positiveCount / sectors.length) * 100)}% with positive momentum`}
                icon={ListOrdered}
              />
            </section>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Rotation map</p>
                <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                  <span>{formatDateTime(data.prior_as_of)}</span>
                  <span aria-hidden="true">→</span>
                  <span>{formatDateTime(data.as_of)}</span>
                </p>
              </div>
              <ButtonGroup aria-label="Sort sectors">
                <Button
                  type="button"
                  size="sm"
                  variant={sortMode === 'rotation' ? 'secondary' : 'outline'}
                  aria-pressed={sortMode === 'rotation'}
                  onClick={() => setSortMode('rotation')}
                >
                  <MoveUp aria-hidden="true" />
                  Biggest moves
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={sortMode === 'rank' ? 'secondary' : 'outline'}
                  aria-pressed={sortMode === 'rank'}
                  onClick={() => setSortMode('rank')}
                >
                  <ListOrdered aria-hidden="true" />
                  Current rank
                </Button>
              </ButtonGroup>
            </div>

            <div className="border-border bg-muted/20 rounded-xl border p-2">
              <div className="space-y-0.5">
                {rows.map((row) => (
                  <RotationBar
                    key={row.etf_symbol}
                    entry={row}
                    maxAbs={maxAbsMomentum}
                    isActive={activeSector?.etf_symbol === row.etf_symbol}
                    onActiveChange={setActiveSector}
                  />
                ))}
              </div>
              <p className="text-muted-foreground border-border mt-2 border-t px-2 pt-2 text-xs leading-relaxed">
                {activeSector
                  ? describeRotation(activeSector)
                  : 'Bars show current momentum around a zero baseline. Hover or focus a sector for its rank story.'}
              </p>
            </div>
          </>
        )}

        {data?.caveat ? (
          <div className="border-border bg-muted/25 text-muted-foreground flex gap-2 rounded-lg border px-3 py-2.5 text-xs leading-relaxed">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <p>{data.caveat}</p>
          </div>
        ) : null}

        {data && hasComparison && (
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            <span className="inline-flex items-center gap-1">
              <ArrowUpRight className="size-3 text-emerald-600" aria-hidden="true" /> rising rank
            </span>
            <span className="inline-flex items-center gap-1">
              <ArrowDownRight className="size-3 text-red-600" aria-hidden="true" /> falling rank
            </span>
            <span>pp = percentage-point momentum change</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
