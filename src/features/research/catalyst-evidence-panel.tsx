import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { ErrorState } from '@/components/shared/error-state'
import { formatEasternDateTime, formatSignedPct } from '@/lib/format'
import { ApiError } from '@/lib/api-client'
import { getCatalystEvidence } from './catalyst-evidence'
import type { EvidenceClock, HistoricalContext } from './catalyst-evidence'

const HORIZONS = [0, 1, 3, 5, 7] as const
const STATUSES: Record<string, string> = {
  pending: 'Awaiting session close', missing_price: 'Completed price unavailable',
  baseline_unavailable: 'Prior price baseline unavailable',
  corporate_action_unresolved: 'Price adjustment checks incomplete',
  price_discontinuity: 'Price discontinuity needs review', mixed_provider: 'Price sources differ',
  stale_at_detection: 'Article was already older than 72 hours when detected',
  time_uncertain: 'Event timing is uncertain', future_timestamp: 'Event timestamp is in the future',
  calendar_unavailable: 'Trading calendar unavailable', bar_limit: 'Price coverage incomplete',
}

function statusLabel(status: string) {
  return STATUSES[status] ?? 'Price evidence unavailable'
}

export function HistoricalContextLine({ context, label = 'Initial-close history' }: {
  context?: HistoricalContext | null; label?: string
}) {
  if (!context || context.status === 'unavailable') return null
  if (context.status !== 'ok' || context.event_rate === null || context.control_rate === null) {
    return <p className="text-muted-foreground text-xs">{label}: matched controls unavailable ({context.observations.toLocaleString()} completed observations).</p>
  }
  return <p className="text-muted-foreground text-xs">
    {label}: {(100 * context.event_rate).toFixed(1)}% event windows vs {(100 * context.control_rate).toFixed(1)}% earlier controls had a market-relative move ≥1 ATR, in either direction.
    {' '}{context.paired_observations.toLocaleString()} paired observations{context.as_of && ` · study ${context.as_of.slice(0, 10)}`}.
  </p>
}

