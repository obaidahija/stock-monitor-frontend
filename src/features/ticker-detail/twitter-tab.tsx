import { useCallback, useId, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { Pagination } from '@/components/shared/pagination'
import {
  twitterSearchOperationKey,
  useSearchTicker,
  useTwitterFeed,
  useTwitterSearchCache,
  useTwitterSearchOperation,
} from '@/features/twitter/hooks'
import { useTwitterOperationPoll } from '@/features/twitter/use-operation-poll'
import { TweetRow } from '@/features/twitter/tweet-row'
import { TweetDetailDialog } from '@/features/twitter/tweet-detail-dialog'
import type { TweetType, TwitterMinimumViews, TwitterSort } from '@/api/twitter'
import { formatRelativeTime } from '@/lib/format'
import { ApiError } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { TwitterOperationOut, TwitterPostOut } from '@/types/api'
import { CompanyPostsSection } from './company-x/company-posts-section'

const SORT_OPTIONS: { label: string; value: TwitterSort }[] = [
  { label: 'Signal', value: 'signal' },
  { label: 'Newest', value: 'newest' },
  { label: 'Virality', value: 'virality' },
]

const TWEET_TYPE_OPTIONS: { label: string; value: TweetType }[] = [
  { label: 'News', value: 'news' },
  { label: 'Recommendation', value: 'recommendation' },
  { label: 'Analysis', value: 'analysis' },
  { label: 'General', value: 'general' },
  { label: 'Other', value: 'other' },
]

interface MentionsView {
  ticker: string
  sort: TwitterSort
  page: number
  tweetTypes: TweetType[]
}

/**
 * Posts that trusted accounts made about this ticker, from the general feed with
 * `filter=trusted` (its usual 72-hour window). Popularity never hides one: sort and
 * type are the only controls, and nothing here starts a live X search.
 */
function TrustedMentions({ ticker }: { ticker: string }) {
  const headingId = useId()
  const [view, setView] = useState<MentionsView>({
    ticker,
    sort: 'signal',
    page: 1,
    tweetTypes: [],
  })
  // A different ticker starts from the defaults rather than carrying the old page.
  const current: MentionsView =
    view.ticker === ticker ? view : { ticker, sort: 'signal', page: 1, tweetTypes: [] }
  const [selectedPost, setSelectedPost] = useState<TwitterPostOut | null>(null)

  const { data, isPending, isError, error, refetch } = useTwitterFeed({
    filter: 'trusted',
    tickers: [ticker],
    sort: current.sort,
    page: current.page,
    tweetTypes: current.tweetTypes,
  })

  function update(next: Partial<MentionsView>) {
    setView({ ...current, ...next })
  }

  function toggleTweetType(value: TweetType) {
    const tweetTypes = current.tweetTypes.includes(value)
      ? current.tweetTypes.filter((type) => type !== value)
      : [...current.tweetTypes, value]
    update({ tweetTypes, page: 1 })
  }

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="text-sm font-semibold">
          Trusted-account mentions
        </h3>
        <div className="flex items-center gap-1">
          {SORT_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={current.sort === option.value ? 'secondary' : 'ghost'}
              aria-pressed={current.sort === option.value}
              onClick={() => update({ sort: option.value, page: 1 })}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs">Type</span>
        <div className="flex flex-wrap gap-1">
          {TWEET_TYPE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={current.tweetTypes.includes(option.value) ? 'secondary' : 'ghost'}
              aria-pressed={current.tweetTypes.includes(option.value)}
              onClick={() => toggleTweetType(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {isPending && <Skeleton className="h-64 rounded-xl" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && data.items.length === 0 && current.tweetTypes.length > 0 && (
        <EmptyState
          title={`No ${ticker} mentions match the selected type(s)`}
          description="Clear the type filter or wait for classification to catch up."
        />
      )}

      {data && data.items.length === 0 && current.tweetTypes.length === 0 && (
        <EmptyState
          title={`No trusted-account mentions of ${ticker} in the last 72 hours.`}
          description="Mentions appear here as trusted accounts post about this ticker."
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
              Showing {(current.page - 1) * data.page_size + 1}–
              {(current.page - 1) * data.page_size + data.items.length} of {data.total}
            </p>
            <Pagination
              page={current.page}
              totalPages={Math.max(1, Math.ceil(data.total / data.page_size))}
              onPageChange={(page) => update({ page })}
            />
          </div>
        </>
      )}

      <TweetDetailDialog post={selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)} />
    </section>
  )
}

const MINIMUM_VIEW_OPTIONS: TwitterMinimumViews[] = [1000, 2000, 3000, 5000]
const ACTIVE_OPERATION_STATUSES = new Set(['queued', 'running', 'deferred'])

/**
 * What anyone on X said about the ticker, from an explicit cashtag search. The
 * section reads the last search's cached results; only the Search button starts a
 * live search (one queued X request), so opening the tab never does.
 */
function CrowdSearch({ ticker }: { ticker: string }) {
  const headingId = useId()
  const queryClient = useQueryClient()
  const [sort, setSort] = useState<TwitterSort>('signal')
  const [minimumViews, setMinimumViews] = useState<TwitterMinimumViews>(2000)
  const [selectedPost, setSelectedPost] = useState<TwitterPostOut | null>(null)

  const cache = useTwitterSearchCache(ticker, sort)
  const search = useSearchTicker()
  const rememberedOperation = useTwitterSearchOperation(ticker)
  const onSearchFinished = useCallback((operation: TwitterOperationOut) => {
    queryClient.setQueryData(twitterSearchOperationKey(ticker), operation)
    const queryKey = ['twitter', 'search', ticker]
    // An initial cache read may still contain the previous search's snapshot.
    // Cancel it before refetching so completion cannot reuse that old request.
    void queryClient.cancelQueries({ queryKey }).then(() =>
      queryClient.invalidateQueries({ queryKey }),
    )
  }, [queryClient, ticker])
  const poll = useTwitterOperationPoll(rememberedOperation.data?.id ?? null, onSearchFinished)
  const operation = poll.data ?? rememberedOperation.data ?? null
  const operationMissing = poll.error instanceof ApiError && poll.error.status === 404
  const searching =
    search.isPending || rememberedOperation.isRequestPending ||
    (!operationMissing && operation !== null && ACTIVE_OPERATION_STATUSES.has(operation.status))
  const data = cache.data
  const items = data?.items ?? []
  const symbol = `$${ticker}`

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h3 id={headingId} className="text-sm font-semibold">
            X search
          </h3>
          <p className="text-muted-foreground text-xs">
            Posts from anyone on X that mention {symbol}. Searches only when you ask.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Select
            value={String(minimumViews)}
            onValueChange={(value) => setMinimumViews(Number(value) as TwitterMinimumViews)}
          >
            <SelectTrigger size="sm" aria-label="Minimum views">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {MINIMUM_VIEW_OPTIONS.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value.toLocaleString()} views
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={searching}
            onClick={() => search.mutate({ ticker, sort, minViews: minimumViews })}
          >
            <Search className={cn(searching && 'animate-pulse')} />
            {`Search X for ${symbol}`}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {SORT_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={sort === option.value ? 'secondary' : 'ghost'}
              aria-pressed={sort === option.value}
              onClick={() => setSort(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {poll.isError && !operationMissing
            ? 'Search status unavailable'
            : searching
            ? 'Searching X…'
            : data?.cache_fetched_at
              ? `Searched ${formatRelativeTime(data.cache_fetched_at)}`
              : null}
        </p>
      </div>

      {operation?.status === 'failed' && (
        <p className="text-destructive text-xs">
          {operation.public_error_message ?? 'The X search failed.'}
        </p>
      )}
      {search.isError && <ErrorState error={search.error} />}
      {poll.isError && (
        <ErrorState error={poll.error} onRetry={operationMissing ? undefined : () => { void poll.refetch() }} />
      )}
      {cache.isPending && <Skeleton className="h-40 rounded-xl" />}
      {cache.isError && <ErrorState error={cache.error} onRetry={() => cache.refetch()} />}

      {data && items.length === 0 && (
        <EmptyState
          title={
            data.cache_fetched_at
              ? `The last search found no ${symbol} posts.`
              : `X has not been searched for ${symbol} yet.`
          }
          description={
            data.cache_fetched_at
              ? 'Try a lower minimum views.'
              : 'Search to see recent posts that mention it. Each search is one live X request.'
          }
        />
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((post) => (
            <TweetRow key={post.id} post={post} onSelect={setSelectedPost} />
          ))}
        </div>
      )}

      <TweetDetailDialog post={selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)} />
    </section>
  )
}

/**
 * A ticker's Twitter view: posts from its confirmed company account first, then what
 * trusted accounts said about it, then an explicit X search. Each section pages on
 * its own; the company section collects only while this tab is the one on screen,
 * and the X search only when its button is pressed.
 */
export function TwitterTab({ ticker }: { ticker: string }) {
  return (
    <div className="space-y-8">
      <CompanyPostsSection ticker={ticker} />
      <TrustedMentions ticker={ticker} />
      <CrowdSearch key={ticker} ticker={ticker} />
    </div>
  )
}
