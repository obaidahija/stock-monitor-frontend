import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AddTrackedTickerButton } from '@/features/discover/add-tracked-ticker-button'
import { RemoveTickerDialog } from '@/features/discover/remove-ticker-dialog'
import { PriceChart } from '@/features/ticker-detail/price-chart'
import { TickerPriceHeader } from '@/features/ticker-detail/ticker-price-header'
import { AiResearchTab } from '@/features/ticker-detail/ai-research/ai-research-tab'
import { AnalysisTab } from '@/features/ticker-detail/analysis-tab'
import { CompetitorsTab } from '@/features/ticker-detail/competitors/competitors-tab'
import { EarningsTab } from '@/features/ticker-detail/earnings-tab'
import { NewsTab } from '@/features/ticker-detail/news-tab'
import { FilingsTab } from '@/features/ticker-detail/filings-tab'
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
  'earnings',
  'news',
  'twitter',
  'reddit',
  'filings',
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
            <TickerPriceHeader ticker={symbol} />
          </>
        }
        description="Analysis, earnings, news, Twitter, Reddit, filings, and catalysts."
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

      <PriceChart ticker={symbol} />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="ai-research">AI Research</TabsTrigger>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="news">News</TabsTrigger>
          <TabsTrigger value="twitter">Twitter</TabsTrigger>
          <TabsTrigger value="reddit">Reddit</TabsTrigger>
          <TabsTrigger value="filings">Filings</TabsTrigger>
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
        <TabsContent value="catalysts">
          <CatalystsTab ticker={symbol} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
