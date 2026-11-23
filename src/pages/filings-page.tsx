import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/shared/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AnalyzePanel } from '@/features/filing-intel/analyze-panel'
import { FilingDetailSheet } from '@/features/filing-intel/filing-detail-sheet'
import { RecentFilings } from '@/features/filing-intel/recent-filings'
import { UpcomingFilings } from '@/features/filing-intel/upcoming-filings'

const TABS = ['upcoming', 'recent', 'analyze'] as const
type Tab = (typeof TABS)[number]

/** Filing Intel: expected filings, the detected-filing feed, and on-demand batch analysis. */
export function FilingsPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'upcoming'
  const accession = params.get('filing')

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }
  const openFiling = (value: string) => update({ filing: value })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Filings"
        description="When tracked companies are expected to file, what they filed, and the rule-based analysis of each filing."
      />
      <Tabs value={tab} onValueChange={(value) => update({ tab: value })} className="gap-4">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="recent">Recent filings</TabsTrigger>
          <TabsTrigger value="analyze">Analyze</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
          <UpcomingFilings onOpenFiling={openFiling} />
        </TabsContent>
        <TabsContent value="recent">
          <RecentFilings onOpenFiling={openFiling} />
        </TabsContent>
        <TabsContent value="analyze">
          <AnalyzePanel onOpenFiling={openFiling} />
        </TabsContent>
      </Tabs>
      <FilingDetailSheet
        accession={accession}
        onOpenChange={(open) => !open && update({ filing: null })}
        onOpen={openFiling}
      />
    </div>
  )
}
