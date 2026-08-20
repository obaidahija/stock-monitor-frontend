import { Link, useSearchParams } from 'react-router'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { useMacroSectorImpact } from '@/features/macro/hooks'
import { cn } from '@/lib/utils'
import type { MacroSectorImpactBucketOut } from '@/types/api'

const NET_TEXT_CLASSES: Record<'positive' | 'negative', string> = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-red-600 dark:text-red-400',
}

const NET_BORDER_TINT: Record<'positive' | 'negative', string> = {
  positive: 'border-emerald-500/40 bg-emerald-500/10',
  negative: 'border-red-500/40 bg-red-500/10',
}

function signalStrength(bucket: MacroSectorImpactBucketOut): number {
  return Math.abs(bucket.positive_count - bucket.negative_count)
}

type Dominant = 'negative' | 'mixed' | 'positive'

const DOMINANT_LABEL: Record<Dominant, string> = {
  negative: 'Predominantly bearish macro pressure today',
  mixed: 'Mixed bullish and bearish macro pressure today',
  positive: 'Predominantly bullish macro pressure today',
}

// Red / amber / green in a fixed left-to-right order, like an actual
// traffic light -- only the light matching today's dominant read is lit
// (glow + pulse), the other two sit dim. A quiet row of pills doesn't pull
// the eye on its own; one glowing dot next to the section title does.
function TrafficLight({ dominant }: { dominant: Dominant }) {
  const lights: { key: Dominant; on: string; off: string }[] = [
    { key: 'negative', on: 'bg-red-500 shadow-[0_0_6px_2px_rgba(239,68,68,0.7)]', off: 'bg-red-500/20' },
    { key: 'mixed', on: 'bg-amber-500 shadow-[0_0_6px_2px_rgba(245,158,11,0.7)]', off: 'bg-amber-500/20' },
    { key: 'positive', on: 'bg-emerald-500 shadow-[0_0_6px_2px_rgba(16,185,129,0.7)]', off: 'bg-emerald-500/20' },
  ]
  return (
    <span
      className="border-border flex items-center gap-1 rounded-full border bg-muted/50 px-1.5 py-1"
      role="img"
      aria-label={DOMINANT_LABEL[dominant]}
    >
      {lights.map((light) => (
        <span
          key={light.key}
          className={cn(
            'size-2 rounded-full transition-colors',
            light.key === dominant ? cn(light.on, 'animate-pulse') : light.off,
          )}
        />
      ))}
    </span>
  )
}

/** Only sectors with a one-sided macro read today (net positive/negative --
 * "mixed"/"neutral" carry no directional attention), ranked strongest
 * first -- same tornado-sort as the Macro page's own leaderboard.
 *
 * Deliberately a compact pill row, not a card grid -- the Sector Heatmap
 * right below already owns the "tile with a colored background" visual
 * language for today's realized price move; reusing that same look here for
 * a different signal (forward-looking macro pressure) read as one
 * confusing double heatmap. Pills borrow MacroCategoryFilter's language
 * instead (border + low-alpha tint, no filled background), so this reads as
 * a lightweight tag/filter row, not a second data grid.
 *
 * Renders nothing when today's snapshot hasn't been computed yet or nothing
 * is flagged: this is an alert surface, not a status panel, so silence when
 * there's nothing to flag is the right default. */
export function MacroAttentionStrip() {
  const { data } = useMacroSectorImpact()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSector = searchParams.get('sector')

  const flagged = data
    ? Object.entries(data.sectors)
        .filter((entry): entry is [string, MacroSectorImpactBucketOut] => {
          const [, bucket] = entry
          return bucket.net === 'positive' || bucket.net === 'negative'
        })
        .sort(([, a], [, b]) => signalStrength(b) - signalStrength(a))
    : []

  if (flagged.length === 0) return null

  const totalPositive = flagged
    .filter(([, b]) => b.net === 'positive')
    .reduce((sum, [, b]) => sum + signalStrength(b), 0)
  const totalNegative = flagged
    .filter(([, b]) => b.net === 'negative')
    .reduce((sum, [, b]) => sum + signalStrength(b), 0)
  const dominant: Dominant =
    totalPositive === totalNegative ? 'mixed' : totalPositive > totalNegative ? 'positive' : 'negative'

  function toggleSector(sector: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (activeSector === sector) {
        next.delete('sector')
      } else {
        next.set('sector', sector)
      }
      next.delete('page')
      return next
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          <TrafficLight dominant={dominant} />
          Macro attention today
        </h2>
        <Link to="/macro" className="text-muted-foreground text-xs hover:underline">
          View macro detail →
        </Link>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sectors with a notable macro read today">
        {flagged.map(([sector, bucket]) => {
          const net = bucket.net as 'positive' | 'negative'
          const isActive = activeSector === sector
          const Icon = net === 'positive' ? TrendingUp : TrendingDown
          return (
            <button
              key={sector}
              type="button"
              onClick={() => toggleSector(sector)}
              aria-pressed={isActive}
              title={`${bucket.items.length} macro item${bucket.items.length === 1 ? '' : 's'} today`}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                isActive
                  ? cn('text-foreground', NET_BORDER_TINT[net])
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className={cn('size-3.5 shrink-0', NET_TEXT_CLASSES[net])} aria-hidden="true" />
              {sector}
              <span className={cn('tabular-nums', NET_TEXT_CLASSES[net])}>
                {net === 'positive' ? '+' : '−'}
                {signalStrength(bucket)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
