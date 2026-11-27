import { useEffect, useRef } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { NewsAnalysisBadge } from '@/components/shared/news-analysis-badge'
import { formatEasternDateTime } from '@/lib/format'
import { formatSourceName } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { NewsAnalysisFactorOut, NewsItemAnalysisOut } from '@/types/api'
import { useAnalyzeNewsItem, useNewsItemAnalysis } from './hooks'

const DIRECTION_DOT: Record<NewsAnalysisFactorOut['direction'], string> = {
  positive: 'bg-emerald-500',
  negative: 'bg-red-500',
  neutral: 'bg-amber-500',
}
const CLAIM_STYLE: Record<NewsAnalysisFactorOut['claim_type'], string> = {
  reported: 'bg-muted text-muted-foreground',
  conditional: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  opinion: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
}
const SECTIONS: { direction: NewsAnalysisFactorOut['direction']; title: string }[] = [
  { direction: 'positive', title: 'Positive business factors' },
  { direction: 'negative', title: 'Negative business factors' },
  { direction: 'neutral', title: 'Neutral / unresolved' },
]

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        className,
      )}
    >
      {children}
    </span>
  )
}

function FactorRow({ factor }: { factor: NewsAnalysisFactorOut }) {
  return (
    <div className="border-t py-3 first:border-t-0 first:pt-0">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <Pill className={CLAIM_STYLE[factor.claim_type]}>{factor.claim_type}</Pill>
        <Pill className="bg-muted text-muted-foreground">{factor.materiality}</Pill>
        {factor.event_type && factor.event_type !== 'other' && (
          <Pill className="bg-muted text-muted-foreground">{factor.event_type.replaceAll('_', ' ')}</Pill>
        )}
        <span className="text-muted-foreground ml-auto text-xs">{factor.paragraph_id}</span>
      </div>
      <blockquote className="font-serif text-[15px] leading-relaxed">“{factor.evidence}”</blockquote>
    </div>
  )
}

function Stat({ value, label, className }: { value: number; label: string; className?: string }) {
  return (
    <div className="bg-card rounded-lg border px-3 py-2">
      <div className={cn('font-serif text-2xl font-bold', className)}>{value}</div>
      <div className="text-muted-foreground text-[11px] leading-tight">{label}</div>
    </div>
  )
}

