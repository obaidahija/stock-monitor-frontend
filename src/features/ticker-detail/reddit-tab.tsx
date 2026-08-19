import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { RedditPostCard } from '@/features/reddit/reddit-post-card'
import { RedditPostDetailDialog } from '@/features/reddit/reddit-post-detail-dialog'
import { useRedditSearch, useSearchRedditTicker } from '@/features/reddit/hooks'
import { useRedditOperationPoll } from '@/features/reddit/use-operation-poll'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { RedditPostOut, RedditSort } from '@/types/api'

const SORT_OPTIONS: { label: string; value: RedditSort }[] = [
  { label: 'Signal', value: 'signal' },
  { label: 'Newest', value: 'newest' },
  { label: 'Virality', value: 'virality' },
  { label: 'Score', value: 'score' },
  { label: 'Comments', value: 'comments' },
]

export function RedditTab({ ticker }: { ticker: string }) {
  const [sort, setSort] = useState<RedditSort>('signal')
  const [selectedPost, setSelectedPost] = useState<RedditPostOut | null>(null)
  const queryClient = useQueryClient()
  const searchCache = useRedditSearch(ticker, sort)
  const search = useSearchRedditTicker()
  const operationId = search.data?.operation?.id ?? null
  const poll = useRedditOperationPoll(operationId, () => {
    queryClient.invalidateQueries({ queryKey: ['reddit', 'search', ticker, sort] })
  })
  const isRefreshing =
    search.isPending || poll.data?.status === 'queued' || poll.data?.status === 'running'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {SORT_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={sort === option.value ? 'secondary' : 'ghost'}
              onClick={() => setSort(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {searchCache.data?.generated_at && !isRefreshing && (
            <p className="text-muted-foreground text-xs">
              Updated {formatRelativeTime(searchCache.data.generated_at)}
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={isRefreshing}
            onClick={() => search.mutate({ ticker, force: true })}
          >
            <RefreshCw className={cn(isRefreshing && 'animate-spin')} />
            Refresh Reddit
          </Button>
        </div>
      </div>

      {searchCache.isPending && <Skeleton className="h-64 rounded-xl" />}
      {searchCache.isError && <ErrorState error={searchCache.error} />}
      {searchCache.data?.items.length === 0 && (
        <EmptyState
          title={`No Reddit discussions loaded for ${ticker}`}
          description="Refresh Reddit to collect current ticker discussions."
        />
      )}
      {!!searchCache.data?.items.length && (
        <div className="space-y-2">
          {searchCache.data.items.map((post) => (
            <RedditPostCard key={post.id} post={post} onSelect={setSelectedPost} />
          ))}
        </div>
      )}
      <RedditPostDetailDialog
        post={selectedPost}
        onOpenChange={(open) => !open && setSelectedPost(null)}
      />
    </div>
  )
}
