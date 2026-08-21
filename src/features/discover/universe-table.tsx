import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  AtSign,
  Loader2,
  MessagesSquare,
  Search,
  X,
} from 'lucide-react'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { Pagination } from '@/components/shared/pagination'
import { PATTERN_LABEL_SHORT, PatternBadge } from '@/components/shared/pattern-badge'
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
  useDisableRedditMonitoredTicker,
  useEnableMonitoredTicker,
  useEnableRedditMonitoredTicker,
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

// First click on "Next earnings" should read soonest-first, unlike the other
// fields (score/ticker/change_pct/volume_ratio), which default to
// desc on first click.
const DEFAULT_ORDER_OVERRIDE: Partial<Record<NonNullable<UniverseParams['sort']>, 'asc' | 'desc'>> =
  {
    next_earnings_date: 'asc',
  }

const SCORE_LEAN_META: Record<string, string> = {
  bullish:
    'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  bearish: 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400',
  neutral: 'border-border bg-muted text-muted-foreground',
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

// Same backend labels chart_pattern_detections actually stores, shown with
// PatternBadge's short display form so the filter buttons and the row
// badges read consistently.
const PATTERN_FILTER_OPTIONS: { label: string; value: string | undefined }[] = [
  { label: 'All', value: undefined },
  ...Object.entries(PATTERN_LABEL_SHORT)
    .filter(([label]) => label !== 'StockLine')
    .map(([value, label]) => ({ label, value })),
]

function EarningsCell({ item }: { item: UniverseTickerOut }) {
  return (
    <div className="max-w-36 space-y-0.5">
      {item.is_reit ? (
        <span
          className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-normal"
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
        <p className="text-muted-foreground text-xs whitespace-normal">
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

function SortableHead({
  label,
  field,
  sort,
  order,
  onSort,
}: {
  label: string
  field: NonNullable<UniverseParams['sort']>
  sort: NonNullable<UniverseParams['sort']>
  order: NonNullable<UniverseParams['order']>
  onSort: (field: NonNullable<UniverseParams['sort']>) => void
}) {
  const active = sort === field
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'hover:text-foreground inline-flex items-center gap-1 font-medium',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
        {active ? (
          order === 'desc' ? (
            <ArrowDown className="size-3" />
          ) : (
            <ArrowUp className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-40" />
        )}
      </button>
    </TableHead>
  )
}

export function UniverseTable() {
  // Sort/order/filters/page all live in the URL, not component state, so the
  // back button, a bookmark, or a shared link all restore the exact same view.
  const [searchParams, setSearchParams] = useSearchParams()

  const sort = (searchParams.get('sort') as UniverseParams['sort']) || DEFAULT_SORT
  const order = (searchParams.get('order') as UniverseParams['order']) || DEFAULT_ORDER
  const twitterMonitoredOnly = searchParams.get('twitter_monitored_only') === 'true'
  const redditMonitoredOnly = searchParams.get('reddit_monitored_only') === 'true'
  const earningsResult = (searchParams.get('earnings_result') as EarningsResult | null) ?? undefined
  const minGapPctRaw = searchParams.get('min_gap_pct')
  const minVolumeRatioRaw = searchParams.get('min_volume_ratio')
  const minGapPct = minGapPctRaw !== null ? Number(minGapPctRaw) : undefined
  const minVolumeRatio = minVolumeRatioRaw !== null ? Number(minVolumeRatioRaw) : undefined
  const patternLabel = searchParams.get('pattern_label') ?? undefined
  const sector = searchParams.get('sector') ?? undefined
  const q = searchParams.get('q') ?? ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const { data, isPending, isFetching, isError, error, refetch } = useUniverse({
    sort,
    order,
    twitterMonitoredOnly,
    redditMonitoredOnly,
    earningsResult,
    minGapPct,
    minVolumeRatio,
    patternLabel,
    sector,
    q: q || undefined,
    limit: PAGE_SIZE,
    offset,
  })
  const enableMonitoring = useEnableMonitoredTicker()
  const disableMonitoring = useDisableMonitoredTicker()
  const enableRedditMonitoring = useEnableRedditMonitoredTicker()
  const disableRedditMonitoring = useDisableRedditMonitoredTicker()
  const monitoredCount = useUniverse({ twitterMonitoredOnly: true, limit: 1, offset: 0 })
  const redditMonitoredCount = useUniverse({ redditMonitoredOnly: true, limit: 1, offset: 0 })

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

  // Typing updates this local field immediately; the URL (and therefore the
  // actual request) only follows after a short pause, same debounce pattern
  // as the header's ticker-search box, so the ~916-ticker universe isn't
  // re-queried on every keystroke.
  const [searchInput, setSearchInput] = useState(q)

  useEffect(() => {
    setSearchInput(q)
  }, [q])

  useEffect(() => {
    const trimmed = searchInput.trim()
    if (trimmed === q) return
    const handle = setTimeout(() => updateParams({ q: trimmed || undefined }), 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

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

      <div className="relative max-w-xs">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search ticker or company…"
          aria-label="Search tracked universe by ticker or company name"
          className="pl-8 pr-8"
        />
        {searchInput && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Clear search"
            onClick={() => setSearchInput('')}
            className="absolute top-1/2 right-1 -translate-y-1/2 cursor-pointer"
          >
            <X className="size-3.5" />
          </Button>
        )}
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
        <Button
          size="sm"
          variant={redditMonitoredOnly ? 'secondary' : 'ghost'}
          onClick={() =>
            updateParams({
              reddit_monitored_only: redditMonitoredOnly ? undefined : 'true',
            })
          }
        >
          <MessagesSquare />
          {redditMonitoredCount.data?.total ?? 0} Reddit monitored
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

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs">Pattern</span>
        {PATTERN_FILTER_OPTIONS.map((opt) => (
          <Button
            key={opt.label}
            size="sm"
            variant={patternLabel === opt.value ? 'secondary' : 'ghost'}
            onClick={() => updateParams({ pattern_label: opt.value })}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {isPending && <Skeleton className="h-64 rounded-xl" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.items.length === 0 && q && (
        <EmptyState
          title={`No matches for "${q}"`}
          description="Try a different ticker or company name."
        />
      )}
      {data && data.items.length === 0 && !q && (
        <EmptyState title="No tracked tickers yet" description="Add a custom ticker to begin." />
      )}

      {data && data.items.length > 0 && (
        <>
          <Table className={cn(isFetching && 'opacity-60 transition-opacity')}>
            <TableHeader>
              <TableRow>
                <SortableHead
                  label="Ticker"
                  field="ticker"
                  sort={sort}
                  order={order}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Score"
                  field="score"
                  sort={sort}
                  order={order}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Price"
                  field="change_pct"
                  sort={sort}
                  order={order}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="P/E"
                  field="pe_ratio"
                  sort={sort}
                  order={order}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Volume"
                  field="volume_ratio"
                  sort={sort}
                  order={order}
                  onSort={toggleSort}
                />
                <TableHead>Catalyst</TableHead>
                <SortableHead
                  label="Earnings"
                  field="next_earnings_date"
                  sort={sort}
                  order={order}
                  onSort={toggleSort}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.ticker} className="group">
                  <TableCell className="font-medium">
                    <div className="inline-flex items-center gap-1">
                      <Link to={`/stocks/${item.ticker}`} className="hover:underline">
                        {item.ticker}
                      </Link>
                      {item.is_manual && (
                        <Badge variant="outline" className="align-middle text-[10px]">
                          Custom
                        </Badge>
                      )}
                      <PatternBadge pattern={item.recent_pattern} />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
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
                            className={cn(
                              'cursor-pointer',
                              !item.twitter_monitoring_enabled &&
                                'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
                            )}
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
                        </TooltipTrigger>
                        <TooltipContent>
                          {item.twitter_monitoring_enabled
                            ? 'Stop Twitter monitoring'
                            : 'Monitor on Twitter'}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <RedditMonitoringButton
                            ticker={item.ticker}
                            enabled={item.reddit_monitoring_enabled}
                            pending={
                              enableRedditMonitoring.isPending || disableRedditMonitoring.isPending
                            }
                            className={cn(
                              !item.reddit_monitoring_enabled &&
                                'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
                            )}
                            onToggle={() => {
                              const mutation = item.reddit_monitoring_enabled
                                ? disableRedditMonitoring
                                : enableRedditMonitoring
                              mutation.mutate(item.ticker, {
                                onSuccess: () =>
                                  toast.success(
                                    item.reddit_monitoring_enabled
                                      ? `${item.ticker} Reddit monitoring stopped`
                                      : `${item.ticker} Reddit monitoring enabled`,
                                  ),
                                onError: () =>
                                  toast.error(`Failed to update Reddit monitoring for ${item.ticker}`),
                              })
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          {item.reddit_monitoring_enabled
                            ? 'Stop Reddit monitoring'
                            : 'Monitor on Reddit'}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    {(item.company_name || item.sector) && (
                      <div className="flex max-w-56 items-center gap-1">
                        {item.company_name && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-muted-foreground min-w-0 truncate text-xs font-normal cursor-help">
                                {item.company_name}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{item.company_name}</TooltipContent>
                          </Tooltip>
                        )}
                        {item.sector && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="bg-muted text-muted-foreground max-w-24 shrink-0 cursor-help truncate rounded px-1 py-px text-[9px] leading-tight font-medium">
                                {item.sector}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{item.sector}</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.score !== null ? (
                      <div className="space-y-0.5">
                        <span
                          className={cn(
                            'inline-flex min-w-9 items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums',
                            SCORE_LEAN_META[item.lean ?? 'neutral'] ?? SCORE_LEAN_META.neutral,
                          )}
                          aria-label={`${item.score.toFixed(0)} score${item.lean ? `, ${item.lean}` : ''}`}
                          title={item.lean ? `${item.lean} score` : 'Score'}
                        >
                          {item.score.toFixed(0)}
                        </span>
                        <p className="text-muted-foreground text-[10px]">
                          {formatRelativeTime(item.score_updated_at)}
                        </p>
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="tabular-nums">{formatCurrency(item.price)}</div>
                    <div
                      className={cn(
                        'text-xs tabular-nums',
                        item.change_pct === null
                          ? 'text-muted-foreground'
                          : item.change_pct >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400',
                      )}
                    >
                      {formatSignedPct(item.change_pct)}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {item.pe_ratio !== null ? `${item.pe_ratio.toFixed(1)}×` : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="tabular-nums">{formatNumber(item.volume)}</div>
                    <div className="text-muted-foreground text-xs tabular-nums">
                      {item.volume_ratio !== null ? `${item.volume_ratio.toFixed(1)}×` : '—'}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-32">
                    {item.catalyst ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block cursor-help truncate">{item.catalyst}</span>
                        </TooltipTrigger>
                        <TooltipContent>{item.catalyst}</TooltipContent>
                      </Tooltip>
                    ) : item.change_pct !== null ? (
                      <span className="inline-flex min-w-0 items-center gap-1 text-amber-600 dark:text-amber-400">
                        <AlertCircle className="size-3.5 shrink-0" />
                        <span className="truncate">No catalyst</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="relative">
                    <EarningsCell item={item} />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <div className="bg-background pointer-events-auto flex items-center gap-1 rounded-md border py-1 pr-1 pl-3 shadow-md">
                        <ManageListsDialog ticker={item.ticker} />
                        <RemoveTickerDialog ticker={item.ticker} />
                      </div>
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

export function RedditMonitoringButton({
  ticker,
  enabled,
  pending,
  onToggle,
  className,
}: {
  ticker: string
  enabled: boolean
  pending: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={`${enabled ? 'Stop monitoring' : 'Monitor'} ${ticker} on Reddit`}
      disabled={pending}
      onClick={onToggle}
      className={cn('cursor-pointer', className)}
    >
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <MessagesSquare className={cn(enabled && 'text-orange-600 dark:text-orange-400')} />
      )}
    </Button>
  )
}
