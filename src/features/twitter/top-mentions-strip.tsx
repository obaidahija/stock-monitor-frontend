import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import {
  TickerMentionStrip,
  TickerMentionStripSkeleton,
} from '@/components/shared/ticker-mention-strip'
import { useRefreshTwitterBestStocks, useTwitterBestStocks } from '@/features/discover/hooks'
import { TONE_TEXT, toneOf } from '@/features/discover/social-buzz'
import { formatNumber, formatScore } from '@/lib/format'
import { cn } from '@/lib/utils'

const LIMIT = 20
const MAX_CHIPS = 12

/**
 * The Twitter page's own top-mentions leaderboard: trusted-account Twitter
 * attention only (Twitter best-stocks), rendered through the same
 * TickerMentionStrip as Reddit's Top Mentions. Cross-platform attention
 * (Reddit + Twitter combined) lives on the Trending page and Discover's
 * Social Buzz strip instead -- each platform's own page shows that
 * platform's own signal.
 *
 * Doubles as a shortcut into the feed's own ticker filter -- clicking a chip
 * toggles that ticker into `tickers`, the same URL param `TickerTagFilter`/
 * `FeedTable` already read, so the strip earns its space instead of just
 * repeating the ranking elsewhere on the page.
 */
export function TopMentionsStrip() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selected = searchParams.get('tickers')?.split(',').filter(Boolean) ?? []
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

  if (twitter.isPending) return <TickerMentionStripSkeleton />
  if (twitter.isError && !twitter.data) return null

  const rows = (twitter.data?.items ?? []).slice(0, MAX_CHIPS)
  const isRefreshing = Boolean(refresh.isPending || twitter.data?.refresh_active)

  const items = rows.map((row) => {
    const tone = toneOf(row.sentiment_score)
    return {
      ticker: row.ticker,
      chip: (
        <>
          <span className="font-semibold">${row.ticker}</span>
          <span className="text-muted-foreground tabular-nums">{formatNumber(row.unique_authors)}</span>
          {row.sentiment_score !== null && (
            <span className={cn('tabular-nums', TONE_TEXT[tone])}>
              {formatScore(row.sentiment_score, 1)}
            </span>
          )}
        </>
      ),
      tooltip: (
        <div className="space-y-0.5">
          <p className="font-medium">{row.company_name ?? row.ticker}</p>
          <p>
            {formatNumber(row.unique_authors)} author{row.unique_authors === 1 ? '' : 's'} ·{' '}
            {formatNumber(row.unique_posts)} posts
          </p>
        </div>
      ),
    }
  })

  return (
    <TickerMentionStrip
      headerTooltip="Trusted-account Twitter mentions, ranked by unique author count. Click one to filter the feed below."
      items={items}
      selected={selected}
      onToggle={toggleTicker}
      onRefresh={requestRefresh}
      isRefreshing={isRefreshing}
      emptyMessage="No tickers currently trending among trusted Twitter accounts."
      ariaLabel="Tickers with notable Twitter attention"
    />
  )
}
