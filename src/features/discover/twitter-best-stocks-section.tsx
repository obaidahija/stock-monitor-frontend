import { useNavigate } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { formatNumber, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  useDisableMonitoredTicker,
  useEnableMonitoredTicker,
  useRefreshTwitterBestStocks,
  useTwitterBestStocks,
} from './hooks'
import { RankedBarRow, SentimentLegend, sentimentTone } from './ranked-bar-row'

export function TwitterBestStocksSection() {
  const { data, isPending, isError, error, refetch } = useTwitterBestStocks(20)
  const refresh = useRefreshTwitterBestStocks()
  const enable = useEnableMonitoredTicker()
  const disable = useDisableMonitoredTicker()
  const navigate = useNavigate()

  const maxAuthors = Math.max(1, ...(data?.items.map((item) => item.unique_authors) ?? []))

  function requestRefresh() {
    refresh.mutate(undefined, {
      onSuccess: (result) =>
        toast.success(result.reused ? 'The current Twitter scan is still running.' : 'Twitter scan queued.'),
      onError: () => toast.error('Could not start the Twitter scan.'),
    })
  }

  function toggleMonitoring(ticker: string, enabled: boolean) {
    const mutation = enabled ? disable : enable
    mutation.mutate(ticker, {
      onSuccess: () => toast.success(`${ticker} ${enabled ? 'removed from' : 'added to'} Twitter monitoring.`),
      onError: () => toast.error(`Could not update Twitter monitoring for ${ticker}.`),
    })
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="font-semibold">Best Stocks on Twitter</h2>
        <div className="flex flex-wrap items-center gap-3">
          <SentimentLegend />
          <span className="text-muted-foreground text-xs">
            {data?.generated_at
              ? `Updated ${formatRelativeTime(data.generated_at)} · ${data.qualified_sample_size.toLocaleString()} posts`
              : 'Unique authors across six high-intent searches'}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={refresh.isPending || data?.refresh_active}
            onClick={requestRefresh}
          >
            <RefreshCw className={cn((refresh.isPending || data?.refresh_active) && 'animate-spin')} />
            {data?.refresh_active ? 'Scanning' : 'Refresh'}
          </Button>
        </div>
      </div>

      {data?.stale && data.stale_reason !== 'not_generated' && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          The latest scan did not cover enough search phrases. Showing the last complete result.
        </p>
      )}
      {isPending && <Skeleton className="h-48 rounded-xl" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.items.length === 0 && (
        <EmptyState
          title={data.refresh_active ? 'Twitter scan in progress' : 'No Twitter ranking yet'}
          description="The daily scan publishes after enough search phrases complete."
        />
      )}

      {data && data.items.length > 0 && (
        <div className="divide-border divide-y">
          {data.items.map((item) => {
            const tone = sentimentTone(item.sentiment_score)
            const pct = (item.unique_authors / maxAuthors) * 100
            return (
              <RankedBarRow
                key={item.ticker}
                rank={item.rank}
                onNavigate={() => navigate(`/stocks/${item.ticker}?tab=twitter`)}
                identity={
                  item.company_name ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block truncate font-medium">
                          {item.symbols.map((s) => s.ticker).join(' / ')}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{item.company_name}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="block truncate font-medium">
                      {item.symbols.map((s) => s.ticker).join(' / ')}
                    </span>
                  )
                }
                pct={pct}
                tone={tone}
                primaryValue={formatNumber(item.unique_authors)}
                meta={
                  <>
                    {formatNumber(item.unique_posts)} posts ·{' '}
                    {formatNumber(item.representative_views)} views
                  </>
                }
                trailing={
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {item.symbols.map((symbol) => (
                      <Button
                        key={symbol.ticker}
                        variant={symbol.monitoring_enabled ? 'secondary' : 'outline'}
                        size="xs"
                        disabled={enable.isPending || disable.isPending}
                        onClick={() => toggleMonitoring(symbol.ticker, symbol.monitoring_enabled)}
                      >
                        {symbol.ticker} · {symbol.monitoring_enabled ? 'Stop' : 'Monitor'}
                      </Button>
                    ))}
                  </div>
                }
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
