import { BadgeCheck, ExternalLink, Eye, Heart, MessageCircle, Repeat2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { SentimentBadge } from '@/components/shared/sentiment-badge'
import { formatDateTime, formatNumber } from '@/lib/format'
import { SignalScoreDetail } from './signal-score-detail'
import type { TwitterPostOut } from '@/types/api'

export function TweetDetailDialog({
  post,
  onOpenChange,
}: {
  post: TwitterPostOut | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={post !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {post && (
              <span className="inline-flex items-center gap-1.5 font-medium">
                {post.author_name}
                {post.author_verified && <BadgeCheck className="text-primary size-4" />}
                <span className="text-muted-foreground font-normal">@{post.author_username}</span>
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {post && (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto">
            <p className="text-sm whitespace-pre-wrap">{post.text}</p>

            {post.sentiment_label && (
              <SentimentBadge label={post.sentiment_label} score={post.sentiment_score} />
            )}

            <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1">
                <Eye className="size-3.5" />
                {formatNumber(post.metrics.views)} views
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart className="size-3.5" />
                {formatNumber(post.metrics.likes)} likes
              </span>
              <span className="inline-flex items-center gap-1">
                <Repeat2 className="size-3.5" />
                {formatNumber(post.metrics.retweets)} retweets
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="size-3.5" />
                {formatNumber(post.metrics.replies)} replies
              </span>
            </div>

            <p className="text-muted-foreground text-xs">{formatDateTime(post.created_at)}</p>

            <a
              href={post.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              View on X
              <ExternalLink className="size-3.5" />
            </a>

            <Separator />

            {post.signal_score ? (
              <SignalScoreDetail score={post.signal_score} />
            ) : (
              <p className="text-muted-foreground text-sm">Not yet scored.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
