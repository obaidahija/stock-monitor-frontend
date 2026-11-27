import { Link } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { MacroExposedIndustryOut, MacroExposedStockOut } from '@/types/api'
import { DriverChip } from './drivers'
import { useMacroExposures } from './hooks'

function pp(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}pp`
}

function IndustryList({ title, rows, tone }: { title: string; rows: MacroExposedIndustryOut[]; tone: 'up' | 'down' }) {
  if (rows.length === 0) return null
  return (
    <div className="space-y-1">
      <h4 className={cn('text-xs font-semibold', tone === 'up' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
        {title}
      </h4>
      <ul className="space-y-0.5 text-xs">
        {rows.map((row) => (
          <li key={row.industry} className="flex items-baseline justify-between gap-2">
            <span className="truncate">{row.industry}</span>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              <span className="text-foreground font-medium">{pp(row.typical_move_pp)}</span> ·{' '}
              {Math.round(row.consistency * 100)}% of {row.members}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StockList({ rows }: { rows: MacroExposedStockOut[] }) {
  if (rows.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1">
      {rows.map((row) => (
        <Link
          key={row.ticker}
          to={`/stocks/${encodeURIComponent(row.ticker)}`}
          className="bg-muted hover:bg-muted/70 rounded px-1.5 py-0.5 text-xs tabular-nums"
          title={`${row.industry ?? ''} · t = ${row.t}`}
        >
          {row.ticker} <span className="text-muted-foreground">{pp(row.typical_move_pp)}</span>
        </Link>
      ))}
    </div>
  )
}

/**
 * Who measurably reacts when a market driver moves: industries (median, with how
 * many members agree) and the stocks with a significant exposure.
 */
export function ExposurePanel({
  driver,
  direction,
  compact = false,
}: {
  driver: string
  direction: 'up' | 'down'
  /** Industries only, three each side (for the item panel). */
  compact?: boolean
}) {
  const query = useMacroExposures(driver, direction)
  if (query.isPending) return <Skeleton className="h-24 rounded-md" />
  if (query.isError) {
    const notYet = query.error instanceof ApiError && query.error.status === 404
    return (
      <p className="text-muted-foreground text-xs">
        {notYet ? 'Measured exposures appear after the first weekly refresh.' : 'Measured exposures are unavailable.'}
      </p>
    )
  }
  const data = query.data
  const limit = compact ? 3 : 8
  return (
    <div className="space-y-3">
      {!compact && (
        <p className="text-muted-foreground text-xs">
          On a typical day <DriverChip driver={driver} direction={direction} /> (about{' '}
          {data.typical_driver_move.toFixed(driver === 'yield_10y' ? 0 : 1)}
          {driver === 'yield_10y' ? 'bp' : driver === 'vix' ? ' points' : '%'}), these moved against SPY by:
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <IndustryList title="Hurt" rows={data.industries.hurt.slice(0, limit)} tone="down" />
        <IndustryList title="Helped" rows={data.industries.helped.slice(0, limit)} tone="up" />
      </div>
      {!compact && (
        <div className="grid gap-3 sm:grid-cols-2">
          <StockList rows={data.stocks.hurt} />
          <StockList rows={data.stocks.helped} />
        </div>
      )}
      <p className="text-muted-foreground text-[11px]">
        Measured over {data.window_start} to {data.window_end} ({data.tickers} stocks). {data.caveat}
      </p>
    </div>
  )
}
