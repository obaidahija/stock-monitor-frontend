import { useState } from 'react'
import { useNavigate } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { formatNumber, formatScore } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useRefreshTwitterBestStocks, useTrending, useTwitterBestStocks } from './hooks'
import {
  mergeSocialBuzz,
  scoreFor,
  toneOf,
  REDDIT_DOT,
  TONE_TEXT,
  TWITTER_DOT,
  REDDIT_BAR,
  TWITTER_BAR,
  type PlatformFilter,
} from './social-buzz'

const MAX_ROWS = 25
const ROW_HEIGHT = 52

export function SocialBuzzSection() {
  const reddit = useTrending(20)
  const twitter = useTwitterBestStocks(20)
  const refresh = useRefreshTwitterBestStocks()
  const navigate = useNavigate()
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')

  const isPending = reddit.isPending || twitter.isPending
  const isError = (reddit.isError && !reddit.data) || (twitter.isError && !twitter.data)

  const merged = mergeSocialBuzz(reddit.data ?? [], twitter.data?.items ?? [])
  const rows = merged
    .filter((row) => {
      if (platformFilter === 'reddit') return row.reddit !== null
      if (platformFilter === 'twitter') return row.twitter !== null
      return true
    })
    .sort((a, b) => scoreFor(b, platformFilter) - scoreFor(a, platformFilter))
    .slice(0, MAX_ROWS)
  const maxScore = Math.max(1, ...rows.map((r) => scoreFor(r, platformFilter)))

  function requestRefresh() {
    refresh.mutate(undefined, {
      onSuccess: (result) =>
        toast.success(result.reused ? 'The current Twitter scan is still running.' : 'Twitter scan queued.'),
      onError: () => toast.error('Could not start the Twitter scan.'),
    })
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Social Buzz</h2>
        <div className="flex items-center gap-3">
          {/* The platform legend and the filter are the same control: each
           * tab's dot both explains the bar color and, clicked, narrows the
           * list to that platform — one element instead of a static legend
           * plus a separate row of filter buttons. */}
          <Tabs
            value={platformFilter}
            onValueChange={(value) => setPlatformFilter(value as PlatformFilter)}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="reddit">
                <span className={cn('size-2 rounded-full', REDDIT_DOT)} />
                Reddit
              </TabsTrigger>
              <TabsTrigger value="twitter">
                <span className={cn('size-2 rounded-full', TWITTER_DOT)} />
                Twitter
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            size="sm"
            disabled={refresh.isPending || twitter.data?.refresh_active}
            onClick={requestRefresh}
          >
            <RefreshCw className={cn((refresh.isPending || twitter.data?.refresh_active) && 'animate-spin')} />
            {twitter.data?.refresh_active ? 'Scanning' : 'Refresh Twitter'}
          </Button>
        </div>
      </div>

      {isPending && <Skeleton className="h-40 rounded-xl" />}
      {!isPending && isError && (
        <ErrorState
          error={reddit.error ?? twitter.error}
          onRetry={() => {
            reddit.refetch()
            twitter.refetch()
          }}
        />
      )}
      {!isPending && !isError && rows.length === 0 && (
        <EmptyState
          title="No social buzz yet"
          description="Populated once/day by social_ingest (Reddit) and the daily Twitter scan."
        />
      )}

      {!isPending && rows.length > 0 && (
        <div className="divide-border divide-y">
          {rows.map((row, index) => {
            const pct = (scoreFor(row, platformFilter) / maxScore) * 100
            const showReddit = row.reddit && platformFilter !== 'twitter'
            const showTwitter = row.twitter && platformFilter !== 'reddit'
            const sentiments = [
              showReddit ? row.reddit?.sentiment : null,
              showTwitter ? row.twitter?.sentiment : null,
            ].filter((s): s is number => s !== null && s !== undefined)
            const blendedSentiment =
              sentiments.length > 0 ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length : null
            const tone = toneOf(blendedSentiment)
            const preferTwitterTab = (row.twitter?.score ?? -1) >= (row.reddit?.score ?? -1)
            const targetTab =
              platformFilter === 'twitter' || (platformFilter === 'all' && row.twitter && (!row.reddit || preferTwitterTab))
                ? 'twitter'
                : 'reddit'

            return (
              <div
                key={row.ticker}
                style={{ height: ROW_HEIGHT }}
                className="group flex items-center gap-3 rounded-lg px-2 transition-colors hover:bg-muted/50"
              >
                <span className="text-muted-foreground w-5 shrink-0 text-right text-xs tabular-nums">
                  {index + 1}
                </span>

                <button
                  type="button"
                  onClick={() => navigate(`/stocks/${row.ticker}?tab=${targetTab}`)}
                  className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                >
                  <div className="flex w-16 min-w-0 shrink-0 items-baseline gap-1.5 sm:w-28 md:w-32">
                    {row.companyName ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="truncate font-medium">{row.ticker}</span>
                        </TooltipTrigger>
                        <TooltipContent>{row.companyName}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="truncate font-medium">{row.ticker}</span>
                    )}
                    {blendedSentiment !== null && (
                      <span className={cn('shrink-0 text-[11px] tabular-nums', TONE_TEXT[tone])}>
                        {formatScore(blendedSentiment, 1)}
                      </span>
                    )}
                  </div>

                  <div className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/60">
                    <div
                      className="flex h-full gap-[2px]"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    >
                      {showReddit && (
                        <div
                          className={cn('h-full rounded-sm', REDDIT_BAR)}
                          style={{ flexGrow: row.reddit!.score }}
                        />
                      )}
                      {showTwitter && (
                        <div
                          className={cn('h-full rounded-sm', TWITTER_BAR)}
                          style={{ flexGrow: row.twitter!.score }}
                        />
                      )}
                    </div>
                  </div>

                  <div className="w-14 shrink-0 text-right sm:w-28 md:w-36">
                    <div className="text-sm font-semibold tabular-nums">
                      {platformFilter === 'reddit'
                        ? row.reddit!.score.toFixed(0)
                        : platformFilter === 'twitter'
                          ? row.twitter!.score.toFixed(0)
                          : row.combinedScore.toFixed(0)}
                    </div>
                    <div className="text-muted-foreground truncate text-xs">
                      {platformFilter === 'reddit' &&
                        `${formatNumber(row.reddit!.mentions)} mentions`}
                      {platformFilter === 'twitter' &&
                        `${formatNumber(row.twitter!.posts)} posts · ${formatNumber(row.twitter!.views)} views`}
                      {platformFilter === 'all' && (
                        <>
                          {row.reddit && `Reddit ${row.reddit.score.toFixed(0)}`}
                          {row.reddit && row.twitter && ' · '}
                          {row.twitter &&
                            `${formatNumber(row.twitter.authors)} author${row.twitter.authors === 1 ? '' : 's'}`}
                        </>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
