import { useState } from 'react'
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Minus,
  RefreshCw,
  TrendingUp,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/shared/error-state'
import { formatCompactCurrency, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  MarketEventBigEarningsOut,
  MarketEventOut,
  MarketEventSectorImpactOut,
  MarketEventStance,
} from '@/types/api'
import {
  type DayInfo,
  getDayInfo,
  MARKET_EVENT_CATEGORY_EXPLANATION,
  MARKET_EVENT_CATEGORY_LABEL,
  MARKET_EVENT_STANCE_EXPLANATION,
  MARKET_EVENT_STANCE_LABEL,
  URGENCY_ACCENT_CLASSES,
  URGENCY_BADGE_CLASSES,
} from './constants'
import { useMarketEvents, useRefreshMarketEvents } from './hooks'

// Same emerald/red polarity pair used everywhere else for a bullish/bearish
// read (lean-colors.ts, macro-sector-impact.tsx) -- applied here to a single
// sector's predicted direction, not to the event itself (stance stays
// neutral-toned, see constants.ts).
const DIRECTION_CLASSES: Record<'positive' | 'negative', string> = {
  positive: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent',
  negative: 'bg-red-500/15 text-red-600 dark:text-red-400 border-transparent',
}

// One combined, chronologically-sortable shape for the two independent data
// sources this page shows -- Google-Finance-sourced macro events and our own
// EarningsEvent-sourced big-cap earnings (see CLAUDE.md's "Market Events"
// section for why earnings are deliberately NOT asked of Google Finance).
// Interleaving them into one timeline is what actually answers "when does
// this happen" -- two separate lists would force a reader to cross-reference
// dates by hand.
type AgendaItem =
  | { kind: 'macro'; date: string; event: MarketEventOut }
  | { kind: 'earnings'; date: string; item: MarketEventBigEarningsOut }

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-border bg-card rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
    </div>
  )
}

function AgendaSummaryStats({
  events,
  bigEarnings,
  nextItem,
}: {
  events: MarketEventOut[]
  bigEarnings: MarketEventBigEarningsOut[]
  nextItem: AgendaItem | null
}) {
  const allImpacts = events.flatMap((e) => e.sector_impacts)
  const positiveCalls = allImpacts.filter((i) => i.predicted_direction === 'positive').length
  const negativeCalls = allImpacts.filter((i) => i.predicted_direction === 'negative').length
  const graded = allImpacts.filter((i) => i.graded)
  const hits = graded.filter((i) => i.hit === true).length
  const misses = graded.filter((i) => i.hit === false).length

  const nextInfo = nextItem ? getDayInfo(nextItem.date) : null
  const nextLabel =
    nextItem?.kind === 'macro'
      ? nextItem.event.event_name
      : nextItem?.kind === 'earnings'
        ? `${nextItem.item.ticker} earnings`
        : undefined

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatTile label="Macro events" value={String(events.length)} />
      <StatTile label="Big earnings" value={String(bigEarnings.length)} />
      <StatTile label="Next up" value={nextInfo ? nextInfo.relative : '—'} hint={nextLabel} />
      <StatTile
        label="Sector calls"
        value={`${positiveCalls} up / ${negativeCalls} down`}
        hint="Predicted direction, not a return"
      />
      <StatTile
        label="Graded so far"
        value={graded.length === 0 ? 'None yet' : `${hits} of ${graded.length} hit`}
        hint={graded.length > 0 ? `${misses} missed, rest flat` : 'Grades in after the window passes'}
      />
    </div>
  )
}

function StanceBadge({ stance }: { stance: MarketEventStance }) {
  return <Badge variant="secondary">{MARKET_EVENT_STANCE_LABEL[stance]}</Badge>
}

function OutcomeNote({ impact }: { impact: MarketEventSectorImpactOut }) {
  if (!impact.graded) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1">
        <Minus className="size-3" aria-hidden="true" /> not graded yet
      </span>
    )
  }
  if (impact.actual_direction === 'flat' || impact.hit === null) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1">
        <Minus className="size-3" aria-hidden="true" /> sector barely moved (
        {impact.trend_pct_before?.toFixed(1)}% → {impact.trend_pct_after?.toFixed(1)}%) -- graded
        flat
      </span>
    )
  }
  return impact.hit ? (
    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
      <Check className="size-3" aria-hidden="true" /> moved as predicted (
      {impact.trend_pct_before?.toFixed(1)}% → {impact.trend_pct_after?.toFixed(1)}%)
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
      <X className="size-3" aria-hidden="true" /> moved the opposite way (
      {impact.trend_pct_before?.toFixed(1)}% → {impact.trend_pct_after?.toFixed(1)}%)
    </span>
  )
}

