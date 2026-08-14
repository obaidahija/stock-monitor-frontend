import { Link } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { formatNumber, formatRelativeTime, formatScore } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  useDisableMonitoredTicker,
  useEnableMonitoredTicker,
  useRefreshTwitterBestStocks,
  useTwitterBestStocks,
} from './hooks'

export function TwitterBestStocksSection() {
  const { data, isPending, isError, error, refetch } = useTwitterBestStocks(20)
  const refresh = useRefreshTwitterBestStocks()
  const enable = useEnableMonitoredTicker()
  const disable = useDisableMonitoredTicker()

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Best Stocks on Twitter</h2>
          <p className="text-muted-foreground text-xs">
            Unique authors mentioning each ticker across six high-intent searches · daily at 6:00 AM ET
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data?.generated_at && (
            <span className="text-muted-foreground text-xs">
              Updated {formatRelativeTime(data.generated_at)} · {data.qualified_sample_size.toLocaleString()} posts
            </span>
          )}
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Ticker</TableHead>
              <TableHead>Unique authors</TableHead>
              <TableHead>Posts</TableHead>
              <TableHead>Top post views</TableHead>
              <TableHead>Sentiment</TableHead>
              <TableHead className="text-right">Monitoring</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item) => (
              <TableRow key={item.ticker}>
                <TableCell className="text-muted-foreground tabular-nums">{item.rank}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-x-1 font-medium">
                    {item.symbols.map((symbol, index) => (
                      <span key={symbol.ticker}>
                        {index > 0 && <span className="text-muted-foreground mr-1">/</span>}
                        <Link to={`/stocks/${symbol.ticker}`} className="hover:underline">
                          {symbol.ticker}
                        </Link>
                      </span>
                    ))}
                  </div>
                  {item.company_name && (
                    <p className="text-muted-foreground text-xs">{item.company_name}</p>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{formatNumber(item.unique_authors)}</TableCell>
                <TableCell className="tabular-nums">{formatNumber(item.unique_posts)}</TableCell>
                <TableCell className="tabular-nums">{formatNumber(item.representative_views)}</TableCell>
                <TableCell
                  className={cn(
                    'tabular-nums',
                    (item.sentiment_score ?? 0) > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : (item.sentiment_score ?? 0) < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-muted-foreground',
                  )}
                >
                  {formatScore(item.sentiment_score)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    {item.symbols.map((symbol) => (
                      <Button
                        key={symbol.ticker}
                        variant={symbol.monitoring_enabled ? 'secondary' : 'outline'}
                        size="xs"
                        disabled={enable.isPending || disable.isPending}
                        onClick={() =>
                          toggleMonitoring(symbol.ticker, symbol.monitoring_enabled)
                        }
                      >
                        {symbol.ticker} · {symbol.monitoring_enabled ? 'Stop' : 'Monitor'}
                      </Button>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
