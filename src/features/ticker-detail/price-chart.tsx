import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { Maximize2, Minimize2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const WIDGET_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
const DEFAULT_HEIGHT = 'h-[600px]'

// TradingView's embed only reads its config at script-init time, so a theme
// change requires tearing down and re-appending the widget rather than
// updating props in place. The widget itself is `autosize`, so it reflows on
// its own when the container is resized (e.g. maximizing) — no re-init
// needed for that.
export function PriceChart({ ticker }: { ticker: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const [isMaximized, setIsMaximized] = useState(false)

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
    const container = containerRef.current
    if (!container) return

    container.innerHTML = ''

    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    container.appendChild(widgetDiv)

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = WIDGET_SRC
    script.async = true
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: ticker,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: resolvedTheme === 'dark' ? 'dark' : 'light',
      style: '1',
      locale: 'en',
      allow_symbol_change: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
    })
    container.appendChild(script)

    return () => {
      container.innerHTML = ''
    }
  }, [ticker, resolvedTheme])

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
        <CardContent className={cn(isMaximized && 'flex-1')}>
          <div
            ref={containerRef}
            className={cn('tradingview-widget-container w-full', isMaximized ? 'h-full' : DEFAULT_HEIGHT)}
            role="img"
            aria-label={`Price chart for ${ticker}`}
          />
        </CardContent>
      </Card>
    </>
  )
}
