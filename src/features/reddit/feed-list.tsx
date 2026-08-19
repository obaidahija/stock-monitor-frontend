import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Pagination } from '@/components/shared/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import type { RedditFeedFilter, RedditPostOut, RedditSort } from '@/types/api'
import { useRedditFeed } from './hooks'
import { RedditPostCard } from './reddit-post-card'
import { RedditPostDetailDialog } from './reddit-post-detail-dialog'

export function RedditFeedList() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const query = useRedditFeed({ filter: (params.get('filter') as RedditFeedFilter) || 'all', sort: (params.get('sort') as RedditSort) || 'signal', subreddit: params.get('subreddit') || undefined, page })
  const [selected, setSelected] = useState<RedditPostOut | null>(null)
  if (query.isPending) return <Skeleton className="h-64" aria-label="Loading Reddit feed" />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (!query.data?.items.length) return <EmptyState title="No Reddit discussions yet" description="Add trusted sources, monitor a ticker, or refresh the feed." />
  return <div className="space-y-3"><div className="space-y-2">{query.data.items.map((post) => <RedditPostCard key={post.id} post={post} onSelect={setSelected} />)}</div><Pagination page={page} totalPages={Math.max(1, Math.ceil(query.data.total / query.data.page_size))} onPageChange={(nextPage) => setParams((previous) => { const next = new URLSearchParams(previous); if (nextPage === 1) next.delete('page'); else next.set('page', String(nextPage)); return next })} /><RedditPostDetailDialog post={selected} onOpenChange={(open) => { if (!open) setSelected(null) }} /></div>
}
