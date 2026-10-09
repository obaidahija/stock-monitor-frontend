import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { ArrowUpRight, ListFilter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ErrorState } from '@/components/shared/error-state'
import { useResearchCapabilities } from '@/features/research/hooks'
import { FollowThroughControl } from '@/features/watchlists/follow-through-control'
import { ManageListsDialog } from '@/features/watchlists/manage-lists-dialog'
import { formatEasternDateTime } from '@/lib/format'
import { formatSourceName } from '@/lib/labels'
import { DigestLivePrice } from '@/features/digest/live-quotes'
import { getResearchFirst } from './api'
import type { ResearchFirstItem, ResearchFirstReport } from './types'

function useHorizon() {
  const [params, setParams] = useSearchParams()
  const raw = Number(params.get('horizon_sessions'))
  const horizon = Number.isInteger(raw) && raw >= 1 && raw <= 7 ? raw : 5
  function setHorizon(value: number) {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set('horizon_sessions', String(value))
      return next
    })
  }
  return [horizon, setHorizon] as const
}

/** Joins parts with " · " so each part stays its own element. */
function dotted(parts: ReactNode[]): ReactNode {
  return parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 && ' · '}
      {part}
    </Fragment>
  ))
}

/** Watch lines every visible card repeats word for word: market-wide, so said once. */
function sharedRisks(items: ResearchFirstItem[]): Set<string> {
  if (items.length < 2) return new Set()
  const [first, ...rest] = items
  return new Set(first.risks.filter((risk) => rest.every((item) => item.risks.includes(risk))))
}

