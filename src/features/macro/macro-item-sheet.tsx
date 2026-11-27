import { ExternalLink } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { formatEasternDateTime } from '@/lib/format'
import { formatSourceName } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { MacroItemExplanationOut } from '@/types/api'
import { DriverChip } from './drivers'
import { ExposurePanel } from './exposure-panel'
import { NEWS_TO_MARKET_DRIVER } from './market-drivers'
import { useMacroItemExplanation } from './hooks'

const RELEVANCE_TEXT: Record<MacroItemExplanationOut['relevance'], string> = {
  high: 'High relevance to US stocks',
  medium: 'Medium relevance to US stocks',
  low: 'Low relevance — not counted',
  none: 'Not macro news — not counted',
}
const EFFECT_STYLE = {
  positive: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  negative: 'bg-red-500/15 text-red-700 dark:text-red-400',
  mixed: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
}
const EFFECT_TEXT = { positive: 'Tailwind', negative: 'Headwind', mixed: 'Mixed' }

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function Summary({ data }: { data: MacroItemExplanationOut }) {
  const summary = data.item.summary
  if (data.overview?.text) {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Overview</h3>
        <p className="font-serif text-[15px] leading-relaxed">{data.overview.text}</p>
        <p className="text-muted-foreground text-xs">
          {data.overview.method === 'extractive'
            ? 'Key passages, quoted from the feed summary.'
            : 'Written by BART from the feed summary. Check the quotes below for exact wording.'}
        </p>
        {summary && (
          <details className="text-sm">
            <summary className="text-muted-foreground cursor-pointer text-xs">Show the full feed summary</summary>
            <p className="text-muted-foreground mt-2 whitespace-pre-line">{summary}</p>
          </details>
        )}
      </section>
    )
  }
  return summary ? <p className="text-muted-foreground text-sm">{summary}</p> : null
}

function Body({ data }: { data: MacroItemExplanationOut }) {
  return (
    <div className="space-y-5">
      <Summary data={data} />
      {data.market_wrap && (
        <p className="rounded-lg border border-dashed px-3 py-2 text-xs">
          <span className="font-semibold">Market wrap.</span> This item rounds up many separate stories, so the
          read below summarizes the wrap as a whole — mostly its opening stories — rather than one event.
        </p>
      )}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Is it market-moving?</h3>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              data.relevant ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
            )}
          >
            {RELEVANCE_TEXT[data.relevance]}
          </span>
          {data.relevant && data.magnitude !== 'none' && (
            <span className="text-muted-foreground text-xs capitalize">{data.magnitude} event</span>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          The model gives it a {percent(data.p_relevant)} chance of being medium or high relevance
          (counted from {percent(data.relevance_threshold)}).
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">What moved</h3>
        {data.driver_details.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {data.relevant ? 'No clear driver read from the text.' : 'Nothing — the item was filtered as noise.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {data.driver_details.map((driver) => (
              <li key={driver.driver} className="space-y-1">
                <div className="flex items-center gap-2">
                  <DriverChip driver={driver.driver} direction={driver.direction} />
                  <span className="text-muted-foreground text-xs">{percent(driver.confidence)} confident</span>
                </div>
                <blockquote className="border-l-2 pl-3 font-serif text-sm leading-relaxed">
                  “{driver.evidence}”
                </blockquote>
                {NEWS_TO_MARKET_DRIVER[driver.driver] && (
                  <details className="text-xs">
                    <summary className="text-muted-foreground cursor-pointer">Who it moves (measured)</summary>
                    <div className="mt-2">
                      <ExposurePanel driver={NEWS_TO_MARKET_DRIVER[driver.driver]} direction={driver.direction} compact />
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.sector_effects.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Sector effects (rules learned from labelled news)</h3>
          <ul className="space-y-3">
            {data.sector_effects.map((sector) => (
              <li key={sector.sector} className="bg-card space-y-1.5 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{sector.sector}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', EFFECT_STYLE[sector.net])}>
                    {EFFECT_TEXT[sector.net]}
                  </span>
                </div>
                {sector.because.map((b) => (
                  <p key={`${b.driver}-${b.direction}`} className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                    <DriverChip driver={b.driver} direction={b.direction} />
                    <span>{b.reason}</span>
                    {b.cases !== null && b.cases > 0 && (
                      <span className="opacity-80">
                        · labelled data agreed {b.agree}/{b.cases}
                      </span>
                    )}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-muted-foreground text-xs">
        Read by a locally trained model ({data.model_version}) from the headline and feed summary. Evidence is
        the sentence (or, in run-on text, the short passage) that carries each driver most strongly. {data.caveat}
      </p>
    </div>
  )
}

/** Why one macro headline was (or was not) counted, opened beside the page. */
export function MacroItemSheet({
  itemId,
  title,
  onOpenChange,
}: {
  itemId: number | null
  /** Shown while the explanation loads. */
  title?: string
  onOpenChange: (open: boolean) => void
}) {
  const query = useMacroItemExplanation(itemId)
  const item = query.data?.item
  return (
    <Sheet open={itemId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="pr-6 font-serif text-xl leading-snug">{item?.title ?? title ?? 'Macro news'}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            {item && (
              <>
                <span>{formatSourceName(item.source)}</span>
                <span>·</span>
                <span>{formatEasternDateTime(item.published_at)}</span>
                <span>·</span>
                <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                  Original <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </>
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-8">
          {query.isPending && itemId !== null && <Skeleton className="h-72 w-full" />}
          {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
          {query.data && <Body data={query.data} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}
