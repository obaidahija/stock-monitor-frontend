import { useState } from 'react'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { SentimentBadge } from '@/components/shared/sentiment-badge'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useNews } from './hooks'
import { NewsClusterDetailDialog } from './news-cluster-detail-dialog'

const WINDOWS = [
  { label: '24h', hours: 24 },
  { label: '7d', hours: 24 * 7 },
  { label: '30d', hours: 24 * 30 },
]

export function NewsTab({ ticker }: { ticker: string }) {
  const [hours, setHours] = useState(24)
  const [openClusterId, setOpenClusterId] = useState<number | null>(null)
  const { data, isPending, isError, error, refetch } = useNews(ticker, hours)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
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
      </div>

      {isPending && <Skeleton className="h-64 rounded-xl" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && data.length === 0 && <EmptyState title="No news in this window" />}

      {data && data.length > 0 && (
        <div className="space-y-2">
          {data.map((cluster) => (
            <Card
              key={cluster.id}
              className="hover:bg-muted/40 cursor-pointer transition-colors"
              onClick={() => setOpenClusterId(cluster.id)}
            >
              <CardHeader className={cn('flex flex-row items-start justify-between gap-4')}>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{cluster.representative_title}</p>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                    <span>{formatRelativeTime(cluster.last_seen_at)}</span>
                    <span>·</span>
                    <span>{cluster.sources.join(', ')}</span>
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

      <NewsClusterDetailDialog
        ticker={ticker}
        clusterId={openClusterId}
        onOpenChange={(open) => !open && setOpenClusterId(null)}
      />
    </div>
  )
}
