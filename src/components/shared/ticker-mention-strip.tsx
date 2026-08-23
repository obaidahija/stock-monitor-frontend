import type { ReactNode } from 'react'
import { Flame, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// Visual weight tapers with rank instead of a bar length -- reads as a
// leaderboard through tint alone, staying a single scrollable row instead of
// a multi-row list. Shared by every "top mentions" chip strip (Twitter,
// Reddit) so the convention stays identical across platforms.
export function weightClassFor(index: number, total: number): string {
  const pct = total <= 1 ? 0 : index / (total - 1)
  if (pct < 0.15) return 'bg-primary/15 ring-primary/30'
  if (pct < 0.4) return 'bg-primary/10 ring-primary/20'
  if (pct < 0.7) return 'bg-primary/5 ring-primary/10'
  return 'bg-card ring-foreground/10'
}

export interface TickerMentionItem {
  ticker: string
  /** Rendered inside the chip button -- ticker, headline metric(s), badges. */
  chip: ReactNode
  /** Rendered in the chip's hover tooltip -- the fuller per-ticker breakdown. */
  tooltip: ReactNode
}

interface TickerMentionStripProps {
  headerTooltip: ReactNode
  items: TickerMentionItem[]
  selected: string[]
  onToggle: (ticker: string) => void
  onRefresh: () => void
  isRefreshing: boolean
  emptyMessage: string
  ariaLabel: string
}

/**
 * Shared "top mentions" chip strip: an uppercase label (with a tooltip
 * explaining the ranking), a refresh button, and a horizontally-scrollable
 * row of rank-tinted ticker chips, each with its own hover tooltip for the
 * fuller breakdown. Twitter's and Reddit's top-mentions strips both render
 * through this so the two platforms present identically -- only the data
 * (fetched by each caller) and the chip/tooltip content differ.
 */
export function TickerMentionStrip({
  headerTooltip,
  items,
  selected,
  onToggle,
  onRefresh,
  isRefreshing,
  emptyMessage,
  ariaLabel,
}: TickerMentionStripProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <h2 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
              <Flame className="size-3.5" />
              Top mentions
            </h2>
          </TooltipTrigger>
          <TooltipContent>{headerTooltip}</TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Refresh top mentions"
          disabled={isRefreshing}
          onClick={onRefresh}
        >
          <RefreshCw className={cn(isRefreshing && 'animate-spin')} />
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground py-1.5 text-xs">{emptyMessage}</p>
      ) : (
        <div
          className="flex items-center gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label={ariaLabel}
        >
          {items.map((item, index) => {
            const isSelected = selected.includes(item.ticker)
            return (
              <Tooltip key={item.ticker}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`Filter feed by $${item.ticker}`}
                    onClick={() => onToggle(item.ticker)}
                    className={cn(
                      'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 transition-colors select-none hover:ring-primary/40',
                      weightClassFor(index, items.length),
                      isSelected && 'outline-2 outline-primary outline-offset-1',
                    )}
                  >
                    {item.chip}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{item.tooltip}</TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Matches TickerMentionStrip's stacked header + chip-row layout while data loads. */
export function TickerMentionStripSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-full rounded-full" />
    </div>
  )
}
