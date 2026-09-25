import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ResearchPerformanceFilters } from '@/types/api'
import { useResearchObservations } from './hooks'

export const OBSERVATION_PAGE_SIZE = 50

const signedPct = (value: number | null) =>
  value === null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  evaluated: 'Evaluated',
  missing_data: 'Missing data',
  corporate_action_unresolved: 'Split unresolved',
}

/** Row-level drill-down, including rows whose prices never arrived. */
export function ResearchObservationsTable({ filters }: { filters: ResearchPerformanceFilters }) {
  const [page, setPage] = useState(1)
  const query = useResearchObservations(filters, page, OBSERVATION_PAGE_SIZE, true)

  if (query.isPending) return <p className="text-muted-foreground text-sm">Loading rows…</p>
  if (query.isError || !query.data) {
    return <p className="text-destructive text-sm">Could not load the observation rows.</p>
  }
  const { items, total } = query.data
  const pages = Math.max(1, Math.ceil(total / OBSERVATION_PAGE_SIZE))
  if (total === 0) return <p className="text-muted-foreground text-sm">No rows match.</p>

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead>Decision session</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Baseline → exit</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">vs SPY</TableHead>
              <TableHead>Path</TableHead>
              <TableHead>Evidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => (
              <TableRow key={`${row.observation_id}-${row.revision}`}>
                <TableCell className="font-medium">{row.ticker}</TableCell>
                <TableCell>{row.decision_session}</TableCell>
                <TableCell>
                  {STATUS_LABELS[row.status] ?? row.status}
                  {row.status_reason && (
                    <span className="text-muted-foreground block text-xs">
                      {row.status_reason.replaceAll('_', ' ')}
                    </span>
                  )}
                  {row.revision > 1 && (
                    <span className="text-muted-foreground block text-xs">
                      revision {row.revision}
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {row.baseline_session} → {row.exit_session}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {signedPct(row.raw_return_pct)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {signedPct(row.excess_return_pct)}
                </TableCell>
                <TableCell className="min-w-40 text-xs">
                  {row.path_status ? (
                    <>
                      <span>{row.target_stop_order?.replaceAll('_', ' ') ?? row.path_status.replaceAll('_', ' ')}</span>
                      {row.path_status.startsWith('gap_through_') && (
                        <span className="text-muted-foreground block">
                          {row.path_status.replaceAll('_', ' ')} · no fill assumed
                        </span>
                      )}
                      <span className="text-muted-foreground block">
                        Favorable {signedPct(row.favorable_move_pct ?? null)} · adverse{' '}
                        {signedPct(row.adverse_move_pct ?? null)}
                      </span>
                      {row.path_coverage && row.path_coverage.usable_bars < row.path_coverage.expected_bars && (
                        <span className="text-muted-foreground block">
                          {row.path_coverage.usable_bars}/{row.path_coverage.expected_bars} bars covered
                        </span>
                      )}
                    </>
                  ) : '—'}
                </TableCell>
                <TableCell className="max-w-72 truncate" title={row.headline ?? undefined}>
                  {row.headline ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {total} rows · page {page} of {pages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
