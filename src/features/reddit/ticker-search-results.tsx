import { useState } from 'react'
import { useSearchParams } from 'react-router'
import type { RedditPostOut } from '@/types/api'
import { useRedditSearch } from './hooks'
import { RedditPostCard } from './reddit-post-card'
import { RedditPostDetailDialog } from './reddit-post-detail-dialog'

export function TickerSearchResults() {
  const [params, setParams] = useSearchParams(); const ticker = params.get('ticker') ?? ''
  const query = useRedditSearch(ticker); const [selected, setSelected] = useState<RedditPostOut | null>(null)
  if (!ticker) return null
  return <section className="space-y-3" aria-labelledby="ticker-results"><div className="flex items-center justify-between"><h2 id="ticker-results" className="font-semibold">${ticker} search</h2><button className="text-muted-foreground text-sm underline" onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.delete('ticker'); return n })}>Clear</button></div>{query.data?.items.map((post) => <RedditPostCard key={post.id} post={post} onSelect={setSelected} />)}<RedditPostDetailDialog post={selected} onOpenChange={(open) => !open && setSelected(null)} /></section>
}
