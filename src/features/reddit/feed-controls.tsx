import { RefreshCw } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { TickerTagFilter } from '@/components/shared/ticker-tag-filter'
import { cn } from '@/lib/utils'
import { useRefreshRedditFeed, useSearchRedditTicker } from './hooks'
import type { RedditFeedFilter, RedditSort } from '@/types/api'

const FILTERS: RedditFeedFilter[] = ['all', 'trusted', 'viral']
const SORTS: RedditSort[] = ['signal', 'newest', 'virality', 'score', 'comments']

export function RedditFeedControls() {
  const [params, setParams] = useSearchParams()
  const tickers = params.get('tickers')?.split(',').filter(Boolean) ?? []
  const refresh = useRefreshRedditFeed()
  const search = useSearchRedditTicker()
  const filter = (params.get('filter') as RedditFeedFilter) || 'all'
  const sort = (params.get('sort') as RedditSort) || 'signal'

  function update(key: string, value: string, defaultValue: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      if (value === defaultValue) next.delete(key)
      else next.set(key, value)
      next.delete('page')
      return next
    })
  }

  // TickerTagFilter always either appends one ticker or removes one per call,
  // so a longer `next` means the newest entry (its last item) was just added --
  // that's the one ticker that needs a fresh search kicked off. A shorter
  // `next` is a removal; the removed ticker's cached results just stop
  // rendering, nothing to trigger.
  function updateTickers(next: string[]) {
    const added = next.length > tickers.length ? next[next.length - 1] : null
    setParams((previous) => {
      const params = new URLSearchParams(previous)
      if (next.length > 0) params.set('tickers', next.join(','))
      else params.delete('tickers')
      return params
    })
    if (added) search.mutate({ ticker: added, force: true })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((item) => (
            <Button
              key={item}
              size="sm"
              variant={filter === item ? 'secondary' : 'ghost'}
              onClick={() => update('filter', item, 'all')}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </Button>
          ))}
        </div>
        <span className="text-muted-foreground text-xs">Sort</span>
        <div className="flex flex-wrap gap-1">
          {SORTS.map((item) => (
            <Button
              key={item}
              size="sm"
              variant={sort === item ? 'secondary' : 'ghost'}
              onClick={() => update('sort', item, 'signal')}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </Button>
          ))}
        </div>
        <TickerTagFilter
          selected={tickers}
          onChange={updateTickers}
          placeholder="Search Reddit by ticker"
        />
      </div>

      <Button size="sm" variant="outline" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
        <RefreshCw className={cn(refresh.isPending && 'animate-spin')} /> Refresh feed
      </Button>
    </div>
  )
}
