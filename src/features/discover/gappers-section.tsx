import { useState } from 'react'
import { Link } from 'react-router'
import { AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { formatCurrency, formatNumber, formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useGappers } from './hooks'

export function GappersSection() {
  const [minGapPct, setMinGapPct] = useState(3)
  const { data, isPending, isError, error, refetch } = useGappers(minGapPct)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Premarket gappers</h2>
        <div className="flex items-center gap-2">
          <Label htmlFor="min-gap" className="text-muted-foreground text-xs">
            Min gap %
          </Label>
          <Input
            id="min-gap"
            type="number"
            step="0.5"
            min="0"
            value={minGapPct}
            onChange={(e) => setMinGapPct(Number(e.target.value) || 0)}
            className="w-20"
          />
        </div>
      </div>

      {isPending && <Skeleton className="h-40 rounded-xl" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState title="No gappers above this threshold" />}

      {data && data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Volume</TableHead>
              <TableHead>Catalyst</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((gapper) => (
              <TableRow key={gapper.ticker}>
                <TableCell className="font-medium">
                  <Link to={`/stocks/${gapper.ticker}`} className="hover:underline">
                    {gapper.ticker}
                  </Link>
                </TableCell>
                <TableCell>{formatCurrency(gapper.price)}</TableCell>
                <TableCell
                  className={cn(
                    'tabular-nums',
                    (gapper.change_pct ?? 0) >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400',
                  )}
                >
                  {formatSignedPct(gapper.change_pct)}
                </TableCell>
                <TableCell>{formatNumber(gapper.volume)}</TableCell>
                <TableCell>
                  {gapper.catalyst ? (
                    gapper.catalyst
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <AlertCircle className="size-3.5" />
                      No catalyst found
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
