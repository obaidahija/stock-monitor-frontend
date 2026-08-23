import { useState } from 'react'
import { useSearchParams } from 'react-router'
import type { RedditPostOut } from '@/types/api'
import { useRedditSearch } from './hooks'
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
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">${ticker}</h3>
        <button type="button" className="text-muted-foreground text-xs underline" onClick={onClear}>
          Clear
        </button>
      </div>
      {query.data?.items.map((post) => (
        <RedditPostCard key={post.id} post={post} onSelect={onSelectPost} />
      ))}
    </div>
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
