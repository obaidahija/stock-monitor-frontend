import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatRelativeTime } from '@/lib/format'
import type { RedditPostOut } from '@/types/api'

export function RedditPostCard({ post, onSelect }: { post: RedditPostOut; onSelect: (post: RedditPostOut) => void }) {
  const [revealed, setRevealed] = useState(false)
  return <Card><CardContent className="space-y-3 py-4">
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>r/{post.subreddit}</span><span>u/{post.author}</span><span>{formatRelativeTime(post.created_at)}</span></div>
    <button className="text-left" onClick={() => onSelect(post)}><h3 className="font-medium leading-snug">{post.title}</h3></button>
    {post.over_18 && !revealed ? <Button size="sm" variant="outline" onClick={() => setRevealed(true)}>Reveal NSFW preview</Button> : <p className="text-muted-foreground line-clamp-3 text-sm whitespace-pre-wrap">{post.selftext}</p>}
    <div className="flex flex-wrap gap-1.5">{post.ticker_matches.map((match) => <Badge key={match.ticker} variant="secondary">${match.ticker}</Badge>)}{post.is_trusted && <Badge>Trusted</Badge>}{post.is_viral && <Badge variant="destructive">Viral</Badge>}{post.sentiment_label && <Badge variant="outline">{post.sentiment_label}</Badge>}</div>
    <div className="flex items-center justify-between text-xs"><span>{post.metrics.score} points · {post.metrics.num_comments} comments</span><span className="font-medium">Signal {post.signal_score?.final_score.toFixed(1) ?? '—'}</span></div>
  </CardContent></Card>
}
