import { RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { CompetitorConfidence, CompetitorOut } from '@/types/api'
import { useCompetitors, useRefreshCompetitors } from '../hooks'
import { CompetitorRow } from './competitor-row'
import { CompetitorsSummary } from './competitors-summary'
import { ProgressPanel } from './progress-panel'

const IMPACT_RANK: Record<CompetitorConfidence, number> = { high: 0, medium: 1, low: 2 }
const CONFIDENCE_RANK: Record<CompetitorConfidence, number> = { high: 0, medium: 1, low: 2 }

const SORT_OPTIONS = [
  { value: 'rank', label: 'Rank' },
  { value: 'impact', label: 'Impact' },
  { value: 'confidence', label: 'Confidence' },
] as const
type SortOption = (typeof SORT_OPTIONS)[number]['value']

function sortCompetitors(competitors: CompetitorOut[], sort: SortOption): CompetitorOut[] {
  const sorted = [...competitors]
  if (sort === 'impact') {
    sorted.sort(
      (a, b) =>
        (a.impact_likelihood ? IMPACT_RANK[a.impact_likelihood] : 3) -
        (b.impact_likelihood ? IMPACT_RANK[b.impact_likelihood] : 3),
    )
  } else if (sort === 'confidence') {
    sorted.sort((a, b) => CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence])
  } else {
    sorted.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
  }
  return sorted
}

export function CompetitorsTab({ ticker }: { ticker: string }) {
  const {
    data,
    isPending,
    isError: isQueryError,
    error,
    refetch,
    isFetching,
  } = useCompetitors(ticker)
  const refresh = useRefreshCompetitors(ticker)
  const [sort, setSort] = useState<SortOption>('rank')

  const isLoading = isFetching || refresh.isPending
  const current = refresh.data ?? data ?? null
  const hasError = (isQueryError || refresh.isError) && !current

  const sortedCompetitors = useMemo(
    () => (current ? sortCompetitors(current.competitors, sort) : []),
    [current, sort],
  )

  function handleRefresh() {
    refresh.mutate()
  }

  if (isPending) {
    return (
      <div className="space-y-4">
        <ProgressPanel ticker={ticker} active={isLoading} />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  if (isQueryError && !current) {
    return <ErrorState error={error} onRetry={() => refetch()} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Evidence-grounded competitors extracted from SEC 10-K filings — named-competitor
          mentions, mutual naming, and business-concentration reads, ranked by an LLM reasoning
          over that gathered evidence. Informational only, not a trading signal.
        </p>
        <Button size="sm" variant="outline" disabled={isLoading} onClick={handleRefresh}>
          <RefreshCw className={cn(isLoading && 'animate-spin')} />
          {isLoading ? 'Analyzing…' : current ? 'Refresh' : 'Find competitors'}
        </Button>
      </div>

      <ProgressPanel ticker={ticker} active={isLoading} />

      {!current && !isLoading && !hasError && (
        <p className="text-muted-foreground text-sm">
          Click "Find competitors" to run this — fetches and reads 10-K filings for {ticker} and
          each named competitor, takes roughly 15-60s.
        </p>
      )}

      {!current && !isLoading && hasError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Couldn't find competitors for {ticker}.
        </p>
      )}

      {current && !current.source.ok && (
        <p className="text-muted-foreground text-sm">
          Competitor identification unavailable right now
          {current.source.error ? `: ${current.source.error}` : '.'}
        </p>
      )}

      {current && current.source.ok && (
        <div className="space-y-4">
          {current.competitors.length > 0 ? (
            <>
              <CompetitorsSummary competitors={current.competitors} />

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs font-medium">Sort by</span>
                <div className="flex items-center gap-1">
                  {SORT_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      size="sm"
                      variant={sort === opt.value ? 'secondary' : 'ghost'}
                      onClick={() => setSort(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {sortedCompetitors.map((competitor) => (
                  <CompetitorRow
                    key={`${competitor.name}-${competitor.ticker}`}
                    competitor={competitor}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              {ticker}'s 10-K doesn't explicitly name any specific competitor companies.
            </p>
          )}

          <p className="text-muted-foreground text-xs">{current.caveat}</p>
        </div>
      )}
    </div>
  )
}
