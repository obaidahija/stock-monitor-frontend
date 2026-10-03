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
import { AiResearchTab } from '@/features/ticker-detail/ai-research/ai-research-tab'
import { AnalysisTab } from '@/features/ticker-detail/analysis-tab'
import { CompetitorsTab } from '@/features/ticker-detail/competitors/competitors-tab'
import { EarningsTab } from '@/features/ticker-detail/earnings-tab'
import { NewsTab } from '@/features/ticker-detail/news-tab'
import { PairsTab } from '@/features/ticker-detail/pairs/pairs-tab'
import { FilingsTab } from '@/features/ticker-detail/filings-tab'
import { InsiderTab } from '@/features/ticker-detail/insider-tab'
import { CatalystsTab } from '@/features/ticker-detail/catalysts-tab'
import { TwitterTab } from '@/features/ticker-detail/twitter-tab'
import { RedditTab } from '@/features/ticker-detail/reddit-tab'
import {
  useAutoRefreshQuote,
  useAutoRefreshUniverseScore,
  useUniverseScore,
} from '@/features/ticker-detail/hooks'
import { ManageListsDialog } from '@/features/watchlists/manage-lists-dialog'

const DETAIL_TABS = [
  'analysis',
  'ai-research',
  'competitors',
  'pairs',
  'earnings',
  'news',
  'twitter',
  'reddit',
  'filings',
  'insider',
  'catalysts',
] as const

export function TickerDetailPage() {
  const { ticker = '' } = useParams<{ ticker: string }>()
  const symbol = ticker.toUpperCase()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  useAutoRefreshUniverseScore(symbol)
  useAutoRefreshQuote(symbol)
  const { data: universeScore, isPending: universeScorePending } = useUniverseScore(symbol)

  const requestedTab = searchParams.get('tab')
  const activeTab =
    requestedTab && (DETAIL_TABS as readonly string[]).includes(requestedTab)
      ? requestedTab
      : 'analysis'

  function handleTabChange(tab: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <>
            {symbol}
            {universeScore?.industry && (
              <Badge variant="secondary" className="text-xs font-normal">
                {universeScore.industry}
              </Badge>
            )}
          </>
        }
        meta={<TickerPriceHeader ticker={symbol} />}
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

      <PriceTargetChangeBanner ticker={symbol} onNavigate={scrollToAnalystDetail} />

      <PriceChart ticker={symbol} />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="ai-research">AI Research</TabsTrigger>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
          <TabsTrigger value="pairs">Pairs</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="news">News</TabsTrigger>
          <TabsTrigger value="twitter">Twitter</TabsTrigger>
          <TabsTrigger value="reddit">Reddit</TabsTrigger>
          <TabsTrigger value="filings">Filings</TabsTrigger>
          <TabsTrigger value="insider">Insider</TabsTrigger>
          <TabsTrigger value="catalysts">Catalysts</TabsTrigger>
        </TabsList>
        <TabsContent value="analysis">
          <AnalysisTab ticker={symbol} />
        </TabsContent>
        <TabsContent value="ai-research">
          <AiResearchTab ticker={symbol} />
        </TabsContent>
        <TabsContent value="competitors">
          <CompetitorsTab ticker={symbol} />
        </TabsContent>
        <TabsContent value="pairs">
          <PairsTab ticker={symbol} />
        </TabsContent>
        <TabsContent value="earnings">
          <EarningsTab ticker={symbol} />
        </TabsContent>
        <TabsContent value="news">
          <NewsTab ticker={symbol} />
        </TabsContent>
        <TabsContent value="twitter">
          <TwitterTab ticker={symbol} />
        </TabsContent>
        <TabsContent value="reddit">
          <RedditTab ticker={symbol} />
        </TabsContent>
        <TabsContent value="filings">
          <FilingsTab ticker={symbol} />
        </TabsContent>
        <TabsContent value="insider">
          <InsiderTab ticker={symbol} />
        </TabsContent>
        <TabsContent value="catalysts">
          <CatalystsTab ticker={symbol} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
