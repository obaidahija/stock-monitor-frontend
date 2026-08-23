import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { formatDate, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useEarnings, useRefreshEarnings } from './hooks'

export function EarningsTab({ ticker }: { ticker: string }) {
  const { data, isPending, isError, error, refetch } = useEarnings(ticker)
  const refreshEarnings = useRefreshEarnings(ticker)

  function runRefresh() {
    refreshEarnings.mutate(undefined, {
      onSuccess: (result) => {
        if (result.error) {
          toast.error(`Failed to refresh earnings for ${result.ticker}: ${result.error}`)
        } else {
          toast.success(
            `Refreshed earnings for ${result.ticker}: ${result.new} new, ${result.updated} updated`,
          )
        }
      },
      onError: () => toast.error(`Failed to refresh earnings for ${ticker}`),
    })
  }

  const refreshButton = (
    <Button size="sm" variant="outline" disabled={refreshEarnings.isPending} onClick={runRefresh}>
      <RefreshCw className={cn(refreshEarnings.isPending && 'animate-spin')} />
      Refresh
    </Button>
  )

  if (isPending) return <Skeleton className="h-72 rounded-xl" />
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!data) return null

  return (
    <div className="space-y-4">
      <div className="flex justify-end">{refreshButton}</div>

      {data.next ? (
        <Card>
          <CardHeader>
            <CardTitle>Next earnings</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>{formatDate(data.next.event_date)}</span>
            <span className="text-muted-foreground uppercase">{data.next.bmo_amc}</span>
            <span className="text-muted-foreground">
              EPS est. {data.next.eps_estimate ?? '—'}
            </span>
            <span className="text-muted-foreground">
              Revenue est. {formatNumber(data.next.revenue_estimate)}
            </span>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="No upcoming earnings date known"
          description="This may be an ETF or a ticker outside the tracked universe — try refreshing to check Finnhub directly."
          action={refreshButton}
        />
      )}

      {data.history.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>EPS est.</TableHead>
              <TableHead>EPS actual</TableHead>
              <TableHead>Revenue est.</TableHead>
              <TableHead>Revenue actual</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.history.map((event) => (
              <TableRow key={event.id}>
                <TableCell>{formatDate(event.event_date)}</TableCell>
                <TableCell>{event.eps_estimate ?? '—'}</TableCell>
                <TableCell>{event.eps_actual ?? '—'}</TableCell>
                <TableCell>{formatNumber(event.revenue_estimate)}</TableCell>
                <TableCell>{formatNumber(event.revenue_actual)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState title="No earnings history available" />
      )}

      <Card>
        <CardHeader>
          <CardTitle>yfinance snapshot (reference only)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.yfinance_snapshot.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>BMO/AMC</TableHead>
                  <TableHead>EPS est.</TableHead>
                  <TableHead>EPS actual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.yfinance_snapshot.map((event) => (
                  <TableRow key={`${event.event_date}-${event.bmo_amc}`}>
                    <TableCell>{formatDate(event.event_date)}</TableCell>
                    <TableCell className="text-muted-foreground uppercase">
                      {event.bmo_amc}
                    </TableCell>
                    <TableCell>{event.eps_estimate ?? '—'}</TableCell>
                    <TableCell>{event.eps_actual ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">No yfinance earnings data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
