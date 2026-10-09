import { useRef, useState } from 'react'
import { TopMentionsStrip } from '@/features/twitter/top-mentions-strip'
import { TrustedAccountsSection } from '@/features/twitter/trusted-accounts-section'
import { FeedControls } from '@/features/twitter/feed-controls'
import { FeedTable } from '@/features/twitter/feed-table'
import { useTrustedAccounts } from '@/features/twitter/hooks'
import { SourcesPanel } from '@/components/shared/sources-panel'

const SETTLE_WINDOW_MS = 18_000
const SETTLE_POLL_INTERVAL_MS = 3_000

/** The Twitter view of the Social page, which owns the page title and login status. */
export function TwitterPage() {
  const [isSettling, setIsSettling] = useState(false)
  const settleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const trustedAccounts = useTrustedAccounts()

  function handleRefreshed() {
    setIsSettling(true)
    if (settleTimeout.current) clearTimeout(settleTimeout.current)
    settleTimeout.current = setTimeout(() => setIsSettling(false), SETTLE_WINDOW_MS)
  }

  return (
    <div className="space-y-8">
      <TopMentionsStrip />

      <SourcesPanel
        count={trustedAccounts.data?.length ?? null}
        description="Trusted accounts the feed collects from"
      >
        <TrustedAccountsSection />
      </SourcesPanel>

      <section className="space-y-3">
        <h2 className="font-semibold">Feed</h2>
        <FeedControls onRefreshed={handleRefreshed} />
        <FeedTable refetchInterval={isSettling ? SETTLE_POLL_INTERVAL_MS : false} />
      </section>
    </div>
  )
}
