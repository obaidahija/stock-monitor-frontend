import { useResearchSubscriptions } from '@/features/research/intraday'
import { IntradayControl } from '@/features/research/intraday-control'
import { formatEasternDateTime } from '@/lib/format'
import type { FollowThroughDetailOut } from '@/types/api'

export function baselineMessage(baseline: string, lifecycle: string, rowCount: number) {
  if (baseline === 'pending') return 'Awaiting baseline close.'
  if (baseline === 'missing') return 'Baseline price unavailable.'
  if (lifecycle === 'completed' && rowCount === 0)
    return 'Window ended before a later close could be observed.'
  return ''
}

const pct = (value: number | null) =>
  value === null ? 'Unavailable' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
const price = (value: number | null) => value === null ? 'Unavailable' : `$${value.toFixed(2)}`

function TrackIntraday({ trackId }: { trackId: number }) {
  const subscriptions = useResearchSubscriptions(true)
  const row = subscriptions.data?.items.find(
    (item) => item.origin_type === 'follow_through' && item.origin_id === trackId,
  )
  const gaps = row?.coverage.sessions_with_gaps ?? []
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {row && (
        <span className="text-muted-foreground">
          5-minute coverage {row.coverage.status ?? 'pending'}
          {row.coverage.last_bar_end && ` through ${formatEasternDateTime(row.coverage.last_bar_end)}`}
          {gaps.length > 0 && ` · gaps on ${gaps.join(', ')}`}
          {row.coverage.error && ` · last attempt failed: ${row.coverage.error}`}
        </span>
      )}
      <IntradayControl origin={{ follow_through_track_id: trackId }} subscriptionId={row?.id ?? null} />
    </div>
  )
}

export function FollowThroughTimeline({
  detail,
  intradayEnabled = false,
}: {
  detail: FollowThroughDetailOut
  intradayEnabled?: boolean
}) {
  const { track, rows } = detail
  const message = baselineMessage(track.baseline_status, track.lifecycle, rows.length)
  const reference = track.levels.entry_primary
  const headline = typeof track.evidence.headline === 'string' ? track.evidence.headline : null
  const sourceUrl = typeof track.evidence.source_url === 'string' &&
    /^https?:\/\//i.test(track.evidence.source_url) ? track.evidence.source_url : null
  const publishedAt = typeof track.evidence.published_at === 'string'
    ? track.evidence.published_at : null
  const frozenRevision = typeof track.evidence.setup_revision_id === 'number'
    ? track.evidence.setup_revision_id : track.setup_revision_id
  const baselinePrice = track.baseline_status === 'pending'
    ? 'Awaiting close' : price(track.baseline_price)
  const benchmarkPrice = track.baseline_status === 'pending'
    ? 'Awaiting close' : price(track.benchmark_baseline_price)
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground text-xs">
        Since tracking began {formatEasternDateTime(track.started_at)} · {track.lifecycle.replaceAll('_', ' ')}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <p>Baseline {track.baseline_session}: {baselinePrice}</p>
        <p>{track.benchmark_label} ({track.benchmark_symbol}): {benchmarkPrice}</p>
        {reference != null && <p>Saved reference: {price(reference)} ({track.side})</p>}
        <p>Expected baseline close: {formatEasternDateTime(track.expected_baseline_at)}</p>
      </div>
      <div className="rounded-lg border p-3 text-xs">
        <p className="font-medium">Original evidence</p>
        {track.origin === 'setup' && (
          <p className="text-muted-foreground mt-1">
            Saved setup revision {frozenRevision ?? 'unavailable'}
            {track.levels.stop_loss != null && ` · stop ${price(track.levels.stop_loss)}`}
            {track.levels.take_profit != null && ` · target ${price(track.levels.take_profit)}`}
          </p>
        )}
        {headline && <p className="mt-1">{headline}</p>}
        {publishedAt && <p className="text-muted-foreground mt-1">Published {formatEasternDateTime(publishedAt)}</p>}
        {sourceUrl && <a className="mt-1 inline-block underline underline-offset-2" href={sourceUrl}
          target="_blank" rel="noopener noreferrer">Original source</a>}
      </div>
      {message && <p className="text-muted-foreground">{message}</p>}
      {intradayEnabled && track.lifecycle === 'active' && <TrackIntraday trackId={track.id} />}
      {track.end_reason && <p className="text-muted-foreground text-xs">End reason: {track.end_reason.replaceAll('_', ' ')}</p>}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b text-muted-foreground">
              <tr><th className="py-2 pr-3">Session</th><th className="pr-3">Close</th><th className="pr-3">Stock</th><th className="pr-3">vs benchmark</th><th>Status / coverage</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.session_date} className="border-b align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{row.session_date}</td>
                  <td className="pr-3">{price(row.close)}</td>
                  <td className="pr-3">{pct(row.metrics.stock_return_pct)}</td>
                  <td className="pr-3">{pct(row.metrics.raw_excess_pct)}</td>
                  <td>
                    {row.metrics.status.replaceAll('_', ' ')}
                    {row.quality.reasons.length > 0 && (
                      <span className="text-muted-foreground block">
                        {row.quality.reasons.join(', ').replaceAll('_', ' ')}
                      </span>
                    )}
                    {(row.quality.stock && row.quality.stock !== 'available' ||
                      row.quality.benchmark && row.quality.benchmark !== 'available') && (
                      <span className="text-muted-foreground block">
                        {row.quality.stock && `Stock: ${row.quality.stock.replaceAll('_', ' ')}`}
                        {row.quality.benchmark && ` · benchmark: ${row.quality.benchmark.replaceAll('_', ' ')}`}
                      </span>
                    )}
                    {row.revision > 1 && <span className="text-muted-foreground block">Revision {row.revision}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-muted-foreground text-xs">Observed closes since the first future session. References are saved research context, not a trade fill or entry signal.</p>
    </div>
  )
}
