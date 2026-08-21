import { useState } from 'react'
import { Check, RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSearchTicker, useTwitterSearchCache } from '@/features/twitter/hooks'
import { useTwitterOperationPoll } from '@/features/twitter/use-operation-poll'
import { TweetRow } from '@/features/twitter/tweet-row'
import { TweetDetailDialog } from '@/features/twitter/tweet-detail-dialog'
import type { TwitterMinimumViews, TwitterSort } from '@/api/twitter'
import type { TwitterPostOut } from '@/types/api'

const SORT_OPTIONS: { label: string; value: TwitterSort }[] = [
  { label: 'Signal', value: 'signal' },
  { label: 'Newest', value: 'newest' },
  { label: 'Virality', value: 'virality' },
]

const MINIMUM_VIEW_OPTIONS: TwitterMinimumViews[] = [1000, 2000, 3000, 5000]

export function TwitterTab({ ticker }: { ticker: string }) {
  const [sort, setSort] = useState<TwitterSort>('signal')
  const [selectedPost, setSelectedPost] = useState<TwitterPostOut | null>(null)
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false)
  const [minimumViews, setMinimumViews] = useState<TwitterMinimumViews>(2000)
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

  function openRefreshDialog() {
    setMinimumViews(2000)
    setRefreshDialogOpen(true)
  }

  function runSearch() {
    search.mutate({ ticker, sort, minViews: minimumViews })
    setRefreshDialogOpen(false)
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
          <Button
            size="sm"
            variant="outline"
            disabled={isRefreshing}
            onClick={openRefreshDialog}
          >
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

      <Dialog open={refreshDialogOpen} onOpenChange={setRefreshDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refresh {ticker} tweets</DialogTitle>
            <DialogDescription>
              Choose the minimum number of views a tweet needs for this refresh.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <p className="text-sm font-medium">Minimum views</p>
            <div className="grid grid-cols-2 gap-2">
              {MINIMUM_VIEW_OPTIONS.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={minimumViews === value ? 'default' : 'outline'}
                  aria-pressed={minimumViews === value}
                  onClick={() => setMinimumViews(value)}
                >
                  {minimumViews === value && <Check />}
                  {value.toLocaleString()} views
                </Button>
              ))}
            </div>
            <p className="bg-primary/5 text-primary rounded-lg px-3 py-2 text-sm font-medium">
              Selected: {minimumViews.toLocaleString()} minimum views
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={runSearch}>
              <RefreshCw />
              Refresh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
