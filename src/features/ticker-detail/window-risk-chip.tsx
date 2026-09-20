import { cn } from '@/lib/utils'
import type { WindowRiskOut } from '@/types/api'

const LEVEL_CLASSES: Record<WindowRiskOut['level'], string> = {
  high: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  medium: 'bg-muted text-muted-foreground',
}

export function WindowRiskChip({ windowRisk }: { windowRisk: WindowRiskOut | null }) {
  if (!windowRisk) return null

  const label = windowRisk.earnings_date
    ? `Earnings ${windowRisk.earnings_date}${
        windowRisk.days_until_earnings !== null
          ? ` · ${windowRisk.days_until_earnings} calendar ${windowRisk.days_until_earnings === 1 ? 'day' : 'days'}`
          : ''
      }`
    : windowRisk.macro_events.join(', ')

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
        LEVEL_CLASSES[windowRisk.level],
      )}
      title={`${windowRisk.note} Counted in calendar days using New York dates.`}
    >
      {label}
    </span>
  )
}
