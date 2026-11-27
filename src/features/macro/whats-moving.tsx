import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { formatEasternDateTime, formatRelativeTime } from '@/lib/format'
import { formatSourceName } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { DriverChip } from './drivers'
import { ExposurePanel } from './exposure-panel'
import { NEWS_TO_MARKET_DRIVER } from './market-drivers'
import { useOpenMacroItem } from './open-item'
import { useMacroMoving } from './hooks'

const WINDOWS = [
  { label: '24h', hours: 24 },
  { label: '3d', hours: 72 },
  { label: '7d', hours: 168 },
]
const EVENTS_SHOWN = 6

/** The day's relevant macro news, grouped by what moved. */
export function WhatsMoving() {
  const [hours, setHours] = useState(24)
  const [showAll, setShowAll] = useState(false)
  const { open } = useOpenMacroItem()
  const [selected, setSelected] = useState<{ driver: string; direction: 'up' | 'down' } | null>(null)
  const query = useMacroMoving(hours)
  const data = query.data
  const events = data ? (showAll ? data.events : data.events.slice(0, EVENTS_SHOWN)) : []

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>What&apos;s moving</CardTitle>
          <CardDescription>
            {data
              ? `${data.relevant_items} relevant of ${data.items} macro headlines — the rest was filtered as noise.`
              : 'Relevant macro news, grouped by what moved.'}
          </CardDescription>
        </div>
        <div className="flex gap-1">
          {WINDOWS.map((w) => (
            <Button
              key={w.hours}
              size="sm"
              variant={hours === w.hours ? 'secondary' : 'ghost'}
              onClick={() => setHours(w.hours)}
            >
              {w.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isPending && <Skeleton className="h-40 rounded-lg" />}
        {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
        {data && data.drivers.length === 0 && (
          <EmptyState
            title="Nothing market-moving in this window"
            description="No headline was read as relevant to US sectors. Try a longer window."
          />
        )}
        {data && data.drivers.length > 0 && (
          <>
            <div className="flex flex-wrap gap-1.5" aria-label="Drivers">
              {data.drivers.map((group) => {
                const market = NEWS_TO_MARKET_DRIVER[group.driver]
                const isSelected =
                  market !== undefined &&
                  selected !== null &&
                  selected.driver === market &&
                  selected.direction === group.direction
                const chip = (
                  <DriverChip
                    driver={group.driver}
                    direction={group.direction}
                    count={group.events}
                    className={cn(
                      group.magnitude === 'major' && 'ring-foreground/30 ring-1',
                      market && 'hover:bg-muted/70 cursor-pointer',
                      isSelected && 'bg-foreground text-background',
                    )}
                  />
                )
                return market ? (
                  <button
                    key={`${group.driver}-${group.direction}`}
                    type="button"
                    aria-pressed={isSelected}
                    title="Who it moves (measured)"
                    onClick={() => setSelected(isSelected ? null : { driver: market, direction: group.direction })}
                  >
                    {chip}
                  </button>
                ) : (
                  <span key={`${group.driver}-${group.direction}`}>{chip}</span>
                )
              })}
            </div>
            {selected ? (
              <div className="bg-muted/30 rounded-lg border p-3">
                <h3 className="mb-2 text-sm font-semibold">Most exposed (measured)</h3>
                <ExposurePanel driver={selected.driver} direction={selected.direction} />
              </div>
            ) : (
              data.drivers.some((g) => NEWS_TO_MARKET_DRIVER[g.driver]) && (
                <p className="text-muted-foreground text-xs">Click Oil, Rates, Yields or Dollar to see who it moves.</p>
              )
            )}
            <ul className="divide-y">
              {events.map((event) => (
                <li
                  key={event.id}
                  role="button"
                  tabIndex={0}
                  aria-label={event.title}
                  className="hover:bg-muted/40 -mx-2 cursor-pointer space-y-1 rounded-md px-2 py-2.5 transition-colors"
                  onClick={() => open(event.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      open(event.id)
                    }
                  }}
                >
                  <p className="text-sm font-medium leading-snug">{event.title}</p>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                    {event.magnitude === 'major' && (
                      <span className="text-foreground font-semibold uppercase">Major</span>
                    )}
                    {event.market_wrap && <span className="rounded border px-1">Market wrap</span>}
                    <span>{formatSourceName(event.source)}</span>
                    {event.also_reported > 0 && <span>+{event.also_reported} similar</span>}
                    <span title={formatEasternDateTime(event.published_at)}>
                      {formatRelativeTime(event.published_at)}
                    </span>
                    {Object.entries(event.drivers).map(([driver, direction]) => (
                      <DriverChip key={driver} driver={driver} direction={direction} />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            {data.events.length > EVENTS_SHOWN && (
              <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show fewer' : `Show all ${data.events.length} events`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
