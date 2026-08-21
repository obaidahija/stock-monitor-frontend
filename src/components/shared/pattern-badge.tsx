import { Minus, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ChartPatternDetail } from '@/types/api'

// Full backend label -> short display form, shared between this badge and
// the Discover table's pattern filter buttons so both use the same wording.
export const PATTERN_LABEL_SHORT: Record<string, string> = {
  W_Bottom: 'W Bottom',
  M_Head: 'M Top',
  'Head and shoulders bottom': 'H&S Bottom',
  'Head and shoulders top': 'H&S Top',
  Triangle: 'Triangle',
  StockLine: 'Trendline',
}

const BIAS_META: Record<string, { icon: LucideIcon; className: string }> = {
  bullish: { icon: TrendingUp, className: 'bg-teal-500/15 text-teal-700 dark:text-teal-300' },
  bearish: { icon: TrendingDown, className: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
  neutral: { icon: Minus, className: 'bg-muted text-muted-foreground' },
}

/** Chart-pattern indicator for table rows -- a colored, labeled pill (same
 * StageBadge-style treatment as the Digest page), not just an icon, so a
 * detected pattern actually stands out while scanning the ticker column. */
export function PatternBadge({ pattern }: { pattern: ChartPatternDetail | null }) {
  if (!pattern) return null
  const meta = BIAS_META[pattern.bias] ?? BIAS_META.neutral
  const shortLabel = PATTERN_LABEL_SHORT[pattern.label] ?? pattern.label

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap cursor-help',
            meta.className,
          )}
        >
          <meta.icon className="size-3" />
          {shortLabel}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {pattern.label} ({(pattern.confidence * 100).toFixed(0)}% confidence)
        {pattern.date_end && ` — detected ${formatDate(pattern.date_end)}`}
      </TooltipContent>
    </Tooltip>
  )
}
