import { TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ForecastOut } from '@/types/api'

export function ForecastCard({
  ticker,
  forecast,
  isLoading,
  isError,
  onGenerate,
}: {
  ticker: string
  forecast: ForecastOut | null | undefined
  isLoading: boolean
  isError?: boolean
  onGenerate: () => void
}) {
  const returnPct = forecast?.forecast_return_pct ?? null
  const returnClass =
    returnPct === null
      ? 'text-muted-foreground'
      : returnPct > 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : returnPct < 0
          ? 'text-red-600 dark:text-red-400'
          : 'text-muted-foreground'

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Price forecast</CardTitle>
        <Button size="sm" variant="outline" disabled={isLoading} onClick={onGenerate}>
          <TrendingUp className={cn(isLoading && 'animate-pulse')} />
          {isLoading ? 'Forecasting…' : 'Generate forecast'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {!forecast && !isLoading && !isError && (
          <p className="text-muted-foreground text-sm">
            Runs a local Kronos foundation model against this ticker's price history to project
            an OHLCV path forward and folds the predicted return into the overall score above as
            a low-weight factor. Autoregressive — noticeably slower than chart-pattern detection,
            can take a while.
          </p>
        )}

        {!forecast && !isLoading && isError && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Couldn't generate a forecast for {ticker}.
          </p>
        )}

        {forecast && !forecast.source.ok && (
          <p className="text-muted-foreground text-sm">
            Forecast unavailable right now{forecast.source.error ? `: ${forecast.source.error}` : '.'}
          </p>
        )}

        {forecast && forecast.source.ok && (
          <div className="space-y-3">
            {forecast.chart_image_base64 && (
              <img
                src={`data:image/png;base64,${forecast.chart_image_base64}`}
                alt={`${ticker} price history with forecast continuation`}
                className="border-border w-full rounded-lg border"
              />
            )}

            <div className="border-border rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-xs">
                Predicted change over {forecast.pred_len_days} trading days
              </p>
              <p className={cn('text-sm font-semibold', returnClass)}>
                {returnPct !== null ? `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%` : 'n/a'}
              </p>
            </div>

            <p className="text-muted-foreground text-xs">{forecast.caveat}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
