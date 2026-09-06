import { RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrency, formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { GoogleFinanceMarketPickOut, GoogleFinanceMarketPicksHorizonKey } from '@/types/api'
import { useGoogleFinanceMarketPicks, useRefreshGoogleFinanceMarketPicks } from './hooks'

type ConvictionTier = 'high' | 'medium' | 'low'

function convictionTier(score: number): ConvictionTier {
  if (score >= 75) return 'high'
  if (score >= 50) return 'medium'
  return 'low'
}

// Same emerald/amber/muted "attention tier" palette as IMPACT_META/METER_FILL
// in competitor-row.tsx, applied here to conviction score instead of impact.
const PILL_RING: Record<ConvictionTier, string> = {
  high: 'ring-emerald-500/40 hover:ring-emerald-500/70',
  medium: 'ring-amber-500/40 hover:ring-amber-500/70',
  low: 'ring-muted-foreground/25 hover:ring-muted-foreground/50',
}

const PILL_SCORE_TEXT: Record<ConvictionTier, string> = {
  high: 'text-emerald-600 dark:text-emerald-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-muted-foreground',
}

function GoogleFinancePickPill({ item }: { item: GoogleFinanceMarketPickOut }) {
  const navigate = useNavigate()
  const tier = convictionTier(item.conviction_score)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${item.ticker}, conviction ${Math.round(item.conviction_score)}`}
          onClick={() => navigate(`/stocks/${item.ticker}`)}
          className={cn(
            'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 transition-colors select-none',
            PILL_RING[tier],
          )}
        >
          <span className="font-semibold">{item.ticker}</span>
          <span className={cn('tabular-nums', PILL_SCORE_TEXT[tier])}>
            {Math.round(item.conviction_score)}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="max-w-xs space-y-1">
          <p className="font-medium">
            {item.ticker}
            {item.company_name_reported ? ` · ${item.company_name_reported}` : ''}
          </p>
          <p>Conviction {Math.round(item.conviction_score)} of 100</p>
          <p>{item.explanation}</p>
          {item.tracked && (
            <p className="text-muted-foreground">
              MarketScout score {item.composite_score?.toFixed(0) ?? '—'} ·{' '}
              {formatCurrency(item.current_price)} ({formatSignedPct(item.change_pct)})
              {item.sector ? ` · ${item.sector}` : ''}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export function GoogleFinanceOutlookSectionSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-9 w-full rounded-full" />
    </div>
  )
}

/**
 * "Google Finance Outlook" -- a daily, opt-in, AI-generated (and explicitly
 * speculative) read on which US stocks Google Finance thinks are most likely
 * to rise, across 2 independent horizons (1-2 weeks, 2-4 weeks). Shared between
 * the Discover and Trending pages, styled after TrendingBuzzStrip's compact pill strip (ticker
 * + score, hover for detail) rather than a full ranked-row list -- the
 * per-pick reasoning lives in the tooltip instead of always-visible text.
 *
 * Hidden entirely (like TrendingBuzzStrip on an empty window) whenever every
 * horizon is empty -- the default, disabled-by-default state before an
 * operator has opted in and the job has run at least once successfully.
 */
export function GoogleFinanceOutlookSection() {
  const query = useGoogleFinanceMarketPicks()
  const refresh = useRefreshGoogleFinanceMarketPicks()
  const [horizon, setHorizon] = useState<GoogleFinanceMarketPicksHorizonKey>('1-2w')

  if (query.isPending) return <GoogleFinanceOutlookSectionSkeleton />
  if (query.isError || !query.data) return null

  const { horizons } = query.data
  const hasAnyItems = horizons.some((h) => h.items.length > 0)
  if (!hasAnyItems) return null

  const active = horizons.find((h) => h.horizon === horizon) ?? horizons[0]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Google Finance Outlook</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Refresh"
            disabled={refresh.isPending}
            onClick={() => refresh.mutate()}
          >
            <RefreshCw className={cn(refresh.isPending && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs
          value={active.horizon}
          onValueChange={(value) => setHorizon(value as GoogleFinanceMarketPicksHorizonKey)}
        >
          <TabsList>
            {horizons.map((h) => (
              <TabsTrigger key={h.horizon} value={h.horizon}>
                {h.horizon_label}
              </TabsTrigger>
            ))}
          </TabsList>
          {horizons.map((h) => (
            <TabsContent key={h.horizon} value={h.horizon}>
              {!h.source_ok ? (
                <p className="text-muted-foreground py-1.5 text-xs">
                  Google Finance couldn't produce an outlook for {h.horizon_label} today.
                </p>
              ) : h.items.length === 0 ? (
                <p className="text-muted-foreground py-1.5 text-xs">
                  No picks parsed for {h.horizon_label} yet.
                </p>
              ) : (
                <div
                  className="flex items-center gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  role="group"
                  aria-label={`Google Finance picks for ${h.horizon_label}`}
                >
                  {h.items.map((item) => (
                    <GoogleFinancePickPill key={item.ticker} item={item} />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
