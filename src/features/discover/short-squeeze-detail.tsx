import { Link } from 'react-router'
import { ErrorState } from '@/components/shared/error-state'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SaveShortSqueezeSetupDialog } from '@/features/watchlists/save-short-squeeze-setup-dialog'
import { formatCurrency, formatDate, formatEasternDateTime, formatSignedPct } from '@/lib/format'
import type {
  ShortSqueezeConditionOut,
  ShortSqueezeConditionsOut,
  ShortSqueezeDetailOut,
  ShortSqueezeOutcomeOut,
} from '@/types/short-squeeze'
import {
  SHORT_SQUEEZE_RULE,
  completedSessionVolume,
  formatDaysToCover,
  formatShortFloat,
  readableReason,
  shortMetadataWarning,
} from './short-squeeze-format'
import { useShortSqueezeDetail } from './short-squeeze-hooks'

const STATE_LABEL = { pass: 'Pass', fail: 'Fail', unknown: 'Unknown' } as const

function ConditionRow({
  label,
  condition,
  value,
}: {
  label: string
  condition: ShortSqueezeConditionOut
  value: string
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2 text-xs">
        <span className="tabular-nums">{value}</span>
        <Badge variant={condition.state === 'pass' ? 'default' : 'outline'}>{STATE_LABEL[condition.state]}</Badge>
      </span>
      {condition.state === 'unknown' && condition.reason && (
        <span className="text-muted-foreground w-full text-xs">{readableReason(condition.reason)}</span>
      )}
    </li>
  )
}

/** Rule v2 compares the signal close; stored v1 rows compared the session high. */
function HighBranchRow({
  conditions,
  priorHigh,
}: {
  conditions: ShortSqueezeConditionsOut
  priorHigh: number | null
}) {
  const condition = conditions.high_close ?? conditions.high_touch
  if (!condition) return null
  const label = conditions.high_close
    ? 'Closed at or above the prior 252-session high'
    : 'Prior 252-session high touched (rule v1)'
  const value =
    condition.value === null || priorHigh === null
      ? '—'
      : `${formatCurrency(condition.value)} vs ${formatCurrency(priorHigh)}`
  return <ConditionRow label={label} condition={condition} value={value} />
}

/** Only for a session that reached the prior high: otherwise the gap says nothing. */
function closingDistance(detail: ShortSqueezeDetailOut): string | null {
  const gap = detail.close_gap_to_high_pct
  if (gap === null || detail.high_touched !== true) return null
  const side = gap < 0 ? 'below' : 'above'
  return `Closed ${Math.abs(gap).toFixed(2)}% ${side} the reference high`
}

function sessionsLabel(horizon: number): string {
  return `${horizon} ${horizon === 1 ? 'session' : 'sessions'}`
}

