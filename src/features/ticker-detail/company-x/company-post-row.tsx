import { BadgeCheck, Bookmark, Eye, Heart, MessageCircle, Quote, Repeat2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatEasternDateTime, formatNumber, formatRelativeTime } from '@/lib/format'
import type { CompanyPostMetricsOut, CompanyPostOut } from '@/types/twitter-company'

const METRICS: { key: keyof CompanyPostMetricsOut; label: string; icon: LucideIcon }[] = [
  { key: 'views', label: 'Views', icon: Eye },
  { key: 'likes', label: 'Likes', icon: Heart },
  { key: 'retweets', label: 'Reposts', icon: Repeat2 },
  { key: 'replies', label: 'Replies', icon: MessageCircle },
  { key: 'quotes', label: 'Quotes', icon: Quote },
  { key: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
]

const linkClass = 'underline-offset-2 hover:underline break-all'

/**
 * One company-authored post. Engagement is shown as X reported it — a metric X did
 * not report is left out rather than shown as zero. AI importance is separate.
 */
export function CompanyPostRow({ post }: { post: CompanyPostOut }) {
  return (
    <article
      aria-label={`Post from @${post.author_username}`}
      className="bg-card space-y-2 rounded-lg border p-3"
    >
      <header className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
        <span className="font-medium">{post.author_name}</span>
        {post.author_verified && (
          <BadgeCheck className="text-primary size-3.5" aria-label="Verified" />
        )}
        <span className="text-muted-foreground">@{post.author_username}</span>
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground ml-auto text-xs underline-offset-2 hover:underline"
          title={formatEasternDateTime(post.created_at)}
        >
          <time dateTime={post.created_at}>{formatRelativeTime(post.created_at)}</time>
        </a>
      </header>

      <p className="text-sm break-words whitespace-pre-line">{post.text}</p>

      {post.analysis && (
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">
              {post.analysis.status === 'completed' && post.analysis.importance_score !== null
                ? `AI importance ${post.analysis.importance_score}/100`
                : post.analysis.status === 'pending' ? 'Analyzing'
                : post.analysis.status === 'uncertain' ? 'Needs review' : 'AI unavailable'}
            </Badge>
            {post.analysis.status === 'completed' && post.analysis.is_company_news && <Badge variant="secondary">Potential company news</Badge>}
          </div>
          {post.analysis.reason && <p className="text-muted-foreground break-words">{post.analysis.reason}</p>}
        </div>
      )}

      {post.quote && (
        <figure
          aria-label={`Quoted post from @${post.quote.author_username ?? 'unknown account'}`}
          className="text-muted-foreground space-y-1 border-l-2 pl-3 text-sm"
        >
          <figcaption className="text-xs">
            Quoting {post.quote.author_name ?? 'a post'}
            {post.quote.author_username && ` @${post.quote.author_username}`}
          </figcaption>
          {post.quote.text && (
            <blockquote className="break-words whitespace-pre-line">{post.quote.text}</blockquote>
          )}
          {post.quote.url && (
            <a href={post.quote.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
              Open the quoted post
            </a>
          )}
        </figure>
      )}

      {post.urls.length > 0 && (
        <ul className="space-y-0.5 text-xs">
          {post.urls.map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                {url}
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
        {METRICS.map(({ key, label, icon: Icon }) => {
          const value = post.metrics[key]
          if (value === null) return null
          return (
            <span
              key={key}
              className="inline-flex items-center gap-1"
              aria-label={`${label}: ${formatNumber(value)}`}
              title={label}
            >
              <Icon className="size-3.5" aria-hidden />
              {formatNumber(value)}
            </span>
          )
        })}
      </div>
    </article>
  )
}
