import { useQuery } from '@tanstack/react-query'
import { Coins } from 'lucide-react'
import { getMarketAssets } from '@/api/market-assets'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatEasternTime, formatSignedPct, formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MarketAssetQuoteOut } from '@/types/api'

function AssetQuote({ asset }: { asset: MarketAssetQuoteOut }) {
  const available = asset.status !== 'unavailable'
  const change = asset.daily_change_pct
  return (
    <div role="group" aria-label={asset.name} className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <a
          href={`https://finance.yahoo.com/quote/${encodeURIComponent(asset.symbol)}/`}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          {asset.name}
        </a>
        {asset.status === 'stale' && <Badge variant="outline">Stale</Badge>}
      </div>
      <span className="text-muted-foreground text-xs">{asset.symbol}</span>
      <span className="mt-1 text-base font-semibold tabular-nums sm:text-lg">
        {formatCurrency(asset.price)}
      </span>
      {available ? (
        <span className={cn(
          'text-sm font-medium tabular-nums',
          asset.status === 'stale' || change === 0 || change === null
            ? 'text-muted-foreground'
            : change > 0 ? 'text-positive' : 'text-destructive',
        )}>
          {formatSignedPct(change)}
        </span>
      ) : (
        <span className="text-muted-foreground text-xs">Unavailable</span>
      )}
      {asset.quoted_at && (
        <time
          dateTime={asset.quoted_at}
          title={`Yahoo quote: ${formatTimestamp(asset.quoted_at)}`}
          className="text-muted-foreground mt-1 text-xs"
        >
          {formatEasternTime(asset.quoted_at)}
        </time>
      )}
    </div>
  )
}

export function MarketAssetsPanel() {
  const query = useQuery({
    queryKey: ['market-assets'],
    queryFn: getMarketAssets,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="flex items-center gap-2">
          <Coins className="text-muted-foreground size-4" aria-hidden="true" />
          Market prices
        </CardTitle>
        <CardDescription>Yahoo Finance · USD</CardDescription>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <div aria-label="Loading market prices" className="grid grid-cols-3 gap-4 min-[1664px]:grid-cols-1">
            {[0, 1, 2].map((key) => <Skeleton key={key} className="h-24" />)}
          </div>
        ) : query.isError && !query.data ? (
          <Alert>
            <AlertDescription className="flex flex-col gap-3">
              <span>Prices are temporarily unavailable.</span>
              <Button variant="outline" size="sm" aria-label="Retry prices" onClick={() => void query.refetch()}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-3 gap-4 min-[1664px]:grid-cols-1 min-[1664px]:gap-6">
            {query.data?.assets.map((asset) => <AssetQuote key={asset.symbol} asset={asset} />)}
          </div>
        )}
      </CardContent>
      {query.data?.captured_at && (
        <CardFooter className="flex-col items-start gap-1">
          <span className="text-muted-foreground text-xs">
            Captured <time dateTime={query.data.captured_at}>{formatTimestamp(query.data.captured_at)}</time>
          </span>
          {query.isError && <span className="text-muted-foreground text-xs">Prices could not be updated.</span>}
        </CardFooter>
      )}
    </Card>
  )
}
