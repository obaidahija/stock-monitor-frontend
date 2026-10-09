import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RedditTab } from './reddit-tab'
import { TwitterTab } from './twitter-tab'

export type SocialPlatform = 'twitter' | 'reddit'

/** Twitter and Reddit for one ticker, each with its own feed behind a platform switch. */
export function SocialTab({
  ticker,
  platform,
  onPlatformChange,
}: {
  ticker: string
  platform: SocialPlatform
  onPlatformChange: (platform: SocialPlatform) => void
}) {
  return (
    <Tabs
      value={platform}
      onValueChange={(value) => onPlatformChange(value as SocialPlatform)}
      className="gap-4"
    >
      <TabsList>
        <TabsTrigger value="twitter">Twitter</TabsTrigger>
        <TabsTrigger value="reddit">Reddit</TabsTrigger>
      </TabsList>
      <TabsContent value="twitter">
        <TwitterTab ticker={ticker} />
      </TabsContent>
      <TabsContent value="reddit">
        <RedditTab ticker={ticker} />
      </TabsContent>
    </Tabs>
  )
}
