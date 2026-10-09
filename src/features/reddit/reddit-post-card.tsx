import { useState } from 'react'
import { ArrowBigUp, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { TickerPill, TrustedBadge, ViralBadge } from '@/components/shared/feed-badges'
import { SentimentBadge } from '@/components/shared/sentiment-badge'
// Reused as-is for Reddit posts -- same shared classifier/taxonomy as Twitter,
// see app/intelligence/tweet_type_classification.py's module docstring.
import { TweetTypeBadge } from '@/components/shared/tweet-type-badge'
import { SignalScoreBadge } from '@/features/twitter/signal-score-badge'
import { formatEasternDateTime, formatNumber, formatRelativeTime } from '@/lib/format'
import type { RedditPostOut } from '@/types/api'

function count(value: number, singular: string, plural: string) {
  return `${formatNumber(value)} ${value === 1 ? singular : plural}`
}

/** Same layout as the Twitter row (TweetRow), so the two feeds read alike. */
export function RedditPostCard({ post, onSelect }: { post: RedditPostOut; onSelect: (post: RedditPostOut) => void }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-foreground font-medium">r/{post.subreddit}</span>
            <span>u/{post.author}</span>
            <span>·</span>
            <span title={formatEasternDateTime(post.created_at)}>{formatRelativeTime(post.created_at)}</span>
          </div>
          <button type="button" className="text-left" onClick={() => onSelect(post)}>
            <h3 className="text-sm leading-snug font-medium hover:underline">{post.title}</h3>
          </button>
          {post.over_18 && !revealed ? (
            <Button size="sm" variant="outline" onClick={() => setRevealed(true)}>
              Reveal NSFW preview
            </Button>
          ) : (
            post.selftext && (
              <p className="text-muted-foreground line-clamp-2 text-sm whitespace-pre-wrap">{post.selftext}</p>
            )
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {post.ticker_matches.map((match) => (
              <TickerPill key={match.ticker} ticker={match.ticker} />
            ))}
            {post.is_trusted && <TrustedBadge />}
            {post.is_viral && <ViralBadge />}
            {post.sentiment_label && <SentimentBadge label={post.sentiment_label} />}
            <TweetTypeBadge type={post.post_type} />
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1">
              <ArrowBigUp className="size-3.5" aria-hidden="true" />
              {count(post.metrics.score, 'point', 'points')}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="size-3.5" aria-hidden="true" />
              {count(post.metrics.num_comments, 'comment', 'comments')}
            </span>
          </div>
        </div>
        <SignalScoreBadge score={post.signal_score?.final_score ?? null} />
      </CardHeader>
    </Card>
  )
}
