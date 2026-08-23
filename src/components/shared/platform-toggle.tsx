import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/**
 * A legend entry that doubles as a filter control -- clicking a platform's
 * own dot+label both explains its color and narrows the strip to it, one
 * element instead of a static legend plus a separate row of filter buttons.
 * Shared by every Reddit/Twitter/Both attention strip (Discover's Social
 * Buzz, Trending's Hot strip).
 */
export function PlatformToggle({
  active,
  onClick,
  dotClassName,
  dotStyle,
  label,
}: {
  active: boolean
  onClick: () => void
  dotClassName?: string
  dotStyle?: CSSProperties
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors',
        active ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <span className={cn('size-2 rounded-full', dotClassName)} style={dotStyle} aria-hidden />
      {label}
    </button>
  )
}
