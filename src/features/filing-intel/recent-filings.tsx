import { useState } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { useCurrentPrices, useRecentFilings } from './hooks'
import { FilingRow } from './filing-row'
import { COVERAGE_LABEL, humanize, KIND_LABEL, TOPIC_OPTIONS } from './labels'
import { cn } from '@/lib/utils'

const HOURS = [
  { value: 24, label: '24h' },
  { value: 72, label: '3 days' },
  { value: 168, label: '7 days' },
  { value: 744, label: '31 days' },
]
const FORMS = ['8-K', '10-Q', '10-K', '424B5']
const ALL = 'all'
const KIND_FILTERS = ['earnings', 'event', 'guidance', 'periodic_report', 'offering'] as const
/** The label filter; "Positive" includes strong positives. Colours match the label badges. */
const SIGNAL_FILTERS = [
  { value: 'strong_positive', label: 'Strong positive', active: 'bg-emerald-600 text-white hover:bg-emerald-600/90' },
  { value: 'positive', label: 'Positive', active: 'bg-emerald-500 text-white hover:bg-emerald-500/90' },
  { value: 'mixed', label: 'Mixed', active: 'bg-amber-500 text-white hover:bg-amber-500/90' },
  { value: 'negative', label: 'Negative', active: 'bg-red-500 text-white hover:bg-red-500/90' },
  { value: 'strong_negative', label: 'Strong negative', active: 'bg-red-600 text-white hover:bg-red-600/90' },
  { value: 'unlabelled', label: 'No label', active: '' },
] as const

export function RecentFilings({ onOpenFiling }: { onOpenFiling: (accession: string) => void }) {
  const [hours, setHours] = useState(72)
  const [ticker, setTicker] = useState('')
  const [topic, setTopic] = useState<string>(ALL)
  const [form, setForm] = useState<string>(ALL)
  const [coverage, setCoverage] = useState<string>(ALL)
  const [kind, setKind] = useState<string>(ALL)
  const [signal, setSignal] = useState<string>(ALL)
  const query = useRecentFilings({
    hours,
    ticker: ticker.trim().toUpperCase() || undefined,
    topic: topic === ALL ? undefined : topic,
    form: form === ALL ? undefined : form,
    coverage: coverage === ALL ? undefined : coverage,
    kind: kind === ALL ? undefined : kind,
    signal: signal === ALL ? undefined : signal,
  })
  const filings = query.data?.pages.flat() ?? []
  const prices = useCurrentPrices(filings.map((f) => f.ticker ?? ''))

  return (
    <section className="space-y-4" aria-label="Recent filings">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Kind">
        <Button size="sm" variant={kind === ALL ? 'default' : 'outline'} onClick={() => setKind(ALL)}>
          All filings
        </Button>
        {KIND_FILTERS.map((value) => (
          <Button key={value} size="sm" variant={kind === value ? 'default' : 'outline'} onClick={() => setKind(value)}>
            {KIND_LABEL[value]}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Label">
        <Button size="sm" variant={signal === ALL ? 'default' : 'outline'} onClick={() => setSignal(ALL)}>
          Any label
        </Button>
        {SIGNAL_FILTERS.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={signal === option.value ? 'default' : 'outline'}
            className={cn(signal === option.value && option.active)}
            aria-pressed={signal === option.value}
            onClick={() => setSignal(signal === option.value ? ALL : option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="group" aria-label="Lookback">
          {HOURS.map((option) => (
            <Button key={option.value} size="sm" variant={hours === option.value ? 'default' : 'outline'} onClick={() => setHours(option.value)}>
              {option.label}
            </Button>
          ))}
        </div>
        <Input
          aria-label="Ticker"
          placeholder="Ticker"
          value={ticker}
          onChange={(event) => setTicker(event.target.value)}
          className="h-8 w-28"
        />
        <Select value={form} onValueChange={setForm}>
          <SelectTrigger size="sm" className="w-32" aria-label="Form">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All forms</SelectItem>
            {FORMS.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={coverage} onValueChange={setCoverage}>
          <SelectTrigger size="sm" className="w-44" aria-label="Coverage">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All companies</SelectItem>
            <SelectItem value="tracked">{COVERAGE_LABEL.tracked}</SelectItem>
            <SelectItem value="extended">{COVERAGE_LABEL.extended}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={topic} onValueChange={setTopic}>
          <SelectTrigger size="sm" className="w-48" aria-label="Topic">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All topics</SelectItem>
            {TOPIC_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {humanize(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {query.isSuccess && (
          <span className="text-muted-foreground text-xs">
            {filings.length} filings{query.hasNextPage ? ' (newest shown, more below)' : ''}
          </span>
        )}
      </div>

      {query.isPending && <Skeleton className="h-96 w-full" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.isSuccess && filings.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No extracted filings match"
          description="The watcher picks up tracked tickers' filings from EDGAR within seconds during market days."
        />
      )}
      {query.isSuccess && filings.length > 0 && (
        <div className="border-border bg-card rounded-lg border">
          {filings.map((filing) => (
            <FilingRow
              key={filing.accession}
              filing={filing}
              now={filing.ticker ? prices.data?.get(filing.ticker) : undefined}
              onOpen={onOpenFiling}
            />
          ))}
        </div>
      )}
      {query.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
            {query.isFetchingNextPage ? 'Loading…' : 'Load older filings'}
          </Button>
        </div>
      )}
    </section>
  )
}
