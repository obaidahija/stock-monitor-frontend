import { useNavigate } from 'react-router'
import {
  TickerMentionStrip,
  TickerMentionStripSkeleton,
} from '@/components/shared/ticker-mention-strip'
import { REDDIT_DOT, TONE_TEXT, TWITTER_DOT, toneOf } from '@/features/discover/social-buzz'
import { formatNumber, formatScore } from '@/lib/format'
import { cn } from '@/lib/utils'
import { blendedTrendingSentiment } from './sentiment'
import { useTrendingSummary } from './hooks'

const MAX_CHIPS = 12

/**
 * "Hot right now" chip strip through the same shared TickerMentionStrip as
 * Twitter's/Reddit's Top Mentions, fed from today's combined leaderboard.
 * Unlike those two (which toggle a local feed filter), a chip here jumps
 * straight to that ticker's detail page -- this page has no single feed to
 * filter into, just a shortcut into the ticker everyone's already reading
 * about.
 */
export function TrendingHotStrip() {
  const navigate = useNavigate()
  const query = useTrendingSummary(MAX_CHIPS)

  if (query.isPending) return <TickerMentionStripSkeleton />
  if (query.isError || !query.data) return null

  const items = query.data.today.slice(0, MAX_CHIPS).map((item) => {
    const sentiment = blendedTrendingSentiment(item)
    const tone = toneOf(sentiment)
    return {
      ticker: item.ticker,
      chip: (
        <>
          <span className="font-semibold">${item.ticker}</span>
          <span className="text-muted-foreground tabular-nums">{item.combined_score.toFixed(2)}</span>
          {sentiment !== null && (
            <span className={cn('tabular-nums', TONE_TEXT[tone])}>{formatScore(sentiment, 1)}</span>
          )}
        </>
      ),
      tooltip: (
        <div className="space-y-0.5">
          <p className="font-medium">{item.company_name ?? item.ticker}</p>
          {item.twitter && (
            <p className="flex items-center gap-1.5">
              <span className={cn('size-1.5 shrink-0 rounded-full', TWITTER_DOT)} />
              Twitter #{item.twitter.rank} · {formatNumber(item.twitter.unique_authors)} authors
            </p>
          )}
          {item.reddit && (
            <p className="flex items-center gap-1.5">
              <span className={cn('size-1.5 shrink-0 rounded-full', REDDIT_DOT)} />
              Reddit #{item.reddit.rank} · {formatNumber(item.reddit.mention_count)} mentions
            </p>
          )}
        </div>
      ),
    }
  })

  return (
    <TickerMentionStrip
      headerTooltip="Today's combined Reddit + Twitter trending leaderboard. Click one to open its ticker page."
      items={items}
      selected={[]}
      onToggle={(ticker) => navigate(`/stocks/${ticker}`)}
      onRefresh={() => query.refetch()}
      isRefreshing={query.isFetching}
      emptyMessage="Nothing trending on Reddit or Twitter yet."
      ariaLabel="Tickers trending today on Reddit or Twitter"
    />
  )
}
