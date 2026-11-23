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
import { COVERAGE_LABEL, humanize, TOPIC_OPTIONS } from './labels'

const HOURS = [
  { value: 24, label: '24h' },
  { value: 72, label: '3 days' },
  { value: 168, label: '7 days' },
  { value: 744, label: '31 days' },
]
const FORMS = ['8-K', '10-Q', '10-K', '424B5']
const ALL = 'all'

export function RecentFilings({ onOpenFiling }: { onOpenFiling: (accession: string) => void }) {
  const [hours, setHours] = useState(72)
  const [ticker, setTicker] = useState('')
  const [topic, setTopic] = useState<string>(ALL)
  const [form, setForm] = useState<string>(ALL)
  const [coverage, setCoverage] = useState<string>(ALL)
  const query = useRecentFilings({
    hours,
    ticker: ticker.trim().toUpperCase() || undefined,
    topic: topic === ALL ? undefined : topic,
    form: form === ALL ? undefined : form,
    coverage: coverage === ALL ? undefined : coverage,
  })
  const prices = useCurrentPrices((query.data ?? []).map((f) => f.ticker ?? ''))

  return (
    <section className="space-y-4" aria-label="Recent filings">
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
        {query.data && <span className="text-muted-foreground text-xs">{query.data.length} filings</span>}
      </div>

      {query.isPending && <Skeleton className="h-96 w-full" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.isSuccess && query.data.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No extracted filings match"
          description="The watcher picks up tracked tickers' filings from EDGAR within seconds during market days."
        />
      )}
      {query.isSuccess && query.data.length > 0 && (
        <div className="border-border bg-card rounded-lg border">
          {query.data.map((filing) => (
            <FilingRow
              key={filing.accession}
              filing={filing}
              now={filing.ticker ? prices.data?.get(filing.ticker) : undefined}
              onOpen={onOpenFiling}
            />
          ))}
        </div>
      )}
    </section>
  )
}
