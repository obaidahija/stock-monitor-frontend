import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import {
  TickerMentionStrip,
  TickerMentionStripSkeleton,
} from '@/components/shared/ticker-mention-strip'
import { TONE_TEXT, toneOf } from '@/features/discover/social-buzz'
import { formatScore } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useRedditTopMentions, useRefreshRedditTopMentions } from './hooks'

const LIMIT = 20
const MAX_CHIPS = 20

/**
 * Reddit's own mention leaderboard, rendered through the same
 * TickerMentionStrip as Twitter's Top Mentions -- ranks tickers straight
 * from the Reddit posts this app actually collects via rdt-cli's trusted
 * subreddit/author sweeps. Each chip packs the headline numbers in (mention
 * count, sentiment), with a recommendation-count badge when the crowd isn't
 * just discussing a ticker but actively pitching it, and the full
 * post-type/sentiment breakdown in the hover tooltip. Doubles as a shortcut
 * into the feed's own ticker filter -- clicking a chip toggles that ticker
 * into `tickers`, the URL param `RedditFeedList` already reads.
 */
export function RedditTopMentionsStrip() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selected = searchParams.get('tickers')?.split(',').filter(Boolean) ?? []
  const mentions = useRedditTopMentions(LIMIT)
  const refresh = useRefreshRedditTopMentions()

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
        toast.success(
          result.reused ? 'The current Reddit scan is still running.' : 'Reddit scan queued.',
        ),
      onError: () => toast.error('Could not start the Reddit top-mentions scan.'),
    })
  }

  if (mentions.isPending) return <TickerMentionStripSkeleton />
  if (mentions.isError && !mentions.data) return null

  const rows = (mentions.data?.items ?? []).slice(0, MAX_CHIPS)
  const isRefreshing = Boolean(refresh.isPending || mentions.data?.refresh_active)

  const items = rows.map((item) => {
    const tone = toneOf(item.sentiment_score)
    return {
      ticker: item.ticker,
      chip: (
        <>
          <span className="font-semibold">${item.ticker}</span>
          <span className="text-muted-foreground tabular-nums">{item.mention_count}</span>
          {item.sentiment_score !== null && (
            <span className={cn('tabular-nums', TONE_TEXT[tone])}>
              {formatScore(item.sentiment_score, 1)}
            </span>
          )}
          {item.recommendation_count > 0 && (
            <span className="rounded-full bg-violet-500/15 px-1.5 text-violet-600 tabular-nums dark:text-violet-400">
              {item.recommendation_count}×rec
            </span>
          )}
        </>
      ),
      tooltip: (
        <div className="space-y-0.5">
          <p className="font-medium">{item.company_name ?? item.ticker}</p>
          <p>
            {item.mention_count} mentions · {item.unique_authors} authors
          </p>
          <p>
            {item.news_count} news · {item.analysis_count} analysis · {item.recommendation_count}{' '}
            recommendation
            {item.recommendation_count === 1 ? '' : 's'} · {item.general_count} general ·{' '}
            {item.other_count} other · {item.untyped_count} untyped
          </p>
          <p>
            Sentiment: {item.sentiment_positive_count} positive · {item.sentiment_negative_count}{' '}
            negative · {item.sentiment_neutral_count} neutral
          </p>
          {item.max_signal_score !== null && <p>Top signal score {item.max_signal_score.toFixed(0)}</p>}
        </div>
      ),
    }
  })

  return (
    <TickerMentionStrip
      headerTooltip="Ranked by our own collected Reddit mentions (trusted subreddit/author sweeps). Click one to filter the feed below."
      items={items}
      selected={selected}
      onToggle={toggleTicker}
      onRefresh={requestRefresh}
      isRefreshing={isRefreshing}
      emptyMessage="No tickers currently trending on Reddit."
      ariaLabel="Tickers with notable Reddit mention volume"
    />
  )
}
