import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSearchTicker, useTwitterSearchCache } from '@/features/twitter/hooks'
import { useTwitterOperationPoll } from '@/features/twitter/use-operation-poll'
import { TweetRow } from '@/features/twitter/tweet-row'
import { TweetDetailDialog } from '@/features/twitter/tweet-detail-dialog'
import type { TwitterSort } from '@/api/twitter'
import type { TwitterPostOut } from '@/types/api'

const SORT_OPTIONS: { label: string; value: TwitterSort }[] = [
  { label: 'Signal', value: 'signal' },
  { label: 'Newest', value: 'newest' },
  { label: 'Virality', value: 'virality' },
]

export function TwitterTab({ ticker }: { ticker: string }) {
  const [sort, setSort] = useState<TwitterSort>('signal')
  const [selectedPost, setSelectedPost] = useState<TwitterPostOut | null>(null)
  const queryClient = useQueryClient()

  // Cache-only on load/sort-change — never triggers a live search by itself.
  const { data, isPending, isError, error } = useTwitterSearchCache(ticker, sort)
  const search = useSearchTicker()

  const pollingOperationId = search.data?.operation?.id ?? null
  const poll = useTwitterOperationPoll(pollingOperationId, () => {
    queryClient.invalidateQueries({ queryKey: ['twitter', 'search', ticker, sort] })
  })
  const isRefreshing =
    search.isPending || poll.data?.status === 'running' || poll.data?.status === 'queued'

  function runSearch() {
    search.mutate({ ticker, sort })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
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
        <div className="flex items-center gap-2">
          {data?.cache_fetched_at && !isRefreshing && (
            <p className="text-muted-foreground text-xs">
              Updated {formatRelativeTime(data.cache_fetched_at)}
            </p>
          )}
          <Button size="sm" variant="outline" disabled={isRefreshing} onClick={runSearch}>
            <RefreshCw className={cn(isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {isPending && <Skeleton className="h-64 rounded-xl" />}
      {isError && <ErrorState error={error} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title={`No tweets loaded for ${ticker} yet`}
          description="Click refresh to search X directly for this ticker."
        />
      )}

      {data && data.items.length > 0 && (
        <div className="space-y-2">
          {data.items.map((post) => (
            <TweetRow key={post.id} post={post} onSelect={setSelectedPost} />
          ))}
        </div>
      )}

      <TweetDetailDialog post={selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)} />
    </div>
  )
}
