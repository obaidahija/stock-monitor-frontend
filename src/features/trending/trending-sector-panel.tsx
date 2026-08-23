import { useSearchParams } from 'react-router'
import { Line, LineChart } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrency, formatDateTime, formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TrendingSectorOut, TrendingSectorTopTickerOut } from '@/types/api'
import { useTrendingSectors } from './hooks'

const chartConfig: ChartConfig = {
  trend_pct: { label: 'Sector trend', color: 'var(--chart-2)' },
}

function SectorSparkline({ sector }: { sector: TrendingSectorOut }) {
  if (sector.etf_sparkline.length < 2) {
    return (
      <div className="text-muted-foreground flex h-12 items-center text-xs">
        Not enough sector history yet
      </div>
    )
  }
  const data = sector.etf_sparkline.map((point) => ({
    time: formatDateTime(point.captured_at),
    trend_pct: point.trend_pct,
  }))
  return (
    <ChartContainer config={chartConfig} className="h-12 w-full">
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
        <Line
          type="monotone"
          dataKey="trend_pct"
          stroke="var(--color-trend_pct)"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  )
}

// Tooltip content always inverts relative to the page (bg-foreground /
// text-background -- see components/ui/tooltip.tsx), so it needs its own
// fixed-shade accent rather than the usual text-emerald-600 dark:text-
// emerald-400 pairing, which assumes a light-mode-vs-dark-mode background
// rather than a light-tooltip-vs-dark-tooltip one.
function TooltipChangeText({ value }: { value: number | null }) {
  if (value === null) return null
  return (
    <span className={value >= 0 ? 'text-emerald-500' : 'text-red-500'}>
      {formatSignedPct(value)}
    </span>
  )
}

function TopTickerChip({ ticker }: { ticker: TrendingSectorTopTickerOut }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="bg-muted text-foreground inline-flex cursor-default items-center rounded-full px-2 py-0.5 text-xs font-medium">
          {ticker.ticker}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-0.5">
          <p className="font-medium">{ticker.company_name ?? ticker.ticker}</p>
          <p>
            {formatCurrency(ticker.price)} <TooltipChangeText value={ticker.change_pct} />
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function SectorCard({
  sector,
  isSelected,
  onToggle,
}: {
  sector: TrendingSectorOut
  isSelected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isSelected}
      className={cn(
        'bg-card flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors',
        isSelected ? 'ring-primary ring-2' : 'hover:bg-muted/50',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{sector.sector}</span>
        {sector.etf_symbol && (
          <Badge variant="outline" className="text-[10px]">
            {sector.etf_symbol}
          </Badge>
        )}
      </div>
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>{sector.ticker_count} trending</span>
        {sector.etf_trend_pct !== null && (
          <span
            className={
              sector.etf_trend_pct >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }
          >
            {formatSignedPct(sector.etf_trend_pct)}
          </span>
        )}
      </div>
      <SectorSparkline sector={sector} />
      {sector.top_tickers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sector.top_tickers.map((ticker) => (
            <TopTickerChip key={ticker.ticker} ticker={ticker} />
          ))}
        </div>
      )}
    </button>
  )
}

export function TrendingSectorPanel() {
  const query = useTrendingSectors()
  const [params, setParams] = useSearchParams()
  const selectedSector = params.get('sector')

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Trending sectors</h2>
      {query.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data.length ? (
        <EmptyState
          title="No sector data yet"
          description="Sector rollups appear once today's Twitter/Reddit trending scans have run."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {query.data.map((sector) => (
            <SectorCard
              key={sector.sector}
              sector={sector}
              isSelected={selectedSector === sector.sector}
              onToggle={() =>
                setParams((previous) => {
                  const next = new URLSearchParams(previous)
                  if (selectedSector === sector.sector) next.delete('sector')
                  else next.set('sector', sector.sector)
                  next.delete('page')
                  return next
                })
              }
            />
          ))}
        </div>
      )}
    </section>
  )
}
