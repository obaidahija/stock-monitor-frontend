import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ErrorState } from '@/components/shared/error-state'
import { cn } from '@/lib/utils'
import type { MacroIndustryReadOut, MacroSectorReadOut } from '@/types/api'
import { DriverChip } from './drivers'
import { useMacroMoving, useSectorRotation } from './hooks'

const NET_STYLE: Record<MacroSectorReadOut['net'], string> = {
  positive: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  negative: 'bg-red-500/15 text-red-700 dark:text-red-400',
  mixed: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
}
const NET_TEXT: Record<MacroSectorReadOut['net'], string> = {
  positive: 'Tailwind',
  negative: 'Headwind',
  mixed: 'Mixed',
}

function signed(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`
}

const INDUSTRIES_SHOWN = 4

function Pushes({ read, scope }: { read: MacroSectorReadOut; scope: string }) {
  return (
    <>
      {read.pushes.map((push) => (
        <span
          key={`${push.driver}-${push.direction}`}
          className="inline-flex items-center gap-0.5"
          title={
            push.consistency != null
              ? `${Math.round(push.consistency * 100)}% of the ${scope}'s stocks move this way`
              : undefined
          }
        >
          <DriverChip driver={push.driver} direction={push.direction} />
          {push.typical_move_pp != null && (
            <span className="text-muted-foreground text-[11px] tabular-nums">{signed(push.typical_move_pp, 2)}</span>
          )}
        </span>
      ))}
    </>
  )
}

function IndustryRows({ industries }: { industries: MacroIndustryReadOut[] }) {
  const [all, setAll] = useState(false)
  const shown = all ? industries : industries.slice(0, INDUSTRIES_SHOWN)
  return (
    <>
      {shown.map((read) => (
        <tr key={read.industry} className="bg-muted/30 border-t border-dashed">
          <td className="py-1.5 pl-6 text-xs">
            {read.industry}
            <span className="text-muted-foreground"> · {read.members} stocks</span>
          </td>
          <td className="py-1.5" colSpan={3}>
            <div className="flex flex-wrap items-center gap-1">
              <span
                className={cn(
                  'text-xs font-semibold tabular-nums',
                  read.net === 'positive' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400',
                )}
              >
                {signed(read.typical_move_pp, 2)}pp
              </span>
              <Pushes read={read} scope="industry" />
            </div>
          </td>
        </tr>
      ))}
      {industries.length > INDUSTRIES_SHOWN && (
        <tr className="bg-muted/30">
          <td colSpan={4} className="py-1 pl-6">
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setAll((v) => !v)}>
              {all ? 'Show fewer' : `Show all ${industries.length} industries`}
            </Button>
          </td>
        </tr>
      )}
    </>
  )
}

/** One list per sector: what today's macro news pushes, next to how the sector ETF is trading. */
export function SectorRead() {
  const [window, setWindow] = useState<5 | 20>(5)
  const moving = useMacroMoving(24)
  const rotation = useSectorRotation(window)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const news = new Map((moving.data?.sectors ?? []).map((s) => [s.sector, s]))
  const industriesBySector = new Map<string, MacroIndustryReadOut[]>()
  for (const read of moving.data?.industries ?? []) {
    if (!read.sector) continue
    industriesBySector.set(read.sector, [...(industriesBySector.get(read.sector) ?? []), read])
  }
  const hasPressure = (sector: string) => news.has(sector) || industriesBySector.has(sector)
  const rows = [...(rotation.data?.sectors ?? [])].sort((a, b) => {
    const pressure = Number(hasPressure(b.sector)) - Number(hasPressure(a.sector))
    return pressure || a.rank - b.rank
  })

  function toggle(sector: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(sector)) next.delete(sector)
      else next.add(sector)
      return next
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-1.5">
            Sector read
            <Tooltip>
              <TooltipTrigger aria-label="About the sector read">
                <Info className="text-muted-foreground size-3.5" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                News pressure is how each sector&apos;s stocks typically move against SPY (in points) on a day
                today&apos;s news drivers move this way, measured over the last year. Context, not a forecast. Momentum
                is each sector ETF&apos;s trailing 20-day return and its rank change over the window.
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <CardDescription>
            Today&apos;s macro news pressure beside each sector&apos;s price momentum. Open a sector for its industries
            — they split mixed sectors (airlines vs. waste management) and read more precisely.
          </CardDescription>
        </div>
        <div className="flex gap-1">
          {([5, 20] as const).map((w) => (
            <Button key={w} size="sm" variant={window === w ? 'secondary' : 'ghost'} onClick={() => setWindow(w)}>
              {w}d rank
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {(rotation.isPending || moving.isPending) && <Skeleton className="h-64 rounded-lg" />}
        {rotation.isError && <ErrorState error={rotation.error} onRetry={() => rotation.refetch()} />}
        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-left text-xs">
              <tr>
                <th className="pb-2 font-medium">Sector</th>
                <th className="pb-2 font-medium">News pressure today</th>
                <th className="pb-2 text-right font-medium">20d momentum</th>
                <th className="pb-2 text-right font-medium">Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => {
                const read = news.get(row.sector)
                const industries = industriesBySector.get(row.sector) ?? []
                const isOpen = expanded.has(row.sector)
                return (
                  <Fragment key={row.sector}>
                    <tr>
                      <td className="py-2">
                        {industries.length > 0 ? (
                          <button
                            type="button"
                            className="flex items-start gap-1 text-left"
                            aria-expanded={isOpen}
                            onClick={() => toggle(row.sector)}
                          >
                            {isOpen ? (
                              <ChevronDown className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                            ) : (
                              <ChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                            )}
                            <span>
                              <span className="block font-medium">{row.sector}</span>
                              <span className="text-muted-foreground block text-xs">
                                {row.etf_symbol} · {industries.length} industries
                              </span>
                            </span>
                          </button>
                        ) : (
                          <>
                            <div className="font-medium">{row.sector}</div>
                            <div className="text-muted-foreground text-xs">{row.etf_symbol}</div>
                          </>
                        )}
                      </td>
                      <td className="py-2">
                        {read ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', NET_STYLE[read.net])}>
                              {NET_TEXT[read.net]}
                            </span>
                            {read.typical_move_pp != null && (
                              <span className="text-xs font-medium tabular-nums">
                                {signed(read.typical_move_pp, 2)}pp
                              </span>
                            )}
                            <Pushes read={read} scope="sector" />
                          </div>
                        ) : industries.length > 0 ? (
                          <span className="text-muted-foreground text-xs">
                            Mixed at sector level — see its industries
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td
                        className={cn(
                          'py-2 text-right tabular-nums',
                          row.trend_pct > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400',
                        )}
                      >
                        {signed(row.trend_pct)}%
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        #{row.rank}
                        {row.rank_change !== null && row.rank_change !== 0 && (
                          <span
                            className={cn(
                              'ml-1 text-xs',
                              row.rank_change > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400',
                            )}
                          >
                            {row.rank_change > 0 ? '▲' : '▼'}
                            {Math.abs(row.rank_change)}
                          </span>
                        )}
                      </td>
                    </tr>
                    {isOpen && <IndustryRows industries={industries} />}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
