import { Badge } from '@/components/ui/badge'
import { formatEasternDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { FilingIntelFilingOut, QuoteOut } from '@/types/filing-intel'
import { priceSteps } from './price-chart-model'
import { PriceSteps } from './price-steps'
import { ScorecardMiniTable } from './earnings-scorecard'
import { GuidanceContextBadge, SignalBadge } from './signal-badge'
import { MarketDisagreedBadge } from './market-disagreed'
import { MarketCapBadge } from './market-cap'
import {
  COVERAGE_HINT,
  COVERAGE_LABEL,
  DIRECTION_CLASS,
  eventLabel,
  hasGuidanceRange,
  KIND_CLASS,
  KIND_HINT,
  KIND_LABEL,
} from './labels'

/** "10-K/A, 2 × 10-Q/A" */
function amendmentForms(amendments: { form: string }[]): string {
  const counts = new Map<string, number>()
  for (const a of amendments) counts.set(a.form, (counts.get(a.form) ?? 0) + 1)
  return [...counts].sort().map(([form, n]) => (n === 1 ? form : `${n} × ${form}`)).join(', ')
}

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
  // An earnings row shows its numbers as a small table; the summary text and the "earnings results" /
  // "N guidance ranges" tags would repeat them.
  const cards = filing.kind === 'earnings' && (filing.scorecard?.rows.length ?? 0) > 0
  const tags = filing.events.filter(
    (e) =>
      e.event_type !== 'guidance' &&
      !(e.event_type === 'disclosure' && e.topic === 'unclassified') &&
      !(cards && (e.event_type === 'earnings_results' || e.topic === 'earnings_results')),
  )
  const guidance = cards ? 0 : filing.events.filter(hasGuidanceRange).length
  return (
    <button
      type="button"
      onClick={() => onOpen(filing.accession)}
      className="hover:bg-muted/50 border-border bg-card grid w-full grid-cols-1 items-start gap-3 rounded-lg border px-4 py-3 text-left shadow-xs transition-colors lg:grid-cols-[minmax(0,1fr)_30rem]"
    >
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">{filing.ticker ?? filing.cik}</span>
          <MarketCapBadge value={filing.market_cap} />
          {filing.industry_group && (
            <span className="text-muted-foreground text-xs" title={`SEC industry: ${filing.sic_description ?? ''} (SIC ${filing.sic ?? ''})`}>
              {filing.industry_group}
            </span>
          )}
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
          {filing.amendments && filing.amendments.length > 0 && (
            <Badge
              className={DIRECTION_CLASS.negative}
              title={filing.amendments.map((a) => `${a.form}: ${a.note ?? 'no restatement stated'}`).join('\n')}
            >
              + {amendmentForms(filing.amendments)}
              {filing.amendments.some((a) => a.note) && ' (restated)'}
            </Badge>
          )}
          {filing.follows_release && (
            <Badge
              className={cn(filing.follows_release.label && DIRECTION_CLASS[filing.follows_release.label])}
              title="These results were already public in the release; the report repeats them, so it takes the release's label"
            >
              Results released in {filing.follows_release.form}
              {filing.follows_release.label && ` · ${filing.follows_release.label}`}
            </Badge>
          )}
          <SignalBadge signal={filing.signal} />
          <GuidanceContextBadge signal={filing.signal} />
          <MarketDisagreedBadge filing={filing} now={now} />
          {filing.coverage === 'extended' && (
            <Badge variant="secondary" title={COVERAGE_HINT}>
              {COVERAGE_LABEL.extended}
            </Badge>
          )}
          {filing.status === 'failed' && <Badge variant="destructive">extraction failed</Badge>}
        </div>
        {cards ? (
          <ScorecardMiniTable scorecard={filing.scorecard} events={filing.events} />
        ) : filing.summary?.includes(':') ? (
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
      </div>
      <div className="w-full max-w-[30rem] space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {filing.form}
            {items.length > 0 && ` · ${items.join(', ')}`}
          </Badge>
          <span className="text-muted-foreground text-xs tabular-nums">
            Filed {formatEasternDateTime(filing.accepted_at)}
          </span>
        </div>
        {filing.periodic_report && (
          <div>
            <Badge variant="outline" title="The quarterly report for these results; its figures are in this release's label">
              + {filing.periodic_report.form} filed {formatEasternDateTime(filing.periodic_report.accepted_at)}
            </Badge>
          </div>
        )}
        {filing.late_release && (
          <div>
            <Badge
              variant="outline"
              title="The results release was furnished after the market had already traded on this report, so it has no label of its own"
            >
              + release {filing.late_release.form} filed later, {formatEasternDateTime(filing.late_release.accepted_at)}
            </Badge>
          </div>
        )}
        {filing.ticker && <PriceSteps steps={priceSteps(filing, now)} size="row" />}
      </div>
    </button>
  )
}
