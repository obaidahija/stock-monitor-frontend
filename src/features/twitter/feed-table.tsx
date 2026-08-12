import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { Pagination } from '@/components/shared/pagination'
import { useTwitterFeed } from './hooks'
import { TweetRow } from './tweet-row'
import { TweetDetailDialog } from './tweet-detail-dialog'
import type { TwitterFeedFilter, TwitterSort } from '@/api/twitter'
import type { TwitterPostOut } from '@/types/api'

export function FeedTable({ refetchInterval = false }: { refetchInterval?: number | false }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = (searchParams.get('filter') as TwitterFeedFilter) || 'all'
  const sort = (searchParams.get('sort') as TwitterSort) || 'signal'
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const [selectedPost, setSelectedPost] = useState<TwitterPostOut | null>(null)

  const { data, isPending, isError, error, refetch } = useTwitterFeed(
    { filter, sort, page },
    refetchInterval,
  )

  function goToPage(nextPage: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (nextPage > 1) next.set('page', String(nextPage))
      else next.delete('page')
      return next
    })
  }

  return (
    <div className="space-y-3">
      {isPending && <Skeleton className="h-64 rounded-xl" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.items.length === 0 && (
        <EmptyState
          title="No tweets in the feed yet"
          description="Add a trusted account or wait for the next viral scan, then try refreshing."
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="space-y-2">
            {data.items.map((post) => (
              <TweetRow key={post.id} post={post} onSelect={setSelectedPost} />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">
              Showing {(page - 1) * data.page_size + 1}–{(page - 1) * data.page_size + data.items.length}{' '}
              of {data.total}
            </p>
            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil(data.total / data.page_size))}
              onPageChange={goToPage}
            />
          </div>
        </>
      )}

      <TweetDetailDialog post={selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)} />
    </div>
  )
}
