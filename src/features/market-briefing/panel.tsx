import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, Newspaper, RefreshCw, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelativeTime, formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { BriefingIndustryImpact, BriefingSource, BriefingStory } from '@/types/api'
import { useMarketBriefing, useRefreshMarketBriefing } from './hooks'

const directionClasses: Record<BriefingIndustryImpact['direction'], string> = {
  positive: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  negative: 'bg-red-500/10 text-red-700 dark:text-red-400',
  mixed: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  uncertain: 'bg-muted text-muted-foreground',
}

function ImpactCounts({ impacts }: { impacts: BriefingIndustryImpact[] }) {
  return <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-medium">
    {(['negative', 'positive', 'mixed', 'uncertain'] as const).map((direction) => {
      const count = impacts.filter((impact) => impact.direction === direction).length
      return count > 0 ? <span key={direction} className={cn('rounded px-1', directionClasses[direction])}>
        {count} {direction}
      </span> : null
    })}
    {!impacts.length && <span className="text-muted-foreground">Industry impact unassigned</span>}
  </span>
}

function StoryPreview({ story, rank, sources, disclaimer, side }: {
  story: BriefingStory
  rank: number
  sources: BriefingSource[]
  disclaimer: string
  side: 'left' | 'bottom'
}) {
  const [open, setOpen] = useState(false)
  const pinned = useRef(false)
  const returnFocus = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const changeOpen = (value: boolean) => {
    clearTimeout(timer.current)
    setOpen(value)
    if (!value) pinned.current = false
  }
  const enter = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), 300)
  }
  const leave = () => {
    clearTimeout(timer.current)
    if (!pinned.current) timer.current = setTimeout(() => setOpen(false), 250)
  }

  return <Popover open={open} onOpenChange={changeOpen}>
    <PopoverAnchor asChild>
      <button
        ref={trigger}
        type="button"
        aria-label={`Read briefing: ${story.headline}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="bg-card hover:bg-muted/60 focus-visible:ring-ring w-full rounded-lg border border-border/80 p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2"
        onPointerEnter={(event) => { if (event.pointerType === 'mouse') enter() }}
        onPointerLeave={leave}
        onClick={() => { clearTimeout(timer.current); pinned.current = true; returnFocus.current = true; setOpen(true) }}
      >
        <span className="flex items-start gap-2">
          <span className="text-muted-foreground pt-0.5 text-[10px] tabular-nums">{rank}.</span>
          <span className="min-w-0 flex-1 space-y-2">
            <span className="line-clamp-3 text-xs leading-relaxed font-medium">{story.headline}</span>
            <ImpactCounts impacts={story.industry_impacts} />
          </span>
          <ArrowUpRight aria-hidden="true" className="text-muted-foreground mt-0.5 size-3 shrink-0" />
        </span>
      </button>
    </PopoverAnchor>
    <PopoverContent
      side={side} align="start" sideOffset={12} collisionPadding={12}
      aria-label={story.headline}
      className="max-h-[min(680px,var(--radix-popover-content-available-height))] w-[min(480px,calc(100vw-24px))] gap-4 overflow-y-auto p-4"
      onPointerEnter={() => clearTimeout(timer.current)}
      onPointerLeave={leave}
      onOpenAutoFocus={(event) => { if (!pinned.current) event.preventDefault() }}
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        if (returnFocus.current) trigger.current?.focus()
        returnFocus.current = false
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Market briefing · Reported {story.reported_date}</p>
          <h3 className="text-base leading-snug font-semibold">{story.headline}</h3>
        </div>
        <Button size="icon-sm" variant="ghost" aria-label="Close briefing preview" className="shrink-0" onClick={() => changeOpen(false)}><X /></Button>
      </div>
      <div className="space-y-2 text-sm">
        <p>{story.summary}</p>
        <p className="text-muted-foreground">{story.significance}</p>
        {story.reported_reaction && <p><span className="font-medium">Reported reaction: </span>{story.reported_reaction}</p>}
      </div>
      {story.industry_impacts.length > 0 ? <div className="space-y-2 border-t pt-3">
        <h4 className="text-muted-foreground text-xs font-medium">Potential industry effects</h4>
        <ul className="space-y-3">
          {story.industry_impacts.map((impact) => <li key={impact.industry} className="space-y-1">
            <Badge variant="outline" className={directionClasses[impact.direction]}>{impact.industry} · {impact.direction}</Badge>
            <p className="text-sm leading-relaxed">{impact.rationale}</p>
          </li>)}
        </ul>
      </div> : <p className="text-muted-foreground text-xs">No supported mapping to tracked industries.</p>}
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-xs">
        {story.source_ids.map((id) => {
          const source = sources.find((item) => item.id === id)
          if (!source || !/^https?:\/\//i.test(source.url)) return null
          return <a key={id} href={source.url} target="_blank" rel="noopener noreferrer" title={source.title} className="inline-flex items-center gap-1 underline underline-offset-2">
            {source.publisher || source.title}<ArrowUpRight className="size-3" aria-hidden="true" />
          </a>
        })}
      </div>
      <p className="text-muted-foreground text-[10px] leading-relaxed">{disclaimer}</p>
    </PopoverContent>
  </Popover>
}

export function MarketBriefingPanel() {
  const [wide, setWide] = useState(() => window.matchMedia?.('(min-width: 1280px)').matches ?? false)
  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 1280px)')
    if (!media) return
    const update = () => setWide(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const query = useMarketBriefing()
  const refresh = useRefreshMarketBriefing()
  const data = query.data
  const refreshing = refresh.isPending || data?.refresh_active === true

  return <section aria-labelledby="market-briefing-title" className="space-y-2">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 space-y-0.5">
        <h2 id="market-briefing-title" className="flex items-center gap-1.5 text-sm font-semibold"><Newspaper className="size-3.5" aria-hidden="true" />Market briefing</h2>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px]">
          {data?.generated_at ? <time dateTime={data.generated_at} title={`Generated ${formatTimestamp(data.generated_at)} · News day ${data.run_date} ET`}>{formatRelativeTime(data.generated_at)}</time> : <span>On demand · US markets</span>}
          {data?.stale && data.stories.length > 0 && <Badge variant="outline" className="px-1 py-0 text-[9px]">Stale</Badge>}
        </div>
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Refresh briefing" title="Refresh briefing" disabled={refreshing || !data?.enabled} onClick={() => refresh.mutate()}>
        <RefreshCw aria-hidden="true" className={cn('size-3.5', refreshing && 'motion-safe:animate-spin')} />
      </Button>
    </div>
    {query.isPending && <div role="status" aria-label="Loading briefing" className="space-y-2">
      {[0, 1, 2].map((key) => <Skeleton key={key} className="h-20 rounded-lg" />)}
    </div>}
    {query.isError && <div role="alert" className="text-muted-foreground rounded-lg border p-2.5 text-xs">
      Briefing is temporarily unavailable.
      <Button variant="link" size="xs" onClick={() => void query.refetch()}>Retry briefing</Button>
    </div>}
    {refresh.isError && <p role="alert" className="text-destructive text-xs">Refresh failed. Try again.</p>}
    {data && !data.enabled && <p className="text-muted-foreground text-xs">Enable Google Finance Research in <Link to="/settings" className="underline">Settings</Link> to generate a briefing.</p>}
    {refreshing && <p role="status" className="text-muted-foreground text-xs">Generating briefing… Saved news stays available.</p>}
    {data?.source_error && <p role="alert" className="rounded-lg border border-amber-500/30 p-2 text-xs">{data.source_error} {data.stories.length > 0 && 'Showing the previous briefing.'}</p>}
    {data?.stale_reason === 'previous_day' && <p className="text-muted-foreground text-xs">Previous US Eastern news day. Refresh for today.</p>}
    {data && !data.stories.length && !refreshing && <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-xs">No briefing yet. Use refresh to gather today's market news.</p>}
    {data && data.stories.length > 0 && <ol className="max-h-60 space-y-2 xl:max-h-[min(36rem,60svh)] overflow-y-auto p-0.5">
      {data.stories.map((story, index) => <li key={story.headline}>
        <StoryPreview story={story} rank={index + 1} sources={data.sources} disclaimer={data.disclaimer} side={wide ? 'left' : 'bottom'} />
      </li>)}
    </ol>}
    <p className="text-muted-foreground text-[10px]">AI assessments · Hover or tap a story to read</p>
  </section>
}
