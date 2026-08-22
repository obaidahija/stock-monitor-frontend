import { useSearchParams } from 'react-router'
import { Flame, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  useRefreshTwitterBestStocks,
  useTrending,
  useTwitterBestStocks,
} from '@/features/discover/hooks'
import { mergeSocialBuzz, REDDIT_DOT, TWITTER_DOT } from '@/features/discover/social-buzz'
import { cn } from '@/lib/utils'

const LIMIT = 20
const MAX_CHIPS = 12

// Visual weight tapers with rank instead of a bar length -- Discover's Social Buzz
// already owns the bar-chart-list look, so this reads as a leaderboard through tint
// alone, staying a single scrollable row instead of a multi-row list.
function weightClassFor(index: number, total: number): string {
  const pct = total <= 1 ? 0 : index / (total - 1)
  if (pct < 0.15) return 'bg-primary/15 ring-primary/30'
  if (pct < 0.4) return 'bg-primary/10 ring-primary/20'
  if (pct < 0.7) return 'bg-primary/5 ring-primary/10'
  return 'bg-card ring-foreground/10'
}

/**
 * Twitter's answer to Discover's Social Buzz leaderboard, but built to sit in one
 * slim row instead of a tall list: a horizontally-scrollable strip of the
 * tickers with the most combined Reddit + Twitter attention (same blended ranking
 * Discover uses -- trusted-account Twitter mentions alone are too thin a sample to
 * rank on their own), tinted by rank. Doubles as a shortcut into the feed's own
 * ticker filter -- clicking a chip toggles that ticker into `tickers`, the same URL
 * param `TickerTagFilter`/`FeedTable` already read, so the strip earns its space
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

  if (isPending) return <Skeleton className="h-8 w-full rounded-full" />
  if (isError) return null

  const items = mergeSocialBuzz(reddit.data ?? [], twitter.data?.items ?? []).slice(0, MAX_CHIPS)
  if (items.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs font-medium">
            <Flame className="size-3.5" />
            Top mentions
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Combined Reddit + Twitter attention, same ranking as Discover's Social Buzz. Click one
          to filter the feed below.
        </TooltipContent>
      </Tooltip>

      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((row, index) => {
          const isSelected = selected.includes(row.ticker)
          return (
            <button
              key={row.ticker}
              type="button"
              aria-pressed={isSelected}
              aria-label={`Filter feed by $${row.ticker}`}
              onClick={() => toggleTicker(row.ticker)}
              className={cn(
                'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 transition-colors select-none',
                weightClassFor(index, items.length),
                isSelected && 'outline-2 outline-primary outline-offset-1',
              )}
            >
              <span className="flex shrink-0 items-center -space-x-0.5" aria-hidden>
                {row.reddit && <span className={cn('size-1.5 rounded-full ring-1 ring-card', REDDIT_DOT)} />}
                {row.twitter && <span className={cn('size-1.5 rounded-full ring-1 ring-card', TWITTER_DOT)} />}
              </span>
              <span className="font-semibold">${row.ticker}</span>
              <span className="text-muted-foreground tabular-nums">
                {row.combinedScore.toFixed(0)}
              </span>
            </button>
          )
        })}
      </div>

      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Refresh top mentions"
        disabled={refresh.isPending || twitter.data?.refresh_active}
        onClick={requestRefresh}
        className="shrink-0"
      >
        <RefreshCw className={cn((refresh.isPending || twitter.data?.refresh_active) && 'animate-spin')} />
      </Button>
    </div>
  )
}