function ResearchCard({ item, horizon, trackingEnabled, hiddenRisks }: {
  item: ResearchFirstItem; horizon: number; trackingEnabled: boolean; hiddenRisks: Set<string>
}) {
  const source = item.source_url && /^https?:\/\//i.test(item.source_url) ? item.source_url : null
  const publisherEvidence = item.original_article_evidence_url && /^https?:\/\//i.test(item.original_article_evidence_url)
    ? item.original_article_evidence_url : null
  const eventEvidence = item.issuer_event_evidence_url && /^https?:\/\//i.test(item.issuer_event_evidence_url)
    ? item.issuer_event_evidence_url : null
  const volatility = item.selected_volatility
  return (
    <Card className="min-w-0 gap-4">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">{String(item.rank).padStart(2, '0')}</span>
            {item.ticker}
          </CardTitle>
          <Badge variant="secondary">{
            item.event_status === 'tentative' ? 'Reported talks'
              : item.candidate_id ? 'Reported event' : 'Upcoming earnings'
          }</Badge>
        </div>
        <CardDescription className="truncate">{item.company_name || item.ticker}</CardDescription>
        <DigestLivePrice ticker={item.ticker} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p className="font-medium break-words">{item.headline}</p>
        <p className="text-muted-foreground text-xs">
          {dotted([
            <span key="source">
              {source ? (
                <a href={source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  {formatSourceName(item.source_name || 'Source')}
                </a>
              ) : (
                formatSourceName(item.source_name || 'Cached earnings calendar')
              )}
            </span>,
            ...(item.published_at
              ? [<span key="feed">{item.original_article_status ? 'Feed time: ' : ''}{formatEasternDateTime(item.published_at)}</span>]
              : []),
            ...(item.candidate_id !== null && item.original_article_status
              ? [
                  <span key="publisher">
                    {item.original_article_on && item.original_article_status === 'verified'
                      ? publisherEvidence
                        ? <a href={publisherEvidence} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Publisher article: {item.original_article_on}</a>
                        : `Publisher article: ${item.original_article_on}`
                      : `Publisher date: ${item.original_article_status === 'unavailable' ? 'unavailable' : 'unverified'}`}
                  </span>,
                  ...(item.category !== 'analyst_action'
                    ? [
                        <span key="issuer">
                          {item.issuer_event_on && item.issuer_event_status === 'verified'
                            ? eventEvidence
                              ? <a href={eventEvidence} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Issuer event: {item.issuer_event_on}</a>
                              : `Issuer event: ${item.issuer_event_on}`
                            : `Issuer event date: ${item.issuer_event_status === 'unavailable' ? 'unavailable' : 'unverified'}`}
                        </span>,
                      ]
                    : []),
                ]
              : []),
          ])}
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span>Composite {item.composite_score === null ? 'unavailable' : `${item.composite_score.toFixed(0)}/100`}{item.lean && ` · ${item.lean}`}</span>
          {item.observed_direction && <span>Observed move: {item.observed_direction}</span>}
        </div>
        {item.supporting_evidence.length > 0 && <p className="text-muted-foreground text-xs">{item.supporting_evidence.join(' · ')}</p>}
        <p className="text-muted-foreground text-xs">
          {volatility?.move_pct != null
            ? `${horizon}-session volatility reference: ±${volatility.move_pct.toFixed(1)}%${volatility.quality.status !== 'ok' ? ` (${volatility.quality.status})` : ''}`
            : `${horizon}-session volatility reference unavailable.`}
        </p>
        {item.risks.some((risk) => !hiddenRisks.has(risk)) && <div className="flex flex-col gap-1 text-xs">
          <p className="font-medium">Watch closely</p>
          {item.risks.filter((risk) => !hiddenRisks.has(risk)).map((risk) => <p key={risk} className="text-muted-foreground">{risk}</p>)}
        </div>}
        {item.data_limits.length > 0 && <details className="text-xs">
          <summary className="text-muted-foreground cursor-pointer">Data limits ({item.data_limits.length})</summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-muted-foreground">
            {item.data_limits.map((limit) => <li key={limit}>{limit}</li>)}
          </ul>
        </details>}
        <details className="text-xs">
          <summary className="cursor-pointer">Why this rank?</summary>
          <div className="mt-2 flex flex-col gap-1 text-muted-foreground">
            {item.ranking.map((reason) => <div key={reason.label} className="flex justify-between gap-3">
              <span>{reason.label}</span><span>{reason.points > 0 ? '+' : ''}{reason.points}</span>
            </div>)}
            <p className="mt-1">{item.priority_points} research priority points. No estimate of return or win probability.</p>
            {item.score_updated_at && <p>Composite updated {formatEasternDateTime(item.score_updated_at)}; it does not add priority points.</p>}
            {item.reaction_observed_at && <p>Completed reaction at {formatEasternDateTime(item.reaction_observed_at)}.</p>}
          </div>
        </details>
      </CardContent>
      <CardFooter className="mt-auto flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link aria-label={`Open ${item.ticker} analysis`} to={`/stocks/${encodeURIComponent(item.ticker)}?tab=analysis&horizon_sessions=${horizon}`}>
            Analysis <ArrowUpRight data-icon="inline-end" />
          </Link>
        </Button>
        <ManageListsDialog ticker={item.ticker} />
        {item.candidate_id !== null && <FollowThroughControl
          ticker={item.ticker} origin={{ kind: 'catalyst', candidateId: item.candidate_id }}
          enabled={trackingEnabled} initialHorizon={horizon} />}
      </CardFooter>
    </Card>
  )
}

function ResearchHorizon({ horizon, setHorizon, label }: {
  horizon: number; setHorizon: (horizon: number) => void; label: string
}) {
  return <label className="flex items-center gap-2 text-sm">Window
    <select aria-label={label} value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}
      className="border-input bg-background h-9 rounded-md border px-2">
      {[1, 2, 3, 4, 5, 6, 7].map((value) => <option key={value} value={value}>{value} {value === 1 ? 'session' : 'sessions'}</option>)}
    </select>
  </label>
}

const COMPACT_COUNT = 3

