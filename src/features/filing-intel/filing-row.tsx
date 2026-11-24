import { Badge } from '@/components/ui/badge'
import { formatEasternDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { FilingIntelFilingOut, QuoteOut } from '@/types/filing-intel'
import { PriceMove } from './price-move'
import { SignalBadge } from './signal-badge'
import {
  COVERAGE_HINT,
  COVERAGE_LABEL,
  DIRECTION_CLASS,
  eventLabel,
  KIND_CLASS,
  KIND_HINT,
  KIND_LABEL,
} from './labels'

/** One filing as a clickable row: when, who, what form, the one-line summary, its event tags. */
export function FilingRow({
  filing,
  now,
  onOpen,
}: {
  filing: FilingIntelFilingOut
  /** Current quote for the filing's ticker, when known. */
  now?: QuoteOut
  onOpen: (accession: string) => void
}) {
  const items = filing.item_codes.filter((code) => code !== '9.01')
  const tags = filing.events.filter((e) => e.event_type !== 'guidance' && !(e.event_type === 'disclosure' && e.topic === 'unclassified'))
  const guidance = filing.events.filter((e) => e.event_type === 'guidance').length
  return (
    <button
      type="button"
      onClick={() => onOpen(filing.accession)}
      className="hover:bg-muted/50 border-border flex w-full flex-col gap-1.5 border-b px-4 py-3 text-left last:border-b-0"
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{filing.ticker ?? filing.cik}</span>
        <Badge variant="outline">
          {filing.form}
          {items.length > 0 && ` · ${items.join(', ')}`}
        </Badge>
        <span className="text-muted-foreground text-xs tabular-nums">{formatEasternDateTime(filing.accepted_at)}</span>
        {filing.kind && (
          <Badge className={KIND_CLASS[filing.kind]} title={KIND_HINT}>
            {KIND_LABEL[filing.kind]}
          </Badge>
        )}
        {filing.other_events.map((name) => (
          <Badge key={name} className={KIND_CLASS.event} title="Separate news filed in the same earnings 8-K">
            + {name}
          </Badge>
        ))}
        <SignalBadge signal={filing.signal} />
        {filing.coverage === 'extended' && (
          <Badge variant="secondary" title={COVERAGE_HINT}>
            {COVERAGE_LABEL.extended}
          </Badge>
        )}
        {filing.status === 'failed' && <Badge variant="destructive">extraction failed</Badge>}
        {filing.ticker && (
          <PriceMove className="ml-auto" filing={filing} now={now} />
        )}
      </div>
      {filing.summary?.includes(':') ? (
        <p className="text-sm leading-snug">{filing.summary.replace(/^[^:]+:\s*/, '')}</p>
      ) : (
        <p className="text-muted-foreground text-sm">No typed details found by the rules — open to see the filing.</p>
      )}
      <div className="flex flex-wrap gap-1">
        {tags.map((event, index) => (
          <Badge
            key={`${event.event_type}-${index}`}
            variant="secondary"
            className={cn(event.direction && DIRECTION_CLASS[event.direction])}
          >
            {eventLabel(event)}
            {event.direction && ` · ${event.direction}`}
            {event.method === 'llm' && ' · AI'}
          </Badge>
        ))}
        {guidance > 0 && <Badge variant="secondary">{guidance} guidance range{guidance > 1 ? 's' : ''}</Badge>}
      </div>
    </button>
  )
}
