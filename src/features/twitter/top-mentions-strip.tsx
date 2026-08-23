import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import {
  TickerMentionStrip,
  TickerMentionStripSkeleton,
} from '@/components/shared/ticker-mention-strip'
import {
  useRefreshTwitterBestStocks,
  useTrending,
  useTwitterBestStocks,
} from '@/features/discover/hooks'
import { blendedSentiment, mergeSocialBuzz, TONE_TEXT, toneOf } from '@/features/discover/social-buzz'
import { formatNumber, formatScore } from '@/lib/format'
import { cn } from '@/lib/utils'

const LIMIT = 20
const MAX_CHIPS = 12

/**
 * Twitter's answer to Discover's Social Buzz leaderboard, rendered through
 * the same TickerMentionStrip as Reddit's Top Mentions: a horizontally-
 * scrollable strip of the tickers with the most combined Reddit + Twitter
 * attention (same blended ranking Discover uses -- trusted-account Twitter
 * mentions alone are too thin a sample to rank on their own), tinted by
 * rank. Doubles as a shortcut into the feed's own ticker filter -- clicking
 * a chip toggles that ticker into `tickers`, the same URL param
 * `TickerTagFilter`/`FeedTable` already read, so the strip earns its space
 * instead of just repeating Discover's widget.
 */
export function TopMentionsStrip() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selected = searchParams.get('tickers')?.split(',').filter(Boolean) ?? []
  const reddit = useTrending(LIMIT)
  const twitter = useTwitterBestStocks(LIMIT)
  const refresh = useRefreshTwitterBestStocks()

  function toggleTicker(ticker: string) {
    const next = selected.includes(ticker)
      ? selected.filter((t) => t !== ticker)
      : [...selected, ticker]
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next.length > 0) params.set('tickers', next.join(','))
      else params.delete('tickers')
      params.delete('page')
      return params
    })
  }

  function requestRefresh() {
    refresh.mutate(undefined, {
      onSuccess: (result) =>
        toast.success(result.reused ? 'The current Twitter scan is still running.' : 'Twitter scan queued.'),
      onError: () => toast.error('Could not start the Twitter scan.'),
    })
  }

  const isPending = reddit.isPending || twitter.isPending
  const isError = (reddit.isError && !reddit.data) || (twitter.isError && !twitter.data)

  if (isPending) return <TickerMentionStripSkeleton />
  if (isError) return null

  const rows = mergeSocialBuzz(reddit.data ?? [], twitter.data?.items ?? []).slice(0, MAX_CHIPS)
  const isRefreshing = Boolean(refresh.isPending || twitter.data?.refresh_active)

  const items = rows.map((row) => {
    const sentiment = blendedSentiment(row)
    const tone = toneOf(sentiment)
    return {
      ticker: row.ticker,
      chip: (
        <>
          <span className="font-semibold">${row.ticker}</span>
          <span className="text-muted-foreground tabular-nums">{row.combinedScore.toFixed(0)}</span>
          {sentiment !== null && (
            <span className={cn('tabular-nums', TONE_TEXT[tone])}>{formatScore(sentiment, 1)}</span>
          )}
        </>
      ),
      tooltip: (
        <div className="space-y-0.5">
          <p className="font-medium">{row.companyName ?? row.ticker}</p>
          {row.reddit && (
            <p>
              Reddit buzz {row.reddit.score.toFixed(0)}
              {row.reddit.mentions !== null && ` · ${formatNumber(row.reddit.mentions)} mentions`}
            </p>
          )}
          {row.twitter && (
            <p>
              Twitter {formatNumber(row.twitter.authors)} author{row.twitter.authors === 1 ? '' : 's'} ·{' '}
              {formatNumber(row.twitter.posts)} posts
            </p>
          )}
        </div>
      ),
    }
  })

  return (
    <TickerMentionStrip
      headerTooltip="Combined Reddit + Twitter attention, same ranking as Discover's Social Buzz. Click one to filter the feed below."
      items={items}
      selected={selected}
      onToggle={toggleTicker}
      onRefresh={requestRefresh}
      isRefreshing={isRefreshing}
      emptyMessage="No tickers currently trending on Reddit or Twitter."
      ariaLabel="Tickers with notable Reddit or Twitter attention"
    />
  )
}