function AnalysisBody({
  analysis,
  onReanalyze,
  reanalyzing,
}: {
  analysis: NewsItemAnalysisOut
  onReanalyze: () => void
  reanalyzing: boolean
}) {
  if (analysis.status !== 'readable') {
    return (
      <EmptyState
        title="This article could not be read"
        description={`The full text could not be downloaded (${analysis.error_code ?? 'unknown reason'}), so it was not analyzed and is hidden from the news list.`}
        action={
          <Button size="sm" variant="outline" disabled={reanalyzing} onClick={onReanalyze}>
            <RefreshCw className={cn(reanalyzing && 'animate-spin')} /> Try again
          </Button>
        }
      />
    )
  }
  const { factors, relevance } = analysis
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <NewsAnalysisBadge label={analysis.label} className="px-3 py-1 text-sm" />
        {relevance && (
          <span className="text-muted-foreground text-xs">
            {relevance.score}% about this company · {relevance.relevant_paragraphs} of{' '}
            {relevance.paragraphs} paragraphs
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Stat
          value={analysis.positive_count ?? 0}
          label="Positive"
          className="text-emerald-600 dark:text-emerald-400"
        />
        <Stat
          value={analysis.negative_count ?? 0}
          label="Negative"
          className="text-red-600 dark:text-red-400"
        />
        <Stat value={analysis.neutral_count ?? 0} label="Neutral" />
        <Stat value={analysis.price_moves.length} label="Price moves" />
      </div>

      {analysis.overview?.text && (
        <section className="space-y-1.5">
          <h3 className="text-sm font-semibold">Overview</h3>
          <p className="font-serif text-[15px] leading-relaxed">{analysis.overview.text}</p>
          <p className="text-muted-foreground text-xs">
            {analysis.overview.method === 'extractive'
              ? 'The article’s most important sentences, quoted.'
              : 'Summarized from the business factors below (BART). Check the quotes for exact wording.'}
          </p>
        </section>
      )}

      {SECTIONS.map(({ direction, title }) => {
        const rows = factors.filter((f) => f.direction === direction)
        if (rows.length === 0) return null
        return (
          <section key={direction} className="bg-card space-y-2 rounded-lg border p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <span className={cn('size-2 rounded-full', DIRECTION_DOT[direction])} />
              {title}
            </h3>
            {rows.map((factor) => (
              <FactorRow key={factor.span_id} factor={factor} />
            ))}
          </section>
        )
      })}
      {factors.length === 0 && (
        <EmptyState
          title="No business factors found"
          description="The article states nothing material about this company’s business — it may be a market recap, a price-move story or about another company."
        />
      )}

      <section className="space-y-2 rounded-lg border bg-sky-500/5 p-4">
        <h3 className="text-sm font-semibold">Reported stock movement</h3>
        {analysis.price_moves.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">No reported move in this article.</p>
        ) : (
          analysis.price_moves.map((move) => (
            <p key={move.span_id} className="font-serif text-sm leading-relaxed">
              “{move.evidence}”
            </p>
          ))
        )}
      </section>

      <div className="text-muted-foreground space-y-2 text-xs">
        <p>
          <Pill className={CLAIM_STYLE.reported}>reported</Pill> happened ·{' '}
          <Pill className={CLAIM_STYLE.conditional}>conditional</Pill> forecast or plan ·{' '}
          <Pill className={CLAIM_STYLE.opinion}>opinion</Pill> someone’s assessment
        </p>
        <p>
          Read by a locally trained model{analysis.model_version ? ` (${analysis.model_version})` : ''}
          {analysis.seconds ? ` in ${analysis.seconds.toFixed(1)} s` : ''},{' '}
          {formatEasternDateTime(analysis.analyzed_at)}.
          {analysis.hidden_low_factors > 0 &&
            ` ${analysis.hidden_low_factors} low-materiality factors are not shown.`}{' '}
          The label describes the article, not the stock’s direction, and is not a recommendation.
        </p>
        <Button size="sm" variant="outline" disabled={reanalyzing} onClick={onReanalyze}>
          <RefreshCw className={cn(reanalyzing && 'animate-spin')} /> Re-analyze
        </Button>
      </div>
    </div>
  )
}

/** Full-article analysis of one news item, opened beside the news list. */
export function NewsAnalysisSheet({
  ticker,
  itemId,
  title,
  onOpenChange,
}: {
  ticker: string
  itemId: number | null
  /** Shown while the analysis loads. */
  title?: string
  onOpenChange: (open: boolean) => void
}) {
  const query = useNewsItemAnalysis(ticker, itemId)
  const analyze = useAnalyzeNewsItem(ticker, itemId)
  const started = useRef<number | null>(null)

  // Not analyzed yet: analyze once when the panel opens (about 1-3 s).
  useEffect(() => {
    if (itemId !== null && query.isSuccess && query.data === null && started.current !== itemId) {
      started.current = itemId
      analyze.mutate(false)
    }
  }, [itemId, query.isSuccess, query.data, analyze])

  const analysis = query.data ?? (analyze.data?.item.id === itemId ? analyze.data : undefined)
  const item = analysis?.item
  return (
    <Sheet open={itemId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="pr-6 font-serif text-xl leading-snug">{item?.title ?? title ?? 'Article'}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <span className="bg-foreground text-background rounded px-1.5 py-0.5 text-[11px] font-bold">
              {ticker}
            </span>
            {item && (
              <>
                <span>{formatSourceName(item.source)}</span>
                <span>·</span>
                <span>{formatEasternDateTime(item.published_at)}</span>
                <span>·</span>
                <a
                  href={analysis?.resolved_url ?? item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline"
                >
                  Original <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </>
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-8">
          {query.isPending && itemId !== null && <Skeleton className="h-96 w-full" />}
          {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
          {!analysis && analyze.isPending && (
            <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
              <Spinner /> Reading the full article…
            </div>
          )}
          {!analysis && analyze.isError && (
            <ErrorState error={analyze.error} onRetry={() => analyze.mutate(false)} />
          )}
          {analysis && (
            <AnalysisBody
              analysis={analysis}
              reanalyzing={analyze.isPending}
              onReanalyze={() => analyze.mutate(true)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
