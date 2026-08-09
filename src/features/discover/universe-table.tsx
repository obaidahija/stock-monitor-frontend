import { Link, useSearchParams } from 'react-router'
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
import { Pagination } from '@/components/shared/pagination'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { AddTickerDialog } from './add-ticker-dialog'
import { useRemoveManualTicker, useUniverse } from './hooks'
import type { UniverseParams } from '@/api/discover'
import type { EarningsResult, UniverseTickerOut } from '@/types/api'

const PAGE_SIZE = 25

const SORT_OPTIONS: { label: string; value: NonNullable<UniverseParams['sort']> }[] = [
  { label: 'Score', value: 'score' },
  { label: 'Ticker', value: 'ticker' },
  { label: 'Added', value: 'added_at' },
  { label: 'Next earnings', value: 'next_earnings_date' },
]

// First click on "Next earnings" should read soonest-first, unlike the other
// fields (score/ticker/added_at), which default to desc on first click.
const DEFAULT_ORDER_OVERRIDE: Partial<Record<NonNullable<UniverseParams['sort']>, 'asc' | 'desc'>> =
  {
    next_earnings_date: 'asc',
  }

const LEAN_META: Record<string, string> = {
  bullish: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  bearish: 'bg-red-500/15 text-red-600 dark:text-red-400',
  neutral: 'bg-muted text-muted-foreground',
}

const EARNINGS_FILTER_OPTIONS: { label: string; value: EarningsResult | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Beat', value: 'beat' },
  { label: 'Miss', value: 'miss' },
  { label: 'In-line', value: 'inline' },
]

const EARNINGS_RESULT_META: Record<EarningsResult, string> = {
  beat: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  miss: 'bg-red-500/15 text-red-600 dark:text-red-400',
  inline: 'bg-muted text-muted-foreground',
}

function EarningsCell({ item }: { item: UniverseTickerOut }) {
  return (
    <div className="space-y-0.5">
      {item.is_reit ? (
        <span
          className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
          title="REITs report GAAP EPS that isn't comparable to analyst FFO-based estimates, so beat/miss isn't shown."
        >
          REIT — not comparable
        </span>
      ) : (
        item.last_earnings_result && (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
              EARNINGS_RESULT_META[item.last_earnings_result],
            )}
          >
            {item.last_earnings_result}
            {item.last_earnings_surprise_pct !== null &&
              ` ${item.last_earnings_surprise_pct > 0 ? '+' : ''}${item.last_earnings_surprise_pct.toFixed(1)}%`}
          </span>
        )
      )}
      {item.next_earnings_date && (
        <p className="text-muted-foreground text-xs">
          Next {formatDate(item.next_earnings_date)}
          {item.next_earnings_bmo_amc &&
            item.next_earnings_bmo_amc !== 'unknown' &&
            ` (${item.next_earnings_bmo_amc.toUpperCase()})`}
        </p>
      )}
      {!item.is_reit && !item.last_earnings_result && !item.next_earnings_date && (
        <span className="text-muted-foreground text-xs">—</span>
      )}
    </div>
  )
}

const DEFAULT_SORT: NonNullable<UniverseParams['sort']> = 'score'
const DEFAULT_ORDER: NonNullable<UniverseParams['order']> = 'desc'

export function UniverseTable() {
  // Sort/order/filters/page all live in the URL, not component state, so the
  // back button, a bookmark, or a shared link all restore the exact same view.
  const [searchParams, setSearchParams] = useSearchParams()

  const sort = (searchParams.get('sort') as UniverseParams['sort']) || DEFAULT_SORT
  const order = (searchParams.get('order') as UniverseParams['order']) || DEFAULT_ORDER
  const manualOnly = searchParams.get('manual_only') === 'true'
  const earningsResult = (searchParams.get('earnings_result') as EarningsResult | null) ?? undefined
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const { data, isPending, isError, error, refetch } = useUniverse({
    sort,
    order,
    manualOnly,
    earningsResult,
    limit: PAGE_SIZE,
    offset,
  })
  const removeManualTicker = useRemoveManualTicker()

  /** Merge partial updates into the URL's search params. Any filter/sort
   * change resets to page 1 — a stale page number from a different, larger
   * result set wouldn't make sense under the new one. */
  function updateParams(updates: Record<string, string | undefined>, resetPage = true) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) {
          next.delete(key)
        } else {
          next.set(key, value)
        }
      }
      if (resetPage) next.delete('page')
      return next
    })
  }

  function toggleSort(field: NonNullable<UniverseParams['sort']>) {
    if (sort === field) {
      updateParams({ order: order === 'desc' ? 'asc' : 'desc' })
    } else {
      updateParams({ sort: field, order: DEFAULT_ORDER_OVERRIDE[field] ?? 'desc' })
    }
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
          onClick={() => updateParams({ manual_only: manualOnly ? undefined : 'true' })}
          className="ml-2"
        >
          <Pin />
          Pinned only
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs">Last earnings</span>
        {EARNINGS_FILTER_OPTIONS.map((opt) => (
          <Button
            key={opt.label}
            size="sm"
            variant={earningsResult === opt.value ? 'secondary' : 'ghost'}
            onClick={() => updateParams({ earnings_result: opt.value })}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {isPending && <Skeleton className="h-64 rounded-xl" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.items.length === 0 && (
        <EmptyState
          title={manualOnly ? 'No pinned tickers yet' : 'No tracked tickers yet'}
          description="Scores populate daily once universe_score has run."
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Lean</TableHead>
                <TableHead>Earnings</TableHead>
                <TableHead>Scored</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
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
                  <TableCell>
                    <EarningsCell item={item} />
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
              Showing {offset + 1}–{offset + data.items.length} of {data.total}
            </p>
            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
              onPageChange={(p) => updateParams({ page: p > 1 ? String(p) : undefined }, false)}
            />
          </div>
        </>
      )}
    </section>
  )
}
