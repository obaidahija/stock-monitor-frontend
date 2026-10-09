import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { Pagination } from '@/components/shared/pagination'
import { useTwitterFeed } from '@/features/twitter/hooks'
import { TweetRow } from '@/features/twitter/tweet-row'
import { TweetDetailDialog } from '@/features/twitter/tweet-detail-dialog'
import type { TweetType, TwitterSort } from '@/api/twitter'
import type { TwitterPostOut } from '@/types/api'
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

/**
 * A ticker's Twitter view: posts from its confirmed company account first, then what
 * trusted accounts said about it. Each section pages on its own; only the company
 * section can collect, and only while this tab is the one on screen.
 */
export function TwitterTab({ ticker }: { ticker: string }) {
  return (
    <div className="space-y-8">
      <CompanyPostsSection ticker={ticker} />
      <TrustedMentions ticker={ticker} />
    </div>
  )
}
