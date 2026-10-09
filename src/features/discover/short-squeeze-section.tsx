import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ErrorState } from '@/components/shared/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useResearchCapabilities } from '@/features/research/hooks'
import { formatDate, formatEasternDateTime, formatSignedPct } from '@/lib/format'
import type { ShortSqueezeItemOut, ShortSqueezeListOut } from '@/types/short-squeeze'
import { ShortSqueezeDetail } from './short-squeeze-detail'
import {
  SHORT_SQUEEZE_RULE,
  closedBelowHigh,
  completedSessionVolume,
  formatDaysToCover,
  formatShortFloat,
  matchedConditionLabel,
  readableReason,
  shortMetadataWarning,
} from './short-squeeze-format'
import { readShortSqueezeParams, useShortSqueezes } from './short-squeeze-hooks'

const selectClass = 'border-input bg-background h-8 max-w-full rounded-md border px-2 text-xs'

function SqueezeRow({ item, onInspect }: { item: ShortSqueezeItemOut; onInspect: () => void }) {
  const incomplete = item.status === 'incomplete'
  const metadataWarning = shortMetadataWarning(item)
  return (
    <TableRow>
      <TableCell className="align-top">
        <Link className="font-semibold hover:underline" to={`/stocks/${encodeURIComponent(item.ticker)}?tab=analysis`}>
          {item.ticker}
        </Link>
        {item.company_name && <p className="text-muted-foreground max-w-40 truncate text-xs">{item.company_name}</p>}
      </TableCell>
      <TableCell className="align-top tabular-nums">{formatSignedPct(item.move_pct)}</TableCell>
      <TableCell className={`align-top tabular-nums${metadataWarning ? ' text-muted-foreground' : ''}`}>
        {formatShortFloat(item.short_percent_of_float)}
        {metadataWarning && <p className="text-amber-700 dark:text-amber-400 text-xs">Unusable</p>}
        {item.short_float_source === 'derived_shares_short_over_float' && <p className="text-muted-foreground text-xs">Estimated short float</p>}
      </TableCell>
      <TableCell className={`align-top tabular-nums${metadataWarning ? ' text-muted-foreground' : ''}`}>
        {formatDaysToCover(item.short_ratio)}
        {metadataWarning && <p className="text-amber-700 dark:text-amber-400 text-xs">Unusable</p>}
      </TableCell>
      <TableCell className="min-w-56 space-y-0.5 align-top text-xs">
        {incomplete ? (
          <>
            <p className="font-medium">Incomplete</p>
            {item.quality_reasons.length > 0 && (
              <p className="text-muted-foreground">Missing: {item.quality_reasons.map(readableReason).join(', ')}</p>
            )}
          </>
        ) : (
          <>
            <p className="font-medium">{matchedConditionLabel(item)}</p>
            {item.quality_reasons.length > 0 && (
              <p className="text-muted-foreground whitespace-normal">Data limits: {item.quality_reasons.map(readableReason).join(', ')}</p>
            )}
          </>
        )}
        {metadataWarning && <p className="text-amber-700 dark:text-amber-400 whitespace-normal">{metadataWarning}</p>}
        {closedBelowHigh(item) && <p className="text-amber-700 dark:text-amber-400">High touched; closed below</p>}
        {item.source_corrected && <p className="text-amber-700 dark:text-amber-400">Source data changed after the first match</p>}
        <p className="text-muted-foreground">{completedSessionVolume(item.relative_volume)}</p>
        {item.short_report_date === null && (
          <p className="text-muted-foreground">Short-interest report date unavailable</p>
        )}
      </TableCell>
      <TableCell className="align-top text-right">
        <Button variant="outline" size="sm" aria-label={`Inspect ${item.ticker}`} onClick={onInspect}>
          Inspect
        </Button>
      </TableCell>
    </TableRow>
  )
}

function CollectionLine({ data }: { data: ShortSqueezeListOut }) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
      <span>{data.collection_enabled ? 'Scanning completed daily sessions' : 'Collection off · cached results'}</span>
      {data.stale && (
        <>
          <Badge variant="outline">Stale</Badge>
          <span>{data.stale_reasons.map(readableReason).join(', ')}</span>
        </>
      )}
    </div>
  )
}

