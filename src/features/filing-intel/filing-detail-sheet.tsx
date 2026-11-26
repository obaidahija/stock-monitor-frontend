import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { CheckCircle2, Download, ExternalLink, Radar, ScanText, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ErrorState } from '@/components/shared/error-state'
import { formatEasternDate, formatEasternDateTimeWithYear } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { FilingEventOut, FilingFactOut, FilingIntelFilingOut } from '@/types/filing-intel'
import { useCurrentPrices, useFiling, useFilingEpisodes } from './hooks'
import { PriceTable } from './price-move'
import { FilingPriceChart } from './price-chart'
import { SignalReasons } from './signal-badge'
import { MarketCapBadge } from './market-cap'
import { PeerFilings } from './peer-filings'
import { MarketDisagreedBadge } from './market-disagreed'
import { EarningsPanel } from './earnings-panel'
import {
  DIRECTION_CLASS,
  eventLabel,
  FEATURE_GROUPS,
  FEATURE_SKIP,
  formatValue,
  hasGuidanceRange,
  humanize,
  sessionLabel,
} from './labels'

const DETECTED_VIA: Record<FilingIntelFilingOut['detected_via'], string> = {
  feed: 'EDGAR live feed (15 s watcher)',
  analyze: 'On-demand analyze request',
  backfill: 'Historical backfill',
}
const KEY_METRICS = [
  'revenue',
  'gross_profit',
  'operating_income',
  'net_income',
  'eps_diluted',
  'adjusted_eps_diluted',
  'comparable_sales_pct',
  'shares_diluted',
  'cash',
  'total_assets',
  'long_term_debt',
  'shares_outstanding',
  'operating_cash_flow',
]

function lagText(seconds: number | null): string | null {
  if (seconds === null) return null
  if (seconds < 120) return `${seconds} s after acceptance`
  return `${Math.round(seconds / 60)} min after acceptance`
}

function Step({ icon: Icon, title, children }: { icon: typeof Radar; title: string; children: ReactNode }) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-medium">{title}</p>
        <div className="text-muted-foreground mt-0.5 text-xs">{children}</div>
      </div>
    </li>
  )
}

function ProcessTimeline({ filing }: { filing: FilingIntelFilingOut }) {
  const documents = Object.entries(filing.documents)
  return (
    <ol aria-label="Analysis process" className="border-border bg-card rounded-lg border p-4">
      <Step icon={Send} title="1. Accepted by the SEC">
        {formatEasternDateTimeWithYear(filing.accepted_at)}
        {filing.period_of_report && ` · period of report ${filing.period_of_report}`}
      </Step>
      <Step icon={Radar} title="2. Detected">
        {DETECTED_VIA[filing.detected_via]} · {formatEasternDateTimeWithYear(filing.detected_at)}
        {lagText(filing.detection_lag_seconds) && ` · ${lagText(filing.detection_lag_seconds)}`}
        <span className="block">
          {filing.detected_price !== null
            ? `Price at detection $${filing.detected_price.toFixed(2)} (${sessionLabel(filing.detected_price_session)}, ${formatEasternDateTimeWithYear(filing.detected_price_time)})`
            : 'No price at detection (not caught live)'}
        </span>
      </Step>
      <Step icon={Download} title={`3. Downloaded ${documents.length} document${documents.length === 1 ? '' : 's'}`}>
        <span className="block">Chosen by the index page's EDGAR type column; raw bytes cached for re-extraction.</span>
        {documents.map(([name, sha]) => (
          <span key={name} className="block font-mono">
            {name} <span className="opacity-60">sha256 {sha.slice(0, 10)}…</span>
          </span>
        ))}
      </Step>
      <Step icon={ScanText} title="4. Extracted with rules">
        {filing.extract_ms !== null ? `${filing.extract_ms.toFixed(1)} ms` : '—'} · extraction v{filing.extraction_version ?? '—'} ·{' '}
        {filing.events.length} event{filing.events.length === 1 ? '' : 's'} · {filing.facts.length} reported numbers
        {filing.warnings.length > 0 && <span className="block text-amber-600">Warnings: {filing.warnings.join(', ')}</span>}
        {filing.error_code && <span className="block text-red-600">Error: {filing.error_code}</span>}
      </Step>
      <Step icon={CheckCircle2} title="5. Features computed">
        {Object.keys(filing.features).filter((k) => !FEATURE_SKIP.has(k)).length} comparable features, using only data
        known at acceptance time.
      </Step>
    </ol>
  )
}

