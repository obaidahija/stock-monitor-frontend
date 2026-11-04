import { formatTimestamp } from '@/lib/format'
import type { DigestItem } from '@/types/api'

export function HeadlineEvidence({ item }: { item: Pick<DigestItem, 'headlines' | 'headline_snippets'> }) {
  const headlines = item.headlines?.length ? item.headlines
    : item.headline_snippets.map((title) => ({ title, url: null, source: null, published_at: null }))
  if (headlines.length === 0) return null
  return <details className="text-sm">
    <summary className="text-muted-foreground cursor-pointer">Headlines ({headlines.length})</summary>
    <ul className="mt-2 flex flex-col gap-3">
      {headlines.map((headline, index) => {
        const url = headline.url && /^https?:\/\//i.test(headline.url) ? headline.url : null
        const timestamp = headline.published_at && Number.isFinite(Date.parse(headline.published_at))
          ? formatTimestamp(headline.published_at) : null
        return <li key={`${headline.title}-${index}`} className="flex min-w-0 flex-col gap-1 break-words">
          {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{headline.title}</a>
            : <span>{headline.title}</span>}
          {(headline.source || timestamp) && <span className="text-muted-foreground text-xs">
            {[headline.source, timestamp].filter(Boolean).join(' · ')}
          </span>}
        </li>
      })}
    </ul>
  </details>
}
