import { Link, useSearchParams } from 'react-router'
import { AlertCircle, AtSign, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Pagination } from '@/components/shared/pagination'
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatRelativeTime,
  formatSignedPct,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { AddTickerDialog } from './add-ticker-dialog'
import {
  useDisableMonitoredTicker,
  useEnableMonitoredTicker,
  useUniverse,
} from './hooks'
import { RemoveTickerDialog } from './remove-ticker-dialog'
import type { UniverseParams } from '@/api/discover'
import type { EarningsResult, UniverseTickerOut } from '@/types/api'
import { ManageListsDialog } from '@/features/watchlists/manage-lists-dialog'

const PAGE_SIZE = 25

// Quick-filter chip thresholds — match the previous standalone Gappers/
// Unusual Volume panels' defaults, so the merged table's "one click" view is
// the same set a user would have seen before.
const GAP_CHIP_THRESHOLD = 3
const VOLUME_RATIO_CHIP_THRESHOLD = 2

const SORT_OPTIONS: { label: string; value: NonNullable<UniverseParams['sort']> }[] = [
  { label: 'Score', value: 'score' },
  { label: 'Ticker', value: 'ticker' },
  { label: 'Added', value: 'added_at' },
  { label: 'Next earnings', value: 'next_earnings_date' },
  { label: 'Change %', value: 'change_pct' },
  { label: 'Volume ratio', value: 'volume_ratio' },
]