function ResearchFirstPanel({ report, horizon, setHorizon, saved = false, pending = false, error, retry, onVisibleTickersChange }: {
  report?: ResearchFirstReport; horizon: number; setHorizon: (horizon: number) => void
  saved?: boolean; pending?: boolean; error?: Error | null; retry?: () => void
  /** The compact view's tickers for the selected horizon. Expansion does not
   * change them, so a page can budget its own cards around these three. */
  onVisibleTickersChange?: (tickers: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const [highlightedTicker, setHighlightedTicker] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const sectionRef = useRef<HTMLElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef(new Map<string, HTMLDivElement>())
  function openPanel(trigger: HTMLButtonElement, ticker: string | null = null) {
    triggerRef.current = trigger
    setSelectedTicker(ticker)
    setHighlightedTicker(ticker)
    setOpen(true)
  }
  useEffect(() => {
    setSelectedTicker(null)
    setHighlightedTicker(null)
    if (listRef.current) listRef.current.scrollTop = 0
  }, [horizon])
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      if (selectedTicker) cardRefs.current.get(selectedTicker)?.scrollIntoView({ block: 'start' })
      else if (listRef.current) listRef.current.scrollTop = 0
    })
    return () => cancelAnimationFrame(frame)
  }, [open, selectedTicker, horizon, pending])
  useEffect(() => {
    if (!open || !highlightedTicker) return
    const timer = setTimeout(() => setHighlightedTicker(null), 1800)
    return () => clearTimeout(timer)
  }, [open, highlightedTicker])
  const capabilities = useResearchCapabilities()
  const items = report?.items ?? []
  const visible = items.slice(0, COMPACT_COUNT)
  const shared = sharedRisks(items)
  const compactKey = items.slice(0, COMPACT_COUNT).map((item) => item.ticker).join(',')
  useEffect(() => {
    onVisibleTickersChange?.(compactKey ? compactKey.split(',') : [])
  }, [compactKey, onVisibleTickersChange])
  return (
    <section ref={sectionRef} aria-label="Research first" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold"><ListFilter className="size-4" /> Research first</h2>
        <ResearchHorizon horizon={horizon} setHorizon={setHorizon} label="Research horizon" />
      </div>
      <p className="text-muted-foreground text-xs">Top events to research for your selected window.</p>
      {pending && <div role="status" className="flex flex-col gap-2">
        <span className="text-muted-foreground text-sm">Finding research priorities…</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{Array.from({ length: COMPACT_COUNT }, (_, index) => <Skeleton key={index} className="h-20 w-full rounded-xl" />)}</div>
      </div>}
      {error && <ErrorState error={error} onRetry={retry} />}
      {!pending && !error && !report && saved && <p className="text-muted-foreground text-sm">This digest has no saved shortlist for this window. Rebuild the digest to include one.</p>}
      {report && !pending && !error && <>
        {items.length === 0
          ? <p className="text-muted-foreground text-sm">No fresh events or overlapping earnings qualify for this window in the cached evidence.</p>
          : <div className={`grid grid-cols-1 gap-2 ${visible.length === 3 ? 'sm:grid-cols-3' : visible.length === 2 ? 'sm:grid-cols-2' : ''}`}>
              {visible.map((item) => <Tooltip key={`${horizon}-${item.ticker}`}>
                <TooltipTrigger asChild><button type="button"
                aria-label={`View ${item.ticker} research priority`} aria-haspopup="dialog"
                onClick={(event) => openPanel(event.currentTarget, item.ticker)}
                className="border-border bg-card hover:bg-accent focus-visible:ring-ring flex w-full min-w-0 flex-col gap-1 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 h-full">
                <span className="font-semibold">{item.ticker}</span>
                <span className="w-full truncate text-sm">{item.headline}</span>
                <span className="text-muted-foreground text-xs">Composite {item.composite_score === null ? 'unavailable' : `${item.composite_score.toFixed(0)}/100`}{item.lean && ` · ${item.lean}`}</span>
                </button></TooltipTrigger>
                <TooltipContent className="w-80 max-w-[calc(100vw-2rem)] space-y-2 p-3 text-left text-pretty">
                  <div>
                    <p className="font-semibold">#{item.rank} · {item.ticker}{item.company_name && ` · ${item.company_name}`}</p>
                    <p className="mt-1">{item.event_status === 'tentative' ? 'Reported talks' : item.candidate_id !== null ? 'Reported event' : 'Upcoming earnings'}</p>
                  </div>
                  <p className="font-medium break-words">{item.headline}</p>
                  <p>{formatSourceName(item.source_name || 'Cached earnings calendar')}{item.published_at && ` · ${item.original_article_status ? 'Feed time: ' : ''}${formatEasternDateTime(item.published_at)}`}</p>
                  {item.candidate_id !== null && item.original_article_status && <div className="space-y-1">
                    <p>Publisher date: {item.original_article_status === 'verified' && item.original_article_on ? item.original_article_on : item.original_article_status === 'unavailable' ? 'unavailable' : 'unverified'}</p>
                    {item.category !== 'analyst_action' && <p>Issuer event date: {item.issuer_event_status === 'verified' && item.issuer_event_on ? item.issuer_event_on : item.issuer_event_status === 'unavailable' ? 'unavailable' : 'unverified'}</p>}
                  </div>}
                  <p>Composite {item.composite_score === null ? 'unavailable' : `${item.composite_score.toFixed(0)}/100`}{item.lean && ` · ${item.lean}`}{item.observed_direction && ` · Observed move: ${item.observed_direction}`}</p>
                  <p>{item.selected_volatility?.move_pct != null
                    ? `${horizon}-session volatility reference: ±${item.selected_volatility.move_pct.toFixed(1)}%${item.selected_volatility.quality.status !== 'ok' ? ` (${item.selected_volatility.quality.status})` : ''}. Typical magnitude, not a forecast.`
                    : `${horizon}-session volatility reference unavailable.`}</p>
                  {item.supporting_evidence[0] && <p>{item.supporting_evidence[0]}</p>}
                  {item.risks[0] && <p><span className="font-semibold">Watch closely: </span>{item.risks[0]}</p>}
                  <p className="opacity-75">Click to see the full research card.</p>
                </TooltipContent>
              </Tooltip>)}
            </div>}
        {items.length > 0 && <Button variant="ghost" size="sm" className="self-start" aria-haspopup="dialog"
          onClick={(event) => openPanel(event.currentTarget)}>
          Show all {items.length} priorities
        </Button>}
      </>}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex gap-0 p-0" onOpenAutoFocus={() => {
          if (selectedTicker) cardRefs.current.get(selectedTicker)?.scrollIntoView({ block: 'start' })
          else if (listRef.current) listRef.current.scrollTop = 0
        }} onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (triggerRef.current?.isConnected) triggerRef.current.focus()
          else sectionRef.current?.querySelector('select')?.focus()
        }}>
          <SheetHeader className="shrink-0">
            <SheetTitle>Research first</SheetTitle>
            <SheetDescription>All research priorities for your selected window.</SheetDescription>
            <ResearchHorizon horizon={horizon} setHorizon={setHorizon} label="Panel research horizon" />
          </SheetHeader>
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-4">
            {pending && <div role="status"><span>Finding research priorities…</span><Skeleton className="mt-2 h-48 rounded-xl" /></div>}
            {error && <ErrorState error={error} onRetry={retry} />}
            {!pending && !error && !report && saved && <p className="text-muted-foreground">This digest has no saved shortlist for this window. Rebuild the digest to include one.</p>}
            {report && !pending && !error && <div className="flex flex-col gap-3">
              <p className="text-muted-foreground text-xs">
                {saved ? 'Saved with this digest' : 'Calculated'} {formatEasternDateTime(report.generated_at)}
                {' · '}Window ends {formatEasternDateTime(report.window.expires_at)}
                {' · '}{items.length} of {report.eligible_tickers} eligible tickers
                {' · '}News coverage: {report.coverage.status || 'unavailable'}
                {!report.collection_enabled && ' · News collection off; cached evidence only'}
              </p>
              {report.coverage.reason && <p className="text-muted-foreground text-xs">Coverage limit: {report.coverage.reason.replaceAll('_', ' ')}</p>}
              {items.length === 0 && <p className="text-muted-foreground">No fresh events or overlapping earnings qualify for this window in the cached evidence.</p>}
              {shared.size > 0 && <div className="flex flex-col gap-1 text-xs">
                <p className="font-medium">Watch closely (every item)</p>
                {[...shared].map((risk) => <p key={risk} className="text-muted-foreground">{risk}</p>)}
              </div>}
              {items.map((item) => <div key={`${horizon}-${item.ticker}`} ref={(element) => {
                if (element) cardRefs.current.set(item.ticker, element)
                else cardRefs.current.delete(item.ticker)
              }} data-highlighted={highlightedTicker === item.ticker ? 'true' : undefined}
                className="scroll-mt-2 rounded-xl transition-shadow motion-reduce:transition-none data-[highlighted=true]:ring-2 data-[highlighted=true]:ring-primary">
                <ResearchCard item={item} horizon={horizon} trackingEnabled={capabilities.data?.follow_through_enabled === true} hiddenRisks={shared} />
              </div>)}
              <p className="text-muted-foreground text-xs">Priority uses feed timing and available evidence. A feed date can reflect republication; check the original event date. Priority is separate from the composite lean and does not predict returns. Volatility references are typical magnitudes, not forecasts.</p>
            </div>}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}

export function DiscoverResearchFirst() {
  const [horizon, setHorizon] = useHorizon()
  const query = useQuery({
    queryKey: ['research-first', horizon], queryFn: () => getResearchFirst(horizon),
    staleTime: 60_000, refetchInterval: 5 * 60_000,
  })
  return <ResearchFirstPanel report={query.data} horizon={horizon} setHorizon={setHorizon}
    pending={query.isPending} error={query.error} retry={() => void query.refetch()} />
}

export function DigestResearchFirst({ snapshots, onVisibleTickersChange }: {
  snapshots?: Record<string, ResearchFirstReport>
  onVisibleTickersChange?: (tickers: string[]) => void
}) {
  const [horizon, setHorizon] = useHorizon()
  return <ResearchFirstPanel report={snapshots?.[String(horizon)]} horizon={horizon} setHorizon={setHorizon} saved
    onVisibleTickersChange={onVisibleTickersChange} />
}
