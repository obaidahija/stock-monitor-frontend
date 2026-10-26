import { ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SentimentBadge } from '@/components/shared/sentiment-badge'
import type { RedditPostOut } from '@/types/api'
import { useRedditThread, useRedditThreadFollow, useRefreshRedditThread } from './hooks'
import { OperationProgress } from './operation-progress'
import { RedditCommentTree } from './reddit-comment-tree'
import { SignalScoreDetail } from './signal-score-detail'

const REFRESH_LABELS = {
  queued: 'Refreshing discussion (queued)…',
  running: 'Refreshing discussion…',
  deferred: 'Refreshing discussion (waiting to retry)…',
}

export function RedditPostDetailDialog({ post, onOpenChange }: { post: RedditPostOut | null; onOpenChange: (open: boolean) => void }) {
  const thread = useRedditThread(post?.id ?? null)
  const refresh = useRefreshRedditThread()
  const { operation } = useRedditThreadFollow(post?.id ?? null)
  const refreshing = refresh.isPending || (operation !== null && operation.status !== 'failed')
  return <Dialog open={post !== null} onOpenChange={onOpenChange}><DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-3xl">
    {post && <><DialogHeader><DialogTitle>{post.title}</DialogTitle><DialogDescription>r/{post.subreddit} · u/{post.author}</DialogDescription></DialogHeader>
      {post.sentiment_label && <SentimentBadge label={post.sentiment_label} score={post.sentiment_confidence} />}
      <div className="flex gap-2"><Button size="sm" variant="outline" disabled={refreshing} onClick={() => refresh.mutate({ postId: post.id })}><RefreshCw /> Refresh discussion</Button><Button asChild size="sm" variant="ghost"><a href={post.permalink} target="_blank" rel="noreferrer">Open Reddit <ExternalLink /></a></Button></div>
      {post.signal_score && <SignalScoreDetail score={post.signal_score} />}
      <OperationProgress operation={operation} labels={REFRESH_LABELS} failure="Discussion refresh failed" retryLabel="Retry refresh" onRetry={() => refresh.mutate({ postId: post.id })} retrying={refresh.isPending} />
      {thread.data?.stale && operation === null && <p role="status" className="text-muted-foreground text-xs">Showing cached discussion while a refresh is available.</p>}
      {thread.data && <RedditCommentTree comments={thread.data.comments} />}
    </>}
  </DialogContent></Dialog>
}