function OutcomeTable({ outcomes }: { outcomes: ShortSqueezeOutcomeOut[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-1 pr-2 font-medium">Horizon</th>
            <th className="py-1 pr-2 font-medium">Status</th>
            <th className="py-1 pr-2 font-medium">Return</th>
            <th className="py-1 pr-2 font-medium">vs SPY</th>
            <th className="py-1 pr-2 font-medium">Best / worst move</th>
          </tr>
        </thead>
        <tbody>
          {outcomes.map((outcome) => (
            <tr key={outcome.id} className="border-t">
              <td className="py-1 pr-2">{sessionsLabel(outcome.horizon_sessions)}</td>
              <td className="py-1 pr-2">{readableReason(outcome.status)}</td>
              <td className="py-1 pr-2 tabular-nums">{formatSignedPct(outcome.side_return_pct)}</td>
              <td className="py-1 pr-2 tabular-nums">{formatSignedPct(outcome.excess_return_pct)}</td>
              <td className="py-1 pr-2 tabular-nums">
                {formatSignedPct(outcome.favorable_move_pct)} / {formatSignedPct(outcome.adverse_move_pct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DetailBody({ detail }: { detail: ShortSqueezeDetailOut }) {
  const { conditions } = detail
  const distance = closingDistance(detail)
  const metadataWarning = shortMetadataWarning(detail)
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        {SHORT_SQUEEZE_RULE} · rule {detail.rule_version} · session {formatDate(detail.signal_session)}
      </p>
      {detail.source_corrected && (
        <p className="rounded-md border border-amber-500/50 px-3 py-2 text-xs">
          Source data changed after the first match. The first match below stays as recorded.
        </p>
      )}
      <ul className="space-y-1.5">
        <ConditionRow label="Short float above 7%" condition={conditions.short_float} value={formatShortFloat(detail.short_percent_of_float)} />
        <ConditionRow label="Days to cover above 5" condition={conditions.days_to_cover} value={formatDaysToCover(detail.short_ratio)} />
        <ConditionRow label="Daily gain above 7%" condition={conditions.daily_gain} value={formatSignedPct(detail.move_pct)} />
        <HighBranchRow conditions={conditions} priorHigh={detail.prior_high} />
      </ul>
      <div className="text-muted-foreground space-y-1 text-xs">
        {metadataWarning && <p className="text-amber-700 dark:text-amber-400">{metadataWarning}</p>}
        {detail.short_float_source === 'derived_shares_short_over_float' && (
          <p>
            Estimated short float: {detail.shares_short?.toLocaleString('en-US')} shares short ÷{' '}
            {detail.float_shares?.toLocaleString('en-US')} float shares. The current float may differ from the report-date float.
          </p>
        )}
        <p>
          Signal close {formatCurrency(detail.signal_close)} · Prior 252-session high {formatCurrency(detail.prior_high)}
          {distance && ` · ${distance}`}
        </p>
        <p>{completedSessionVolume(detail.relative_volume)}</p>
        <p>
          Short data fetched {formatEasternDateTime(detail.short_metadata_fetched_at)} ·{' '}
          {detail.short_report_date
            ? `Short-interest report date ${formatDate(detail.short_report_date)}`
            : 'Short-interest report date unavailable'}
        </p>
        {detail.quality_reasons.length > 0 && (
          <p>Data limits: {detail.quality_reasons.map(readableReason).join(', ')}</p>
        )}
        <p>
          <Link className="underline underline-offset-2" to={`/stocks/${encodeURIComponent(detail.ticker)}?tab=analysis`}>
            Open {detail.ticker} research
          </Link>
          {' '}for news and catalyst context.
        </p>
      </div>
      {detail.status === 'matched' && <SaveShortSqueezeSetupDialog detail={detail} />}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Recorded outcomes</h3>
        {detail.first_match ? (
          <>
            <p className="text-muted-foreground text-xs">
              First matched {formatEasternDateTime(detail.first_match.decision_at)} · Signal session{' '}
              {formatDate(detail.first_match.signal_session)} · measurement starts at the{' '}
              {formatDate(detail.first_match.baseline_session)} close, the first close after discovery. The move between
              discovery and that close is excluded.
            </p>
            {detail.outcomes.length > 0 ? (
              <OutcomeTable outcomes={detail.outcomes} />
            ) : (
              <p className="text-muted-foreground text-xs">No outcome has been recorded yet.</p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-xs">
            No outcome is recorded for an {detail.status === 'incomplete' ? 'incomplete' : 'excluded'} evaluation.
          </p>
        )}
      </div>
    </div>
  )
}

function titleFor(detail: ShortSqueezeDetailOut): string {
  if (detail.status === 'matched') return `${detail.ticker} · Matched conditions`
  if (detail.status === 'incomplete') return `${detail.ticker} · Incomplete evaluation`
  return `${detail.ticker} · Conditions`
}

export function ShortSqueezeDetail({
  evaluationId,
  open,
  onOpenChange,
}: {
  evaluationId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const query = useShortSqueezeDetail(open ? evaluationId : null)
  // Only ever render the evaluation that was asked for.
  const detail = query.data && query.data.evaluation_id === evaluationId ? query.data : undefined
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{detail ? titleFor(detail) : 'Loading evidence…'}</DialogTitle>
          <DialogDescription>
            Frozen evidence from the daily scan. Research only: a match is not a forecast or an instruction to trade.
          </DialogDescription>
        </DialogHeader>
        {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
        {detail && <DetailBody detail={detail} />}
      </DialogContent>
    </Dialog>
  )
}
