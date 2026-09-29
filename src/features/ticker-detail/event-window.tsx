import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatEasternDateTime } from '@/lib/format'
import type { EventWindowOut, WindowEventOut } from '@/types/api'

export function eventWindowMessage(count: number, coverage: string): string {
  if (count === 0) return coverage === 'complete'
    ? 'No listed events found' : 'Calendar coverage incomplete'
  return count === 1 ? '1 listed event' : `${count} listed events`
}

function timingLabel(event: WindowEventOut): string {
  if (event.precision === 'bmo') return 'Before market open (BMO)'
  if (event.precision === 'amc') return 'After market close (AMC)'
  if (event.precision === 'date_only') return 'Time unknown'
  return formatEasternDateTime(event.start_at)
}

function EventRow({ event }: { event: WindowEventOut }) {
  return (
    <li className="min-w-0 border-l-2 border-amber-500/50 py-1 pl-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <strong className="break-words">{event.title}</strong>
        <span className="text-muted-foreground">{formatDate(event.local_date)} · {timingLabel(event)}</span>
      </div>
      <p className="text-muted-foreground text-xs">
        {event.overlap === 'possible_overlap' ? 'Possible overlap' : event.overlap === 'after_expiry' ? 'After this window' : 'Inside window'}
        {' · '}{event.severity} exposure · {event.status.replaceAll('_', ' ')}
        {' · '}{event.verification.replaceAll('_', ' ')}
      </p>
      <p className="text-muted-foreground text-xs">
        Source: {event.source_url ? (
          <a className="underline underline-offset-2" href={event.source_url} target="_blank" rel="noopener noreferrer">{event.source_name}</a>
        ) : event.source_name}
      </p>
      {event.timing_reasons.length > 0 && <p className="text-muted-foreground text-xs">{event.timing_reasons.join(', ').replaceAll('_', ' ')}</p>}
    </li>
  )
}

export function EventWindowCard({ data, title = 'Events in this window' }: { data: EventWindowOut; title?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-muted-foreground text-xs">
          {eventWindowMessage(data.events.length, data.coverage_status)} · Calendar coverage: {data.coverage_status}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.historical_knowledge && <p className="text-muted-foreground text-xs">Expired saved window shown with current calendar knowledge.</p>}
        {!data.collection_enabled && <p className="text-muted-foreground text-xs">Calendar collection is off; known cached events are still shown.</p>}
        {data.events.length > 0 && <ol className="space-y-3">{data.events.map((event) => <EventRow key={event.canonical_key} event={event} />)}</ol>}
        {data.near_after_expiry.length > 0 && (
          <section className="space-y-2 border-t pt-3" aria-label="Events after this window">
            <h4 className="text-muted-foreground text-xs font-semibold uppercase">After this window</h4>
            <ol className="space-y-3">{data.near_after_expiry.map((event) => <EventRow key={event.canonical_key} event={event} />)}</ol>
          </section>
        )}
        {(data.coverage_sources.length > 0 || data.conflicts.length > 0) && (
          <details className="text-muted-foreground text-xs">
            <summary className="cursor-pointer">Calendar sources and conflicts</summary>
            <ul className="mt-2 space-y-1">
              {data.coverage_sources.map((source) => (
                <li key={source.source_key}>
                  {source.source_key}: {source.status}
                  {source.reason && ` · ${source.reason.replaceAll('_', ' ')}`}
                  {source.last_success_at && ` · last updated ${formatEasternDateTime(source.last_success_at)}`}
                </li>
              ))}
              {data.conflicts.length > 0 && <li>{data.conflicts.length} conflicting schedule {data.conflicts.length === 1 ? 'record' : 'records'} retained for review</li>}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
