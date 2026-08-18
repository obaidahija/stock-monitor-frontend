import {
  AlertTriangle,
  ChevronDown,
  ListPlus,
  Pencil,
  Trash2,
} from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  useCreateWatchlist,
  useDeleteWatchlist,
  useRemoveWatchlistItem,
  useRenameWatchlist,
  useWatchlistItems,
  useWatchlists,
} from '@/features/watchlists/hooks'
import { SetupFormDialog } from '@/features/watchlists/setup-form-dialog'
import { SetupHistoryDialog } from '@/features/watchlists/setup-history-dialog'
import { WatchlistEventsDialog } from '@/features/watchlists/watchlist-events-dialog'
import { ScoreGauge } from '@/features/ticker-detail/ai-research/score-gauge'
import {
  formatCurrency,
  formatEasternDateTime,
  formatRelativeTime,
  formatSignedPct,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AnalysisLean, WatchlistItemOut } from '@/types/api'

export function WatchlistsPage() {
  const lists = useWatchlists()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const items = useWatchlistItems(selectedId)
  const create = useCreateWatchlist()
  const rename = useRenameWatchlist()
  const remove = useDeleteWatchlist()

  useEffect(() => {
    if (!lists.data?.length) return
    if (selectedId === null || !lists.data.some((list) => list.id === selectedId)) {
      setSelectedId(lists.data[0].id)
    }
  }, [lists.data, selectedId])

  const selected = lists.data?.find((list) => list.id === selectedId)

  async function createList() {
    const name = window.prompt('New watchlist name')?.trim()
    if (!name) return
    try {
      const row = await create.mutateAsync(name)
      setSelectedId(row.id)
    } catch {
      toast.error('Could not create that watchlist')
    }
  }

  async function renameList() {
    if (!selected) return
    const name = window.prompt('Rename watchlist', selected.name)?.trim()
    if (!name || name === selected.name) return
    try {
      await rename.mutateAsync({ id: selected.id, name })
    } catch {
      toast.error('Could not rename that watchlist')
    }
  }

  async function deleteList() {
    if (!selected || !window.confirm(`Delete ${selected.name} and all of its setup history?`)) return
    try {
      await remove.mutateAsync(selected.id)
      setSelectedId(null)
    } catch {
      toast.error('The final watchlist cannot be deleted')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Watchlists"
        description="Personal favorites and price plans. These do not change tracked-universe coverage or scheduled enrichment."
        actions={<Button size="sm" onClick={() => void createList()}><ListPlus /> New list</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        {lists.data?.map((list) => (
          <Button
            key={list.id}
            size="sm"
            variant={selectedId === list.id ? 'secondary' : 'ghost'}
            onClick={() => setSelectedId(list.id)}
          >
            {list.name}
            <Badge variant="outline">{list.item_count}</Badge>
          </Button>
        ))}
        {selected && (
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Rename watchlist" onClick={() => void renameList()}><Pencil /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Delete watchlist" onClick={() => void deleteList()}><Trash2 /></Button>
          </div>
        )}
      </div>

      {items.isError && <ErrorState error={items.error} onRetry={() => items.refetch()} />}
      {items.isPending && selectedId !== null && <p className="text-muted-foreground text-sm">Loading watchlist…</p>}
      {items.data?.length === 0 && (
        <EmptyState title="No tickers in this list" description="Use Manage lists from Discover or a ticker page to add favorites." />
      )}
      {items.data && items.data.length > 0 && (
        <SimpleWatchlistTable items={items.data} />
      )}
    </div>
  )
}

function SimpleWatchlistTable({ items }: { items: WatchlistItemOut[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  function toggleExpanded(id: number) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[20%] whitespace-normal">Ticker</TableHead>
            <TableHead className="w-[20%] whitespace-normal text-right">Price</TableHead>
            <TableHead className="w-[14%] whitespace-normal text-right">Primary entry</TableHead>
            <TableHead className="w-[14%] whitespace-normal text-right">Secondary entry</TableHead>
            <TableHead className="w-[14%] whitespace-normal text-right">Take profit</TableHead>
            <TableHead className="w-[18%] whitespace-normal text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const isExpanded = expanded.has(item.id)
            const sessionChange =
              item.current_price !== null && item.session_price !== null
                ? item.session_price - item.current_price
                : null
            const sessionChangePct =
              sessionChange !== null && item.current_price !== null && item.current_price > 0
                ? (sessionChange / item.current_price) * 100
                : null
            const showSessionPrice =
              item.market_session === 'pre_market' ||
              item.market_session === 'post_market' ||
              item.market_session === 'overnight'
            return (
              <Fragment key={item.id}>
                <TableRow>
                  <TableCell className="max-w-56 whitespace-normal">
                    <Link to={`/stocks/${item.ticker}`} className="font-medium hover:underline">
                      {item.ticker}
                    </Link>
                    {item.company_name && (
                      <span className="text-muted-foreground mt-0.5 block text-sm leading-snug break-words">
                        {item.company_name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal text-right tabular-nums">
                    <span className="block">{formatCurrency(item.current_price)}</span>
                    {item.market_session && (
                      <>
                        <span className="mt-0.5 flex flex-wrap items-center justify-end gap-x-1.5 text-xs leading-snug">
                          <span className="text-muted-foreground">
                            {formatMarketSession(item.market_session)}
                          </span>
                          {showSessionPrice && item.session_price !== null && (
                            <span>{formatCurrency(item.session_price)}</span>
                          )}
                          {sessionChange !== null && sessionChangePct !== null && (
                            <span
                              className={cn(
                                'font-medium',
                                sessionChange > 0 && 'text-emerald-600 dark:text-emerald-400',
                                sessionChange < 0 && 'text-red-600 dark:text-red-400',
                                sessionChange === 0 && 'text-muted-foreground',
                              )}
                            >
                              {formatSignedPriceChange(sessionChange)} ({formatSignedPct(
                                sessionChangePct,
                                Math.abs(sessionChangePct) < 1 ? 3 : 2,
                              )})
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
                          {item.market_session === 'overnight' && 'Closed: '}
                          {formatEasternDateTime(item.quote_updated_at)}
                        </span>
                      </>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal text-right tabular-nums">
                    <SimpleLevel
                      value={item.current_setup?.entry_primary ?? null}
                      distance={item.distance_pct?.entry_primary}
                    />
                  </TableCell>
                  <TableCell className="whitespace-normal text-right tabular-nums">
                    <SimpleLevel
                      value={item.current_setup?.entry_secondary ?? null}
                      distance={item.distance_pct?.entry_secondary}
                    />
                  </TableCell>
                  <TableCell className="whitespace-normal text-right tabular-nums">
                    <SimpleLevel
                      value={item.current_setup?.take_profit ?? null}
                      distance={item.distance_pct?.take_profit}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-0.5">
                      <SetupFormDialog
                        watchlistId={item.watchlist_id}
                        ticker={item.ticker}
                        setup={item.current_setup}
                        compact
                      />
                      <SetupHistoryDialog itemId={item.id} ticker={item.ticker} compact />
                      <WatchlistEventsDialog item={item} />
                      <RemoveWatchlistItemButton item={item} />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${item.ticker} details`}
                        aria-expanded={isExpanded}
                        onClick={() => toggleExpanded(item.id)}
                      >
                        <ChevronDown
                          className={cn('transition-transform', isExpanded && 'rotate-180')}
                        />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="bg-muted/20 p-0 whitespace-normal">
                      <ExpandedWatchlistDetails item={item} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function formatMarketSession(session: NonNullable<WatchlistItemOut['market_session']>) {
  return {
    overnight: 'Overnight',
    pre_market: 'Pre',
    regular: 'Regular',
    post_market: 'Post',
    closed: 'Closed',
  }[session]
}

function formatSignedPriceChange(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${Math.abs(value).toFixed(2)}`
}

function ExpandedWatchlistDetails({ item }: { item: WatchlistItemOut }) {
  const setup = item.current_setup

  if (!setup) {
    return (
      <div className="px-6 py-4">
        <p className="text-muted-foreground text-sm">
          This ticker is saved as a favorite without a price setup. Use Create setup in this row
          to add entry, stop-loss, and take-profit levels.
        </p>
      </div>
    )
  }

  const researchLean: AnalysisLean | null =
    setup.research?.lean === 'bullish' ||
    setup.research?.lean === 'bearish' ||
    setup.research?.lean === 'neutral'
      ? setup.research.lean
      : null
  const researchScore = setup.research?.score
  const researchConfidence = setup.research?.confidence
  const researchGauge =
    researchLean !== null &&
    typeof researchScore === 'number' &&
    typeof researchConfidence === 'number'
      ? { lean: researchLean, score: researchScore, confidence: researchConfidence }
      : null

  return (
    <div className="space-y-4 px-6 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={setup.status === 'expired' ? 'outline' : 'secondary'}
          className="capitalize"
        >
          {setup.status}
        </Badge>
        <Badge variant="outline" className="capitalize">{setup.side}</Badge>
        <Badge variant="outline">
          {setup.source_mode === 'ai_managed' ? 'AI managed' : 'Manual'}
        </Badge>
        {setup.needs_review && (
          <Badge variant="destructive"><AlertTriangle /> Needs review</Badge>
        )}
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-muted-foreground text-xs">Stop loss</p>
          <SimpleLevel value={setup.stop_loss} distance={item.distance_pct?.stop_loss} />
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Horizon</p>
          <p className="mt-0.5 capitalize">{setup.horizon.replace('_', ' ')}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Expires</p>
          <p className="mt-0.5">{setup.expires_on}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Latest quote</p>
          <p className="mt-0.5">{formatRelativeTime(item.quote_updated_at)}</p>
        </div>
      </div>

      {(setup.research || setup.note || setup.sync_error) && (
        <div className="bg-background flex max-w-5xl flex-col gap-4 rounded-lg border p-4 whitespace-normal break-words sm:flex-row sm:items-start">
          {researchGauge && (
            <div className="w-full max-w-48 shrink-0">
              <ScoreGauge
                score={researchGauge.score}
                confidence={researchGauge.confidence}
                lean={researchGauge.lean}
              />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-3">
            {setup.research?.summary && (
              <div>
                <p className="text-muted-foreground text-xs font-medium">AI explanation</p>
                <p className="mt-1 text-sm leading-relaxed">{setup.research.summary}</p>
              </div>
            )}
            {setup.note && (
              <div className="border-t pt-3">
                <p className="text-muted-foreground text-xs font-medium">Note</p>
                <p className="mt-1 text-sm leading-relaxed">{setup.note}</p>
              </div>
            )}
            {setup.sync_error && <p className="text-destructive text-xs">{setup.sync_error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function RemoveWatchlistItemButton({ item }: { item: WatchlistItemOut }) {
  const remove = useRemoveWatchlistItem()

  async function removeTicker() {
    if (
      (item.current_setup || item.event_count > 0) &&
      !window.confirm(`Remove ${item.ticker} and all setup and event history from this list?`)
    ) return
    try {
      await remove.mutateAsync({ watchlistId: item.watchlist_id, ticker: item.ticker })
      toast.success(`${item.ticker} removed from this list`)
    } catch {
      toast.error(`Could not remove ${item.ticker}`)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Remove ${item.ticker}`}
      disabled={remove.isPending}
      onClick={() => void removeTicker()}
    >
      <Trash2 />
    </Button>
  )
}

function SimpleLevel({
  value,
  distance,
}: {
  value: number | null
  distance: number | null | undefined
}) {
  return (
    <div>
      <div>{formatCurrency(value)}</div>
      {value !== null && (
        <div
          className={cn(
            'text-xs',
            distance === undefined || distance === null
              ? 'text-muted-foreground'
              : distance >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400',
          )}
        >
          {formatSignedPct(distance)} from current
        </div>
      )}
    </div>
  )
}
