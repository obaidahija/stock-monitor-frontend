import { Link } from 'react-router'
import { X } from 'lucide-react'

/** An active feed filter (a trusted account or subreddit) that stays visible above the feed; × removes it. */
export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-xs font-medium">
      {label}
      <button
        type="button"
        aria-label={`Stop filtering by ${label}`}
        onClick={onRemove}
        className="hover:bg-secondary-foreground/20 rounded-full p-0.5"
      >
        <X className="size-3" />
      </button>
    </span>
  )
}

/** A ticker in a feed card; the click opens the stock without opening the post. */
export function TickerPill({ ticker }: { ticker: string }) {
  return (
    <Link
      to={`/stocks/${ticker}`}
      onClick={(event) => event.stopPropagation()}
      className="bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current"
    >
      ${ticker}
    </Link>
  )
}

export function TrustedBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
      Trusted
    </span>
  )
}

export function ViralBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
      Viral
    </span>
  )
}
