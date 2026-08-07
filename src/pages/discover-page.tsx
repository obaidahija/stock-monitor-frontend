import { TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GappersSection } from '@/features/discover/gappers-section'
import { UnusualVolumeSection } from '@/features/discover/unusual-volume-section'
import { NotableFilingsSection } from '@/features/discover/notable-filings-section'

export function DiscoverPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Discover" description="Market-wide scan, independent of your watchlist." />

      <GappersSection />
      <UnusualVolumeSection />
      <NotableFilingsSection />

      <section className="space-y-3">
        <h2 className="font-semibold">Trending</h2>
        <Card className="opacity-60">
          <CardHeader className="flex flex-row items-center gap-2">
            <TrendingUp className="text-muted-foreground size-4" />
            <CardTitle>Mention velocity — coming in phase 2</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Ranked by social mention z-score vs. a 7-day baseline. Not built on the backend yet.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
