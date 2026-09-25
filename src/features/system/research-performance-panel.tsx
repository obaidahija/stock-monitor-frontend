import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { downloadResearchExport } from '@/api/system'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiError } from '@/lib/api-client'
import type {
  ResearchMetricName,
  ResearchMetricOut,
  ResearchOrigin,
  ResearchOutcomeStatus,
  ResearchPerformanceFilters,
  ResearchSide,
  ResearchSourceKind,
} from '@/types/api'
import { useResearchPerformance } from './hooks'
import { ResearchObservationsTable } from './research-observations-table'

const HORIZONS = [1, 3, 5, 7] as const
const SOURCES: { value: ResearchSourceKind; label: string }[] = [
  { value: 'composite_daily', label: 'Composite score (daily)' },
  { value: 'catalyst', label: 'Catalyst scanner' },
  { value: 'follow_through', label: 'Follow-through (selected)' },
]
const METRIC_ROWS: { metric: ResearchMetricName; label: string }[] = [
  { metric: 'raw_return_pct', label: 'Positive stock return' },
  { metric: 'side_return_pct', label: 'Positive side return' },
  { metric: 'cost_adjusted_return_pct', label: 'Positive after assumed costs' },
  { metric: 'excess_return_pct', label: 'Beat SPY' },
  { metric: 'favorable_move_pct', label: 'Favorable path move' },
  { metric: 'adverse_move_pct', label: 'Adverse path move (signed)' },
]

