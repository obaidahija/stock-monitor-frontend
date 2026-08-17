import {
  AlertTriangle,
  ChevronDown,
  LayoutGrid,
  ListPlus,
  Pencil,
  Table2,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { ScoreGauge } from '@/features/ticker-detail/ai-research/score-gauge'
import { formatCurrency, formatRelativeTime, formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AnalysisLean, WatchlistItemOut } from '@/types/api'

export function WatchlistsPage() {
  const lists = useWatchlists()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'detailed' | 'simple'>('simple')
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
            <div className="mr-2 flex rounded-md border p-0.5" aria-label="Watchlist view">
              <Button
                variant={viewMode === 'detailed' ? 'secondary' : 'ghost'}
                size="icon-sm"
                aria-label="Detailed view"
                aria-pressed={viewMode === 'detailed'}
                onClick={() => setViewMode('detailed')}
              >
                <LayoutGrid />
              </Button>
              <Button
                variant={viewMode === 'simple' ? 'secondary' : 'ghost'}
                size="icon-sm"
                aria-label="Simple table view"
                aria-pressed={viewMode === 'simple'}
                onClick={() => setViewMode('simple')}
              >
                <Table2 />
              </Button>
            </div>
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
        viewMode === 'detailed' ? (
          <div className="grid gap-4">
            {items.data.map((item) => <WatchlistItemCard key={item.id} item={item} />)}
          </div>
        ) : (
          <SimpleWatchlistTable items={items.data} />
        )
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
            <TableHead className="w-[22%] whitespace-normal">Ticker</TableHead>
            <TableHead className="w-[12%] whitespace-normal text-right">Price</TableHead>
            <TableHead className="w-[16%] whitespace-normal text-right">Primary entry</TableHead>
            <TableHead className="w-[16%] whitespace-normal text-right">Secondary entry</TableHead>
            <TableHead className="w-[16%] whitespace-normal text-right">Take profit</TableHead>
            <TableHead className="w-[18%] whitespace-normal text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const isExpanded = expanded.has(item.id)
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
                    {formatCurrency(item.current_price)}
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
      item.current_setup &&
      !window.confirm(`Remove ${item.ticker} and all setup history from this list?`)
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

function WatchlistItemCard({ item }: { item: WatchlistItemOut }) {
  const setup = item.current_setup
  const remove = useRemoveWatchlistItem()

  async function removeTicker() {
    if (
      setup &&
      !window.confirm(`Remove ${item.ticker} and all setup history from this list?`)
    ) return
    try {
      await remove.mutateAsync({ watchlistId: item.watchlist_id, ticker: item.ticker })
      toast.success(`${item.ticker} removed from this list`)
    } catch {
      toast.error(`Could not remove ${item.ticker}`)
    }
  }

  return (
    <Card>
      <CardHeader className="grid-cols-[1fr_auto]">
        <div>
          <CardTitle>
            <Link to={`/stocks/${item.ticker}`} className="hover:underline">{item.ticker}</Link>
            {item.company_name && <span className="text-muted-foreground ml-2 font-normal">{item.company_name}</span>}
          </CardTitle>
          <div className="text-muted-foreground mt-1 text-xs">
            {formatCurrency(item.current_price)} · quote {formatRelativeTime(item.quote_updated_at)}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {setup ? (
            <>
              <Badge variant={setup.status === 'expired' ? 'outline' : 'secondary'} className="capitalize">{setup.status}</Badge>
              <Badge variant="outline" className="capitalize">{setup.side}</Badge>
              <Badge variant="outline">{setup.source_mode === 'ai_managed' ? 'AI managed' : 'Manual'}</Badge>
              {setup.needs_review && <Badge variant="destructive"><AlertTriangle /> Needs review</Badge>}
            </>
          ) : <Badge variant="outline">Favorite only</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {setup ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Level label="Primary entry" value={setup.entry_primary} distance={item.distance_pct?.entry_primary} />
              <Level label="Secondary entry" value={setup.entry_secondary} distance={item.distance_pct?.entry_secondary} />
              <Level label="Stop loss" value={setup.stop_loss} distance={item.distance_pct?.stop_loss} />
              <Level label="Take profit" value={setup.take_profit} distance={item.distance_pct?.take_profit} />
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3 border-t pt-3">
              <div className="max-w-2xl text-sm">
                {setup.research?.summary && <p>{setup.research.summary}</p>}
                <p className="text-muted-foreground mt-1 text-xs">
                  Expires {setup.expires_on}
                  {setup.research && ` · AI ${setup.research.lean ?? 'neutral'} · score ${setup.research.score ?? '—'} · confidence ${setup.research.confidence ?? '—'}`}
                </p>
                {setup.sync_error && <p className="text-destructive mt-1 text-xs">{setup.sync_error}</p>}
              </div>
              <div className="flex flex-wrap gap-1">
                <SetupFormDialog watchlistId={item.watchlist_id} ticker={item.ticker} setup={setup} />
                <SetupHistoryDialog itemId={item.id} ticker={item.ticker} />
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${item.ticker}`} onClick={() => void removeTicker()}><Trash2 /></Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">This ticker is saved without a price plan.</p>
            <div className="flex gap-1">
              <SetupFormDialog watchlistId={item.watchlist_id} ticker={item.ticker} />
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${item.ticker}`} onClick={() => void removeTicker()}><Trash2 /></Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Level({ label, value, distance }: { label: string; value: number | null; distance: number | null | undefined }) {
  return (
    <div className="bg-muted/40 rounded-lg p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-medium tabular-nums">{formatCurrency(value)}</p>
      <p className={cn('mt-0.5 text-xs tabular-nums', distance === undefined || distance === null ? 'text-muted-foreground' : distance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
        {formatSignedPct(distance)} from current
      </p>
    </div>
  )
}
