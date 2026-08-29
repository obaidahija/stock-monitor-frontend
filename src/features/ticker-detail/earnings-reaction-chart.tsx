import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  classifyEarnings,
  EARNINGS_RESULT_BADGE_CLASSES,
  EARNINGS_RESULT_LABEL,
  EARNINGS_RESULT_TEXT_CLASSES,
} from '@/lib/earnings-colors'
import { formatDate, formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  EarningsReactionEventOut,
  EarningsReactionOut,
  EarningsReactionPointOut,
  EarningsResult,
} from '@/types/api'

const CHART_WIDTH = 760
const CHART_HEIGHT = 280
const PADDING_LEFT = 46
const PADDING_RIGHT = 16
const PADDING_TOP = 18
const PADDING_BOTTOM = 38
const AVERAGE_LINE_CLASS = 'stroke-[#2a78d6] dark:stroke-[#3987e5]'
const AVERAGE_FILL_CLASS = 'fill-[#2a78d6] dark:fill-[#3987e5]'
const BAND_FILL_CLASS = 'fill-[#2a78d6]/15 dark:fill-[#3987e5]/15'

type Point = { x: number; y: number }

function buildPath(points: Point[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ')
}

function offsetLabel(offset: number): string {
  if (offset === 0) return '0'
  return offset > 0 ? `+${offset}d` : `${offset}d`
}

function signedOffsetLabel(offset: number): string {
  return `${offset >= 0 ? '+' : ''}${offset}d`
}

function tickOffsets(points: EarningsReactionPointOut[]): number[] {
  if (points.length <= 12) return points.map((point) => point.offset)

  const step = Math.ceil((points.length - 1) / 10)
  const ticks = new Set<number>([points[0].offset, 0, points[points.length - 1].offset])
  for (let index = 0; index < points.length; index += step) ticks.add(points[index].offset)
  return [...ticks].sort((a, b) => a - b)
}

function resultFor(event: EarningsReactionEventOut): EarningsResult | null {
  return classifyEarnings(event.eps_actual, event.eps_estimate).result
}

function eventKey(event: EarningsReactionEventOut): string {
  return `${event.event_date}-${event.bmo_amc}`
}

// Matches the Discover table's Tracked Universe P/E convention exactly
// (universe-table.tsx): one decimal place, multiplication-sign suffix.
function formatRatio(value: number | null): string {
  return value !== null ? `${value.toFixed(1)}×` : '—'
}

function eventLineColorClass(event: EarningsReactionEventOut): string {
  if (event.is_upcoming) return 'stroke-current text-amber-500'
  const result = resultFor(event)
  return cn('stroke-current', result ? EARNINGS_RESULT_TEXT_CLASSES[result] : 'text-muted-foreground')
}

// The most recent offset an in-progress (upcoming) quarter's curve actually
// reaches -- i.e. "where things stand as of today" for that report's lead-up.
function latestPointPct(event: EarningsReactionEventOut): number | null {
  if (event.points.length === 0) return null
  return event.points.reduce((latest, point) => (point.offset > latest.offset ? point : latest))
    .pct
}

// Shared by the chart's "Today" marker and the table's "Today" column so
// they always agree on exactly the same offset.
function todayOffsetFor(data: EarningsReactionOut): number | null {
  // Backend-computed trading-day offset of today relative to whichever
  // nearby report is the target -- negative while counting down to an
  // upcoming report, positive if today is past a recently reported one and
  // there's no report close enough on either side otherwise. Every
  // quarter's own baseline sits at this same offset, so the marker and each
  // curve's 0% point always agree on where "today" actually sits.
  const offset = data.today_offset
  if (offset === null || offset < -data.before_days || offset > data.after_days) return null
  return offset
}

// A day-over-day move in the aggregate average this large is worth
// surfacing as its own column even when it falls in an otherwise-skipped
// gap between the fixed milestones below.
const SIGNIFICANT_MOVE_THRESHOLD_PCT = 3

function significantMoveOffsets(data: EarningsReactionOut): Set<number> {
  const sorted = [...data.points].sort((a, b) => a.offset - b.offset)
  const flagged = new Set<number>()
  for (let index = 1; index < sorted.length; index++) {
    if (
      Math.abs(sorted[index].avg_pct - sorted[index - 1].avg_pct) >= SIGNIFICANT_MOVE_THRESHOLD_PCT
    ) {
      flagged.add(sorted[index].offset)
    }
  }
  return flagged
}

function milestoneOffsets(data: EarningsReactionOut, flagged: Set<number>): number[] {
  const available = new Set(data.points.map((point) => point.offset))
  const leadUpOffsets =
    data.before_days <= 7
      ? Array.from({ length: data.before_days }, (_, index) => -data.before_days + index)
      : [-data.before_days, -data.before_days + 1, -14, -7, -4, -2, -1]
  const today = todayOffsetFor(data)
  const candidates = today !== null ? [...leadUpOffsets, today] : leadUpOffsets
  return [...new Set([...candidates, 0, 1, 2, 4, 7, 14, 21, 30, ...flagged])]
    .filter((offset) => available.has(offset))
    .sort((a, b) => a - b)
}

// Every row in this table is a *past* report, so columns are always labeled
// relative to that report's own reaction day -- never "Today"/"In Nd", which
// would wrongly imply the value is N days from now rather than N trading
// days from a report that already happened. (The chart's left-edge tick
// still gets a "Today" label separately -- that one's accurate, since the
// window's left edge is genuinely built from today's countdown.)
// Every column is labeled relative to each report's own earnings day (offset
// 0), including "Today" -- which is just whichever column happens to match
// today's own position on that same axis. Columns to Today's left are
// further before earnings (chronologically earlier); columns to its right
// are closer to earnings (chronologically later), even though both read
// "before" -- so Today's own signed position is spelled out in its label
// to make that left/right relationship unambiguous at a glance.
function milestoneLabel(offset: number, isToday: boolean): string {
  if (isToday) return `Today (${signedOffsetLabel(offset)})`
  if (offset < 0) return `${Math.abs(offset)}d before`
  if (offset === 0) return 'Earnings day'
  return offsetLabel(offset)
}

// Distinct from the row-hover tint (bg-muted/60) so the two can combine
// (a hovered row still shows which column is "today") without one hiding
// the other.
const TODAY_COLUMN_CLASS = 'bg-amber-500/10'

function ReactionTable({
  data,
  hoveredEventKey,
  onHoverEvent,
}: {
  data: EarningsReactionOut
  hoveredEventKey: string | null
  onHoverEvent: (key: string | null) => void
}) {
  const flaggedOffsets = significantMoveOffsets(data)
  const milestones = milestoneOffsets(data, flaggedOffsets)
  const todayOffset = todayOffsetFor(data)
  const todayHeadRef = useRef<HTMLTableCellElement | null>(null)

  useEffect(() => {
    todayHeadRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    })
    // Re-run whenever the ticker or the resolved "today" offset changes --
    // not on every re-render (e.g. row hover), which would fight the user's
    // own scroll position.
  }, [data.ticker, todayOffset])

  return (
    <div className="border-border rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Report</TableHead>
            <TableHead>Result</TableHead>
            <TableHead className="text-right whitespace-nowrap">P/E</TableHead>
            <TableHead className="text-right whitespace-nowrap">Volume</TableHead>
            {milestones.map((offset) => {
              const isToday = offset === todayOffset
              return (
                <TableHead
                  key={offset}
                  ref={isToday ? todayHeadRef : undefined}
                  className={cn(
                    'text-right whitespace-nowrap',
                    isToday && cn(TODAY_COLUMN_CLASS, 'text-amber-600 dark:text-amber-400'),
                  )}
                >
                  {milestoneLabel(offset, isToday)}
                  {flaggedOffsets.has(offset) && (
                    <span
                      className="ml-1 text-amber-500"
                      title={`Day-over-day average move of ${SIGNIFICANT_MOVE_THRESHOLD_PCT}%+`}
                    >
                      !!
                    </span>
                  )}
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.events.map((event) => {
            const result = resultFor(event)
            const key = eventKey(event)
            const values = new Map(event.points.map((point) => [point.offset, point.pct]))
            return (
              <TableRow
                key={key}
                className={cn(
                  'cursor-default transition-colors',
                  hoveredEventKey === key && 'bg-muted/60',
                )}
                onPointerEnter={() => onHoverEvent(key)}
                onPointerLeave={() => onHoverEvent(null)}
              >
                <TableCell className="whitespace-nowrap">
                  <span className="font-medium">{formatDate(event.event_date)}</span>{' '}
                  <span className="text-muted-foreground text-xs uppercase">{event.bmo_amc}</span>
                </TableCell>
                <TableCell>
                  {event.is_upcoming ? (
                    <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-amber-600 dark:text-amber-400">
                      Upcoming
                    </span>
                  ) : result ? (
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
                        EARNINGS_RESULT_BADGE_CLASSES[result],
                      )}
                    >
                      {EARNINGS_RESULT_LABEL[result]}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRatio(event.pe_ratio)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRatio(event.volume_ratio)}
                </TableCell>
                {milestones.map((offset) => (
                  <TableCell
                    key={offset}
                    className={cn(
                      'text-right tabular-nums',
                      offset === todayOffset && TODAY_COLUMN_CLASS,
                    )}
                  >
                    {values.has(offset) ? formatSignedPct(values.get(offset), 1) : '—'}
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function EarningsReactionChart({ data }: { data: EarningsReactionOut }) {
  const [hoveredOffset, setHoveredOffset] = useState<number | null>(null)
  const [hoveredEventKey, setHoveredEventKey] = useState<string | null>(null)

  if (data.points.length === 0) return null

  const points = [...data.points].sort((a, b) => a.offset - b.offset)
  const minimum = Math.min(0, ...points.map((point) => point.min_pct))
  const maximum = Math.max(0, ...points.map((point) => point.max_pct))
  const rawRange = maximum - minimum || 1
  const yPadding = rawRange * 0.08
  const yMin = minimum - yPadding
  const yMax = maximum + yPadding
  const yRange = yMax - yMin
  const plotWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT
  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const slotWidth = plotWidth / points.length
  const xForIndex = (index: number) =>
    points.length === 1
      ? PADDING_LEFT + plotWidth / 2
      : PADDING_LEFT + (index / (points.length - 1)) * plotWidth
  const indexByOffset = new Map(points.map((point, index) => [point.offset, index]))
  const xForOffset = (offset: number) => xForIndex(indexByOffset.get(offset) ?? 0)
  const yFor = (value: number) => PADDING_TOP + plotHeight - ((value - yMin) / yRange) * plotHeight
  const bandPoints = [
    ...points.map((point, index) => ({ x: xForIndex(index), y: yFor(point.min_pct) })),
    ...points
      .map((point, index) => ({ x: xForIndex(index), y: yFor(point.max_pct) }))
      .reverse(),
  ]
  const averagePoints = points.map((point, index) => ({
    x: xForIndex(index),
    y: yFor(point.avg_pct),
  }))
  const ticks = tickOffsets(points)
  const hovered = points.find((point) => point.offset === hoveredOffset) ?? null
  const hoveredEvent = data.events.find((event) => eventKey(event) === hoveredEventKey) ?? null
  // The window is a fixed before_days/after_days regardless of the actual
  // countdown, so "today" can land anywhere inside it (or outside it, for a
  // ticker further out than before_days) rather than always sitting at the
  // left edge.
  const todayOffset = todayOffsetFor(data)
  const showTodayMarker = todayOffset !== null

  // Draw the hovered quarter's line last so it renders on top of the others
  // it's meant to stand out from.
  const orderedEvents = hoveredEventKey
    ? [
        ...data.events.filter((event) => eventKey(event) !== hoveredEventKey),
        ...data.events.filter((event) => eventKey(event) === hoveredEventKey),
      ]
    : data.events

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Earnings reaction pattern — avg of last {data.events_used} reports</CardTitle>
        {data.current_pe_ratio !== null && (
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            Current P/E {formatRatio(data.current_pe_ratio)}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-xs">
          0% is today's own position in the cycle (the "Today" column/marker), applied to every
          quarter at that same relative point — not always the day before earnings. Offset 0 is
          the earnings reaction day itself. Recent reports use the trading sessions available so
          far, so the sample size can decrease at later offsets. Hover a row in the table below to
          track one quarter's line.
        </p>
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={`Average price reaction from ${data.before_days} trading days before earnings through ${data.after_days} trading days after earnings`}
        >
          <line
            x1={PADDING_LEFT}
            y1={yFor(0)}
            x2={CHART_WIDTH - PADDING_RIGHT}
            y2={yFor(0)}
            className="stroke-border"
            strokeWidth={1}
          />
          <text
            x={PADDING_LEFT - 6}
            y={yFor(0) + 3}
            textAnchor="end"
            className="fill-muted-foreground text-[8px]"
          >
            0%
          </text>
          <line
            x1={xForOffset(0)}
            y1={PADDING_TOP}
            x2={xForOffset(0)}
            y2={PADDING_TOP + plotHeight}
            className="stroke-muted-foreground/60"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
          <text
            x={xForOffset(0) + 6}
            y={PADDING_TOP + 10}
            textAnchor="start"
            className="fill-muted-foreground text-[8px] font-medium"
          >
            Earnings day
          </text>
          {showTodayMarker && todayOffset !== null && (
            <>
              <line
                x1={xForOffset(todayOffset)}
                y1={PADDING_TOP}
                x2={xForOffset(todayOffset)}
                y2={PADDING_TOP + plotHeight}
                className="stroke-amber-500/70"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
              <text
                x={xForOffset(todayOffset) + 6}
                y={PADDING_TOP + plotHeight - 6}
                textAnchor="start"
                className="fill-amber-600 dark:fill-amber-400 text-[8px] font-semibold"
              >
                Today
              </text>
            </>
          )}
          <path d={`${buildPath(bandPoints)} Z`} className={BAND_FILL_CLASS} stroke="none" />
          {orderedEvents.map((event) => {
            const key = eventKey(event)
            const isHovered = key === hoveredEventKey
            const isDimmed = hoveredEventKey !== null && !isHovered
            return (
              <path
                key={key}
                d={buildPath(
                  event.points.map((point) => ({ x: xForOffset(point.offset), y: yFor(point.pct) })),
                )}
                className={cn(
                  'fill-none',
                  eventLineColorClass(event),
                  isHovered ? 'opacity-100' : isDimmed ? 'opacity-10' : 'opacity-30',
                )}
                strokeWidth={isHovered ? 2.5 : 1.25}
                strokeDasharray={event.is_upcoming ? '4 2' : undefined}
              />
            )
          })}
          <path d={buildPath(averagePoints)} className={cn('fill-none', AVERAGE_LINE_CLASS)} strokeWidth={2.5} />
          {points.map((point, index) => {
            const isHovered = point.offset === hoveredOffset
            return (
              <circle
                key={point.offset}
                cx={xForIndex(index)}
                cy={yFor(point.avg_pct)}
                r={isHovered ? 4 : 2}
                className={AVERAGE_FILL_CLASS}
              />
            )
          })}
          {ticks.map((offset) => (
            <text
              key={offset}
              x={xForOffset(offset)}
              y={CHART_HEIGHT - 12}
              textAnchor="middle"
              className={cn(
                'fill-muted-foreground text-[8px]',
                offset === hoveredOffset && 'fill-foreground font-medium',
              )}
            >
              {offsetLabel(offset)}
            </text>
          ))}
          {points.map((point, index) => (
            <rect
              key={`hit-${point.offset}`}
              x={xForIndex(index) - slotWidth / 2}
              y={0}
              width={slotWidth}
              height={CHART_HEIGHT}
              className="fill-transparent"
              tabIndex={0}
              aria-label={`Offset ${signedOffsetLabel(point.offset)}, average ${formatSignedPct(point.avg_pct, 1)}`}
              onPointerEnter={() => setHoveredOffset(point.offset)}
              onPointerLeave={() => setHoveredOffset(null)}
              onFocus={() => setHoveredOffset(point.offset)}
              onBlur={() => setHoveredOffset(null)}
            />
          ))}
        </svg>

        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <svg width="16" height="8" aria-hidden="true">
                <line x1="0" y1="4" x2="16" y2="4" strokeWidth="2.5" className={AVERAGE_LINE_CLASS} />
              </svg>
              Average
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg width="16" height="8" aria-hidden="true">
                <rect width="16" height="8" rx="2" className={BAND_FILL_CLASS} />
              </svg>
              Min–max range
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg width="16" height="8" aria-hidden="true">
                <line x1="0" y1="4" x2="16" y2="4" strokeWidth="1.25" className="stroke-muted-foreground/50" />
              </svg>
              Individual quarters
            </span>
            {data.events.some((event) => event.is_upcoming) && (
              <span className="inline-flex items-center gap-1.5">
                <svg width="16" height="8" aria-hidden="true">
                  <line
                    x1="0"
                    y1="4"
                    x2="16"
                    y2="4"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    className="stroke-amber-500"
                  />
                </svg>
                Upcoming (so far)
              </span>
            )}
          </div>
          <span>yfinance, {data.events_used} quarters</span>
        </div>

        <p className="text-muted-foreground min-h-4 text-xs">
          {hoveredEvent ? (
            <>
              <span className="font-medium">{formatDate(hoveredEvent.event_date)}</span>{' '}
              <span className="uppercase">{hoveredEvent.bmo_amc}</span>
              {hoveredEvent.is_upcoming ? (
                <>
                  {' — upcoming report — so far '}
                  {formatSignedPct(latestPointPct(hoveredEvent), 1)}
                </>
              ) : (
                <>
                  {(() => {
                    const result = resultFor(hoveredEvent)
                    return result ? ` — ${EARNINGS_RESULT_LABEL[result]}` : ''
                  })()}
                  {' — earnings day '}
                  {formatSignedPct(
                    hoveredEvent.points.find((point) => point.offset === 0)?.pct ?? null,
                    1,
                  )}
                </>
              )}
            </>
          ) : hovered ? (
            `Offset ${signedOffsetLabel(hovered.offset)} — avg ${formatSignedPct(hovered.avg_pct, 1)} (range ${formatSignedPct(hovered.min_pct, 1)} to ${formatSignedPct(hovered.max_pct, 1)}, n=${hovered.n} quarters)`
          ) : (
            'Hover or focus an offset for the average and historical range.'
          )}
        </p>

        <ReactionTable data={data} hoveredEventKey={hoveredEventKey} onHoverEvent={setHoveredEventKey} />
      </CardContent>
    </Card>
  )
}