// First click on "Next earnings" should read soonest-first, unlike the other
// fields (score/ticker/added_at/change_pct/volume_ratio), which default to
// desc on first click.
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
  const twitterMonitoredOnly = searchParams.get('twitter_monitored_only') === 'true'
  const earningsResult = (searchParams.get('earnings_result') as EarningsResult | null) ?? undefined
  const minGapPctRaw = searchParams.get('min_gap_pct')
  const minVolumeRatioRaw = searchParams.get('min_volume_ratio')
  const minGapPct = minGapPctRaw !== null ? Number(minGapPctRaw) : undefined
  const minVolumeRatio = minVolumeRatioRaw !== null ? Number(minVolumeRatioRaw) : undefined
  const sector = searchParams.get('sector') ?? undefined
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const { data, isPending, isError, error, refetch } = useUniverse({
    sort,
    order,
    twitterMonitoredOnly,
    earningsResult,
    minGapPct,
    minVolumeRatio,
    sector,
    limit: PAGE_SIZE,
    offset,
  })
  const enableMonitoring = useEnableMonitoredTicker()
  const disableMonitoring = useDisableMonitoredTicker()
  const monitoredCount = useUniverse({ twitterMonitoredOnly: true, limit: 1, offset: 0 })

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

  /** Chips both set a filter threshold and switch sort to that metric in one
   * click — a shortcut on top of the raw numeric inputs below, which stay
   * the source of truth (toggling a chip off just clears the filter). */
  function toggleGapChip() {
    if (minGapPct !== undefined) {
      updateParams({ min_gap_pct: undefined })
    } else {
      updateParams({ min_gap_pct: String(GAP_CHIP_THRESHOLD), sort: 'change_pct', order: 'desc' })
    }
  }

  function toggleVolumeRatioChip() {
    if (minVolumeRatio !== undefined) {
      updateParams({ min_volume_ratio: undefined })
    } else {
      updateParams({
        min_volume_ratio: String(VOLUME_RATIO_CHIP_THRESHOLD),
        sort: 'volume_ratio',
        order: 'desc',
      })
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Tracked universe</h2>
        <AddTickerDialog />
      </div>

      {sector && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Filtered by sector</span>
          <button
            type="button"
            onClick={() => updateParams({ sector: undefined })}
            className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
          >
            {sector}
            <X className="size-3" />
          </button>
        </div>
      )}

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
          variant={twitterMonitoredOnly ? 'secondary' : 'ghost'}
          onClick={() =>
            updateParams({
              twitter_monitored_only: twitterMonitoredOnly ? undefined : 'true',
            })
          }
        >
          <AtSign />
          {monitoredCount.data?.total ?? 0}/50 monitored
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

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-muted-foreground text-xs">Movement</span>
        <Button
          size="sm"
          variant={minGapPct !== undefined ? 'secondary' : 'ghost'}
          onClick={toggleGapChip}
        >
          Gapping ≥{GAP_CHIP_THRESHOLD}%
        </Button>
        <Button
          size="sm"
          variant={minVolumeRatio !== undefined ? 'secondary' : 'ghost'}
          onClick={toggleVolumeRatioChip}
        >
          Unusual volume ≥{VOLUME_RATIO_CHIP_THRESHOLD}×
        </Button>
        <div className="flex items-center gap-2">
          <Label htmlFor="min-gap" className="text-muted-foreground text-xs">
            Min gap %
          </Label>
          <Input
            id="min-gap"
            type="number"
            step="0.5"
            min="0"
            placeholder="any"
            value={minGapPct ?? ''}
            onChange={(e) => updateParams({ min_gap_pct: e.target.value || undefined })}
            className="w-20"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="min-ratio" className="text-muted-foreground text-xs">
            Min volume ×
          </Label>
          <Input
            id="min-ratio"
            type="number"
            step="0.5"
            min="1"
            placeholder="any"
            value={minVolumeRatio ?? ''}
            onChange={(e) => updateParams({ min_volume_ratio: e.target.value || undefined })}
            className="w-20"
          />
        </div>
      </div>

      {isPending && <Skeleton className="h-64 rounded-xl" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.items.length === 0 && (
        <EmptyState title="No tracked tickers yet" description="Add a custom ticker to begin." />
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
                <TableHead>Price</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Ratio</TableHead>
                <TableHead>Catalyst</TableHead>
                <TableHead>Earnings</TableHead>
                <TableHead>Scored</TableHead>
                <TableHead className="bg-background sticky right-0 w-10 border-l" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.ticker} className="group">
                  <TableCell className="font-medium">
                    <Link to={`/stocks/${item.ticker}`} className="hover:underline">
                      {item.ticker}
                    </Link>
                    {item.is_manual && (
                      <Badge variant="outline" className="ml-1.5 align-middle text-[10px]">
                        Custom
                      </Badge>
                    )}
                    {item.twitter_monitoring_enabled && (
                      <AtSign
                        className="ml-1.5 inline size-3 text-sky-600 dark:text-sky-400"
                        aria-label="Monitored on Twitter"
                      />
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
                  <TableCell>{formatCurrency(item.price)}</TableCell>
                  <TableCell
                    className={cn(
                      'tabular-nums',
                      item.change_pct === null
                        ? undefined
                        : item.change_pct >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400',
                    )}
                  >
                    {formatSignedPct(item.change_pct)}
                  </TableCell>
                  <TableCell>{formatNumber(item.volume)}</TableCell>
                  <TableCell className="tabular-nums">
                    {item.volume_ratio !== null ? `${item.volume_ratio.toFixed(1)}×` : '—'}
                  </TableCell>
                  <TableCell className="max-w-48 truncate">
                    {item.catalyst ? (
                      item.catalyst
                    ) : item.change_pct !== null ? (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <AlertCircle className="size-3.5" />
                        No catalyst found
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
                  <TableCell className="bg-background sticky right-0 border-l">
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <ManageListsDialog ticker={item.ticker} />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${item.twitter_monitoring_enabled ? 'Stop monitoring' : 'Monitor'} ${item.ticker} on Twitter`}
                        disabled={enableMonitoring.isPending || disableMonitoring.isPending}
                        onClick={() => {
                          const mutation = item.twitter_monitoring_enabled
                            ? disableMonitoring
                            : enableMonitoring
                          mutation.mutate(item.ticker, {
                            onSuccess: () =>
                              toast.success(
                                item.twitter_monitoring_enabled
                                  ? `${item.ticker} Twitter monitoring stopped`
                                  : `${item.ticker} Twitter monitoring enabled`,
                              ),
                            onError: () =>
                              toast.error(`Failed to update Twitter monitoring for ${item.ticker}`),
                          })
                        }}
                      >
                        {enableMonitoring.isPending || disableMonitoring.isPending ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <AtSign
                            className={cn(
                              item.twitter_monitoring_enabled &&
                                'text-sky-600 dark:text-sky-400',
                            )}
                          />
                        )}
                      </Button>
                      <RemoveTickerDialog ticker={item.ticker} />
                    </div>
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