function CoverageLine({ data }: { data: ShortSqueezeListOut }) {
  const { coverage } = data
  return (
    <p className="text-muted-foreground text-xs">
      Coverage: {coverage.evaluated} evaluated / {coverage.matched} matched / {coverage.incomplete} incomplete /{' '}
      {coverage.excluded} excluded
      {data.published_at && ` · Last published ${formatEasternDateTime(data.published_at)}`}
      {' · Short-interest report dates may be unavailable'}
    </p>
  )
}

function emptyMessage(data: ShortSqueezeListOut, status: string): string {
  if (data.data_status === 'not_collected') {
    return 'No scan has been published yet. The first scan runs once a session is final.'
  }
  if (status === 'incomplete') return 'No evaluations are waiting on missing data.'
  return 'No stocks met every condition in the latest session.'
}

export function ShortSqueezeSection() {
  const capabilities = useResearchCapabilities()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selected, setSelected] = useState<number | null>(null)
  const params = readShortSqueezeParams(searchParams)
  const query = useShortSqueezes(params, capabilities.data !== undefined)

  function setFilter(key: 'squeeze_status' | 'squeeze_sort', value: string) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set(key, value)
      next.delete('squeeze_page')
      return next
    })
  }
  function setPage(page: number) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set('squeeze_page', String(page))
      return next
    })
  }

  if (!capabilities.data) return null
  const enabled = capabilities.data.short_squeeze_scanner_enabled === true
  const hasCache = query.data !== undefined && query.data.publication_id !== null
  // Disabled collection hides the section only when there is nothing cached to inspect.
  if (!enabled && !hasCache) return null
  const data = query.data
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / params.pageSize))

  return (
    <section className="space-y-3" aria-label="Short Squeeze Strategy">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Short Squeeze Strategy</h2>
        {data?.signal_session && (
          <span className="text-muted-foreground text-xs">Daily session: {formatDate(data.signal_session)}</span>
        )}
      </div>
      <p className="text-muted-foreground text-xs">{SHORT_SQUEEZE_RULE}</p>
      {data && <CollectionLine data={data} />}
      <div className="flex flex-wrap gap-2">
        <label className="text-muted-foreground flex items-center gap-1 text-xs">Show
          <select className={selectClass} aria-label="Short squeeze status" value={params.status} onChange={(event) => setFilter('squeeze_status', event.target.value)}>
            <option value="matched">Matches</option>
            <option value="incomplete">Incomplete data</option>
            <option value="all">Matches and incomplete</option>
          </select>
        </label>
        <label className="text-muted-foreground flex items-center gap-1 text-xs">Sort
          <select className={selectClass} aria-label="Short squeeze sort" value={params.sort} onChange={(event) => setFilter('squeeze_sort', event.target.value)}>
            <option value="move">Daily move</option>
            <option value="short_float">Short float</option>
            <option value="days_to_cover">Days to cover</option>
            <option value="ticker">Ticker</option>
          </select>
        </label>
      </div>
      {query.isPending && <Skeleton className="h-32 rounded-lg" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {data && data.items.length === 0 && (
        <p className="text-muted-foreground text-sm">{emptyMessage(data, params.status)}</p>
      )}
      {data && data.items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead>Daily move</TableHead>
                <TableHead>Short float</TableHead>
                <TableHead>Days to cover</TableHead>
                <TableHead>Matched condition</TableHead>
                <TableHead className="sr-only">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <SqueezeRow key={item.evaluation_id} item={item} onInspect={() => setSelected(item.evaluation_id)} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <Button variant="outline" size="sm" aria-label="Previous short squeeze page" disabled={params.page <= 1} onClick={() => setPage(params.page - 1)}>Previous</Button>
          <span>Page {params.page} of {totalPages}</span>
          <Button variant="outline" size="sm" aria-label="Next short squeeze page" disabled={params.page >= totalPages} onClick={() => setPage(params.page + 1)}>Next</Button>
        </div>
      )}
      {data && <CoverageLine data={data} />}
      <ShortSqueezeDetail
        evaluationId={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </section>
  )
}
