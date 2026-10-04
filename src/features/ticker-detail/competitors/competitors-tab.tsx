import { useId, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronDown, RefreshCw, Search } from 'lucide-react'
import { MessageResponse } from '@/components/ai-elements/message'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import type { GoogleFinanceCompetitorsOut } from '@/types/api'
import { useCompetitors, useRefreshCompetitors } from '../hooks'
import { summarizeCompetitors, type CompetitorGroup } from './competitor-summary'

function Disclosure({ label, children, research = false }: { label: string; children: ReactNode; research?: boolean }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="border-border border-t pt-2">
      <Button type="button" variant="ghost" className="w-full justify-between px-0 hover:bg-transparent" aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}>
        {research ? `${open ? 'Hide' : 'Show'} detailed research` : label}
        <ChevronDown aria-hidden className={open ? 'rotate-180' : ''} />
      </Button>
      <div id={id}>{open && <div className="pt-3">{children}</div>}</div>
    </div>
  )
}

const GROUPS: { key: CompetitorGroup; title: string }[] = [
  { key: 'direct', title: 'Direct competitors' },
  { key: 'indirect', title: 'Indirect alternatives' },
  { key: 'other', title: 'Competitors' },
]

function CompetitorResult({ result }: { result: GoogleFinanceCompetitorsOut }) {
  const items = useMemo(() => summarizeCompetitors(result.answer_markdown ?? '', result.ticker), [result.answer_markdown, result.ticker])
  return (
    <Card>
      <CardHeader>
        <CardTitle>Competitors of {result.ticker}</CardTitle>
        <p className="text-muted-foreground text-xs">
          Updated:{' '}
          <time dateTime={result.generated_at}>
            {new Intl.DateTimeFormat(undefined, {
              year: 'numeric', month: 'short', day: 'numeric',
              hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
            }).format(new Date(result.generated_at))}
          </time>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 && (
          <p className="text-muted-foreground text-sm">Open detailed research to read this response; no public competitor list could be extracted.</p>
        )}
        {GROUPS.map(({ key, title }) => {
          const groupItems = items.filter((item) => item.group === key)
          if (groupItems.length === 0) return null
          return (
            <section key={key} aria-label={title} className="space-y-2">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide">{title}</h3>
              <ul className="divide-border divide-y">
                {groupItems.map((item) => (
                  <li key={item.symbols.join('/')} className="space-y-1 py-3 first:pt-1 last:pb-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      {item.companyName && <span className="text-sm font-medium">{item.companyName}</span>}
                      <span className="flex flex-wrap gap-2">
                        {item.symbols.map((symbol) => (
                          <Link key={symbol} to={`/stocks/${encodeURIComponent(symbol)}`} className="text-primary text-sm font-semibold underline-offset-4 hover:underline focus-visible:underline">{symbol}</Link>
                        ))}
                      </span>
                    </div>
                    {item.explanation && <p className="text-muted-foreground text-sm">{item.explanation}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
        {result.sources.length > 0 && (
          <Disclosure label={`Sources (${result.sources.length})`}>
            <ul aria-label="Google Finance sources" className="space-y-2 text-sm">
              {result.sources.map((source, index) => (
                <li key={`${source.url}:${index}`}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">{source.title}</a>
                  {source.publisher && <span className="text-muted-foreground"> · {source.publisher}</span>}
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
        <Disclosure label="Detailed research" research>
          <MessageResponse mode="static">{result.answer_markdown ?? ''}</MessageResponse>
          <p className="text-muted-foreground mt-3 text-xs">{result.caveat}</p>
        </Disclosure>
      </CardContent>
    </Card>
  )
}

export function CompetitorsTab({ ticker }: { ticker: string }) {
  const query = useCompetitors(ticker)
  const search = useRefreshCompetitors(ticker)
  const result = query.data?.source.ok ? query.data : search.data
  const current = result?.ticker === ticker.toUpperCase() ? result : null
  const saved = current?.source.ok && current.snapshot_id !== null && current.answer_markdown
  const failure = search.isError ? search.error : null
  const responseError = search.data?.ticker === ticker.toUpperCase() && !search.data.source.ok
    ? search.data.source.error
    : null

  if (query.isPending) return <Skeleton className="h-72 rounded-xl" />
  if (query.isError && !saved) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Competitor research from Google Finance. Saved for future visits; refresh whenever
          you want a new response.
        </p>
          <Button type="button" size="sm" variant="outline" disabled={search.isPending} onClick={() => search.mutate(Boolean(saved))}>
            {search.isPending ? <Spinner /> : saved ? <RefreshCw /> : <Search />}
            {search.isPending
              ? saved ? 'Refreshing…' : 'Searching Google Finance…'
              : saved ? 'Refresh' : current || failure ? 'Retry search' : 'Find competitors'}
          </Button>
      </div>

      {search.isPending && (
        <p role="status" className="text-muted-foreground text-sm">
          Asking Google Finance about {ticker}'s competitors and saving the response…
        </p>
      )}

      {!search.isPending && (responseError || failure) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {responseError ?? (failure instanceof Error ? failure.message : 'The search failed. Please retry.')}
        </p>
      )}

      {saved && current && (
        <CompetitorResult key={`${current.ticker}:${current.snapshot_id}:${current.generated_at}`} result={current} />
      )}
    </div>
  )
}
