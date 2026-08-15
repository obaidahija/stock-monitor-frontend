import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PriceReferenceOut } from '@/types/api'

interface Marker {
  key: string
  label: string
  value: number
  dotClassName: string
  labelClassName: string
}

function PriceReferenceGrid({
  priceReference,
  currentPrice,
}: {
  priceReference: PriceReferenceOut | null
  currentPrice: number | null
}) {
  const rows: { label: string; value: number | null }[] = [
    { label: 'Current price', value: currentPrice },
    { label: 'Entry (primary)', value: priceReference?.entry_primary ?? null },
    { label: 'Entry (secondary)', value: priceReference?.entry_secondary ?? null },
    { label: 'Stop loss', value: priceReference?.stop_loss ?? null },
    { label: 'Take profit', value: priceReference?.take_profit ?? null },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price reference</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="border-border rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-xs">{row.label}</p>
              <p className="text-sm font-medium">
                {row.value !== null ? formatCurrency(row.value) : 'Not provided'}
              </p>
            </div>
          ))}
        </div>
        {priceReference?.note && (
          <p className="text-muted-foreground text-sm">{priceReference.note}</p>
        )}
        <p className="text-muted-foreground text-xs">
          Reference levels only, not a recommendation to buy or sell.
        </p>
      </CardContent>
    </Card>
  )
}

export function PriceReferenceLadder({
  priceReference,
  currentPrice,
}: {
  priceReference: PriceReferenceOut | null
  currentPrice: number | null
}) {
  // Current price is deliberately NOT one of the ranked markers below -- it
  // gets its own "you are here" treatment (a dashed line + flag) at its true
  // linear position, since it's a different kind of thing than the LLM's
  // discrete reference levels: a continuous fact, not a level to rank
  // alongside the others.
  const markers: Marker[] = [
    priceReference?.stop_loss !== null && priceReference?.stop_loss !== undefined
      ? {
          key: 'stop_loss',
          label: 'Stop',
          value: priceReference.stop_loss,
          dotClassName: 'bg-red-500',
          labelClassName: 'text-red-600 dark:text-red-400',
        }
      : null,
    priceReference?.entry_secondary !== null && priceReference?.entry_secondary !== undefined
      ? {
          key: 'entry_secondary',
          label: 'Entry (2nd)',
          value: priceReference.entry_secondary,
          dotClassName: 'bg-amber-500',
          labelClassName: 'text-amber-600 dark:text-amber-400',
        }
      : null,
    priceReference?.entry_primary !== null && priceReference?.entry_primary !== undefined
      ? {
          key: 'entry_primary',
          label: 'Entry',
          value: priceReference.entry_primary,
          dotClassName: 'bg-amber-600',
          labelClassName: 'text-amber-700 dark:text-amber-400',
        }
      : null,
    priceReference?.take_profit !== null && priceReference?.take_profit !== undefined
      ? {
          key: 'take_profit',
          label: 'Target',
          value: priceReference.take_profit,
          dotClassName: 'bg-emerald-500',
          labelClassName: 'text-emerald-600 dark:text-emerald-400',
        }
      : null,
  ].filter((m): m is Marker => m !== null)

  if (markers.length < 2) {
    return <PriceReferenceGrid priceReference={priceReference} currentPrice={currentPrice} />
  }

  // Evenly spaced by rank, not scaled to true price distance -- a linear
  // scale crowds/collides labels whenever entry/entry(2nd) sit within a few
  // dollars of each other while stop/target sit far away. Ranking is also
  // how real trading-platform price ladders (DOM/Level 2) work.
  const sorted = [...markers].sort((a, b) => a.value - b.value)
  const padPct = 8
  const step = sorted.length > 1 ? (100 - padPct * 2) / (sorted.length - 1) : 0

  // The current-price line has to be positioned on this SAME rank-based
  // scale, not a separately-computed true-linear one -- mixing the two
  // breaks ordering whenever the reference levels aren't evenly spaced in
  // price (e.g. stop/entry/entry(2nd) clustered together with target far
  // above: a linear scale would place "today's price" left of levels it's
  // actually numerically greater than). Instead, find which two consecutive
  // ranked markers current price falls between and interpolate within that
  // one rank-segment's span -- this guarantees correct left-to-right order
  // relative to every dot, while still reflecting relative closeness within
  // that segment.
  let currentPct: number | null = null
  if (currentPrice !== null) {
    if (currentPrice <= sorted[0].value) {
      currentPct = Math.max(0, padPct - step * 0.4)
    } else if (currentPrice >= sorted[sorted.length - 1].value) {
      currentPct = Math.min(100, padPct + (sorted.length - 1) * step + step * 0.4)
    } else {
      const upperIndex = sorted.findIndex((m) => m.value >= currentPrice)
      const lower = sorted[upperIndex - 1]
      const upper = sorted[upperIndex]
      const frac = (currentPrice - lower.value) / (upper.value - lower.value || 1)
      currentPct = padPct + (upperIndex - 1) * step + frac * step
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price reference</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="relative mx-2 mt-24 mb-9 h-1.5 rounded-full bg-muted">
          {currentPct !== null && currentPrice !== null && (
            <div
              className="absolute flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${currentPct}%`, top: '-5.5rem', bottom: '-2.25rem' }}
            >
              <span className="bg-primary text-primary-foreground mb-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap shadow-sm">
                Now {formatCurrency(currentPrice)}
              </span>
              <span className="border-primary/60 mt-0.5 w-px flex-1 border-l-2 border-dashed" />
            </div>
          )}

          {sorted.map((marker, i) => {
            const pct = padPct + i * step
            return (
              <div
                key={marker.key}
                className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={{ left: `${pct}%` }}
              >
                <span className={cn('-mt-8 mb-1 text-xs whitespace-nowrap', marker.labelClassName)}>
                  {marker.label}
                </span>
                <span
                  className={cn('size-3 rounded-full ring-2 ring-background', marker.dotClassName)}
                />
                <span className="mt-1 text-xs whitespace-nowrap tabular-nums">
                  {formatCurrency(marker.value)}
                </span>
              </div>
            )
          })}
        </div>

        {priceReference?.note && (
          <p className="text-muted-foreground text-sm">{priceReference.note}</p>
        )}
        <p className="text-muted-foreground text-xs">
          Reference levels only, not a recommendation to buy or sell.
        </p>
      </CardContent>
    </Card>
  )
}
