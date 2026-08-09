import { Link } from 'react-router'
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
import { formatScore } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useTrending } from './hooks'

export function TrendingSection() {
  const { data, isPending, isError, error, refetch } = useTrending(20)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Trending on Reddit</h2>
        <p className="text-muted-foreground text-xs">
          Buzz score (0-100), refreshed once/day — budget-limited API
        </p>
      </div>

      {isPending && <Skeleton className="h-40 rounded-xl" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.length === 0 && (
        <EmptyState
          title="No trending data yet"
          description="Populated once/day by the social_ingest job."
        />
      )}

      {data && data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead>Buzz score</TableHead>
              <TableHead>Sentiment</TableHead>
              <TableHead>Mentions</TableHead>
              <TableHead>Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.ticker}>
                <TableCell className="font-medium">
                  <Link to={`/stocks/${item.ticker}`} className="hover:underline">
                    {item.ticker}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums">
                  {item.buzz_score !== null ? item.buzz_score.toFixed(0) : '—'}
                </TableCell>
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
                <TableCell>{item.mentions?.toLocaleString() ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground capitalize">
                  {item.trend ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
