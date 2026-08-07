import { useState } from 'react'
import { Link } from 'react-router'
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
import { formatNumber } from '@/lib/format'
import { useUnusualVolume } from './hooks'

export function UnusualVolumeSection() {
  const [minRatio, setMinRatio] = useState(2)
  const { data, isPending, isError, error, refetch } = useUnusualVolume(minRatio)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Unusual premarket volume</h2>
        <div className="flex items-center gap-2">
          <Label htmlFor="min-ratio" className="text-muted-foreground text-xs">
            Min ratio ×
          </Label>
          <Input
            id="min-ratio"
            type="number"
            step="0.5"
            min="1"
            value={minRatio}
            onChange={(e) => setMinRatio(Number(e.target.value) || 1)}
            className="w-20"
          />
        </div>
      </div>

      {isPending && <Skeleton className="h-40 rounded-xl" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState title="No unusual volume above this ratio" />}

      {data && data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead>Volume</TableHead>
              <TableHead>20d avg</TableHead>
              <TableHead>Ratio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.ticker}>
                <TableCell className="font-medium">
                  <Link to={`/stocks/${row.ticker}`} className="hover:underline">
                    {row.ticker}
                  </Link>
                </TableCell>
                <TableCell>{formatNumber(row.volume)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatNumber(row.avg_volume_20d)}
                </TableCell>
                <TableCell className="font-medium tabular-nums">
                  {row.volume_ratio.toFixed(1)}×
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
