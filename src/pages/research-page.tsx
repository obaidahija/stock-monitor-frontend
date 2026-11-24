import { PageHeader } from '@/components/shared/page-header'
import { FreshCatalystsSection } from '@/features/discover/fresh-catalysts-section'
import { DiscoverResearchFirst } from '@/features/research-first/research-first-panel'

/**
 * Dedicated short-term research view. Research First has no on/off setting,
 * so the page is never
 * empty even when the catalyst scanner below it is turned off.
 */
export function ResearchPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Research"
        description="Company disclosures, events and setups worth investigating."
      />
      <DiscoverResearchFirst />
      <FreshCatalystsSection />
    </div>
  )
}
