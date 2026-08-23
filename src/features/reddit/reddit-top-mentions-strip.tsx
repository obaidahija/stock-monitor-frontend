import { useNavigate } from 'react-router'
import { Flame, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { TONE_TEXT, toneOf } from '@/features/discover/social-buzz'
import { formatScore } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useRedditTopMentions, useRefreshRedditTopMentions } from './hooks'

const LIMIT = 20
const MAX_CHIPS = 20

// Visual weight tapers with rank instead of a bar length, same convention as
// Twitter's Top Mentions strip and Discover's Social Buzz.
function weightClassFor(index: number, total: number): string {
  const pct = total <= 1 ? 0 : index / (total - 1)
  if (pct < 0.15) return 'bg-primary/15 ring-primary/30'
  if (pct < 0.4) return 'bg-primary/10 ring-primary/20'
  if (pct < 0.7) return 'bg-primary/5 ring-primary/10'
  return 'bg-card ring-foreground/10'
}

/**
 * Reddit's own mention leaderboard, in the same tag-strip style as Twitter's
 * Top Mentions -- unlike Discover's Social Buzz (Adanos' third-party buzz
 * score), this ranks tickers straight from the Reddit posts this app actually
 * collects via rdt-cli's trusted subreddit/author sweeps. Each chip packs the
 * headline numbers in (mention count, sentiment), with a recommendation-count
 * badge when the crowd isn't just discussing a ticker but actively pitching
 * it, and the full post-type/sentiment breakdown in the hover tooltip.
 */
export function RedditTopMentionsStrip() {
  const navigate = useNavigate()
  const mentions = useRedditTopMentions(LIMIT)
  const refresh = useRefreshRedditTopMentions()

  function requestRefresh() {
    refresh.mutate(undefined, {
      onSuccess: (result) =>
        toast.success(
          result.reused ? 'The current Reddit scan is still running.' : 'Reddit scan queued.',
        ),
      onError: () => toast.error('Could not start the Reddit top-mentions scan.'),
    })
  }

  if (mentions.isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-full rounded-full" />
      </div>
    )
  }
  if (mentions.isError && !mentions.data) return null

  const items = (mentions.data?.items ?? []).slice(0, MAX_CHIPS)
  const isRefreshing = refresh.isPending || mentions.data?.refresh_active

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
          <Flame className="size-3.5" />
          Top mentions
        </h2>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Refresh top mentions"
          disabled={isRefreshing}
          onClick={requestRefresh}
        >
          <RefreshCw className={cn(isRefreshing && 'animate-spin')} />
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground py-1.5 text-xs">
          No tickers currently trending on Reddit.
        </p>
      ) : (
        <div
          className="flex items-center gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Tickers with notable Reddit mention volume"
        >
          {items.map((item, index) => {
            const tone = toneOf(item.sentiment_score)
            return (
              <Tooltip key={item.ticker}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Open ${item.ticker}`}
                    onClick={() => navigate(`/stocks/${item.ticker}?tab=reddit`)}
                    className={cn(
                      'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 transition-colors select-none hover:ring-primary/40',
                      weightClassFor(index, items.length),
                    )}
                  >
                    <span className="font-semibold">${item.ticker}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {item.mention_count}
                    </span>
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
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-0.5">
                    <p className="font-medium">{item.company_name ?? item.ticker}</p>
                    <p>
                      {item.mention_count} mentions · {item.unique_authors} authors
                    </p>
                    <p>
                      {item.news_count} news · {item.analysis_count} analysis ·{' '}
                      {item.recommendation_count} recommendation
                      {item.recommendation_count === 1 ? '' : 's'} · {item.general_count} general ·{' '}
                      {item.other_count} other · {item.untyped_count} untyped
                    </p>
                    <p>
                      Sentiment: {item.sentiment_positive_count} positive ·{' '}
                      {item.sentiment_negative_count} negative · {item.sentiment_neutral_count}{' '}
                      neutral
                    </p>
                    {item.max_signal_score !== null && (
                      <p>Top signal score {item.max_signal_score.toFixed(0)}</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      )}
    </div>
  )
}
