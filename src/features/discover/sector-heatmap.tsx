import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { formatCurrency, formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSectorHeatmap, useSectorTickers } from './hooks'
import { squarify, type Rect } from './treemap-layout'
import type { UniverseTickerOut } from '@/types/api'

const MAP_HEIGHT = 360
const MIN_MAP_WIDTH = 720
const GROUP_HEADER_HEIGHT = 34
const GAP = 2
// Colour saturates at this absolute move; most sector/industry averages sit
// well inside +/-3%, so a wider scale would leave the whole map pale.
const MAX_ABS_CHANGE_PCT = 3
// One zoom step per wheel gesture: trackpads fire dozens of wheel events
// (plus inertia) per swipe, which would otherwise skip straight through
// every level.
const WHEEL_STEP_COOLDOWN_MS = 450

const UP_TEXT = 'text-emerald-600 dark:text-emerald-400'
const DOWN_TEXT = 'text-red-600 dark:text-red-400'

function moveColor(pct: number | null, base = 0.14, range = 0.6): CSSProperties {
  if (pct === null) return {}
  const intensity = Math.min(Math.abs(pct) / MAX_ABS_CHANGE_PCT, 1)
  const [r, g, b] = pct >= 0 ? [16, 185, 129] : [239, 68, 68]
  return { backgroundColor: `rgba(${r}, ${g}, ${b}, ${base + intensity * range})` }
}

function signedText(pct: number | null): string {
  if (pct === null) return 'text-muted-foreground'
  return pct >= 0 ? UP_TEXT : DOWN_TEXT
}

/** Where the map is zoomed: all sectors, one sector, or one industry. */
interface Zoom {
  sector: string | null
  industry: string | null
}

const TOP: Zoom = { sector: null, industry: null }

/** One labelled block on the map (a sector, or an industry once zoomed in)
 * with its child boxes inside. */
interface MapGroup {
  key: string
  name: string
  shortName?: string
  pct: number | null
  count: number
  advancers: number
  decliners: number
  topTicker: string | null
  topPct: number | null
  weight: number
  boxes: MapBox[]
  /** Where scrolling in over this block goes; absent at the deepest level. */
  dive?: Zoom
  isActive: boolean
  isDimmed: boolean
  onSelect: () => void
}

interface MapBox {
  key: string
  label: string
  pct: number | null
  weight: number
  /** Extra line shown only when the box has room (a ticker's price). */
  detail?: string
  title: string
  isActive: boolean
  onSelect: () => void
}

// Used only when a sector block is too narrow for its full name.
const SHORT_SECTOR_NAMES: Record<string, string> = {
  'Communication Services': 'Comm. Svcs',
  'Technology Services': 'Tech Svcs',
  'Electronic Technology': 'Elec. Tech',
  'Financial Services': 'Financials',
  'Consumer Cyclical': 'Cons. Cyclical',
  'Consumer Defensive': 'Cons. Defensive',
  'Basic Materials': 'Materials',
}

// Yahoo repeats the group in some industry names; inside its sector block the
// prefix is noise and costs the label its space.
const REDUNDANT_PREFIXES = ['REIT - ', 'Utilities - ']

function shortIndustryName(industry: string): string {
  const prefix = REDUNDANT_PREFIXES.find((p) => industry.startsWith(p))
  return prefix ? industry.slice(prefix.length) : industry
}

function breadthLine(count: number, advancers: number, decliners: number): string {
  const tickers = `${count} ticker${count === 1 ? '' : 's'}`
  return advancers + decliners > 0 ? `${tickers} · ${advancers}↑ ${decliners}↓` : tickers
}

/** Ticker boxes are sized by market cap (Finviz-style); a ticker with no
 * known cap takes the median of its peers so it neither vanishes nor
 * dominates. */
