import { useState, type FormEvent } from 'react'
import { Loader2, ScanSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorState } from '@/components/shared/error-state'
import { useAnalyzeFilings, useCurrentPrices } from './hooks'
import { FilingRow } from './filing-row'
import { MAX_TICKERS, parseTickers } from './labels'


export function AnalyzePanel({ onOpenFiling }: { onOpenFiling: (accession: string) => void }) {
  const [text, setText] = useState('')
  const [days, setDays] = useState(30)
  const [perTicker, setPerTicker] = useState(3)
  const mutation = useAnalyzeFilings()
  const tickers = parseTickers(text)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (tickers.length > 0) mutation.mutate({ tickers, days, per_ticker: perTicker })
  }

  const result = mutation.data
  const prices = useCurrentPrices((result?.filings ?? []).map((f) => f.ticker ?? ''))
  const counts = result
    ? {
        extracted: result.outcomes.filter((o) => o.status === 'extracted').length,
        cached: result.outcomes.filter((o) => o.status === 'cached').length,
        failed: result.outcomes.filter((o) => o.status === 'failed').length,
      }
    : null

  return (
    <section className="space-y-4" aria-label="Analyze filings">
      <form onSubmit={submit} className="border-border bg-card space-y-3 rounded-lg border p-4">
        <label className="block text-sm font-medium" htmlFor="filing-intel-tickers">
          Tickers (up to {MAX_TICKERS})
        </label>
        <Input
          id="filing-intel-tickers"
          placeholder="NVDA, TGT, SLS, CHRW …"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            Last
            <Input type="number" min={1} max={400} value={days} onChange={(e) => setDays(Number(e.target.value) || 30)} className="h-8 w-20" />
            days
          </label>
          <label className="flex items-center gap-2">
            Up to
            <Input type="number" min={1} max={20} value={perTicker} onChange={(e) => setPerTicker(Number(e.target.value) || 3)} className="h-8 w-16" />
            filings per ticker
          </label>
          <Button type="submit" disabled={tickers.length === 0 || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ScanSearch className="size-4" aria-hidden="true" />}
            Analyze {tickers.length > 0 ? `${tickers.length} ticker${tickers.length > 1 ? 's' : ''}` : ''}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Lists each ticker's latest 8-K, 10-Q, 10-K and 424B filings from EDGAR, downloads only the documents needed,
          and extracts them with rules. Filings already analyzed come back from the cache.
        </p>
      </form>

      {mutation.isError && <ErrorState error={mutation.error} onRetry={() => mutation.reset()} />}
      {result && counts && (
        <div className="space-y-2">
          <p className="text-sm">
            <span className="font-medium">{result.requested} filings in {(result.elapsed_ms / 1000).toFixed(1)} s</span>
            <span className="text-muted-foreground">
              {' '}
              · {counts.extracted} newly extracted · {counts.cached} from cache · {counts.failed} failed
            </span>
          </p>
          {result.errors.length > 0 && (
            <p className="text-sm text-amber-600">
              {result.errors.map((e) => `${e.ticker ?? e.accession}: ${e.error_code}`).join(' · ')}
            </p>
          )}
          <div className="border-border bg-card rounded-lg border">
            {result.filings.map((filing) => (
              <FilingRow
                key={filing.accession}
                filing={filing}
                now={filing.ticker ? prices.data?.get(filing.ticker) : undefined}
                onOpen={onOpenFiling}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
