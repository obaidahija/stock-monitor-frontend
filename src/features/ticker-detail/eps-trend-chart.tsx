import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatSignedPct } from '@/lib/format'
import {
  classifyEarnings,
  EARNINGS_RESULT_DOT_CLASSES,
  EARNINGS_RESULT_LABEL,
  EARNINGS_RESULT_TEXT_CLASSES,
} from '@/lib/earnings-colors'
import { cn } from '@/lib/utils'
import type { YfEarningsEventOut } from '@/types/api'

// The backend's yfinance snapshot already caps at ~12 quarters
// (app/adapters/yf.py's _safe_earnings_history), but this re-slices
// defensively so the chart's x-axis never gets denser than it was designed
// for even if that upstream limit ever changes.
const MAX_QUARTERS = 12

const CHART_WIDTH = 640
const CHART_HEIGHT = 210
const PADDING_X = 20
const PADDING_TOP = 16
// Room for two stacked x-axis rows: the quarter label, then the surprise %
// directly under it.
const PADDING_BOTTOM = 50
const ACTUAL_LINE_CLASS = 'stroke-[#2a78d6] dark:stroke-[#3987e5]'
const ACTUAL_FILL_CLASS = 'fill-[#2a78d6] dark:fill-[#3987e5]'

type Point = { x: number; y: number }

function buildPath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
}

function quarterLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  const quarter = Math.floor(d.getMonth() / 3) + 1
  return `Q${quarter}'${String(d.getFullYear()).slice(-2)}`
}

// yfinance's get_earnings_dates history isn't guaranteed to arrive in any
// particular order, so this always re-sorts chronologically ascending before
// laying anything out on the x-axis.
export function EpsTrendChart({ events }: { events: YfEarningsEventOut[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const sorted = [...events]
    .filter((e) => e.eps_estimate !== null || e.eps_actual !== null)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(-MAX_QUARTERS)

  if (sorted.length < 2) return null

  const values = sorted
    .flatMap((e) => [e.eps_estimate, e.eps_actual])
    .filter((v): v is number => v !== null)
  const min = Math.min(...values, 0)
  const max = Math.max(...values)
  const range = max - min || 1

  const plotWidth = CHART_WIDTH - PADDING_X * 2
  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const slotWidth = plotWidth / sorted.length
  const xFor = (i: number) =>
    sorted.length === 1 ? PADDING_X + plotWidth / 2 : PADDING_X + (i / (sorted.length - 1)) * plotWidth
  const yFor = (v: number) => PADDING_TOP + plotHeight - ((v - min) / range) * plotHeight

  const estimatePoints = sorted.map((e, i) =>
    e.eps_estimate !== null ? { x: xFor(i), y: yFor(e.eps_estimate) } : null,
  )
  const actualPoints = sorted.map((e, i) =>
    e.eps_actual !== null ? { x: xFor(i), y: yFor(e.eps_actual) } : null,
  )

  const hovered = hoveredIndex !== null ? sorted[hoveredIndex] : null
  const hoveredClassification = hovered
    ? classifyEarnings(hovered.eps_actual, hovered.eps_estimate)
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Earnings history — last {sorted.length} quarters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full"
          role="img"
          aria-label="EPS estimate vs actual over the last several quarters"
        >
          <line
            x1={PADDING_X}
            y1={PADDING_TOP + plotHeight}
            x2={CHART_WIDTH - PADDING_X}
            y2={PADDING_TOP + plotHeight}
            className="stroke-border"
            strokeWidth={1}
          />
          <path
            d={buildPath(estimatePoints.filter((p): p is Point => p !== null))}
            className="fill-none stroke-muted-foreground/50"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          <path
            d={buildPath(actualPoints.filter((p): p is Point => p !== null))}
            className={cn('fill-none', ACTUAL_LINE_CLASS)}
            strokeWidth={2}
          />
          {sorted.map((e, i) => {
            const est = estimatePoints[i]
            const act = actualPoints[i]
            const { result, surprisePct } = classifyEarnings(e.eps_actual, e.eps_estimate)
            const isHovered = hoveredIndex === i
            return (
              <g key={e.event_date}>
                {est && (
                  <circle
                    cx={est.x}
                    cy={est.y}
                    r={isHovered ? 4 : 2.5}
                    className="fill-muted-foreground/60"
                  />
                )}
                {act && (
                  <circle
                    cx={act.x}
                    cy={act.y}
                    r={isHovered ? 5 : 3}
                    className={result ? EARNINGS_RESULT_DOT_CLASSES[result] : ACTUAL_FILL_CLASS}
                  />
                )}
                <text
                  x={xFor(i)}
                  y={CHART_HEIGHT - PADDING_BOTTOM + 16}
                  textAnchor="middle"
                  className={cn(
                    'fill-muted-foreground text-[9px]',
                    isHovered && 'fill-foreground font-medium',
                  )}
                >
                  {quarterLabel(e.event_date)}
                </text>
                {result && surprisePct !== null && (
                  <text
                    x={xFor(i)}
                    y={CHART_HEIGHT - PADDING_BOTTOM + 27}
                    textAnchor="middle"
                    className={cn(
                      'fill-current text-[7px] font-medium',
                      EARNINGS_RESULT_TEXT_CLASSES[result],
                    )}
                  >
                    {EARNINGS_RESULT_LABEL[result]} {formatSignedPct(surprisePct, 1)}
                  </text>
                )}
                <rect
                  x={xFor(i) - slotWidth / 2}
                  y={0}
                  width={slotWidth}
                  height={CHART_HEIGHT}
                  className="fill-transparent"
                  tabIndex={0}
                  onPointerEnter={() => setHoveredIndex(i)}
                  onPointerLeave={() => setHoveredIndex(null)}
                  onFocus={() => setHoveredIndex(i)}
                  onBlur={() => setHoveredIndex(null)}
                />
              </g>
            )
          })}
        </svg>
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <svg width="16" height="8" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="16"
                  y2="4"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  className="stroke-muted-foreground/60"
                />
              </svg>
              Estimate
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg width="16" height="8" aria-hidden="true">
                <line x1="0" y1="4" x2="16" y2="4" strokeWidth="2" className={ACTUAL_LINE_CLASS} />
              </svg>
              Actual
            </span>
          </div>
          <span>yfinance, reference only</span>
        </div>
        <p className="text-muted-foreground min-h-4 text-xs">
          {hovered ? (
            <>
              <span className="font-medium">{quarterLabel(hovered.event_date)}</span> ({hovered.event_date})
              {' — '}est {hovered.eps_estimate ?? '—'} / actual {hovered.eps_actual ?? '—'}
              {hoveredClassification?.surprisePct !== null && hoveredClassification && (
                <> ({formatSignedPct(hoveredClassification.surprisePct, 1)})</>
              )}
            </>
          ) : (
            'Hover or focus a point for exact figures.'
          )}
        </p>
      </CardContent>
    </Card>
  )
}
