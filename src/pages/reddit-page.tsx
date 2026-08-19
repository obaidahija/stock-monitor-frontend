import { PageHeader } from '@/components/shared/page-header'
import { RedditAuthStatusBanner } from '@/features/reddit/auth-status-banner'
import { RedditFeedControls } from '@/features/reddit/feed-controls'
import { RedditFeedList } from '@/features/reddit/feed-list'
import { TickerSearchResults } from '@/features/reddit/ticker-search-results'
import { TrustedAuthorsSection } from '@/features/reddit/trusted-authors-section'
import { TrustedSubredditsSection } from '@/features/reddit/trusted-subreddits-section'

export function RedditPage() {
  return <div className="space-y-8"><PageHeader title="Reddit" description="Trusted-community and selected-ticker Reddit intelligence, signal scoring, and discussion threads." /><RedditAuthStatusBanner /><div className="grid gap-6 lg:grid-cols-2"><TrustedSubredditsSection /><TrustedAuthorsSection /></div><section className="space-y-3"><h2 className="font-semibold">Feed</h2><RedditFeedControls /><TickerSearchResults /><RedditFeedList /></section></div>
}