function SectorImpactRow({ impact }: { impact: MarketEventSectorImpactOut }) {
  return (
    <div className="space-y-1 py-2 first:pt-0">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Badge className={cn('border-transparent', DIRECTION_CLASSES[impact.predicted_direction])}>
          {impact.sector} · predicted {impact.predicted_direction}
        </Badge>
        {impact.current_trend_pct !== null && (
          <span className="text-muted-foreground">
            currently {impact.current_trend_pct.toFixed(1)}% (20d trend)
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-sm">{impact.rationale}</p>
      <p className="text-xs">
        <OutcomeNote impact={impact} />
      </p>
    </div>
  )
}

function EventCard({ event, defaultExpanded }: { event: MarketEventOut; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="border-border rounded-lg border">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="hover:bg-muted/50 flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors"
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">{event.event_name}</span>
            <Badge variant="outline">{MARKET_EVENT_CATEGORY_LABEL[event.category]}</Badge>
            <StanceBadge stance={event.stance} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{event.reason}</p>
        </div>
      </button>
      {expanded && (
        <div className="border-border space-y-3 border-t px-3 py-3 pl-9">
          <div className="space-y-1 text-xs">
            <p>
              <span className="font-medium">{MARKET_EVENT_CATEGORY_LABEL[event.category]}:</span>{' '}
              <span className="text-muted-foreground">
                {MARKET_EVENT_CATEGORY_EXPLANATION[event.category]}
              </span>
            </p>
            <p>
              <span className="font-medium">{MARKET_EVENT_STANCE_LABEL[event.stance]}:</span>{' '}
              <span className="text-muted-foreground">
                {MARKET_EVENT_STANCE_EXPLANATION[event.stance]}
              </span>
            </p>
          </div>
          {event.sector_impacts.length > 0 ? (
            <div>
              <p className="text-xs font-medium">Likely sector impact</p>
              <div className="divide-border divide-y">
                {event.sector_impacts.map((impact) => (
                  <SectorImpactRow key={impact.sector} impact={impact} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              No sector transmission mapped for this category.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function EarningsCard({ item }: { item: MarketEventBigEarningsOut }) {
  return (
    <div className="border-border flex items-center gap-2.5 rounded-lg border px-3 py-2.5">
      <TrendingUp className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium">{item.ticker}</span>
          <Badge variant="outline">Earnings</Badge>
          {item.sector && <span className="text-muted-foreground text-xs">{item.sector}</span>}
        </div>
      </div>
      <div className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
        {item.bmo_amc !== 'unknown' && <span className="uppercase">{item.bmo_amc}</span>}
        <span className="tabular-nums">{formatCompactCurrency(item.market_cap)}</span>
      </div>
    </div>
  )
}

function DayGroupHeader({ dayInfo }: { dayInfo: DayInfo }) {
  return (
    <div
      className={cn(
        'flex items-baseline gap-2 border-l-4 pl-2.5',
        URGENCY_ACCENT_CLASSES[dayInfo.urgency],
      )}
    >
      <span className="text-sm font-semibold">
        {dayInfo.weekday}, {dayInfo.monthDay}
      </span>
      <Badge className={cn('border-transparent', URGENCY_BADGE_CLASSES[dayInfo.urgency])}>
        {dayInfo.relative}
      </Badge>
    </div>
  )
}

function HowThisWorks() {
  const [open, setOpen] = useState(true)
  return (
    <div className="border-border bg-muted/30 rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
        )}
        <Info className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        How this calendar is built
      </button>
      {open && (
        <ol className="text-muted-foreground space-y-2 px-3 pb-3 pl-9 text-xs [&>li]:list-decimal">
          <li>
            Once a day, Google Finance Research is asked which scheduled US macroeconomic events
            in the next 7 days could move markets -- Fed and other central bank decisions,
            inflation/jobs data, and similar.
          </li>
          <li>
            Each event's category and directional stance are matched against MarketScout's own
            hand-authored sector transmission rules -- the same rules behind{' '}
            <span className="font-medium">/v1/macro/sector-impact</span> on the Macro page -- to
            work out which sectors it plausibly hits and which way, deterministically, with no
            extra AI guessing involved.
          </li>
          <li>
            A few days after each event's date, MarketScout checks what the affected sector ETFs
            actually did and grades the call: moved as predicted, moved the opposite way, or
            barely moved at all (graded flat, not counted either way).
          </li>
          <li>
            "Big earnings" is a separate list, deliberately not asked of Google Finance at all --
            it's every US large/mega-cap ($100B+) tracked ticker reporting this week, read
            straight from MarketScout's own earnings calendar and market-cap data. More reliable
            for exact tickers and dates than a freeform AI answer.
          </li>
        </ol>
      )}
    </div>
  )
}

export function MarketEventsList() {
  const { data, isPending, isError, error } = useMarketEvents()
  const refresh = useRefreshMarketEvents()

  const agendaItems: AgendaItem[] = [
    ...(data?.events ?? []).map((event): AgendaItem => ({ kind: 'macro', date: event.event_date, event })),
    ...(data?.big_earnings ?? []).map(
      (item): AgendaItem => ({ kind: 'earnings', date: item.event_date, item }),
    ),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const groups: { dayInfo: DayInfo; items: AgendaItem[] }[] = []
  for (const item of agendaItems) {
    const dayInfo = getDayInfo(item.date)
    const lastGroup = groups[groups.length - 1]
    if (lastGroup && lastGroup.dayInfo.monthDay === dayInfo.monthDay) {
      lastGroup.items.push(item)
    } else {
      groups.push({ dayInfo, items: [item] })
    }
  }

  const hasNothing = data ? data.events.length === 0 && data.big_earnings.length === 0 : false

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>This week's calendar</CardTitle>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Refresh"
          disabled={refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          <RefreshCw className={cn(refresh.isPending && 'animate-spin')} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {(isPending || refresh.isPending) && (
          <div className="border-border flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <Calendar className="text-muted-foreground size-5 animate-pulse" aria-hidden="true" />
            <p className="text-muted-foreground text-sm">
              {refresh.isPending ? 'Asking Google Finance Research…' : 'Loading…'}
            </p>
          </div>
        )}

        {isError && !isPending && <ErrorState error={error} />}
        {refresh.isError && <ErrorState error={refresh.error} onRetry={() => refresh.mutate()} />}

        {data && !isPending && !refresh.isPending && (
          <>
            {hasNothing ? (
              <p className="text-muted-foreground text-sm">
                {data.stale
                  ? "No macro events generated yet -- click refresh to run today's scan. Big earnings show automatically once a tracked mega-cap reports this week."
                  : 'Nothing on the calendar for this date.'}
              </p>
            ) : (
              <>
                <AgendaSummaryStats
                  events={data.events}
                  bigEarnings={data.big_earnings}
                  nextItem={agendaItems[0] ?? null}
                />
                <div className="space-y-4">
                  {groups.map((group, groupIndex) => (
                    <div key={group.dayInfo.monthDay} className="space-y-2">
                      <DayGroupHeader dayInfo={group.dayInfo} />
                      <div className="space-y-1.5">
                        {group.items.map((item) =>
                          item.kind === 'macro' ? (
                            <EventCard
                              key={`macro-${item.event.event_name}-${item.event.event_date}`}
                              event={item.event}
                              defaultExpanded={groupIndex === 0}
                            />
                          ) : (
                            <EarningsCard
                              key={`earnings-${item.item.ticker}-${item.item.event_date}`}
                              item={item.item}
                            />
                          ),
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {data.stale && data.events.length === 0 && (
                  <p className="text-muted-foreground text-xs">
                    Macro events haven't generated yet today -- only big earnings are shown below.
                  </p>
                )}
              </>
            )}

            {data.source_error && (
              <p className="text-muted-foreground text-xs">Source error: {data.source_error}</p>
            )}
            {data.parse_warning && (
              <p className="text-muted-foreground text-xs">{data.parse_warning}</p>
            )}

            <HowThisWorks />

            <div className="border-border space-y-1 border-t pt-3 text-xs">
              <p className="text-muted-foreground">{data.disclaimer}</p>
              <p className="text-muted-foreground">{data.outcome_caveat}</p>
              {data.generated_at && (
                <p className="text-muted-foreground">
                  Generated {formatRelativeTime(data.generated_at)}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
