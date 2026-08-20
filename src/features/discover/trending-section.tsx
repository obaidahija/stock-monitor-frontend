import { useNavigate } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { formatScore } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useTrending } from './hooks'
import { RankedBarRow, SentimentLegend, TONE_TEXT_CLASS, sentimentTone } from './ranked-bar-row'

const BUZZ_SCORE_MAX = 100

export function TrendingSection() {
  const { data, isPending, isError, error, refetch } = useTrending(20)
  const navigate = useNavigate()

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="font-semibold">Trending on Reddit</h2>
        <div className="flex items-center gap-3">
          <SentimentLegend />
          <p className="text-muted-foreground text-xs">
            Buzz score (0-100), refreshed once/day
          </p>
        </div>
      </div>

      {isPending && <Skeleton className="h-40 rounded-xl" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.length === 0 && (
        <EmptyState
          title="No trending data yet"
          description="Populated once/day by the social_ingest job."
        />
      )}

      {data && data.length > 0 && (
        <div className="divide-border divide-y">
          {data.map((item, index) => {
            const tone = sentimentTone(item.sentiment_score)
            const pct = item.buzz_score !== null ? (item.buzz_score / BUZZ_SCORE_MAX) * 100 : 0
            return (
              <RankedBarRow
                key={item.ticker}
                rank={index + 1}
                onNavigate={() => navigate(`/stocks/${item.ticker}?tab=reddit`)}
                identity={<span className="font-medium">{item.ticker}</span>}
                pct={pct}
                tone={tone}
                primaryValue={item.buzz_score !== null ? item.buzz_score.toFixed(0) : '—'}
                meta={
                  <>
                    {item.mentions !== null && (
                      <>{item.mentions.toLocaleString()} mentions · </>
                    )}
                    <span className={cn(TONE_TEXT_CLASS[tone])}>
                      {formatScore(item.sentiment_score)}
                    </span>
                    {item.trend && <span className="capitalize"> · {item.trend}</span>}
                  </>
                }
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
