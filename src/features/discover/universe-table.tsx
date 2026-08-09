import { useState } from 'react'
import { Link } from 'react-router'
import { Pin, Trash2 } from 'lucide-react'
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
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { AddTickerDialog } from './add-ticker-dialog'
import { useRemoveManualTicker, useUniverse } from './hooks'
import type { UniverseParams } from '@/api/discover'

const PAGE_SIZE = 25

const SORT_OPTIONS: { label: string; value: NonNullable<UniverseParams['sort']> }[] = [
  { label: 'Score', value: 'score' },
  { label: 'Ticker', value: 'ticker' },
  { label: 'Added', value: 'added_at' },
]

const LEAN_META: Record<string, string> = {
  bullish: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  bearish: 'bg-red-500/15 text-red-600 dark:text-red-400',
  neutral: 'bg-muted text-muted-foreground',
}

export function UniverseTable() {
  const [sort, setSort] = useState<NonNullable<UniverseParams['sort']>>('score')
  const [order, setOrder] = useState<UniverseParams['order']>('desc')
  const [manualOnly, setManualOnly] = useState(false)
  const [offset, setOffset] = useState(0)

  const { data, isPending, isError, error, refetch } = useUniverse({
    sort,
    order,
    manualOnly,
    limit: PAGE_SIZE,
    offset,
  })
  const removeManualTicker = useRemoveManualTicker()

  function toggleSort(field: NonNullable<UniverseParams['sort']>) {
    if (sort === field) {
      setOrder(order === 'desc' ? 'asc' : 'desc')
    } else {
      setSort(field)
      setOrder('desc')
    }
    setOffset(0)
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Tracked universe</h2>
        <AddTickerDialog />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs">Sort</span>
        {SORT_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            variant={sort === opt.value ? 'secondary' : 'ghost'}
            onClick={() => toggleSort(opt.value)}
          >
            {opt.label}
            {sort === opt.value && (order === 'desc' ? ' ↓' : ' ↑')}
          </Button>
        ))}
        <Button
          size="sm"
          variant={manualOnly ? 'secondary' : 'ghost'}
          onClick={() => {
            setManualOnly((v) => !v)
            setOffset(0)
          }}
          className="ml-2"
        >
          <Pin />
          Pinned only
        </Button>
      </div>

      {isPending && <Skeleton className="h-64 rounded-xl" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.length === 0 && (
        <EmptyState
          title={manualOnly ? 'No pinned tickers yet' : 'No tracked tickers yet'}
          description="Scores populate daily once universe_score has run."
        />
      )}

      {data && data.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Lean</TableHead>
                <TableHead>Scored</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.ticker}>
                  <TableCell className="font-medium">
                    <Link to={`/stocks/${item.ticker}`} className="hover:underline">
                      {item.ticker}
                    </Link>
                    {item.is_manual && (
                      <Pin className="text-muted-foreground ml-1.5 inline size-3" />
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-60 truncate">
                    {item.company_name ?? '—'}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {item.score !== null ? item.score.toFixed(0) : '—'}
                  </TableCell>
                  <TableCell>
                    {item.lean ? (
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          LEAN_META[item.lean] ?? LEAN_META.neutral,
                        )}
                      >
                        {item.lean}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelativeTime(item.score_updated_at)}
                  </TableCell>
                  <TableCell>
                    {item.is_manual && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Unpin ${item.ticker}`}
                        onClick={() =>
                          removeManualTicker.mutate(item.ticker, {
                            onSuccess: () => toast.success(`${item.ticker} unpinned`),
                            onError: () => toast.error(`Failed to unpin ${item.ticker}`),
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">
              Showing {offset + 1}–{offset + data.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={data.length < PAGE_SIZE}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
