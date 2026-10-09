import { RedditFeedControls } from '@/features/reddit/feed-controls'
import { RedditFeedList } from '@/features/reddit/feed-list'
import { RedditTopMentionsStrip } from '@/features/reddit/reddit-top-mentions-strip'
import { TickerSearchResults } from '@/features/reddit/ticker-search-results'
import { TrustedAuthorsSection } from '@/features/reddit/trusted-authors-section'
import { TrustedSubredditsSection } from '@/features/reddit/trusted-subreddits-section'
import { useTrustedAuthors, useTrustedSubreddits } from '@/features/reddit/hooks'
import { SourcesPanel } from '@/components/shared/sources-panel'

/** The Reddit view of the Social page, which owns the page title and login status. */
export function RedditPage() {
  const subreddits = useTrustedSubreddits()
  const authors = useTrustedAuthors()
  const sourceCount =
    subreddits.data && authors.data ? subreddits.data.length + authors.data.length : null

  return (
    <div className="space-y-8">
      <RedditTopMentionsStrip />
      {/* An active subreddit filter also shows as a chip in the feed controls, so closing this panel never hides it. */}
      <SourcesPanel
        count={sourceCount}
        description="Trusted subreddits and authors the feed collects from"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <TrustedSubredditsSection />
          <TrustedAuthorsSection />
        </div>
      </SourcesPanel>
      <section className="space-y-3">
        <h2 className="font-semibold">Feed</h2>
        <RedditFeedControls />
        <TickerSearchResults />
        <RedditFeedList />
      </section>
    </div>
  )
}
