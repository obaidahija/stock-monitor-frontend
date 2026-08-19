import { useState, type FormEvent } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRefreshRedditFeed, useSearchRedditTicker } from './hooks'
import type { RedditFeedFilter, RedditSort } from '@/types/api'

const FILTERS: RedditFeedFilter[] = ['all', 'trusted', 'viral']
const SORTS: RedditSort[] = ['signal', 'newest', 'virality', 'score', 'comments']
const TICKER_RE = /^[A-Z]{1,5}(\.[A-Z])?$/

export function RedditFeedControls() {
  const [params, setParams] = useSearchParams()
  const [ticker, setTicker] = useState(params.get('ticker') ?? '')
  const [tickerError, setTickerError] = useState(false)
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
  function submit(event: FormEvent) {
    event.preventDefault()
    const normalized = ticker.trim().toUpperCase()
    if (!TICKER_RE.test(normalized)) return setTickerError(true)
    setTickerError(false)
    setTicker(normalized)
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set('ticker', normalized)
      return next
    })
    search.mutate({ ticker: normalized, force: true })
  }
  return <div className="space-y-3">
    <form className="flex max-w-md gap-2" onSubmit={submit}><Input aria-label="Search Reddit by ticker" value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="NVDA" /><Button type="submit" size="sm"><Search /> Search</Button></form>
    {tickerError && <p className="text-destructive text-xs">Enter a US ticker such as NVDA or BRK.B.</p>}
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-1">{FILTERS.map((item) => <Button key={item} size="sm" variant={filter === item ? 'secondary' : 'ghost'} onClick={() => update('filter', item, 'all')}>{item[0].toUpperCase() + item.slice(1)}</Button>)}<span className="mx-1 self-center text-xs text-muted-foreground">Sort</span>{SORTS.map((item) => <Button key={item} size="sm" variant={sort === item ? 'secondary' : 'ghost'} onClick={() => update('sort', item, 'signal')}>{item[0].toUpperCase() + item.slice(1)}</Button>)}</div><Button size="sm" variant="outline" disabled={refresh.isPending} onClick={() => refresh.mutate()}><RefreshCw /> Refresh feed</Button></div>
  </div>
}
