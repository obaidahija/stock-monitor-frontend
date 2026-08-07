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
import { useEarnings } from './hooks'

export function EarningsTab({ ticker }: { ticker: string }) {
  const { data, isPending, isError, error, refetch } = useEarnings(ticker)

  if (isPending) return <Skeleton className="h-72 rounded-xl" />
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!data) return null

  return (
    <div className="space-y-4">
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
        <EmptyState title="No upcoming earnings date known" />
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
    </div>
  )
}
