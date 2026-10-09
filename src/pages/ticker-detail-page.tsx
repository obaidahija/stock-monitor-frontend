import { useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AddTrackedTickerButton } from '@/features/discover/add-tracked-ticker-button'
import { RemoveTickerDialog } from '@/features/discover/remove-ticker-dialog'
import { PriceChart } from '@/features/ticker-detail/price-chart'
import { PriceTargetChangeBanner } from '@/features/ticker-detail/price-target-change-banner'
import { TickerPriceHeader } from '@/features/ticker-detail/ticker-price-header'
import { RelatedEtfs } from '@/features/ticker-detail/related-etfs'
import { TickerDescription } from '@/features/ticker-detail/ticker-description'
import { TickerHeaderStats } from '@/features/ticker-detail/ticker-header-stats'
import { AiResearchTab } from '@/features/ticker-detail/ai-research/ai-research-tab'
import { AnalysisTab } from '@/features/ticker-detail/analysis-tab'
import { EarningsTab } from '@/features/ticker-detail/earnings-tab'
import { NewsTab } from '@/features/ticker-detail/news-tab'
import { FilingsInsiderTab } from '@/features/ticker-detail/filings-insider-tab'
import { PeersTab } from '@/features/ticker-detail/peers-tab'
import { resolveDetailTab, type FilingsView, type PeersView } from '@/features/ticker-detail/detail-tabs'
import { SocialTab, type SocialPlatform } from '@/features/ticker-detail/social-tab'
import {
  useAutoRefreshQuote,
  useAutoRefreshUniverseScore,
  useUniverseScore,
} from '@/features/ticker-detail/hooks'
import { ManageListsDialog } from '@/features/watchlists/manage-lists-dialog'
import { centerHorizontally } from '@/lib/scroll'

export function TickerDetailPage() {
  const { ticker = '' } = useParams<{ ticker: string }>()
  const symbol = ticker.toUpperCase()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  useAutoRefreshUniverseScore(symbol)
  useAutoRefreshQuote(symbol)
  const { data: universeScore, isPending: universeScorePending } = useUniverseScore(symbol)

  const { tab: activeTab, socialPlatform, filingsView, peersView } = resolveDetailTab(searchParams)

  function handleTabChange(tab: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        // A sub-view belongs to the tab it was picked on.
        next.delete('view')
        next.delete('platform')
        if (tab === 'analysis') {
          next.delete('tab')
        } else {
          next.set('tab', tab)
        }
        return next
      },
      { replace: true },
    )
  }

  function handleViewChange(tab: 'filings' | 'peers', view: string, defaultView: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', tab)
        if (view === defaultView) {
          next.delete('view')
        } else {
          next.set('view', view)
        }
        return next
      },
      { replace: true },
    )
  }

  function handleSocialPlatformChange(platform: SocialPlatform) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', 'social')
        if (platform === 'twitter') {
          next.delete('platform')
        } else {
          next.set('platform', platform)
        }
        return next
      },
      { replace: true },
    )
  }

  // The Analyst Detail card only exists in the DOM while the Analysis tab is
  // mounted (Radix unmounts inactive TabsContent) -- if we're on another tab,
  // switch first and defer the scroll to the effect below, which fires once
  // activeTab actually becomes 'analysis' and the card has had a chance to mount.
  const pendingScrollRef = useRef(false)

  function scrollToAnalystDetail() {
    const target = document.getElementById('analyst-detail-card')
    if (activeTab === 'analysis' && target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      pendingScrollRef.current = true
      handleTabChange('analysis')
    }
  }

  useEffect(() => {
    if (activeTab !== 'analysis' || !pendingScrollRef.current) return
    pendingScrollRef.current = false
    const frame = requestAnimationFrame(() => {
      document.getElementById('analyst-detail-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(frame)
  }, [activeTab])

  // On a phone the tab row scrolls sideways; keep the open tab in view
  // without moving the page itself.
  const tabScrollerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const scroller = tabScrollerRef.current
    const active = scroller?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
    if (scroller && active) centerHorizontally(scroller, active)
  }, [activeTab])

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {symbol}
            {universeScore?.company_name && (
              <span className="text-muted-foreground text-base font-normal">
                {universeScore.company_name}
              </span>
            )}
            {universeScore?.industry && (
              <Badge variant="secondary" className="text-xs font-normal">
                {universeScore.industry}
              </Badge>
            )}
          </span>
        }
        meta={
          <div className="space-y-2">
            <TickerPriceHeader ticker={symbol} />
            <TickerHeaderStats ticker={symbol} />
          </div>
        }
        actions={
          <>
            <ManageListsDialog ticker={symbol} labeled />
            {!universeScorePending &&
              (universeScore ? (
                <RemoveTickerDialog
                  ticker={symbol}
                  trigger="labeled"
                  onRemoved={() => navigate('/discover')}
                />
              ) : (
                <AddTrackedTickerButton ticker={symbol} />
              ))}
          </>
        }
      />

      <TickerDescription ticker={symbol} />

      <RelatedEtfs ticker={symbol} />

      <PriceTargetChangeBanner ticker={symbol} onNavigate={scrollToAnalystDetail} />

      <PriceChart ticker={symbol} />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        {/*
          The row is wider than a phone screen: it scrolls sideways instead of widening the page.
          overflow-y-hidden clips each trigger's hidden underline (::after, 5px below the tab), which
          would otherwise add a vertical scrollbar to the row.
        */}
        <div ref={tabScrollerRef} className="overflow-x-auto overflow-y-hidden">
          <TabsList aria-label="Stock sections">
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="ai-research">AI Research</TabsTrigger>
            <TabsTrigger value="news">News</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
            <TabsTrigger value="social">Social</TabsTrigger>
            <TabsTrigger value="filings">Filings</TabsTrigger>
            <TabsTrigger value="peers">Peers</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="analysis">
          <AnalysisTab ticker={symbol} />
        </TabsContent>
        <TabsContent value="ai-research">
          <AiResearchTab ticker={symbol} />
        </TabsContent>
        <TabsContent value="news">
          <NewsTab ticker={symbol} />
        </TabsContent>
        <TabsContent value="earnings">
          <EarningsTab ticker={symbol} />
        </TabsContent>
        <TabsContent value="social">
          <SocialTab
            ticker={symbol}
            platform={socialPlatform}
            onPlatformChange={handleSocialPlatformChange}
          />
        </TabsContent>
        <TabsContent value="filings">
          <FilingsInsiderTab
            ticker={symbol}
            view={filingsView}
            onViewChange={(view: FilingsView) => handleViewChange('filings', view, 'insider')}
          />
        </TabsContent>
        <TabsContent value="peers">
          <PeersTab
            ticker={symbol}
            view={peersView}
            onViewChange={(view: PeersView) => handleViewChange('peers', view, 'competitors')}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
