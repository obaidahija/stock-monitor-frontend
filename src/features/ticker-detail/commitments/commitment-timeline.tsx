import { ExternalLink } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import {
  EVENT_KIND_LABELS,
  STATUS_LABELS,
  type CommitmentDetailOut,
  type EventOut,
  type MetricIdentity,
} from '@/types/management-commitments'
import {
  NOTICE_COPY,
  formatAmount,
  formatDate,
  formatPeriod,
  formatTarget,
  formatTimestamp,
  outcomeLabel,
  outcomeVariant,
} from './format'
import { CommitmentEventForm } from './commitment-event-form'
import { useCommitment } from './hooks'

/**
 * Full history for one commitment.
 *
 * The design rule the tests pin: the original target and the latest target are
 * always shown as two separate benchmarks with two separate outcomes. Once a
 * company revises guidance down and then meets the revised number, showing only
 * "met" would be a materially different -- and misleading -- statement about
 * what happened.
 *
 * All outcome text comes from the backend's projection. Nothing here recomputes
 * a comparison in JavaScript, where a decimal string would have to become a
 * float to be compared at all.
 */
export function CommitmentTimeline({
  ticker,
  commitmentId,
  commitment: provided,
}: {
  ticker: string
  commitmentId?: number
  commitment?: CommitmentDetailOut
}) {
  const query = useCommitment(ticker, provided ? undefined : commitmentId)
  const commitment = provided ?? query.data

  if (!provided && query.isPending) return <Skeleton className="h-40 w-full" />
  if (!provided && query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  }
  if (!commitment) return null

  const { identity, projection } = commitment

  return (
    <div className="space-y-4" data-testid="commitment-timeline">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{STATUS_LABELS[projection.status]}</Badge>
        {commitment.archived && <Badge variant="secondary">Archived</Badge>}
        {projection.withdrawn && <Badge variant="secondary">Withdrawn</Badge>}
      </div>

      {commitment.archived && commitment.archive_reason && (
        <Alert>
          <AlertDescription>
            Archived: {commitment.archive_reason}. History is preserved.
          </AlertDescription>
        </Alert>
      )}

      {/* Both benchmarks, always side by side and always separately labelled. */}
      <dl className="grid gap-3 sm:grid-cols-2">
        <Benchmark
          label="Original target"
          value={projection.original ? formatTarget(projection.original.target, identity) : '—'}
          stated={projection.original ? formatDate(projection.original.statement_date) : null}
        />
        <Benchmark
          label="Latest target"
          value={
            projection.latest
              ? formatTarget(projection.latest.target, identity)
              : projection.withdrawn
                ? 'Withdrawn'
                : '—'
          }
          stated={projection.latest ? formatDate(projection.latest.statement_date) : null}
        />
      </dl>

      <dl className="grid gap-3 sm:grid-cols-2">
        <Benchmark
          label="Reported result"
          value={projection.actual ? formatAmount(projection.actual.value, identity) : '—'}
          stated={projection.actual ? formatDate(projection.actual.statement_date) : null}
        />
        <div>
          <dt className="text-muted-foreground text-xs">Fiscal period</dt>
          <dd className="text-sm">{formatPeriod(identity)}</dd>
          <dd className="text-muted-foreground text-xs">
            {formatDate(identity.period_start)} – {formatDate(identity.period_end)}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        {projection.original_comparison && (
          <Badge variant={outcomeVariant(projection.original_comparison.outcome)}>
            {outcomeLabel(projection.original_comparison.outcome, 'original')}
          </Badge>
        )}
        {projection.latest_comparison && (
          <Badge variant={outcomeVariant(projection.latest_comparison.outcome)}>
            {outcomeLabel(projection.latest_comparison.outcome, 'latest')}
          </Badge>
        )}
        {projection.status === 'awaiting_result' && (
          <span className="text-muted-foreground text-sm">
            The period has ended; no comparable result has been recorded yet.
          </span>
        )}
      </div>

      {projection.notices.length > 0 && (
        <ul className="space-y-1">
          {projection.notices.map((notice) => (
            <li key={notice} className="text-muted-foreground text-sm">
              {NOTICE_COPY[notice] ?? notice}
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-3">
        <h4 className="text-sm font-medium">History</h4>
        <ol className="space-y-3" data-testid="event-history">
          {commitment.events.map((event) => (
            <EventRow key={event.id} event={event} identity={identity} />
          ))}
        </ol>
      </section>

      {commitment.superseded_events.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-sm font-medium">Superseded records</h4>
          <p className="text-muted-foreground text-xs">
            Corrections add a record; they never erase one. These are the entries a
            correction replaced.
          </p>
          <ol className="space-y-3" data-testid="superseded-history">
            {commitment.superseded_events.map((event) => (
              <EventRow key={event.id} event={event} identity={identity} superseded />
            ))}
          </ol>
        </section>
      )}

      <CommitmentEventForm ticker={ticker} commitment={commitment} />
    </div>
  )
}

function Benchmark({
  label,
  value,
  stated,
}: {
  label: string
  value: string
  stated: string | null
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
      {stated && <dd className="text-muted-foreground text-xs">Stated {stated}</dd>}
    </div>
  )
}

function EventRow({
  event,
  identity,
  superseded,
}: {
  event: EventOut
  identity: MetricIdentity
  superseded?: boolean
}) {
  const { payload } = event
  return (
    <li className="border-border space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={superseded ? 'secondary' : 'outline'}>
          {EVENT_KIND_LABELS[event.kind]}
        </Badge>
        {event.kind === 'correction' && event.supersedes_event_id !== null && (
          <span className="text-muted-foreground text-xs">
            replaces record #{event.supersedes_event_id}
          </span>
        )}
        {superseded && <Badge variant="secondary">Superseded</Badge>}
        <span className="text-muted-foreground text-xs">
          {event.origin === 'model' ? 'From a model proposal' : 'Entered manually'}
        </span>
      </div>

      <p className="text-sm">
        {payload.target
          ? formatTarget(payload.target, identity)
          : payload.actual_value
            ? formatAmount(payload.actual_value, identity)
            : '—'}
      </p>

      {/* Statement date and recorded time are shown separately on purpose: when
          the company said it, and when this ledger learned of it. */}
      <p className="text-muted-foreground text-xs">
        Stated {formatDate(payload.statement_date)} · recorded{' '}
        {formatTimestamp(event.recorded_at)}
      </p>

      {payload.actual_definition && (
        <p className="text-muted-foreground text-xs">
          Adjustments: {payload.actual_definition}
        </p>
      )}

      {event.note && <p className="text-sm">Note: {event.note}</p>}

      {payload.evidence.map((evidence, index) => (
        <blockquote
          key={`${evidence.block_id}-${index}`}
          className="border-border bg-muted/40 rounded-md border-l-2 px-3 py-2 text-sm"
        >
          <p className="italic">“{evidence.quote}”</p>
          <p className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
            Passage {evidence.block_id}
            <a
              className="hover:text-foreground inline-flex items-center gap-1"
              href={`#source-${evidence.document_id}`}
            >
              source <ExternalLink className="size-3" />
            </a>
          </p>
        </blockquote>
      ))}
    </li>
  )
}