function tickerWeights(tickers: UniverseTickerOut[]): Map<string, number> {
  const caps = tickers
    .map((t) => t.market_cap ?? null)
    .filter((c): c is number => c !== null && c > 0)
    .sort((a, b) => a - b)
  const fallback = caps.length ? caps[Math.floor(caps.length / 2)] : 1
  return new Map(tickers.map((t) => [t.ticker, (t.market_cap ?? 0) > 0 ? t.market_cap! : fallback]))
}

/** Sector map: a nested treemap you can dive into. Top level is sectors
 * (area = ticker count) holding their industries; scrolling up over a
 * sector zooms to its industries holding their tickers (area = market cap);
 * once more zooms to a single industry's tickers. Scrolling down, the
 * breadcrumb, or the zoom-out button step back out. Every block header
 * carries its average move, breadth and top mover.
 *
 * Clicking a sector or industry filters the tracked-universe table below
 * via the `sector`/`industry` URL params; clicking a ticker opens it.
 * Zooming itself never changes the table. */
export function SectorHeatmap() {
  const { data, isPending, isError, error, refetch } = useSectorHeatmap()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const activeSector = searchParams.get('sector')
  const activeIndustry = searchParams.get('industry')

  const [zoom, setZoom] = useState<Zoom>(TOP)
  const [zoomDirection, setZoomDirection] = useState<'in' | 'out'>('in')
  const [origin, setOrigin] = useState('50% 50%')
  const { data: sectorTickers, isPending: tickersPending } = useSectorTickers(zoom.sector)

  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [data])

  // Unclassified carries no move data; it is counted in the header instead.
  const sectors = (data?.items ?? []).filter((s) => s.sector !== 'Unclassified')
  const advancers = sectors.reduce((sum, s) => sum + s.advancers, 0)
  const decliners = sectors.reduce((sum, s) => sum + s.decliners, 0)
  const zoomedSector = sectors.find((s) => s.sector === zoom.sector) ?? null

  // A sector that disappears from the data (refetch) can't stay zoomed.
  useEffect(() => {
    if (data && zoom.sector && !zoomedSector) setZoom(TOP)
  }, [data, zoom.sector, zoomedSector])

  function diveTo(next: Zoom, from?: HTMLElement | null) {
    const map = containerRef.current?.firstElementChild as HTMLElement | null
    if (from && map) {
      // Grow the new view out of the block that was zoomed into.
      const box = from.getBoundingClientRect()
      const mapBox = map.getBoundingClientRect()
      setOrigin(
        `${box.left + box.width / 2 - mapBox.left}px ${box.top + box.height / 2 - mapBox.top}px`,
      )
    } else {
      setOrigin('50% 50%')
    }
    setZoomDirection(next.industry || (next.sector && !zoom.sector) ? 'in' : 'out')
    setZoom(next)
  }

  function zoomOut() {
    if (zoom.industry) diveTo({ sector: zoom.sector, industry: null })
    else if (zoom.sector) diveTo(TOP)
  }

  // Wheel up over a block dives into it; wheel down steps out. At the top
  // (nothing to step out of) and the bottom (nothing to dive into) the
  // wheel is left alone so the page still scrolls normally.
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const diveRef = useRef({ diveTo, zoomOut })
  diveRef.current = { diveTo, zoomOut }
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let lockedUntil = 0
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const now = performance.now()
      if (now < lockedUntil) {
        e.preventDefault()
        return
      }
      if (e.deltaY < 0) {
        const target = (e.target as HTMLElement).closest<HTMLElement>('[data-dive]')
        if (!target?.dataset.dive) return
        e.preventDefault()
        lockedUntil = now + WHEEL_STEP_COOLDOWN_MS
        diveRef.current.diveTo(JSON.parse(target.dataset.dive) as Zoom, target)
      } else {
        if (!zoomRef.current.sector) return
        e.preventDefault()
        lockedUntil = now + WHEEL_STEP_COOLDOWN_MS
        diveRef.current.zoomOut()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [data])

  function setFilter(sector: string, industry: string | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      const isActive = activeSector === sector && activeIndustry === industry
      if (isActive) {
        // Clicking the active industry steps back out to its sector;
        // clicking the active sector clears the filter entirely.
        if (industry) next.delete('industry')
        else next.delete('sector')
      } else {
        next.set('sector', sector)
        if (industry) next.set('industry', industry)
        else next.delete('industry')
      }
      next.delete('page')
      return next
    })
  }

  // ---- Build the groups for the current zoom level ----
  let groups: MapGroup[] = []
  const tickersByIndustry = new Map<string, UniverseTickerOut[]>()
  for (const t of sectorTickers?.items ?? []) {
    const key = t.industry?.trim() || 'Other'
    tickersByIndustry.set(key, [...(tickersByIndustry.get(key) ?? []), t])
  }

  const tickerBoxes = (tickers: UniverseTickerOut[]): MapBox[] => {
    const weights = tickerWeights(tickers)
    return tickers.map((t) => ({
      key: t.ticker,
      label: t.ticker,
      pct: t.change_pct,
      weight: weights.get(t.ticker) ?? 1,
      detail: t.price !== null ? formatCurrency(t.price) : undefined,
      title: `${t.ticker}${t.company_name ? ` · ${t.company_name}` : ''}\n${formatSignedPct(t.change_pct)}${
        t.price !== null ? ` · ${formatCurrency(t.price)}` : ''
      }\nClick to open`,
      isActive: false,
      onSelect: () => navigate(`/stocks/${encodeURIComponent(t.ticker)}`),
    }))
  }

  if (!zoomedSector) {
    groups = sectors.map((s) => ({
      key: s.sector,
      name: s.sector,
      shortName: SHORT_SECTOR_NAMES[s.sector],
      pct: s.avg_change_pct,
      count: s.count,
      advancers: s.advancers,
      decliners: s.decliners,
      topTicker: s.top_ticker,
      topPct: s.top_ticker_change_pct,
      weight: s.count,
      dive: { sector: s.sector, industry: null },
      isActive: activeSector === s.sector && !activeIndustry,
      isDimmed: activeSector !== null && activeSector !== s.sector,
      onSelect: () => setFilter(s.sector, null),
      boxes: (s.industries?.length ? s.industries : [{ ...s, industry: s.sector }]).map((ind) => ({
        key: ind.industry,
        label: shortIndustryName(ind.industry),
        pct: ind.avg_change_pct,
        weight: ind.count,
        title: `${ind.industry} ${formatSignedPct(ind.avg_change_pct)}\n${breadthLine(ind.count, ind.advancers, ind.decliners)}${
          ind.top_ticker ? `\nTop mover: ${ind.top_ticker} ${formatSignedPct(ind.top_ticker_change_pct)}` : ''
        }`,
        isActive: activeSector === s.sector && activeIndustry === ind.industry,
        onSelect: () => setFilter(s.sector, ind.industry),
      })),
    }))
  } else {
    const industries = (zoomedSector.industries ?? []).filter(
      (ind) => !zoom.industry || ind.industry === zoom.industry,
    )
    groups = industries.map((ind) => ({
      key: ind.industry,
      name: shortIndustryName(ind.industry),
      pct: ind.avg_change_pct,
      count: ind.count,
      advancers: ind.advancers,
      decliners: ind.decliners,
      topTicker: ind.top_ticker,
      topPct: ind.top_ticker_change_pct,
      weight: ind.count,
      dive: zoom.industry ? undefined : { sector: zoomedSector.sector, industry: ind.industry },
      isActive: activeSector === zoomedSector.sector && activeIndustry === ind.industry,
      isDimmed: false,
      onSelect: () => setFilter(zoomedSector.sector, ind.industry),
      boxes: tickerBoxes(tickersByIndustry.get(ind.industry) ?? []),
    }))
  }

  const mapWidth = Math.max(width, MIN_MAP_WIDTH)
  const groupRects =
    width > 0
      ? squarify(
          groups.map((g) => g.weight),
          { x: 0, y: 0, w: mapWidth, h: MAP_HEIGHT },
        )
      : []
  const zoomKey = `${zoom.sector ?? ''}|${zoom.industry ?? ''}`
  const zoomedIndustry = zoom.industry
    ? zoomedSector?.industries?.find((ind) => ind.industry === zoom.industry)
    : undefined

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <nav className="flex min-w-0 items-center gap-1 text-xs" aria-label="Sector map zoom">
          <button
            type="button"
            onClick={() => diveTo(TOP)}
            disabled={!zoom.sector}
            className={cn(
              'text-muted-foreground font-semibold tracking-wide uppercase',
              zoom.sector && 'hover:text-foreground cursor-pointer hover:underline',
            )}
          >
            Sector map
          </button>
          {zoomedSector && (
            <>
              <ChevronRight className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
              <button
                type="button"
                onClick={() => diveTo({ sector: zoomedSector.sector, industry: null })}
                disabled={!zoom.industry}
                className={cn('font-semibold', zoom.industry && 'cursor-pointer hover:underline')}
              >
                {zoomedSector.sector}
              </button>
              <span className={cn('font-semibold tabular-nums', signedText(zoomedSector.avg_change_pct))}>
                {formatSignedPct(zoomedSector.avg_change_pct)}
              </span>
            </>
          )}
          {zoomedIndustry && (
            <>
              <ChevronRight className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate font-semibold">{zoomedIndustry.industry}</span>
              <span className={cn('font-semibold tabular-nums', signedText(zoomedIndustry.avg_change_pct))}>
                {formatSignedPct(zoomedIndustry.avg_change_pct)}
              </span>
            </>
          )}
          {zoom.sector && (
            <button
              type="button"
              onClick={zoomOut}
              className="text-muted-foreground hover:text-foreground hover:bg-muted ml-1 inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5"
            >
              <ZoomOut className="size-3.5" aria-hidden="true" />
              Zoom out
            </button>
          )}
        </nav>
        <div className="text-muted-foreground flex items-center gap-3 text-xs tabular-nums">
          {data && !zoom.sector && (
            <span>
              {data.total_tickers.toLocaleString()} tickers
              {advancers + decliners > 0 && (
                <>
                  {' · '}
                  <span className={UP_TEXT}>{advancers}↑</span>{' '}
                  <span className={DOWN_TEXT}>{decliners}↓</span>
                </>
              )}
              {data.unclassified_tickers > 0 && ` · ${data.unclassified_tickers} unclassified`}
            </span>
          )}
          {zoomedSector && !zoomedIndustry && (
            <span>{breadthLine(zoomedSector.count, zoomedSector.advancers, zoomedSector.decliners)}</span>
          )}
          {zoomedIndustry && (
            <span>{breadthLine(zoomedIndustry.count, zoomedIndustry.advancers, zoomedIndustry.decliners)}</span>
          )}
          <span className="hidden md:inline">
            {zoom.industry ? 'Scroll down to zoom out' : 'Scroll to zoom in/out'}
          </span>
          <Legend />
        </div>
      </div>

      {isPending && <Skeleton className="rounded-lg" style={{ height: MAP_HEIGHT }} />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && sectors.length === 0 && (
        <p className="text-muted-foreground text-sm">Sectors populate once universe_score has run.</p>
      )}
      {sectors.length > 0 && (
        <div ref={containerRef} className="overflow-x-auto overflow-y-hidden">
          <div
            key={zoomKey}
            className={cn(
              'animate-in fade-in relative duration-300',
              zoomDirection === 'in' ? 'zoom-in-50' : 'zoom-in-150',
            )}
            style={{ width: mapWidth, height: MAP_HEIGHT, transformOrigin: origin }}
          >
            {groupRects.map((rect, i) => (
              <GroupBlock
                key={groups[i].key}
                group={groups[i]}
                rect={rect}
                isLoading={zoom.sector !== null && tickersPending}
                onDive={diveTo}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function Legend() {
  const stops = [-3, -1.5, -0.5, 0.5, 1.5, 3]
  return (
    <span className="hidden items-center gap-1 sm:flex" aria-hidden="true">
      <span>-3%</span>
      <span className="flex overflow-hidden rounded-sm">
        {stops.map((pct) => (
          <span key={pct} className="h-2.5 w-4" style={moveColor(pct)} />
        ))}
      </span>
      <span>+3%</span>
    </span>
  )
}

function GroupBlock({
  group: g,
  rect,
  isLoading,
  onDive,
}: {
  group: MapGroup
  rect: Rect
  isLoading: boolean
  onDive: (zoom: Zoom, from?: HTMLElement | null) => void
}) {
  const blockRef = useRef<HTMLDivElement>(null)
  const inner = {
    x: rect.x + GAP / 2,
    y: rect.y + GAP / 2,
    w: Math.max(rect.w - GAP, 0),
    h: Math.max(rect.h - GAP, 0),
  }
  const diveAttr = g.dive ? JSON.stringify(g.dive) : undefined

  // Too small for a header: the whole block becomes one coloured box that
  // still dives in on scroll.
  if (inner.h < GROUP_HEADER_HEIGHT + 14 || inner.w < 70) {
    return (
      <div
        ref={blockRef}
        data-dive={diveAttr}
        className={cn('absolute transition-opacity', g.isDimmed && 'opacity-45 hover:opacity-90')}
        style={{ left: inner.x, top: inner.y, width: inner.w, height: inner.h }}
      >
        <MapTile
          box={{
            key: g.key,
            label: g.name,
            pct: g.pct,
            weight: g.weight,
            title: `${g.name} ${formatSignedPct(g.pct)}\n${breadthLine(g.count, g.advancers, g.decliners)}${
              g.topTicker ? `\nTop mover: ${g.topTicker} ${formatSignedPct(g.topPct)}` : ''
            }`,
            isActive: g.isActive,
            onSelect: g.onSelect,
          }}
          rect={{ x: 0, y: 0, w: inner.w, h: inner.h }}
          className="rounded-md"
        />
      </div>
    )
  }

  const bodyHeight = inner.h - GROUP_HEADER_HEIGHT
  const boxRects = squarify(
    g.boxes.map((b) => b.weight),
    { x: 0, y: 0, w: inner.w, h: bodyHeight },
  )
  const nameFits = textWidth(`${g.name} ${formatSignedPct(g.pct)}`, 600) + (g.dive ? 36 : 16) <= inner.w
  const breadthTotal = g.advancers + g.decliners

  return (
    <div
      ref={blockRef}
      data-dive={diveAttr}
      className={cn(
        'border-border bg-card absolute overflow-hidden rounded-md border transition-opacity',
        g.isDimmed && 'opacity-45 hover:opacity-90',
        g.isActive && 'ring-primary ring-2',
      )}
      style={{ left: inner.x, top: inner.y, width: inner.w, height: inner.h }}
    >
      <div className="flex items-stretch" style={{ height: GROUP_HEADER_HEIGHT }}>
        <button
          type="button"
          onClick={g.onSelect}
          aria-pressed={g.isActive}
          title={`${g.name} · click to filter the table`}
          className="hover:bg-muted flex min-w-0 flex-1 cursor-pointer flex-col justify-center px-1.5 text-left"
        >
          <span className="flex items-baseline gap-1.5 text-xs leading-tight whitespace-nowrap">
            <span className="truncate font-semibold">{nameFits ? g.name : (g.shortName ?? g.name)}</span>
            <span className={cn('shrink-0 font-semibold tabular-nums', signedText(g.pct))}>
              {formatSignedPct(g.pct)}
            </span>
          </span>
          <span className="text-muted-foreground flex items-baseline gap-1.5 text-[11px] leading-tight whitespace-nowrap tabular-nums">
            <span className="shrink-0">
              {g.count}
              {breadthTotal > 0 && (
                <>
                  {' · '}
                  <span className={UP_TEXT}>{g.advancers}↑</span>{' '}
                  <span className={DOWN_TEXT}>{g.decliners}↓</span>
                </>
              )}
            </span>
            {g.topTicker && (
              <span className="truncate">
                · <span className="text-foreground font-medium">{g.topTicker}</span>{' '}
                <span className={signedText(g.topPct)}>{formatSignedPct(g.topPct)}</span>
              </span>
            )}
          </span>
        </button>
        {g.dive && (
          <button
            type="button"
            onClick={() => onDive(g.dive!, blockRef.current)}
            aria-label={`Zoom into ${g.name}`}
            title={`Zoom into ${g.name}`}
            className="text-muted-foreground hover:text-foreground hover:bg-muted flex w-6 shrink-0 cursor-pointer items-center justify-center"
          >
            <ZoomIn className="size-3.5" />
          </button>
        )}
      </div>

      <div className="relative" style={{ height: bodyHeight }}>
        {g.boxes.length === 0 && isLoading && <Skeleton className="absolute inset-0 rounded-none" />}
        {boxRects.map((r, i) => (
          <MapTile key={g.boxes[i].key} box={g.boxes[i]} rect={r} className="absolute border-card border" />
        ))}
      </div>
    </div>
  )
}

const LABEL_FONT_PX = 11
const LINE_HEIGHT = 13
const PAD = 6

let measureCtx: CanvasRenderingContext2D | null | undefined

/** Rendered width of `text` in the label font, via canvas so fit decisions
 * match what the browser will draw. Falls back to an average glyph width
 * where canvas is unavailable (tests). */
function textWidth(text: string, weight: number): number {
  if (measureCtx === undefined) {
    try {
      measureCtx = document.createElement('canvas').getContext('2d')
    } catch {
      measureCtx = null
    }
  }
  if (!measureCtx) return text.length * 6
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif'
  measureCtx.font = `${weight} ${LABEL_FONT_PX}px ${family}`
  return measureCtx.measureText(text).width
}

function wrappedLines(label: string, width: number): number | null {
  const words = label.split(/\s+/)
  if (words.some((w) => textWidth(w, 500) > width)) return null
  let lines = 1
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (line && textWidth(next, 500) > width) {
      lines += 1
      line = word
    } else {
      line = next
    }
  }
  return lines
}

/** Decide what a box can show without clipping: the name only when every
 * word fits the width and all its wrapped lines fit the height (above the
 * percentage), the detail line only on top of both, else the percentage
 * alone, else colour only. A cut-off label reads worse than none. */
function fitLabel(box: MapBox, rect: Rect) {
  const width = rect.w - PAD
  const height = rect.h - PAD
  const pctText = formatSignedPct(box.pct)
  if (textWidth(pctText, 600) > width || height < LINE_HEIGHT) {
    return { showName: false, showPct: false, showDetail: false }
  }
  const lines = wrappedLines(box.label, width)
  const showName = lines !== null && (lines + 1) * LINE_HEIGHT <= height
  const showDetail =
    showName &&
    box.detail !== undefined &&
    textWidth(box.detail, 400) <= width &&
    (lines! + 2) * LINE_HEIGHT <= height
  return { showName, showPct: true, showDetail }
}

function MapTile({ box, rect, className }: { box: MapBox; rect: Rect; className?: string }) {
  const { showName, showPct, showDetail } = fitLabel(box, rect)
  return (
    <button
      type="button"
      onClick={box.onSelect}
      aria-pressed={box.isActive}
      aria-label={`${box.label} ${formatSignedPct(box.pct)}`}
      title={box.title}
      className={cn(
        'bg-muted flex cursor-pointer flex-col items-center justify-center overflow-hidden px-0.5 text-center leading-tight hover:brightness-110',
        box.isActive && 'ring-primary z-10 ring-2 ring-inset',
        className,
      )}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, ...moveColor(box.pct) }}
    >
      {showName && <span className="text-[11px] font-medium">{box.label}</span>}
      {showPct && (
        <span className="text-[11px] font-semibold tabular-nums">{formatSignedPct(box.pct)}</span>
      )}
      {showDetail && <span className="text-[10px] opacity-75 tabular-nums">{box.detail}</span>}
    </button>
  )
}
