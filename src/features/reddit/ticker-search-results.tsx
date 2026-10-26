import { useState } from 'react'
import { useSearchParams } from 'react-router'
import type { RedditPostOut } from '@/types/api'
import { useRedditSearch, useRedditSearchFollow, useSearchRedditTicker } from './hooks'
import { OperationProgress } from './operation-progress'
import { RedditPostCard } from './reddit-post-card'
import { RedditPostDetailDialog } from './reddit-post-detail-dialog'

function TickerSearchSection({
  ticker,
  onClear,
  onSelectPost,
}: {
  ticker: string
  onClear: () => void
  onSelectPost: (post: RedditPostOut) => void
}) {
  const query = useRedditSearch(ticker)
  const { operation } = useRedditSearchFollow(ticker)
  const retry = useSearchRedditTicker()
  const headingId = `reddit-ticker-search-${ticker}`
  return (
    <section className="space-y-2" aria-labelledby={headingId}>
      <div className="flex items-center justify-between">
        <h3 id={headingId} className="text-sm font-semibold">
          ${ticker}
        </h3>
        <button type="button" className="text-muted-foreground text-xs underline" onClick={onClear}>
          Clear
        </button>
      </div>
      <OperationProgress
        operation={operation}
        labels={{
          queued: `Reddit search for $${ticker} queued…`,
          running: `Searching Reddit for $${ticker}…`,
          deferred: `Reddit search for $${ticker} waiting to retry…`,
        }}
        failure="Reddit search failed"
        retryLabel="Retry search"
        onRetry={() => retry.mutate({ ticker, force: true })}
        retrying={retry.isPending}
      />
      {query.data?.items.map((post) => (
        <RedditPostCard key={post.id} post={post} onSelect={onSelectPost} />
      ))}
    </section>
  )
}

export function TickerSearchResults() {
  const [params, setParams] = useSearchParams()
  const tickers = params.get('tickers')?.split(',').filter(Boolean) ?? []
  const [selected, setSelected] = useState<RedditPostOut | null>(null)

  function clearTicker(ticker: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      const remaining = tickers.filter((t) => t !== ticker)
      if (remaining.length > 0) next.set('tickers', remaining.join(','))
      else next.delete('tickers')
      return next
    })
  }

  if (tickers.length === 0) return null

  return (
    <section className="space-y-4" aria-labelledby="ticker-results">
      <h2 id="ticker-results" className="font-semibold">
        Ticker search
      </h2>
      {tickers.map((ticker) => (
        <TickerSearchSection
          key={ticker}
          ticker={ticker}
          onClear={() => clearTicker(ticker)}
          onSelectPost={setSelected}
        />
      ))}
      <RedditPostDetailDialog post={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </section>
  )
}
