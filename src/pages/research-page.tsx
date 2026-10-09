import { PageHeader } from '@/components/shared/page-header'
import { FreshCatalystsSection } from '@/features/discover/fresh-catalysts-section'
import { ShortSqueezeSection } from '@/features/discover/short-squeeze-section'
import { DiscoverResearchFirst } from '@/features/research-first/research-first-panel'

/**
 * Short-term research, moved out of Discover so that page stays a scan of the
 * whole market. Research First has no on/off setting, so the page is never
 * empty even when the scanners below it are turned off.
 */
export function ResearchPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Research"
        description="Events and setups worth investigating over the next 1–7 trading sessions."
      />
      <DiscoverResearchFirst />
      <FreshCatalystsSection />
      <ShortSqueezeSection />
    </div>
  )
}
