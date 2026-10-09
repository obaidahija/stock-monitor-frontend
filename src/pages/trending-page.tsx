import { TrendingHeroStats } from '@/features/trending/trending-hero-stats'
import { TrendingHotStrip } from '@/features/trending/trending-hot-strip'
import { TrendingPlatformOverlap } from '@/features/trending/trending-platform-overlap'
import { TrendingSectorPanel } from '@/features/trending/trending-sector-panel'
import { TrendingSentimentGauge } from '@/features/trending/trending-sentiment-gauge'
import { TrendingTabs } from '@/features/trending/trending-tabs'

/**
 * The Trending view of the Social page. Google Finance Outlook used to sit here
 * too; it is Google's stock picks rather than social data, so it now appears
 * only on Discover.
 */
export function TrendingPage() {
  return (
    <div className="space-y-8">
      <TrendingHeroStats />
      <TrendingHotStrip />
      <div className="grid gap-4 sm:grid-cols-2">
        <TrendingSentimentGauge />
        <TrendingPlatformOverlap />
      </div>
      <TrendingTabs />
      <TrendingSectorPanel />
    </div>
  )
}
