import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlatformToggle } from '@/components/shared/platform-toggle'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  accentStyleFor,
  BOTH_GRADIENT,
  coverageLabel,
  REDDIT_DOT,
  TONE_TEXT,
  TWITTER_DOT,
  toneOf,
  weightClassFor,
  type PlatformFilter,
} from '@/features/discover/social-buzz'
import { formatNumber, formatScore } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TrendingTickerOut } from '@/types/api'
import { blendedTrendingSentiment } from './sentiment'
import { useTrendingSummary } from './hooks'

const LIMIT = 50
const MAX_CHIPS = 18

// A platform-specific "score" for display/sort when narrowed to one
// platform -- Twitter/Reddit have no comparable normalized score here (only
// each daily run's own rank + raw metric), so this falls back to the raw
// metric; the combined ("all") score is the real cross-platform RRF fusion
// already computed server-side.
function scoreFor(item: TrendingTickerOut, filter: PlatformFilter): number {
  if (filter === 'reddit') return item.reddit?.mention_count ?? 0
  if (filter === 'twitter') return item.twitter?.unique_authors ?? 0
  return item.combined_score
}

// Lands on whichever platform's tab actually has the stronger showing for
// this ticker (lower rank = stronger), so a Reddit-only mention doesn't drop
// someone onto an empty Twitter tab.
function targetTabFor(item: TrendingTickerOut): 'twitter' | 'reddit' {
  if (!item.reddit) return 'twitter'
  if (!item.twitter) return 'reddit'
  return item.twitter.rank <= item.reddit.rank ? 'twitter' : 'reddit'
}

/**
 * Trending's answer to Discover's Social Buzz strip, same two-tone-accent
 * style: a two-tone left edge marks a ticker trending on *both* platforms at
 * once -- solid Reddit orange or Twitter blue for single-source mentions, a
 * split gradient for double coverage -- and the Reddit/Twitter/Both legend
 * doubles as the filter control, re-ranking the strip by that platform's own
 * standing. "Both" is the default, showing today's combined RRF ranking.
 */
export function TrendingHotStrip() {
  const navigate = useNavigate()
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')
  const [isHovering, setIsHovering] = useState(false)
  const frozenRef = useRef<{ filter: PlatformFilter; items: TrendingTickerOut[] } | null>(null)
  const query = useTrendingSummary(LIMIT)

  if (query.isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-full rounded-full" />
      </div>
    )
  }
  if (query.isError || !query.data) return null

  const today = query.data.today
  if (today.length === 0) return null

  const computedItems = today
    .filter((item) => {
      if (platformFilter === 'reddit') return item.reddit !== null
      if (platformFilter === 'twitter') return item.twitter !== null
      return true
    })
    .sort((a, b) => scoreFor(b, platformFilter) - scoreFor(a, platformFilter))
    .slice(0, MAX_CHIPS)

  const holdFrozen = isHovering && frozenRef.current?.filter === platformFilter
  const items = holdFrozen ? frozenRef.current!.items : computedItems
  if (!holdFrozen) {
    frozenRef.current = { filter: platformFilter, items: computedItems }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-3">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Hot right now
          </h2>
          <div className="flex items-center gap-1 text-[11px]" role="group" aria-label="Filter by platform">
            <PlatformToggle
              active={platformFilter === 'reddit'}
              onClick={() => setPlatformFilter((f) => (f === 'reddit' ? 'all' : 'reddit'))}
              dotClassName={REDDIT_DOT}
              label="Reddit"
            />
            <PlatformToggle
              active={platformFilter === 'twitter'}
              onClick={() => setPlatformFilter((f) => (f === 'twitter' ? 'all' : 'twitter'))}
              dotClassName={TWITTER_DOT}
              label="Twitter"
            />
            <PlatformToggle
              active={platformFilter === 'all'}
              onClick={() => setPlatformFilter('all')}
              dotStyle={{ background: BOTH_GRADIENT }}
              label="Both"
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Refresh trending"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
        >
          <RefreshCw className={cn(query.isFetching && 'animate-spin')} />
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground py-1.5 text-xs">
          No tickers currently trending on {platformFilter === 'reddit' ? 'Reddit' : 'Twitter'}.
        </p>
      ) : (
        <div
          className="flex items-center gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Tickers trending today on Reddit or Twitter"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {items.map((item, index) => {
            const hasReddit = item.reddit !== null
            const hasTwitter = item.twitter !== null
            const sentiment = blendedTrendingSentiment(item)
            const tone = toneOf(sentiment)

            return (
              <Tooltip key={item.ticker}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Open ${item.ticker}`}
                    onClick={() => navigate(`/stocks/${item.ticker}?tab=${targetTabFor(item)}`)}
                    className={cn(
                      'relative flex h-8 shrink-0 items-center gap-1.5 overflow-hidden rounded-r-full rounded-l-[3px] py-0 pr-2.5 pl-2.5 text-xs font-medium ring-1 transition-colors select-none hover:ring-primary/40',
                      weightClassFor(index, items.length),
                    )}
                  >
                    <span
                      className="mr-0.5 -ml-2.5 h-full w-1.5 shrink-0 self-stretch"
                      style={accentStyleFor(hasReddit, hasTwitter)}
                      aria-hidden
                    />
                    <span className="font-semibold">{item.ticker}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {platformFilter === 'all'
                        ? scoreFor(item, platformFilter).toFixed(2)
                        : formatNumber(scoreFor(item, platformFilter))}
                    </span>
                    {sentiment !== null && (
                      <span className={cn('tabular-nums', TONE_TEXT[tone])}>
                        {formatScore(sentiment, 1)}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-0.5">
                    <p className="font-medium">
                      {item.company_name ?? item.ticker} · {coverageLabel(hasReddit, hasTwitter)}
                    </p>
                    {hasReddit && (
                      <p>
                        Reddit #{item.reddit!.rank} · {formatNumber(item.reddit!.mention_count)} mentions
                      </p>
                    )}
                    {hasTwitter && (
                      <p>
                        Twitter #{item.twitter!.rank} · {formatNumber(item.twitter!.unique_authors)} author
                        {item.twitter!.unique_authors === 1 ? '' : 's'}
                      </p>
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
