import { useSearchParams } from 'react-router'
import { RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { TickerTagFilter } from '@/components/shared/ticker-tag-filter'
import { cn } from '@/lib/utils'
import { useRefreshFeed } from './hooks'
import { useSelectedTrustedAccounts } from './trusted-accounts-section'
import type { TweetType, TwitterFeedFilter, TwitterSort } from '@/api/twitter'

const FILTER_OPTIONS: { label: string; value: TwitterFeedFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Trusted', value: 'trusted' },
  { label: 'Viral', value: 'viral' },
]

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

export function FeedControls({ onRefreshed }: { onRefreshed: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = (searchParams.get('filter') as TwitterFeedFilter) || 'all'
  const sort = (searchParams.get('sort') as TwitterSort) || 'signal'
  const tickers = searchParams.get('tickers')?.split(',').filter(Boolean) ?? []
  const tweetTypes = searchParams.get('tweet_types')?.split(',').filter(Boolean) ?? []
  const { selected: accounts, setSelected: setAccounts } = useSelectedTrustedAccounts()
  const refreshFeed = useRefreshFeed()

  function updateParams(updates: Record<string, string | undefined>) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) next.delete(key)
        else next.set(key, value)
      }
      next.delete('page')
      return next
    })
  }

  function toggleTweetType(value: TweetType) {
    const next = tweetTypes.includes(value)
      ? tweetTypes.filter((t) => t !== value)
      : [...tweetTypes, value]
    updateParams({ tweet_types: next.length > 0 ? next.join(',') : undefined })
  }

  function runRefresh() {
    refreshFeed.mutate(undefined, {
      onSuccess: () => {
        toast.success('Feed refresh triggered')
        onRefreshed()
      },
      onError: () => toast.error('Failed to refresh feed'),
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {FILTER_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={filter === opt.value ? 'secondary' : 'ghost'}
                onClick={() => updateParams({ filter: opt.value === 'all' ? undefined : opt.value })}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <span className="text-muted-foreground text-xs">Sort</span>
          <div className="flex items-center gap-1">
            {SORT_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={sort === opt.value ? 'secondary' : 'ghost'}
                onClick={() => updateParams({ sort: opt.value === 'signal' ? undefined : opt.value })}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <TickerTagFilter
            selected={tickers}
            onChange={(next) => updateParams({ tickers: next.length > 0 ? next.join(',') : undefined })}
          />
          {accounts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {accounts.map((username) => (
                <span
                  key={username}
                  className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-xs font-medium"
                >
                  @{username}
                  <button
                    type="button"
                    aria-label={`Stop filtering by @${username}`}
                    onClick={() => setAccounts(accounts.filter((u) => u !== username))}
                    className="hover:bg-secondary-foreground/20 rounded-full p-0.5"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <Button size="sm" variant="outline" disabled={refreshFeed.isPending} onClick={runRefresh}>
          <RefreshCw className={cn(refreshFeed.isPending && 'animate-spin')} />
          Refresh feed
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs">Type</span>
        <div className="flex items-center gap-1">
          {TWEET_TYPE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={tweetTypes.includes(opt.value) ? 'secondary' : 'ghost'}
              onClick={() => toggleTweetType(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
