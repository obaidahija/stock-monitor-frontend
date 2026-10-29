import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { X } from 'lucide-react'
import { getMarketAssetHistory, type AssetHistoryPeriod } from '@/api/market-assets'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatNumber } from '@/lib/format'
import type { MarketAssetQuoteOut } from '@/types/api'

export function MarketAssetChart({ asset, children }: { asset: MarketAssetQuoteOut; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [period, setPeriod] = useState<AssetHistoryPeriod>('1mo')
  const pinned = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const preview = useQuery({
    queryKey: ['market-asset-history', asset.symbol, '1mo'],
    queryFn: () => getMarketAssetHistory(asset.symbol, '1mo'),
    staleTime: 300_000,
  })
  const history = useQuery({
    queryKey: ['market-asset-history', asset.symbol, period],
    queryFn: () => getMarketAssetHistory(asset.symbol, period),
    enabled: open,
    staleTime: 300_000,
  })
  const enter = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(true), 300) }
  const leave = () => {
    clearTimeout(timer.current)
    if (!pinned.current) timer.current = setTimeout(() => setOpen(false), 250)
  }
  const points = preview.data?.points ?? []
  const prices = points.map((p) => p.close)
  const min = Math.min(...prices)
  const span = Math.max(...prices) - min || 1
  const path = prices.map((price, i) => `${i * 200 / Math.max(1, prices.length - 1)},${28 - (price - min) / span * 24}`).join(' ')
  const rising = prices.length > 1 && prices[prices.length - 1] >= prices[0]
  const data = history.data?.points ?? []
  const last = data.at(-1)
  const highs = data.flatMap((p) => p.high === null ? [] : [p.high])
  const lows = data.flatMap((p) => p.low === null ? [] : [p.low])
  return (
    <Popover open={open} onOpenChange={(value) => { setOpen(value); if (!value) pinned.current = false }}>
      <PopoverAnchor asChild>
        <div onPointerEnter={(e) => { if (e.pointerType === 'mouse') enter() }} onPointerLeave={leave}>
          {children}
          <button
            type="button" aria-label={`Explore ${asset.name} price history`} aria-expanded={open}
            className="text-muted-foreground mt-1 block w-full rounded px-1 pb-1 text-left text-[10px] hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => { clearTimeout(timer.current); pinned.current = true; setOpen(true) }}
          >
            {points.length > 1 ? <svg viewBox="0 0 200 32" preserveAspectRatio="none" className="h-7 w-full" role="img" aria-label={`${asset.name} one month daily closing prices`}>
              <polyline points={path} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className={rising ? 'text-positive' : 'text-destructive'} />
            </svg> : <span>{preview.isPending ? 'Loading chart…' : 'Chart unavailable'}</span>}
            <span className="flex justify-between"><span>1M · Daily closes</span><span>Explore ↗</span></span>
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent side="right" align="start" sideOffset={12} className="w-[min(440px,calc(100vw-24px))] gap-4 p-4" aria-label={`${asset.name} price history`} onPointerEnter={() => clearTimeout(timer.current)} onPointerLeave={leave} onOpenAutoFocus={(e) => { if (!pinned.current) e.preventDefault() }}>
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-semibold">{asset.name}</h3><p className="text-muted-foreground text-xs">{asset.symbol} · USD · Daily prices</p></div>
          <Button size="icon-sm" variant="ghost" aria-label="Close price history" onClick={() => { pinned.current = false; setOpen(false) }}><X /></Button>
        </div>
        <div className="flex gap-1" role="group" aria-label="History period">
          {(['1mo', '3mo', '1y'] as const).map((value) => <Button key={value} size="xs" variant={period === value ? 'secondary' : 'ghost'} aria-pressed={period === value} onClick={() => { pinned.current = true; setPeriod(value) }}>{value === '1mo' ? '1M' : value === '3mo' ? '3M' : '1Y'}</Button>)}
        </div>
        {history.isPending ? <p role="status" className="text-muted-foreground py-16 text-center text-sm">Loading price history…</p> : history.isError ? <div role="alert" className="py-8 text-center"><p>History is temporarily unavailable.</p><Button variant="outline" size="sm" onClick={() => void history.refetch()}>Retry chart</Button></div> : <>
          <div className="h-48 w-full" aria-label="Interactive daily closing price chart">
            <ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={50} tickFormatter={(date: string) => date.slice(5)} />
              <YAxis domain={['auto', 'auto']} width={65} tick={{ fontSize: 10 }} tickFormatter={(value: number) => `$${formatNumber(Math.round(value))}`} />
              <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Close']} contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Area type="linear" dataKey="close" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.08} isAnimationActive={false} />
            </AreaChart></ResponsiveContainer>
          </div>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-xs">
            {[
              ['Last daily close', formatCurrency(last?.close)],
              ['Last open', formatCurrency(last?.open)],
              ['Period high', formatCurrency(highs.length ? Math.max(...highs) : null)],
              ['Period low', formatCurrency(lows.length ? Math.min(...lows) : null)],
              ['Last volume', formatNumber(last?.volume)],
              ['Last session', last?.date ?? '—'],
            ].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium tabular-nums">{value}</dd></div>)}
          </dl>
        </>}
        <p className="text-muted-foreground text-[10px]">Yahoo Finance · Daily history may differ from the latest quote. {asset.symbol !== 'BTC-USD' && 'Futures contract rollovers can affect history.'}</p>
      </PopoverContent>
    </Popover>
  )
}
