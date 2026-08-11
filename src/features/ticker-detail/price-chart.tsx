import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { Maximize2, Minimize2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const CHART_WIDGET_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
const QUOTE_WIDGET_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js'
const DEFAULT_CHART_HEIGHT = 'h-[600px]'

// TradingView's embeds only read their config at script-init time, so a
// theme change requires tearing down and re-appending the widget rather than
// updating props in place. The chart widget is `autosize`, so it reflows on
// its own when its container resizes (e.g. maximizing) — no re-init needed
// for that.
//
// Both widgets render into a genuine cross-origin <iframe> on
// tradingview-widget.com (confirmed by inspecting the live DOM), so no
// host-page CSS can reach their internals — background/theming can only be
// controlled through the JSON config each widget reads at init.
function mountTradingViewWidget(container: HTMLDivElement, src: string, config: Record<string, unknown>) {
  container.innerHTML = ''

  const widgetDiv = document.createElement('div')
  widgetDiv.className = 'tradingview-widget-container__widget'
  container.appendChild(widgetDiv)

  const script = document.createElement('script')
  script.type = 'text/javascript'
  script.src = src
  script.async = true
  script.textContent = JSON.stringify(config)
  container.appendChild(script)
}

export function PriceChart({ ticker }: { ticker: string }) {
  const quoteContainerRef = useRef<HTMLDivElement>(null)
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

  // The Symbol Info strip: a small live quote bar (last price, change,
  // change %, open/high/low/volume) from the same TradingView feed as the
  // chart below it — the chart itself is an opaque iframe with no exposed
  // price API, so this is the practical way to surface a live number.
  //
  // isTransparent must stay false: with it true, this particular widget
  // renders a solid white panel regardless of colorTheme (verified — it
  // doesn't actually turn transparent, just breaks dark mode). false +
  // colorTheme gives it a real themed background that matches the chart.
  useEffect(() => {
    const container = quoteContainerRef.current
    if (!container) return
    mountTradingViewWidget(container, QUOTE_WIDGET_SRC, {
      symbol: ticker,
      width: '100%',
      locale: 'en',
      colorTheme: theme,
      isTransparent: false,
    })
    return () => {
      container.innerHTML = ''
    }
  }, [ticker, theme])

  useEffect(() => {
    const container = chartContainerRef.current
    if (!container) return
    mountTradingViewWidget(container, CHART_WIDGET_SRC, {
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
    return () => {
      container.innerHTML = ''
    }
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
        <CardContent className={cn('flex flex-col gap-2', isMaximized && 'flex-1')}>
          <div
            ref={quoteContainerRef}
            className="tradingview-widget-container w-full shrink-0"
            aria-label={`Live quote for ${ticker}`}
          />
          <div
            ref={chartContainerRef}
            className={cn(
              'tradingview-widget-container w-full',
              isMaximized ? 'flex-1' : DEFAULT_CHART_HEIGHT,
            )}
            role="img"
            aria-label={`Price chart for ${ticker}`}
          />
        </CardContent>
      </Card>
    </>
  )
}
