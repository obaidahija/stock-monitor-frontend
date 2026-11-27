import { Link, useSearchParams } from 'react-router'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { DriverChip } from '@/features/macro/drivers'
import { useMacroMoving } from '@/features/macro/hooks'
import { cn } from '@/lib/utils'
import type { MacroIndustryReadOut, MacroSectorReadOut } from '@/types/api'

const NET_TEXT_CLASSES: Record<'positive' | 'negative', string> = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-red-600 dark:text-red-400',
}

const NET_BORDER_TINT: Record<'positive' | 'negative', string> = {
  positive: 'border-emerald-500/40 bg-emerald-500/10',
  negative: 'border-red-500/40 bg-red-500/10',
}

const INDUSTRIES_SHOWN = 8
// Sector total (points vs SPY) under which the day counts as mixed.
const MIXED_BAND_PP = 0.15

type Dominant = 'negative' | 'mixed' | 'positive'

const DOMINANT_LABEL: Record<Dominant, string> = {
  negative: 'Predominantly bearish macro pressure today',
  mixed: 'Mixed bullish and bearish macro pressure today',
  positive: 'Predominantly bullish macro pressure today',
}

function pp(value: number): string {
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}`
}

function why(read: MacroSectorReadOut): string {
  return read.pushes
    .map((p) => `${p.driver} ${p.direction}: ${pp(p.typical_move_pp ?? 0)}pp`)
    .join(' · ')
}

// Red / amber / green in a fixed left-to-right order, like an actual
// traffic light -- only the light matching today's dominant read is lit.
function TrafficLight({ dominant }: { dominant: Dominant }) {
  const lights: { key: Dominant; on: string; off: string }[] = [
    { key: 'negative', on: 'bg-red-500 shadow-[0_0_6px_2px_rgba(239,68,68,0.7)]', off: 'bg-red-500/20' },
    { key: 'mixed', on: 'bg-amber-500 shadow-[0_0_6px_2px_rgba(245,158,11,0.7)]', off: 'bg-amber-500/20' },
    { key: 'positive', on: 'bg-emerald-500 shadow-[0_0_6px_2px_rgba(16,185,129,0.7)]', off: 'bg-emerald-500/20' },
  ]
  return (
    <span
      className="border-border bg-muted/50 flex items-center gap-1 rounded-full border px-1.5 py-1"
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

/** Today's macro pressure for Discover: the same measured sector and industry
 * reads as the Macro page (how stocks typically move vs SPY on a day today's
 * news drivers move this way). Sectors first, strongest move first; then the
 * most affected industries, flagged when they go against their sector (a
 * sector median can hide airlines inside Industrials).
 *
 * Renders nothing until measured exposures exist or when nothing moved: this
 * is an alert surface, not a status panel. */
export function MacroAttentionStrip() {
  const { data } = useMacroMoving(24)
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSector = searchParams.get('sector')
  const activeIndustry = searchParams.get('industry')

  if (!data || data.sector_basis !== 'measured') return null
  const sectors = [...data.sectors].sort(
    (a, b) => Math.abs(b.typical_move_pp ?? 0) - Math.abs(a.typical_move_pp ?? 0),
  )
  const sectorNet = new Map(sectors.map((s) => [s.sector, s.net]))
  const industries = [...(data.industries ?? [])]
    .sort((a, b) => Math.abs(b.typical_move_pp ?? 0) - Math.abs(a.typical_move_pp ?? 0))
    .slice(0, INDUSTRIES_SHOWN)
  if (sectors.length === 0 && industries.length === 0) return null

  const total = sectors.reduce((sum, s) => sum + (s.typical_move_pp ?? 0), 0)
  const dominant: Dominant = Math.abs(total) < MIXED_BAND_PP ? 'mixed' : total > 0 ? 'positive' : 'negative'
  const drivers = data.drivers.slice(0, 4)

  function toggleSector(sector: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (activeSector === sector) next.delete('sector')
      else next.set('sector', sector)
      // A sector switch invalidates any industry chosen in the heatmap.
      next.delete('industry')
      next.delete('page')
      return next
    })
  }

  function toggleIndustry(read: MacroIndustryReadOut) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (activeSector === read.sector && activeIndustry === read.industry) {
        next.delete('sector')
        next.delete('industry')
      } else {
        next.set('sector', read.sector)
        next.set('industry', read.industry)
      }
      next.delete('page')
      return next
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide uppercase">
          <TrafficLight dominant={dominant} />
          Macro attention today
          {drivers.map((d) => (
            <DriverChip key={`${d.driver}-${d.direction}`} driver={d.driver} direction={d.direction} className="normal-case" />
          ))}
        </h2>
        <Link to="/macro" className="text-muted-foreground text-xs hover:underline">
          View macro detail →
        </Link>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sectors with a notable macro read today">
        {sectors.map((read) => {
          const net = read.net === 'positive' ? 'positive' : 'negative'
          const isActive = activeSector === read.sector
          const Icon = net === 'positive' ? TrendingUp : TrendingDown
          return (
            <button
              key={read.sector}
              type="button"
              onClick={() => toggleSector(read.sector)}
              aria-pressed={isActive}
              title={`Typical move vs SPY on a day like today — ${why(read)}`}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                isActive
                  ? cn('text-foreground', NET_BORDER_TINT[net])
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className={cn('size-3.5 shrink-0', NET_TEXT_CLASSES[net])} aria-hidden="true" />
              {read.sector}
              <span className={cn('tabular-nums', NET_TEXT_CLASSES[net])}>{pp(read.typical_move_pp ?? 0)}</span>
            </button>
          )
        })}
      </div>
      {industries.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Most affected industries today">
          <span className="text-muted-foreground mr-1 text-xs">Most affected industries</span>
          {industries.map((read) => {
            const net = read.net === 'positive' ? 'positive' : 'negative'
            const against = sectorNet.has(read.sector) && sectorNet.get(read.sector) !== read.net
            const isActive = activeSector === read.sector && activeIndustry === read.industry
            const Icon = net === 'positive' ? TrendingUp : TrendingDown
            return (
              <button
                key={read.industry}
                type="button"
                onClick={() => toggleIndustry(read)}
                aria-pressed={isActive}
                title={`${read.members} stocks — ${why(read)}${against ? ` · moves against ${read.sector}` : ''}`}
                data-testid={`macro-industry-${read.industry}`}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-0.5 text-xs transition-colors',
                  isActive
                    ? cn('text-foreground', NET_BORDER_TINT[net])
                    : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className={cn('size-3.5 shrink-0', NET_TEXT_CLASSES[net])} aria-hidden="true" />
                {read.industry}
                <span className="text-muted-foreground/70">· {read.sector}</span>
                <span className={cn('tabular-nums', NET_TEXT_CLASSES[net])}>{pp(read.typical_move_pp ?? 0)}</span>
                {against && <span className="text-amber-600 dark:text-amber-400">vs sector</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
