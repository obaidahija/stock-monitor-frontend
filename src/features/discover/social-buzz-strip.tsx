import { useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatNumber, formatScore } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useRefreshTwitterBestStocks, useTrending, useTwitterBestStocks } from './hooks'
import {
  blendedSentiment,
  mergeSocialBuzz,
  scoreFor,
  toneOf,
  type MergedSocialBuzzRow,
  type PlatformFilter,
  REDDIT_DOT,
  TONE_TEXT,
  TWITTER_DOT,
} from './social-buzz'

const BOTH_GRADIENT = 'linear-gradient(to bottom, #eb6834, #2a78d6)'

const LIMIT = 20
const MAX_CHIPS = 18

// Rank reads through background tint alone -- no bar length needed once the
// row-per-ticker list becomes a single scrollable strip.
function weightClassFor(index: number, total: number): string {
  const pct = total <= 1 ? 0 : index / (total - 1)
  if (pct < 0.12) return 'bg-primary/15 ring-primary/30'
  if (pct < 0.35) return 'bg-primary/10 ring-primary/20'
  if (pct < 0.65) return 'bg-primary/5 ring-primary/10'
  return 'bg-card ring-foreground/10'
}

// The left edge is the platform legend: solid Reddit orange or Twitter blue for a
// ticker seen on one platform, a two-tone split for a ticker trending on *both* --
// so double coverage reads at a glance, as its own color, without a badge or label.
function accentStyleFor(hasReddit: boolean, hasTwitter: boolean): CSSProperties {
  if (hasReddit && hasTwitter) {
    return { background: BOTH_GRADIENT }
  }
  return { background: hasReddit ? '#eb6834' : '#2a78d6' }
}

function coverageLabel(hasReddit: boolean, hasTwitter: boolean): string {
  if (hasReddit && hasTwitter) return 'Reddit + Twitter'
  return hasReddit ? 'Reddit only' : 'Twitter only'
}

// Lands on whichever platform's tab actually has the stronger signal for this
// ticker, so a Reddit-only mention doesn't drop someone onto an empty Twitter tab.
function targetTabFor(row: MergedSocialBuzzRow): 'twitter' | 'reddit' {
  if (!row.reddit) return 'twitter'
  if (!row.twitter) return 'reddit'
  return row.twitter.score >= row.reddit.score ? 'twitter' : 'reddit'
}

// The legend doubles as the filter control -- clicking a platform's own dot+label
// both explains the color and narrows the strip to it, one element instead of a
// static legend plus a separate row of filter buttons.
function PlatformToggle({
  active,
  onClick,
  dotClassName,
  dotStyle,
  label,
}: {
  active: boolean
  onClick: () => void
  dotClassName?: string
  dotStyle?: CSSProperties
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors',
        active ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <span className={cn('size-2 rounded-full', dotClassName)} style={dotStyle} aria-hidden />
      {label}
    </button>
  )
}

/**
 * Discover's answer to a tall, per-source bar-chart list: the same combined
 * Reddit + Twitter attention ranking, condensed into one horizontally-scrollable
 * strip of tickers, tinted by rank. A two-tone left edge marks a ticker trending on
 * *both* platforms at once -- solid Reddit orange or Twitter blue for single-source
 * mentions, a split gradient for double coverage, so cross-platform attention is its
 * own visible signal instead of two dots to compare.
 *
 * Clicking a chip jumps straight to that ticker's detail page, landing on
 * whichever of the Twitter/Reddit tabs has the stronger signal -- a shortcut into
 * the same drill-down the old bar-chart-list rows offered.
 *
 * The legend doubles as the platform filter (same trick the old bar-chart-list
 * used): "Both" is the default, active state -- the merged, combined-score
 * ranking every chip starts out showing -- and clicking "Reddit" or "Twitter"
 * narrows the strip to tickers seen on that platform, re-ranked by that
 * platform's own score.
 *
 * The row's order is frozen while the pointer is over it: the underlying data
 * auto-refreshes (every 60s, or every 15s while a scan is actively running) and
 * re-ranks on each fetch, so without this a chip can drift out from under the
 * cursor between spotting it and clicking it -- a click lands on whatever ticker
 * has since taken that slot instead of the one that was actually clicked.
 * Re-ranking resumes the moment the pointer leaves, and an explicit filter
 * click always takes effect immediately regardless of hover.
 */
export function SocialBuzzStrip() {
  const navigate = useNavigate()
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')
  const [isHovering, setIsHovering] = useState(false)
  const frozenRef = useRef<{ filter: PlatformFilter; items: MergedSocialBuzzRow[] } | null>(null)
  const reddit = useTrending(LIMIT)
  const twitter = useTwitterBestStocks(LIMIT)
  const refresh = useRefreshTwitterBestStocks()

  function requestRefresh() {
    refresh.mutate(undefined, {
      onSuccess: (result) =>
        toast.success(result.reused ? 'The current Twitter scan is still running.' : 'Twitter scan queued.'),
      onError: () => toast.error('Could not start the Twitter scan.'),
    })
  }

  const isPending = reddit.isPending || twitter.isPending
  const isError = (reddit.isError && !reddit.data) || (twitter.isError && !twitter.data)

  if (isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-full rounded-full" />
      </div>
    )
  }
  if (isError) return null

  const merged = mergeSocialBuzz(reddit.data ?? [], twitter.data?.items ?? [])
  if (merged.length === 0) return null
  const computedItems = merged
    .filter((row) => {
      if (platformFilter === 'reddit') return row.reddit !== null
      if (platformFilter === 'twitter') return row.twitter !== null
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
            Social buzz
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
          aria-label="Refresh Twitter social buzz"
          disabled={refresh.isPending || twitter.data?.refresh_active}
          onClick={requestRefresh}
        >
          <RefreshCw className={cn((refresh.isPending || twitter.data?.refresh_active) && 'animate-spin')} />
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
          aria-label="Tickers with notable Reddit or Twitter attention today"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {items.map((row, index) => {
            const hasReddit = row.reddit !== null
            const hasTwitter = row.twitter !== null
            const sentiment = blendedSentiment(row)
            const tone = toneOf(sentiment)

            return (
              <Tooltip key={row.ticker}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Open ${row.ticker}`}
                    onClick={() => navigate(`/stocks/${row.ticker}?tab=${targetTabFor(row)}`)}
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
                    <span className="font-semibold">{row.ticker}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {scoreFor(row, platformFilter).toFixed(0)}
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
                      {row.companyName ?? row.ticker} · {coverageLabel(hasReddit, hasTwitter)}
                    </p>
                    {hasReddit && (
                      <p>
                        Reddit buzz {row.reddit!.score.toFixed(0)}
                        {row.reddit!.mentions !== null && ` · ${formatNumber(row.reddit!.mentions)} mentions`}
                      </p>
                    )}
                    {hasTwitter && (
                      <p>
                        Twitter {formatNumber(row.twitter!.authors)} author
                        {row.twitter!.authors === 1 ? '' : 's'} · {formatNumber(row.twitter!.posts)} posts
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
