import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const DRIVER_LABELS: Record<string, string> = {
  oil_price: 'Oil',
  rates_policy: 'Fed / rates',
  treasury_yields: 'Treasury yields',
  inflation: 'Inflation',
  tariffs_trade: 'Tariffs',
  conflict_escalation: 'Conflict',
  credit_stress: 'Credit stress',
  growth_labor: 'Growth / jobs',
  dollar_fx: 'Dollar',
  other: 'Other',
  // measured market drivers (macro exposures)
  oil: 'Oil',
  yield_10y: '10y yield',
  dollar: 'Dollar',
  gold: 'Gold',
  bitcoin: 'Bitcoin',
  vix: 'Fear (VIX)',
}

/** "Oil ↑" -- what moved and which way, as the trained reader saw it. */
export function DriverChip({
  driver,
  direction,
  count,
  className,
}: {
  driver: string
  direction: 'up' | 'down'
  count?: number
  className?: string
}) {
  const Arrow = direction === 'up' ? ArrowUp : ArrowDown
  return (
    <span
      className={cn(
        'bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        className,
      )}
    >
      {DRIVER_LABELS[driver] ?? driver}
      <Arrow className="size-3" aria-label={direction} />
      {count !== undefined && <span className="text-muted-foreground">· {count}</span>}
    </span>
  )
}
