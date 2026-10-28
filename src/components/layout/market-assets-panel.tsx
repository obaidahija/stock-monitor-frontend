import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, Bitcoin, Coins, Droplets, ExternalLink, Minus, RefreshCw } from 'lucide-react'
import { getMarketAssets, refreshMarketAssets } from '@/api/market-assets'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatEasternTime, formatSignedPct, formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MarketAssetQuoteOut } from '@/types/api'

const ASSET_STYLES: Record<string, { icon: typeof Coins; color: string; label: string }> = {
  'GC=F': { icon: Coins, color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', label: 'Gold futures · per oz' },
  'BTC-USD': { icon: Bitcoin, color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400', label: 'Bitcoin · spot' },
  'CL=F': { icon: Droplets, color: 'bg-sky-500/10 text-sky-700 dark:text-sky-400', label: 'WTI futures · per barrel' },
}

function AssetQuote({ asset }: { asset: MarketAssetQuoteOut }) {
  const available = asset.status !== 'unavailable'
  const change = asset.daily_change_pct
  const neutral = asset.status !== 'ok' || change === 0 || change === null
  const style = ASSET_STYLES[asset.symbol]
  const Icon = style?.icon ?? Coins
  const Direction = change === null || change === 0 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <div role="group" aria-label={asset.name} className="bg-card min-w-0 rounded-xl border border-border/80 p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', style?.color ?? 'bg-muted text-muted-foreground')}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <a
            href={`https://finance.yahoo.com/quote/${encodeURIComponent(asset.symbol)}/`}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {asset.name}
            <ExternalLink className="text-muted-foreground size-3" aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <p className="text-muted-foreground mt-0.5 text-xs">{asset.symbol}</p>
        </div>
        {asset.status === 'stale' && <Badge variant="outline">Stale</Badge>}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xl font-semibold tracking-tight tabular-nums">
          {formatCurrency(available ? asset.price : null)}
        </span>
        {available ? (
          <span aria-label={`Daily change ${formatSignedPct(change)}`} className={cn(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums',
            neutral ? 'bg-muted text-muted-foreground' : change! > 0 ? 'bg-positive/10 text-positive' : 'bg-destructive/10 text-destructive',
          )}>
            <Direction className="size-3.5" aria-hidden="true" />
            {formatSignedPct(change)}
          </span>
        ) : <span className="text-muted-foreground rounded-md bg-muted px-2 py-1 text-xs">Unavailable</span>}
      </div>
      <div className="text-muted-foreground mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px]">
        <span>{style?.label ?? 'Market quote'}</span>
        {asset.quoted_at && (
          <time dateTime={asset.quoted_at} title={`Yahoo quote: ${formatTimestamp(asset.quoted_at)}`}>
            {formatEasternTime(asset.quoted_at)}
          </time>
        )}
      </div>
    </div>
  )
}

export function MarketAssetsPanel() {
  const queryClient = useQueryClient()
  const refresh = useMutation({
    mutationFn: refreshMarketAssets,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['market-assets'] })
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['market-assets'], data)
    },
  })
  const query = useQuery({
    queryKey: ['market-assets'],
    queryFn: getMarketAssets,
    staleTime: 60_000,
    refetchInterval: refresh.isPending ? false : 60_000,
  })

  return (
    <section aria-labelledby="market-prices-title" className="market-prices-panel space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="market-prices-title" className="text-sm font-semibold">Market prices</h2>
          <p className="text-muted-foreground text-xs">USD <span aria-hidden="true">·</span> Daily change</p>
        </div>
        <Button variant="ghost" size="icon-sm" title="Refresh market prices" aria-label="Refresh market prices" disabled={query.isFetching || refresh.isPending} onClick={() => refresh.mutate()}>
          <RefreshCw className={cn('size-3.5', (query.isFetching || refresh.isPending) && 'motion-safe:animate-spin')} aria-hidden="true" />
        </Button>
      </div>
      {query.isPending ? (
        <div aria-label="Loading market prices" role="status" className="market-quotes-grid">
          {[0, 1, 2].map((key) => <Skeleton key={key} className="h-32 rounded-xl" />)}
        </div>
      ) : query.isError && !query.data ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>Prices are temporarily unavailable.</span>
            <Button variant="outline" size="sm" aria-label="Retry prices" onClick={() => void query.refetch()}>Retry</Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="market-quotes-grid">
          {query.data?.assets.map((asset) => <AssetQuote key={asset.symbol} asset={asset} />)}
        </div>
      )}
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px]">
        <span>Yahoo Finance · Quotes may be delayed</span>
        {query.data?.captured_at && (
          <span>Captured <time dateTime={query.data.captured_at}>{formatTimestamp(query.data.captured_at)}</time></span>
        )}
        {(refresh.isError || (query.isError && query.data)) && <span role="status">Prices could not be updated. Try refreshing again.</span>}
        {refresh.isPending && <span role="status">Fetching fresh quotes…</span>}
      </div>
    </section>
  )
}
