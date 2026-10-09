import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { Maximize2, Minimize2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const CHART_WIDGET_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
// TradingView's script sets an inline `height: 100%` on its container, so the
// height has to live on a wrapper: without one the chart collapses to 150px.
const CHART_HEIGHT_CLASSES = 'h-[360px] sm:h-[520px]'

// TradingView's embeds only read their config at script-init time, so a
// theme change requires tearing down and re-appending the widget rather than
// updating props in place. The chart widget is `autosize`, so it reflows on
// its own when its container resizes (e.g. maximizing) — no re-init needed
// for that.
//
// The widget renders into a genuine cross-origin <iframe> on
// tradingview-widget.com (confirmed by inspecting the live DOM), so no
// host-page CSS can reach their internals — background/theming can only be
// controlled through the JSON config each widget reads at init.
function mountTradingViewWidget(container: HTMLDivElement, src: string, config: Record<string, unknown>) {
  // StrictMode cleans up its first effect immediately. Starting an async
  // script there leaves it executing against a detached parent when it loads.
  // Let that cleanup cancel initialization before any external script starts.
  const timer = window.setTimeout(() => {
    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    container.replaceChildren(widgetDiv)

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = src
    script.async = true
    script.textContent = JSON.stringify(config)
    container.appendChild(script)
  }, 0)
  return () => {
    window.clearTimeout(timer)
    container.replaceChildren()
  }
}

export function PriceChart({ ticker }: { ticker: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const [isMaximized, setIsMaximized] = useState(false)
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light'

  useEffect(() => {
    if (!isMaximized) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsMaximized(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isMaximized])

  useEffect(() => {
    const container = chartContainerRef.current
    if (!container) return
    return mountTradingViewWidget(container, CHART_WIDGET_SRC, {
      autosize: true,
      symbol: ticker,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme,
      style: '1',
      locale: 'en',
      allow_symbol_change: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
    })
  }, [ticker, theme])

  return (
    <>
      {isMaximized && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={() => setIsMaximized(false)}
          aria-hidden="true"
        />
      )}
      <Card className={cn(isMaximized && 'fixed inset-4 z-50 sm:inset-8')}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Price chart</CardTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={isMaximized ? 'Minimize chart' : 'Maximize chart'}
            onClick={() => setIsMaximized((v) => !v)}
          >
            {isMaximized ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </CardHeader>
        <CardContent className={cn('flex flex-col', isMaximized && 'min-h-0 flex-1')}>
          <div className={cn('w-full', isMaximized ? 'min-h-0 flex-1' : CHART_HEIGHT_CLASSES)}>
            <div
              ref={chartContainerRef}
              className="tradingview-widget-container h-full w-full"
              role="img"
              aria-label={`Price chart for ${ticker}`}
            />
          </div>
        </CardContent>
      </Card>
    </>
  )
}
