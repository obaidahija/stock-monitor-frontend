import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { RedditCommentOut } from '@/types/api'

const DEPTH_CLASS = ['ml-0', 'ml-3', 'ml-6', 'ml-9', 'ml-12', 'ml-15', 'ml-18']

export function RedditCommentTree({ comments }: { comments: RedditCommentOut[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? comments : comments.filter((comment) => comment.depth < 6)
  const hidden = comments.length - visible.length
  return <div className="space-y-2">
    {visible.map((comment) => <article key={comment.id} data-testid="reddit-comment" className={`border-border border-l-2 pl-3 ${DEPTH_CLASS[Math.min(comment.depth, 6)]}`}>
      <p className="text-muted-foreground text-xs">u/{comment.author} · {comment.score} points</p>
      <p className="text-sm whitespace-pre-wrap">{comment.content_state === 'visible' ? comment.body : `[${comment.content_state}]`}</p>
    </article>)}
    {hidden > 0 && <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>Show deeper replies</Button>}
  </div>
}
