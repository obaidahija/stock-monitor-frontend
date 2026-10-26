import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { RedditPostCard } from '@/features/reddit/reddit-post-card'
import { RedditPostDetailDialog } from '@/features/reddit/reddit-post-detail-dialog'
import {
  useRedditSearch,
  useRedditSearchFollow,
  useSearchRedditTicker,
} from '@/features/reddit/hooks'
import { OperationProgress } from '@/features/reddit/operation-progress'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { RedditPostType } from '@/api/reddit'
import type { RedditPostOut, RedditSort } from '@/types/api'

const SORT_OPTIONS: { label: string; value: RedditSort }[] = [
  { label: 'Signal', value: 'signal' },
  { label: 'Newest', value: 'newest' },
  { label: 'Virality', value: 'virality' },
  { label: 'Score', value: 'score' },
  { label: 'Comments', value: 'comments' },
]

const POST_TYPE_OPTIONS: { label: string; value: RedditPostType }[] = [
  { label: 'News', value: 'news' },
  { label: 'Recommendation', value: 'recommendation' },
  { label: 'Analysis', value: 'analysis' },
  { label: 'General', value: 'general' },
  { label: 'Other', value: 'other' },
]

export function RedditTab({ ticker }: { ticker: string }) {
  const [sort, setSort] = useState<RedditSort>('signal')
  const [postTypes, setPostTypes] = useState<RedditPostType[]>([])
  const [selectedPost, setSelectedPost] = useState<RedditPostOut | null>(null)
  const searchCache = useRedditSearch(ticker, sort)
  const search = useSearchRedditTicker()
  const items = searchCache.data?.items ?? []
  // Cache-only search results are already fully loaded (capped at ~20), so
  // filtering client-side avoids needing post_types support on the
  // per-ticker search endpoint for what's a small, already-fetched list.
  const filteredItems =
    postTypes.length > 0
      ? items.filter((post) => post.post_type && postTypes.includes(post.post_type as RedditPostType))
      : items

  function togglePostType(value: RedditPostType) {
    setPostTypes((current) =>
      current.includes(value) ? current.filter((t) => t !== value) : [...current, value]
    )
  }

  // Followed per ticker, so a search queued on another ticker page never refreshes this one.
  const { operation } = useRedditSearchFollow(ticker)
  const isRefreshing =
    search.isPending || (operation !== null && operation.status !== 'failed')

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

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs">Type</span>
        <div className="flex flex-wrap gap-1">
          {POST_TYPE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={postTypes.includes(opt.value) ? 'secondary' : 'ghost'}
              onClick={() => togglePostType(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <OperationProgress
        operation={operation}
        labels={{
          queued: 'Reddit refresh queued…',
          running: 'Collecting Reddit discussions…',
          deferred: 'Reddit refresh waiting to retry…',
        }}
        failure="Reddit refresh failed"
        retryLabel="Retry"
        onRetry={() => search.mutate({ ticker, force: true })}
        retrying={search.isPending}
      />
      {searchCache.isPending && <Skeleton className="h-64 rounded-xl" />}
      {searchCache.isError && <ErrorState error={searchCache.error} />}
      {items.length === 0 && (
        <EmptyState
          title={`No Reddit discussions loaded for ${ticker}`}
          description="Refresh Reddit to collect current ticker discussions."
        />
      )}
      {items.length > 0 && filteredItems.length === 0 && (
        <EmptyState
          title={`No ${ticker} Reddit posts match the selected type(s)`}
          description="Try clearing the type filter above or wait for classification to catch up."
        />
      )}
      {filteredItems.length > 0 && (
        <div className="space-y-2">
          {filteredItems.map((post) => (
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
