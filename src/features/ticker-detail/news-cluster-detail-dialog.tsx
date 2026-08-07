import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { SentimentBadge } from '@/components/shared/sentiment-badge'
import { getNewsClusterDetail } from '@/api/stocks'
import { formatDateTime, stripHtml } from '@/lib/format'

export function NewsClusterDetailDialog({
  ticker,
  clusterId,
  onOpenChange,
}: {
  ticker: string
  clusterId: number | null
  onOpenChange: (open: boolean) => void
}) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['news-cluster-detail', ticker, clusterId],
    queryFn: () => getNewsClusterDetail(ticker, clusterId as number),
    enabled: clusterId !== null,
  })

  return (
    <Dialog open={clusterId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{data?.representative_title ?? 'News cluster'}</DialogTitle>
        </DialogHeader>

        {isPending && <Skeleton className="h-40 rounded-lg" />}
        {isError && <ErrorState error={error} onRetry={() => refetch()} />}

        {data && (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            {data.items.map((item) => (
              <div key={item.id} className="border-border space-y-1.5 border-b pb-3 last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                  >
                    {item.title}
                    <ExternalLink className="size-3.5 shrink-0" />
                  </a>
                </div>
                {item.summary && (
                  <p className="text-muted-foreground text-sm">{stripHtml(item.summary)}</p>
                )}
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  <span>{item.source}</span>
                  <span>·</span>
                  <span>{formatDateTime(item.published_at)}</span>
                  {item.sentiment_label && (
                    <SentimentBadge label={item.sentiment_label} score={item.sentiment_score} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