const rate = (value: number | null) => (value === null ? '—' : `${(value * 100).toFixed(1)}%`)
const signedPct = (value: number | null) =>
  value === null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`

function MetricRow({ label, metric }: { label: string; metric: ResearchMetricOut }) {
  return (
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell className="text-right tabular-nums">
        {rate(metric.positive_rate)}
        {metric.zero > 0 && (
          <span className="text-muted-foreground block text-xs">{metric.zero} flat</span>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {metric.n}
        {metric.unavailable > 0 && (
          <span className="text-muted-foreground block text-xs">
            {metric.unavailable} unavailable
          </span>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">{signedPct(metric.mean)}</TableCell>
      <TableCell className="text-right tabular-nums">{signedPct(metric.equal_date_mean)}</TableCell>
      <TableCell className="text-right tabular-nums">{signedPct(metric.median)}</TableCell>
    </TableRow>
  )
}

/**
 * Prospective 1/3/5/7-session outcomes for one cohort, with every count
 * visible: recorded, mature, evaluated and missing. Descriptive only.
 */
export function ResearchPerformancePanel() {
  const [filters, setFilters] = useState<ResearchPerformanceFilters>({
    horizon_sessions: 5,
    source_kind: 'composite_daily',
  })
  const [drillStatus, setDrillStatus] = useState<ResearchOutcomeStatus | null>(null)
  const [exporting, setExporting] = useState(false)
  const report = useResearchPerformance(filters)

  function update(patch: Partial<ResearchPerformanceFilters>) {
    setFilters((current) => {
      const next = { ...current, ...patch }
      // Origin only exists for follow-through; never send it with another source.
      if (next.source_kind !== 'follow_through') delete next.origin
      return next
    })
  }

  async function handleExport() {
    setExporting(true)
    try {
      await downloadResearchExport(filters)
    } catch (error) {
      const tooLarge =
        error instanceof ApiError &&
        (error.detail as { code?: string } | null)?.code === 'narrow_filters'
      toast.error(tooLarge ? 'Too many rows to export; narrow the filters' : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const data = report.data
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Tabs
          value={String(filters.horizon_sessions)}
          onValueChange={(value) =>
            update({ horizon_sessions: Number(value) as ResearchPerformanceFilters['horizon_sessions'] })
          }
        >
          <TabsList>
            {HORIZONS.map((horizon) => (
              <TabsTrigger key={horizon} value={String(horizon)}>
                {horizon === 1 ? '1 session' : `${horizon} sessions`}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs">Source</span>
          <select
            aria-label="Source"
            value={filters.source_kind}
            onChange={(event) => update({ source_kind: event.target.value as ResearchSourceKind })}
            className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
          >
            {SOURCES.map((source) => (
              <option key={source.value} value={source.value}>
                {source.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs">Side</span>
          <select
            aria-label="Side"
            value={filters.side ?? ''}
            onChange={(event) =>
              update({ side: (event.target.value || undefined) as ResearchSide | undefined })
            }
            className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
          >
            <option value="">All sides</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </label>
        {filters.source_kind === 'follow_through' && (
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground block text-xs">Origin</span>
            <select
              aria-label="Origin"
              value={filters.origin ?? ''}
              onChange={(event) =>
                update({ origin: (event.target.value || undefined) as ResearchOrigin | undefined })
              }
              className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
            >
              <option value="">Setups and catalysts</option>
              <option value="setup">From a saved setup</option>
              <option value="catalyst">From a catalyst</option>
            </select>
          </label>
        )}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={exporting || !data || data.coverage.recorded === 0}
          onClick={() => void handleExport()}
        >
          {exporting ? <Loader2 className="animate-spin" /> : <Download />} Download CSV
        </Button>
      </div>

      {report.isPending && (
        <p className="text-muted-foreground text-sm">Loading prospective results…</p>
      )}
      {report.isError && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-destructive">Could not load prospective results.</span>
          <Button variant="ghost" size="sm" onClick={() => void report.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {data && (
        <>
          {!data.collection_enabled && (
            <p className="text-muted-foreground text-xs">
              Collection is off: showing recorded history only; no new observations are being
              captured.
            </p>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-medium">
                <span>{data.coverage.recorded} recorded</span>
                <span className="text-muted-foreground">/</span>
                <span>{data.coverage.matured} mature</span>
                <span className="text-muted-foreground">/</span>
                <span>{data.coverage.evaluated} evaluated</span>
                <span className="text-muted-foreground">/</span>
                <span>{data.coverage.missing} missing</span>
                {data.provisional && <Badge variant="outline">Provisional sample</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-1 text-xs">
              <p>
                {data.date_counts.decision_sessions} decision sessions
                {data.date_counts.first &&
                  ` · ${data.date_counts.first} to ${data.date_counts.last}`}
                {data.corrections > 0 && ` · ${data.corrections} corrected`}
                {data.cohort.rule_version && ` · rule ${data.cohort.rule_version}`}
              </p>
              <p>
                Future close-to-close observations, not fills or trading performance. Costs:{' '}
                {data.costs.name} ({data.costs.round_trip_bps / 100}% round trip, hypothetical;
                excludes {data.costs.excludes.join(', ')}). Overlapping windows and same-day names
                are correlated; a larger row count is not more independent evidence.
              </p>
            </CardContent>
          </Card>

          {data.coverage.recorded === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-muted-foreground text-sm">
                  No prospective observations recorded for this cohort yet. Rows accrue as
                  decisions are captured and mature {filters.horizon_sessions} sessions after
                  their baseline close.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="overflow-x-auto pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Denominator</TableHead>
                      <TableHead className="text-right">Mean</TableHead>
                      <TableHead className="text-right">Equal-date mean</TableHead>
                      <TableHead className="text-right">Median</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {METRIC_ROWS.map(({ metric, label }) => (
                      <MetricRow key={metric} label={label} metric={data.overall.metrics[metric]} />
                    ))}
                  </TableBody>
                </Table>
                {data.overall.path_order_counts &&
                  Object.keys(data.overall.path_order_counts).length > 0 && (
                    <p className="text-muted-foreground mt-3 text-xs">
                      Target/stop path observations:{' '}
                      {Object.entries(data.overall.path_order_counts)
                        .map(([order, count]) => `${order.replaceAll('_', ' ')} ${count}`)
                        .join(' · ')}. Ambiguous and unknown order are not counted as target-first.
                    </p>
                  )}
                {data.coverage.missing > 0 && (
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2 px-0"
                    onClick={() =>
                      setDrillStatus((current) => (current === 'missing_data' ? null : 'missing_data'))
                    }
                  >
                    {drillStatus === 'missing_data' ? 'Hide missing rows' : 'Show missing rows'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {drillStatus && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Missing rows</CardTitle>
              </CardHeader>
              <CardContent>
                <ResearchObservationsTable filters={{ ...filters, status: drillStatus }} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