export function CatalystEvidencePanel({ candidateId, context }: {
  candidateId: number; context?: HistoricalContext | null
}) {
  const [open, setOpen] = useState(false)
  const [clock, setClock] = useState<EvidenceClock>('publication')
  const [horizon, setHorizon] = useState<number>(0)
  const id = useId()
  const query = useQuery({
    queryKey: ['catalyst-evidence', candidateId, clock],
    queryFn: () => getCatalystEvidence(candidateId, clock),
    enabled: open, staleTime: 60_000, refetchInterval: open ? 60_000 : false,
    retry: false,
  })
  const data = query.data
  const selected = data?.windows.find(w => w.horizon === horizon)
  // Explicit nulls keep chart lines from bridging sessions with missing bars.
  const availablePoints = data?.timeline.filter(p => p.offset <= horizon) ?? []
  const points = availablePoints.flatMap((point, index) => {
    const previous = availablePoints[index - 1]
    return previous && point.offset > previous.offset + 1
      ? [{ offset: previous.offset + 1, stock_pct: null, spy_pct: null }, point]
      : [point]
  })
  const selectClass = 'border-input bg-background h-8 max-w-full rounded-md border px-2 text-xs'
  return <div className="min-w-0 space-y-2">
    <HistoricalContextLine context={context} />
    <details className="min-w-0 text-xs" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer py-1 font-medium">Price timeline &amp; history</summary>
      {open && <div className="min-w-0 space-y-3 pt-2">
        <div className="flex flex-wrap gap-3">
          <label htmlFor={`${id}-clock`} className="flex flex-wrap items-center gap-1">Timeline
            <select id={`${id}-clock`} className={selectClass} value={clock} onChange={event => setClock(event.target.value as EvidenceClock)}>
              <option value="publication">Reported publication</option><option value="first_seen">First seen by the system</option>
            </select>
          </label>
          <label htmlFor={`${id}-window`} className="flex items-center gap-1">Price window
            <select id={`${id}-window`} className={selectClass} value={horizon} onChange={event => setHorizon(Number(event.target.value))}>
              {HORIZONS.map(h => <option key={h} value={h}>{h === 0 ? 'First close afterward' : `Through +${h} sessions`}</option>)}
            </select>
          </label>
        </div>
        {query.isPending && <p role="status">Loading cached price evidence…</p>}
        {query.isError && (query.error instanceof ApiError && query.error.status === 404
          ? <p>Evidence unavailable for this saved event.</p>
          : <ErrorState error={query.error} onRetry={() => query.refetch()} />)}
        {data && <>
          <p className="text-muted-foreground">Cached prices as of {formatEasternDateTime(data.generated_at)} · detected {data.detection_lag_hours.toFixed(1)} hours after reported publication.</p>
          <p className="text-muted-foreground">Publisher date: {data.original_article_status === 'verified' && data.original_article_on ? data.original_article_on : 'unverified'} · issuer event date: {data.issuer_event_status === 'verified' && data.issuer_event_on ? data.issuer_event_on : 'unverified'}.</p>
          <p className="text-muted-foreground">{clock === 'publication'
            ? 'Publication timeline uses cached historical closes and may include prices collected later.'
            : 'First-seen baseline uses price revisions already available when the system detected the article.'}</p>
          {data.status !== 'ok' && <p role="status">{statusLabel(data.status)}</p>}
          {data.status === 'ok' && data.baseline_close !== null && <p>
            Prior close ${data.baseline_close.toFixed(2)} ({data.baseline_session})
            {selected?.status === 'ok' && selected.stock_close !== null && ` → window close $${selected.stock_close.toFixed(2)}`}
          </p>}
          {points.length > 1 && <div role="img" aria-label={`${data.ticker} and SPY completed daily price timeline`}>
            <ChartContainer config={{ stock_pct: { label: data.ticker, color: 'var(--chart-1)' }, spy_pct: { label: 'SPY', color: 'var(--chart-2)' } }} className="h-56 w-full aspect-auto">
              <LineChart data={points} margin={{ top: 12, right: 14, bottom: 16, left: 8 }} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="offset" type="number" domain={['dataMin', 'dataMax']} tickCount={4} label={{ value: 'Session (0 = first close)', position: 'insideBottom', offset: -10 }} />
                <YAxis width={52} tickFormatter={value => `${Number(value).toFixed(1)}%`} />
                <ReferenceLine y={0} stroke="var(--border)" />
                <ReferenceLine x={-0.5} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload[0]?.payload?.session ?? ''} formatter={(value, name) => `${name === 'stock_pct' ? data.ticker : 'SPY'}: ${Number(value).toFixed(2)}%`} />} />
                <Line dataKey="stock_pct" type="linear" stroke="var(--color-stock_pct)" dot={{ r: 2 }} strokeWidth={2} isAnimationActive={false} connectNulls={false} />
                <Line dataKey="spy_pct" type="linear" stroke="var(--color-spy_pct)" dot={false} strokeDasharray="4 3" strokeWidth={2} isAnimationActive={false} connectNulls={false} />
              </LineChart>
            </ChartContainer>
            <p className="text-muted-foreground">{data.ticker} (solid) · SPY (dashed) · % from prior close.</p>
          </div>}
          {selected && <div aria-live="polite" className="space-y-1">
            {selected.status === 'ok' ? <>
              <p>Stock {selected.stock_pct === null ? 'unavailable' : formatSignedPct(selected.stock_pct)} · SPY {selected.spy_pct === null ? 'unavailable' : formatSignedPct(selected.spy_pct)} · relative {selected.excess_pct === null ? 'unavailable' : `${selected.excess_pct >= 0 ? '+' : ''}${selected.excess_pct.toFixed(2)} pp`}</p>
              <p>{selected.excess_atr === null ? 'Relative move size unavailable' : `${selected.excess_atr.toFixed(2)} ATR relative move`} · {selected.mean_volume_ratio === null ? 'Volume comparison unavailable' : `${selected.mean_volume_ratio.toFixed(2)}x average daily volume in window`}</p>
              <p>{selected.other_detected_events ?? 'Unknown'} other detected events in this window.</p>
            </> : <p role="status">{statusLabel(selected.status)} · expected end {formatEasternDateTime(selected.ends_at)}</p>}
            <HistoricalContextLine context={selected.history} label="Selected-window history" />
            {selected.history.status === 'unavailable' && <p className="text-muted-foreground">Historical comparison unavailable for this event type and window.</p>}
          </div>}
          {data.limits.length > 0 && <ul className="text-muted-foreground list-disc space-y-1 pl-4">{data.limits.map(limit => <li key={limit}>{limit}</li>)}</ul>}
        </>}
      </div>}
    </details>
  </div>
}