function guidanceValue(event: FilingEventOut, key: 'low' | 'high' | 'midpoint'): string {
  const value = event.fields[key] as number | undefined
  if (value === undefined) return '—'
  if (event.fields.unit === 'pct') return `${value}%`
  if (event.fields.unit === 'USD/shares') return `$${value.toFixed(2)}`
  return formatValue('amount', value)
}

function EventCard({ event }: { event: FilingEventOut }) {
  if (event.event_type === 'guidance') {
    const { text, low, high, change } = event.fields
    const statedValue = typeof text === 'string' ? text.trim() : ''
    const point = typeof low === 'number' && low === high ? guidanceValue(event, 'low') : ''
    return (
      <div className="border-border rounded-md border p-3 text-sm">
        <p className="font-medium">
          Guidance: {humanize(String(event.fields.metric ?? ''))} {event.fields.period ? `(${event.fields.period})` : ''}
        </p>
        <p className="tabular-nums">
          {hasGuidanceRange(event)
            ? `${guidanceValue(event, 'low')} – ${guidanceValue(event, 'high')} · midpoint ${guidanceValue(event, 'midpoint')}`
            : statedValue || point}
          {change ? ` · ${String(change)}` : ''}
        </p>
        {event.evidence[0] && <blockquote className="text-muted-foreground mt-1 border-l-2 pl-2 text-xs">{event.evidence[0].text}</blockquote>}
      </div>
    )
  }
  const fields = Object.entries(event.fields).filter(([key]) => !['topic', 'topics', 'headline', 'changes', 'proposals', 'tranches'].includes(key))
  const changes = event.fields.changes as { person: string | null; roles: string[]; action: string; interim: boolean; effective: string | null }[] | undefined
  const tranches = event.fields.tranches as { principal: number; coupon_pct: number; kind: string | null; maturity_year: number }[] | undefined
  return (
    <div className="border-border space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{eventLabel(event)}</span>
        {event.item && <Badge variant="outline">Item {event.item}</Badge>}
        {event.direction && <Badge className={DIRECTION_CLASS[event.direction]}>{event.direction} (as stated)</Badge>}
        <Badge variant="secondary">{event.method === 'llm' ? 'local AI topic' : 'rules'}</Badge>
      </div>
      {typeof event.fields.headline === 'string' && <p className="text-sm italic">“{event.fields.headline}”</p>}
      {changes && (
        <ul className="text-sm">
          {changes.map((change, index) => (
            <li key={index}>
              <span className="font-medium">{change.person ?? 'Unnamed'}</span> — {humanize(change.action)} ({change.roles.join(', ')}
              {change.interim ? ', interim' : ''}){change.effective ? `, effective ${change.effective}` : ''}
            </li>
          ))}
        </ul>
      )}
      {tranches && (
        <ul className="text-sm tabular-nums">
          {tranches.map((t, index) => (
            <li key={index}>
              {formatValue('principal', t.principal)} {t.coupon_pct}% {t.kind ?? ''} notes due {t.maturity_year}
            </li>
          ))}
        </ul>
      )}
      {fields.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {fields.map(([key, value]) => (
            <div key={key} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{humanize(key)}</dt>
              <dd className="text-right tabular-nums">{formatValue(key, value)}</dd>
            </div>
          ))}
        </dl>
      )}
      {event.evidence.length > 0 && (
        <details className="text-xs">
          <summary className="text-muted-foreground cursor-pointer">Evidence from the filing ({event.evidence.length})</summary>
          <div className="mt-1 space-y-1">
            {event.evidence.map((item, index) => (
              <blockquote key={index} className="border-l-2 pl-2">
                <span className="text-muted-foreground">{humanize(item.field)}: </span>
                {item.text}
              </blockquote>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function factPeriod(fact: FilingFactOut): string {
  const kind = fact.period_kind === 'year_to_date' ? 'YTD' : fact.period_kind === 'quarter' ? 'Q' : fact.period_kind === 'annual' ? 'FY' : fact.period_kind === 'instant' ? 'at' : (fact.period_kind ?? '')
  const end = fact.period_end ?? (fact.dimensions.fiscal_year ? `FY${fact.dimensions.fiscal_year}` : '')
  return `${kind} ${end}`.trim()
}

function KeyNumbers({ facts }: { facts: FilingFactOut[] }) {
  const rows = facts
    .filter((f) => KEY_METRICS.includes(f.metric) && !Object.keys(f.dimensions).some((k) => k !== 'fiscal_year'))
    .sort((a, b) => KEY_METRICS.indexOf(a.metric) - KEY_METRICS.indexOf(b.metric) || String(b.period_end).localeCompare(String(a.period_end)))
  if (rows.length === 0) return null
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Reported numbers</h3>
      <div className="border-border overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 40).map((fact, index) => (
              <TableRow key={index}>
                <TableCell>
                  {humanize(fact.metric)}
                  {fact.basis === 'adjusted' && <span className="text-muted-foreground"> (adj.)</span>}
                </TableCell>
                <TableCell className="tabular-nums">{factPeriod(fact)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatValue(fact.metric, Number(fact.value))}</TableCell>
                <TableCell className="text-muted-foreground max-w-48 truncate text-xs" title={fact.provenance ?? undefined}>
                  {fact.source === 'xbrl' ? `XBRL ${fact.concept ?? ''}` : 'press release table'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function Features({ features }: { features: FilingIntelFilingOut['features'] }) {
  const entries = Object.entries(features).filter(([key]) => !FEATURE_SKIP.has(key))
  const used = new Set<string>()
  const groups = FEATURE_GROUPS.map((group) => {
    const keys = entries.filter(([key]) => !used.has(key) && group.keys.test(key))
    keys.forEach(([key]) => used.add(key))
    return { title: group.title, keys }
  })
  groups.push({ title: 'Other', keys: entries.filter(([key]) => !used.has(key)) })
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Comparable features</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {groups
          .filter((group) => group.keys.length > 0)
          .map((group) => (
            <div key={group.title} className="border-border rounded-lg border p-3">
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">{group.title}</p>
              <dl className="space-y-0.5 text-sm">
                {group.keys.map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{humanize(key)}</dt>
                    <dd className="text-right tabular-nums">{formatValue(key, value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
      </div>
    </section>
  )
}

function Episode({ ticker, accession, onOpen }: { ticker: string; accession: string; onOpen: (accession: string) => void }) {
  const query = useFilingEpisodes(ticker)
  const episode = query.data?.find((e) => e.filings.some((f) => f.accession === accession))
  if (!episode || episode.filings.length < 2) return null
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Same story ({episode.filings.length} filings within a week of each other)</h3>
      <ol className="border-border space-y-1 rounded-lg border p-3 text-sm">
        {episode.filings.map((f) => (
          <li key={f.accession}>
            <button
              type="button"
              onClick={() => onOpen(f.accession)}
              className={cn('w-full text-left hover:underline', f.accession === accession && 'font-semibold')}
            >
              <span className="text-muted-foreground tabular-nums">{formatEasternDate(f.accepted_at)}</span> {f.form} —{' '}
              {(f.summary ?? '').replace(/^[^:]+:\s*/, '')}
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function FilingDetailSheet({
  accession,
  onOpenChange,
  onOpen,
}: {
  accession: string | null
  onOpenChange: (open: boolean) => void
  onOpen: (accession: string) => void
}) {
  const query = useFiling(accession)
  const filing = query.data
  const prices = useCurrentPrices(filing?.ticker ? [filing.ticker] : [])
  return (
    <Sheet open={accession !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {filing?.ticker && (
              <Link to={`/stocks/${encodeURIComponent(filing.ticker)}`} className="hover:underline">
                {filing.ticker}
              </Link>
            )}
            <MarketCapBadge value={filing?.market_cap} size="lg" />
            {filing?.sic_description && (
              <Badge variant="outline" title={`SEC industry (SIC ${filing.sic}) · ${filing.industry_group ?? ''}`}>
                {filing.sic_description}
              </Badge>
            )}
            <span>{filing?.form ?? 'Filing'}</span>
            {filing && filing.item_codes.length > 0 && (
              <Badge variant="outline">{filing.item_codes.filter((c) => c !== '9.01').join(', ')}</Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {filing?.summary ?? accession}
            {filing && (
              <a href={filing.url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 underline">
                SEC <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-8">
          {filing?.ticker && (
            <div className="border-border bg-card space-y-2 rounded-lg border px-4 py-3">
              <FilingPriceChart filing={filing} now={prices.data?.get(filing.ticker)} />
              <details className="text-sm">
                <summary className="text-muted-foreground cursor-pointer text-xs">Exact prices and times</summary>
                <div className="pt-2">
                  <PriceTable filing={filing} now={prices.data?.get(filing.ticker)} />
                </div>
              </details>
            </div>
          )}
          {query.isPending && <Skeleton className="h-96 w-full" />}
          {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
          {filing && (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Positive or negative?</h3>
                {filing.follows_release ? (
                  <p className="text-sm">
                    Results first released in the{' '}
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => onOpen(filing.follows_release!.accession)}
                    >
                      {filing.follows_release.form} of {formatEasternDateTimeWithYear(filing.follows_release.accepted_at)}
                    </button>
                    {filing.follows_release.label ? ` — labelled ${filing.follows_release.label} there` : ''}. This
                    report repeats those figures without the release's adjusted EPS, guidance or text, so it has no
                    label of its own.
                  </p>
                ) : filing.follows_report ? (
                  <p className="text-sm">
                    These results were already public in the{' '}
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => onOpen(filing.follows_report!.accession)}
                    >
                      {filing.follows_report.form} of {formatEasternDateTimeWithYear(filing.follows_report.accepted_at)}
                    </button>
                    {filing.follows_report.label ? ` — labelled ${filing.follows_report.label} there` : ''}, and the
                    market traded on it before this release was furnished. A label here would describe news already
                    priced, so it has none of its own.
                  </p>
                ) : (
                  <SignalReasons signal={filing.signal} />
                )}
                <MarketDisagreedBadge filing={filing} now={prices.data?.get(filing.ticker ?? '')} />
              </section>
              <ProcessTimeline filing={filing} />
              {filing.ticker && <Episode ticker={filing.ticker} accession={filing.accession} onOpen={onOpen} />}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Peers in the same industry</h3>
                <PeerFilings accession={filing.accession} onOpen={onOpen} />
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">What the filing says</h3>
                {filing.events.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No typed events (periodic reports carry numbers only).</p>
                ) : (
                  <div className="space-y-2">
                    {filing.events.map((event, index) => (
                      <EventCard key={index} event={event} />
                    ))}
                  </div>
                )}
              </section>
              <EarningsPanel filing={filing} />
              <KeyNumbers facts={filing.facts} />
              <Features features={filing.features} />
              <p className="text-muted-foreground text-xs">
                Values are what the filing states, extracted by rules; direction is shown only where the text says it.
                Informational only, not a recommendation.
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
