import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { RECENT_PAGE_SIZE, useCurrentPrices, useRecentFilings } from './hooks'
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
  // Filters and page live in the URL, so a refresh or a shared link shows the same list.
  const [params, setParams] = useSearchParams()
  const hours = HOURS.some((o) => String(o.value) === params.get('hours')) ? Number(params.get('hours')) : 24
  const ticker = params.get('ticker') ?? ''
  const topic = params.get('topic') ?? ALL
  const form = params.get('form') ?? ALL
  const coverage = params.get('coverage') ?? ALL
  const kind = params.get('kind') ?? ALL
  const signal = params.get('signal') ?? ALL
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
  /** Set one URL value (dropped when it is the default); a filter change goes back to page 1. */
  function setParam(key: string, value: string | number, fallback: string | number) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (String(value) === String(fallback)) next.delete(key)
        else next.set(key, String(value))
        if (key !== 'page') next.delete('page')
        return next
      },
      { replace: true },
    )
  }
  const setHours = (value: number) => setParam('hours', value, 24)
  const setTicker = (value: string) => setParam('ticker', value, '')
  const setTopic = (value: string) => setParam('topic', value, ALL)
  const setForm = (value: string) => setParam('form', value, ALL)
  const setCoverage = (value: string) => setParam('coverage', value, ALL)
  const setKind = (value: string) => setParam('kind', value, ALL)
  const setSignal = (value: string) => setParam('signal', value, ALL)
  const setPage = (value: number) => setParam('page', value, 1)
  const query = useRecentFilings({
    page,
    hours,
    ticker: ticker.trim().toUpperCase() || undefined,
    topic: topic === ALL ? undefined : topic,
    form: form === ALL ? undefined : form,
    coverage: coverage === ALL ? undefined : coverage,
    kind: kind === ALL ? undefined : kind,
    signal: signal === ALL ? undefined : signal,
  })
  const filings = query.data?.items ?? []
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / RECENT_PAGE_SIZE))
  // A stored page past the end (the list shrank since) goes to the last page.
  const pastEnd = query.isSuccess && page > totalPages
  useEffect(() => {
    if (pastEnd) setPage(totalPages)
  })
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
            {query.data?.total ?? 0} filings
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
      {query.isSuccess && (query.data?.total ?? 0) > 0 && (
        <nav className="flex flex-wrap items-center justify-center gap-3" aria-label="Filings pagination">
          <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
            Previous
          </Button>
          {Array.from(new Set([1, ...Array.from({ length: 5 }, (_, i) => page + i - 2), totalPages]))
            .filter((number) => number >= 1 && number <= totalPages)
            .sort((a, b) => a - b)
            .map((number) => (
              <Button key={number} variant={number === page ? 'default' : 'outline'} size="sm"
                aria-label={`Page ${number}`} aria-current={number === page ? 'page' : undefined}
                onClick={() => setPage(number)}>
                {number}
              </Button>
            ))}
          <span className="text-muted-foreground text-sm" aria-live="polite">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page * RECENT_PAGE_SIZE >= (query.data?.total ?? 0)}>
            Next
          </Button>
        </nav>
      )}
    </section>
  )
}
