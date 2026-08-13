import { useNavigate, useParams } from 'react-router'
import { PageHeader } from '@/components/shared/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RemoveTickerDialog } from '@/features/discover/remove-ticker-dialog'
import { PriceChart } from '@/features/ticker-detail/price-chart'
import { AnalysisTab } from '@/features/ticker-detail/analysis-tab'
import { EarningsTab } from '@/features/ticker-detail/earnings-tab'
import { NewsTab } from '@/features/ticker-detail/news-tab'
import { FilingsTab } from '@/features/ticker-detail/filings-tab'
import { CatalystsTab } from '@/features/ticker-detail/catalysts-tab'
import { SocialTab } from '@/features/ticker-detail/social-tab'
import { TwitterTab } from '@/features/ticker-detail/twitter-tab'

export function TickerDetailPage() {
  const { ticker = '' } = useParams<{ ticker: string }>()
  const symbol = ticker.toUpperCase()
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <PageHeader
        title={symbol}
        description="Analysis, earnings, news, social, filings, and catalysts."
        actions={
          <RemoveTickerDialog
            ticker={symbol}
            trigger="labeled"
            onRemoved={() => navigate('/discover')}
          />
        }
      />

      <PriceChart ticker={symbol} />

      <Tabs defaultValue="analysis">
        <TabsList>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="news">News</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
          <TabsTrigger value="twitter">Twitter</TabsTrigger>
          <TabsTrigger value="filings">Filings</TabsTrigger>
          <TabsTrigger value="catalysts">Catalysts</TabsTrigger>
        </TabsList>
        <TabsContent value="analysis">
          <AnalysisTab ticker={symbol} />
        </TabsContent>
        <TabsContent value="earnings">
          <EarningsTab ticker={symbol} />
        </TabsContent>
        <TabsContent value="news">
          <NewsTab ticker={symbol} />
        </TabsContent>
        <TabsContent value="social">
          <SocialTab ticker={symbol} />
        </TabsContent>
        <TabsContent value="twitter">
          <TwitterTab ticker={symbol} />
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
