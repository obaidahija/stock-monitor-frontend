import { ScanSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ChartPatternBias, ChartPatternOut } from '@/types/api'

const BIAS_META: Record<ChartPatternBias, string> = {
  bullish: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  bearish: 'bg-red-500/15 text-red-600 dark:text-red-400',
  neutral: 'bg-muted text-muted-foreground',
}

export function ChartPatternCard({
  ticker,
  chartPattern,
  isLoading,
  isError,
  onDetect,
}: {
  ticker: string
  chartPattern: ChartPatternOut | null | undefined
  isLoading: boolean
  isError?: boolean
  onDetect: () => void
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Chart pattern detection</CardTitle>
        <Button size="sm" variant="outline" disabled={isLoading} onClick={onDetect}>
          <ScanSearch className={cn(isLoading && 'animate-pulse')} />
          {isLoading ? 'Detecting…' : 'Detect chart patterns'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {!chartPattern && !isLoading && !isError && (
          <p className="text-muted-foreground text-sm">
            Runs a local object-detection model against a freshly rendered price chart to flag
            classic patterns (head and shoulders, triangles, double tops/bottoms) and folds the
            result into the overall score above as a low-weight factor. Takes a few seconds.
          </p>
        )}

        {!chartPattern && !isLoading && isError && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Couldn't run chart pattern detection for {ticker}.
          </p>
        )}

        {chartPattern && !chartPattern.source.ok && (
          <p className="text-muted-foreground text-sm">
            Pattern detection unavailable right now
            {chartPattern.source.error ? `: ${chartPattern.source.error}` : '.'}
          </p>
        )}

        {chartPattern && chartPattern.source.ok && (
          <div className="space-y-3">
            {chartPattern.annotated_image_base64 && (
              <img
                src={`data:image/png;base64,${chartPattern.annotated_image_base64}`}
                alt={`${ticker} chart with detected patterns`}
                className="border-border w-full rounded-lg border"
              />
            )}

            {chartPattern.patterns.length > 0 ? (
              <div className="space-y-2">
                {chartPattern.patterns.map((pattern, i) => (
                  <div key={i} className="border-border rounded-lg border px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize',
                          BIAS_META[pattern.bias],
                        )}
                      >
                        {pattern.label} · {pattern.bias}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {(pattern.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1.5 text-sm">{pattern.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No patterns detected.</p>
            )}

            <p className="text-muted-foreground text-xs">{chartPattern.caveat}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
