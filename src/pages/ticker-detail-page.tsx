import { useParams } from 'react-router'
import { PageHeader } from '@/components/shared/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AnalysisTab } from '@/features/ticker-detail/analysis-tab'
import { EarningsTab } from '@/features/ticker-detail/earnings-tab'
import { NewsTab } from '@/features/ticker-detail/news-tab'
import { FilingsTab } from '@/features/ticker-detail/filings-tab'
import { CatalystsTab } from '@/features/ticker-detail/catalysts-tab'

export function TickerDetailPage() {
  const { ticker = '' } = useParams<{ ticker: string }>()
  const symbol = ticker.toUpperCase()

  return (
    <div className="space-y-6">
      <PageHeader title={symbol} description="Analysis, earnings, news, filings, and catalysts." />

      <Tabs defaultValue="analysis">
        <TabsList>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="news">News</TabsTrigger>
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
