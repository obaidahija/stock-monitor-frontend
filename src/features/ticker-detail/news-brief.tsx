import { useState } from 'react'
import { ChevronDown, RefreshCw, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { DIRECTION_COLOR_CLASSES } from '@/lib/direction-colors'
import { formatDate, formatEasternDateTimeWithYear } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { BriefingSource, TickerNewsItem, TickerStockReaction } from '@/types/api'
import { useNewsBrief, useRefreshNewsBrief } from './hooks'

const IMPACT_CLASSES: Record<TickerNewsItem['impact'], string> = {
  high: 'border-foreground/40 font-semibold',
  medium: 'text-foreground/80',
  low: 'text-muted-foreground',
}

function DirectionCounts({ items }: { items: TickerNewsItem[] }) {
  return (
    <span className="flex flex-wrap gap-1.5 text-[11px] font-medium">
      {(['positive', 'negative', 'mixed'] as const).map((direction) => {
        const count = items.filter((item) => item.direction === direction).length
        return count > 0 ? (
          <span key={direction} className={cn('rounded px-1.5 py-0.5', DIRECTION_COLOR_CLASSES[direction])}>
            {count} {direction}
          </span>
        ) : null
      })}
    </span>
  )
}

const REACTION_CLASSES: Record<TickerStockReaction['move'], string> = {
  up: DIRECTION_COLOR_CLASSES.positive,
  down: DIRECTION_COLOR_CLASSES.negative,
  mixed: DIRECTION_COLOR_CLASSES.mixed,
  flat: DIRECTION_COLOR_CLASSES.uncertain,
}

function SourceLinks({ ids, sources }: { ids: number[]; sources: BriefingSource[] }) {
  const cited = ids
    .map((id) => sources.find((source) => source.id === id))
    .filter((source): source is BriefingSource => source !== undefined)
  if (cited.length === 0) return null
  return (
    <p className="text-xs">
      {cited.map((source, index) => (
        <span key={source.id}>
          {index > 0 && ' · '}
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            {source.publisher ?? source.title}
          </a>
        </span>
      ))}
    </p>
  )
}

function StockReaction({ reaction, sources }: { reaction: TickerStockReaction; sources: BriefingSource[] }) {
  const Icon = reaction.move === 'down' ? TrendingDown : TrendingUp
  return (
    <div aria-label="Stock reaction" className={cn('mb-2 space-y-1 rounded-lg px-3 py-2 text-sm', REACTION_CLASSES[reaction.move])}>
      <p className="flex items-start gap-2">
        {(reaction.move === 'up' || reaction.move === 'down') && <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />}
        <span><span className="font-semibold">How the stock reacted: </span>{reaction.summary}</span>
      </p>
      <SourceLinks ids={reaction.source_ids} sources={sources} />
    </div>
  )
}

function NewsRow({ item, sources }: { item: TickerNewsItem; sources: BriefingSource[] }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="py-2">
      <button
        type="button"
        className="flex w-full items-start gap-2 text-left"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Badge variant="outline" className={cn('shrink-0 capitalize', DIRECTION_COLOR_CLASSES[item.direction])}>
          {item.direction}
        </Badge>
        <Badge variant="outline" className={cn('shrink-0 capitalize', IMPACT_CLASSES[item.impact])}>
          {item.impact} impact
        </Badge>
        <span className="min-w-0 flex-1 text-sm font-medium">{item.headline}</span>
        <span className="text-muted-foreground shrink-0 text-xs">{formatDate(item.reported_date)}</span>
        <ChevronDown aria-hidden className={cn('text-muted-foreground mt-0.5 size-4 shrink-0', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="text-muted-foreground mt-2 space-y-1.5 pl-1 text-sm">
          <p>{item.summary}</p>
          <p><span className="text-foreground font-medium">Why it could matter: </span>{item.impact_reason}</p>
          <SourceLinks ids={item.source_ids} sources={sources} />
        </div>
      )}
    </li>
  )
}

export function NewsBrief({ ticker }: { ticker: string }) {
  const symbol = ticker.toUpperCase()
  const query = useNewsBrief(ticker)
  const generate = useRefreshNewsBrief(ticker)
  const brief = query.data?.ticker === symbol && query.data.source.ok ? query.data : null
  const responseError = generate.data?.ticker === symbol && !generate.data.source.ok ? generate.data.source.error : null
  const requestError = generate.isError
    ? generate.error instanceof Error ? generate.error.message : 'Generating the brief failed. Please retry.'
    : null

  return (
    <section aria-label="News impact" className="bg-muted/30 rounded-xl border p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">News impact</h2>
          <p className="text-muted-foreground text-xs">
            {brief
              ? <>Last 7 days, from Google Finance · Updated <time dateTime={brief.generated_at}>{formatEasternDateTimeWithYear(brief.generated_at)}</time></>
              : 'Recent company news from Google Finance, rated positive or negative with its likely impact'}
          </p>
          {brief && <DirectionCounts items={brief.items} />}
        </div>
        <Button type="button" size="sm" variant="outline" disabled={generate.isPending || query.isPending} onClick={() => generate.mutate(Boolean(brief))}>
          {generate.isPending ? <Spinner /> : brief ? <RefreshCw /> : <Sparkles />}
          {generate.isPending ? 'Generating…' : brief ? 'Refresh' : 'Generate'}
        </Button>
      </div>

      {generate.isPending && (
        <p role="status" className="text-muted-foreground text-sm">Asking Google Finance about {symbol}'s recent news…</p>
      )}
      {!generate.isPending && (responseError || requestError) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{responseError ?? requestError}</p>
      )}
      {query.isPending ? (
        <p className="text-muted-foreground animate-pulse text-sm" role="status">Loading saved brief…</p>
      ) : brief ? (
        <>
          {brief.stock_reaction && <StockReaction reaction={brief.stock_reaction} sources={brief.sources} />}
          <ul className="divide-border divide-y">
            {brief.items.map((item) => <NewsRow key={item.headline} item={item} sources={brief.sources} />)}
          </ul>
          <p className="text-muted-foreground mt-2 text-[11px]">{brief.caveat}</p>
        </>
      ) : (
        !generate.isPending && !responseError && !requestError && (
          <p className="text-muted-foreground text-sm">No brief yet. Generate one to see recent developments and how they could affect {symbol}.</p>
        )
      )}
    </section>
  )
}
