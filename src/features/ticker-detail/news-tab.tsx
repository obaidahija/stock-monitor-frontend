import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { PagedList } from '@/components/shared/paged-list'
import { SentimentBadge } from '@/components/shared/sentiment-badge'
import { formatEasternDateTime, formatRelativeTime } from '@/lib/format'
import { formatSourceName } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { NewsClusterOut } from '@/types/api'
import { useNews, useRefreshNews } from './hooks'
import { NewsClusterDetailDialog } from './news-cluster-detail-dialog'
import { SentimentTrendChart } from './sentiment-trend-chart'

const WINDOWS = [
  { label: '24h', hours: 24 },
  { label: '7d', hours: 24 * 7 },
  { label: '30d', hours: 24 * 30 },
]

const NEWS_PAGE_SIZE = 20

/** "3 stories · 1 positive · 1 negative · 0 neutral · 1 unscored" for the stories on screen. */
function sentimentCountLine(clusters: NewsClusterOut[]): string {
  let positive = 0
  let negative = 0
  let neutral = 0
  let unscored = 0
  for (const cluster of clusters) {
    if (cluster.sentiment_label === 'positive') positive += 1
    else if (cluster.sentiment_label === 'negative') negative += 1
    else if (cluster.sentiment_label === 'neutral') neutral += 1
    else unscored += 1
  }
  const parts = [
    `${clusters.length} ${clusters.length === 1 ? 'story' : 'stories'}`,
    `${positive} positive`,
    `${negative} negative`,
    `${neutral} neutral`,
  ]
  if (unscored > 0) parts.push(`${unscored} unscored`)
  return parts.join(' · ')
}

function clusterSources(cluster: NewsClusterOut): string {
  return [...new Set(cluster.sources.map(formatSourceName))].join(', ')
}

export function NewsTab({ ticker }: { ticker: string }) {
  const [hours, setHours] = useState(24)
  const [materialOnly, setMaterialOnly] = useState(false)
  const [openClusterId, setOpenClusterId] = useState<number | null>(null)
  const { data, isPending, isError, error, refetch } = useNews(ticker, hours)
  const refreshNews = useRefreshNews(ticker)
  const visible = data ? (materialOnly ? data.filter((cluster) => cluster.is_material) : data) : []

  function runRefresh() {
    refreshNews.mutate(undefined, {
      onSuccess: (result) => {
        const parts = [`${result.new} new`]
        if (result.duplicates) parts.push(`${result.duplicates} duplicates`)
        if (!result.ai_summaries.skipped && result.ai_summaries.generated) {
          parts.push(`${result.ai_summaries.generated} AI summaries`)
        }
        if (result.errors.length) parts.push(`${result.errors.length} source errors`)
        toast[result.errors.length ? 'error' : 'success'](
          `Refreshed news for ${result.ticker}: ${parts.join(', ')}`,
        )
      },
      onError: () => toast.error(`Failed to refresh news for ${ticker}`),
    })
  }

  return (
    <div className="space-y-4">
      <SentimentTrendChart ticker={ticker} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {WINDOWS.map((w) => (
            <Button
              key={w.hours}
              size="sm"
              variant={hours === w.hours ? 'secondary' : 'ghost'}
              onClick={() => setHours(w.hours)}
            >
              {w.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant={materialOnly ? 'secondary' : 'ghost'}
            aria-pressed={materialOnly}
            onClick={() => setMaterialOnly((value) => !value)}
          >
            Material only
          </Button>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={refreshNews.isPending}
          onClick={runRefresh}
        >
          <RefreshCw className={cn(refreshNews.isPending && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {isPending && <Skeleton className="h-64 rounded-xl" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <EmptyState
          title="No news in this window"
          description="This ticker may not be in the tracked universe yet (e.g. an ETF like QQQ) — try refreshing to pull news for it directly."
          action={
            <Button size="sm" variant="outline" disabled={refreshNews.isPending} onClick={runRefresh}>
              <RefreshCw className={cn(refreshNews.isPending && 'animate-spin')} />
              Refresh news
            </Button>
          }
        />
      )}

      {data && data.length > 0 && (
        <p className="text-muted-foreground text-xs">{sentimentCountLine(visible)}</p>
      )}

      {data && data.length > 0 && visible.length === 0 && (
        <EmptyState
          title="No material news in this window"
          description="Turn off Material only to see routine stories too."
        />
      )}

      {visible.length > 0 && (
        <PagedList key={`${hours}-${materialOnly}`} items={visible} pageSize={NEWS_PAGE_SIZE}>
          {(clusters) => (
            <div className="space-y-2">
              {clusters.map((cluster) => (
                <Card
                  key={cluster.id}
                  className="hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => setOpenClusterId(cluster.id)}
                >
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{cluster.representative_title}</p>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                        {!cluster.is_material && (
                          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                            Routine
                          </span>
                        )}
                        <span title={formatEasternDateTime(cluster.last_seen_at)}>
                          {formatRelativeTime(cluster.last_seen_at)}
                        </span>
                        <span>·</span>
                        <span>{clusterSources(cluster)}</span>
                        {cluster.item_count > 1 && (
                          <>
                            <span>·</span>
                            <span>{cluster.item_count} sources</span>
                          </>
                        )}
                      </div>
                    </div>
                    <SentimentBadge label={cluster.sentiment_label} score={cluster.sentiment_net_score} />
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </PagedList>
      )}

      <NewsClusterDetailDialog
        ticker={ticker}
        clusterId={openClusterId}
        onOpenChange={(open) => !open && setOpenClusterId(null)}
      />
    </div>
  )
}
