import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { REDDIT_BAR, TWITTER_BAR } from '@/features/discover/social-buzz'
import { useTrendingSummary } from './hooks'

export function TrendingPlatformOverlap() {
  const query = useTrendingSummary()

  if (query.isPending) return <Skeleton className="h-28" aria-label="Loading platform overlap" />
  if (query.isError || !query.data) return null

  const { twitter_only, reddit_only, both } = query.data.platform_overlap
  const total = Math.max(1, twitter_only + reddit_only + both)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Where the buzz is</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="bg-muted flex h-2 overflow-hidden rounded-full">
          <div className={TWITTER_BAR} style={{ width: `${(twitter_only / total) * 100}%` }} />
          <div className="bg-primary" style={{ width: `${(both / total) * 100}%` }} />
          <div className={REDDIT_BAR} style={{ width: `${(reddit_only / total) * 100}%` }} />
        </div>
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>Twitter only: {twitter_only}</span>
          <span>Both: {both}</span>
          <span>Reddit only: {reddit_only}</span>
        </div>
      </CardContent>
    </Card>
  )
}
