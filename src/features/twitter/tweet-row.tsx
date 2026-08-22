import { BadgeCheck, Eye, Heart, MessageCircle, Repeat2 } from 'lucide-react'
import { Link } from 'react-router'
import { Card, CardHeader } from '@/components/ui/card'
import { SentimentBadge } from '@/components/shared/sentiment-badge'
import { TweetTypeBadge } from '@/components/shared/tweet-type-badge'
import { formatNumber, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SignalScoreBadge } from './signal-score-badge'
import type { TwitterPostOut } from '@/types/api'

export function TweetRow({ post, onSelect }: { post: TwitterPostOut; onSelect: (post: TwitterPostOut) => void }) {
  return (
    <Card
      className="hover:bg-muted/40 cursor-pointer transition-colors"
      onClick={() => onSelect(post)}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="font-medium">{post.author_name}</span>
            {post.author_verified && (
              <BadgeCheck className="text-primary size-3.5" aria-label="Verified" />
            )}
            <span className="text-muted-foreground">@{post.author_username}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{formatRelativeTime(post.created_at)}</span>
          </div>

          <p className="line-clamp-2 text-sm">{post.text}</p>

          <div className="flex flex-wrap items-center gap-1.5">
            {post.ticker_matches.map((match) => (
              <Link
                key={match.ticker}
                to={`/stocks/${match.ticker}`}
                onClick={(e) => e.stopPropagation()}
                className="bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current"
              >
                ${match.ticker}
              </Link>
            ))}
            {post.is_trusted && (
              <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                Trusted
              </span>
            )}
            {post.is_viral && (
              <span className="inline-flex items-center rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
                Viral
              </span>
            )}
            {post.sentiment_label && <SentimentBadge label={post.sentiment_label} />}
            <TweetTypeBadge type={post.tweet_type} />
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
            <span className={cn('inline-flex items-center gap-1')}>
              <Eye className="size-3.5" />
              {formatNumber(post.metrics.views)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="size-3.5" />
              {formatNumber(post.metrics.likes)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Repeat2 className="size-3.5" />
              {formatNumber(post.metrics.retweets)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="size-3.5" />
              {formatNumber(post.metrics.replies)}
            </span>
          </div>
        </div>

        <SignalScoreBadge score={post.signal_score?.final_score ?? null} />
      </CardHeader>
    </Card>
  )
}
