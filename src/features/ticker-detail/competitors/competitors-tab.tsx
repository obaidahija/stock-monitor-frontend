import { RefreshCw, Search } from 'lucide-react'
import { MessageResponse } from '@/components/ai-elements/message'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useCompetitors, useRefreshCompetitors } from '../hooks'

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
          <Button size="sm" variant="outline" disabled={search.isPending} onClick={() => search.mutate(Boolean(saved))}>
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
        <Card>
          <CardHeader>
            <CardTitle>Competitors of {ticker}</CardTitle>
            <p className="text-muted-foreground text-sm">
              Response received:{' '}
              <time dateTime={current.generated_at}>
                {new Intl.DateTimeFormat('en-US', {
                  year: 'numeric', month: 'short', day: 'numeric',
                  hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
                }).format(new Date(current.generated_at))}
              </time>
              {' · Saved Google Finance response'}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <MessageResponse mode="static">{current.answer_markdown ?? ''}</MessageResponse>
            {current.sources.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Sources</h3>
                <ul aria-label="Google Finance sources" className="space-y-2 text-sm">
                  {current.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                        {source.title}
                      </a>
                      {source.publisher && <span className="text-muted-foreground"> · {source.publisher}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-muted-foreground text-xs">{current.caveat}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
