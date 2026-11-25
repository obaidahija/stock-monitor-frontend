import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** Size bands, smallest first: a small company's filing should stand out at a glance. */
const BANDS: { below: number; label: string; className: string }[] = [
  { below: 300e6, label: 'micro cap', className: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  { below: 2e9, label: 'small cap', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  { below: 10e9, label: 'mid cap', className: 'bg-sky-500/15 text-sky-700 dark:text-sky-400' },
  { below: Infinity, label: 'large cap', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
]

export function formatMarketCap(value: number): string {
  for (const [unit, size] of [['T', 1e12], ['B', 1e9], ['M', 1e6]] as const) {
    if (value >= size) return `$${(value / size).toFixed(value / size >= 100 ? 0 : 1)}${unit}`
  }
  return `$${Math.round(value).toLocaleString()}`
}

export function marketCapBand(value: number) {
  return BANDS.find((band) => value < band.below) ?? BANDS[BANDS.length - 1]
}

/** "$412M · small cap", coloured by band; `size="lg"` for the filing panel's header. */
export function MarketCapBadge({
  value,
  size = 'sm',
  className,
}: {
  value: number | null | undefined
  size?: 'sm' | 'lg'
  className?: string
}) {
  if (!value) return null
  const band = marketCapBand(value)
  return (
    <Badge
      className={cn(
        'border-transparent font-semibold tabular-nums',
        band.className,
        size === 'lg' && 'px-2.5 py-1 text-sm',
        className,
      )}
      title="Market cap (tracked: daily score run; outside your universe: Yahoo, cached weekly)"
    >
      {formatMarketCap(value)}
      <span className="font-normal opacity-80">· {band.label}</span>
    </Badge>
  )
}
