import { useRef, useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { AuthStatusBanner } from '@/features/twitter/auth-status-banner'
import { TrustedAccountsSection } from '@/features/twitter/trusted-accounts-section'
import { FeedControls } from '@/features/twitter/feed-controls'
import { FeedTable } from '@/features/twitter/feed-table'

const SETTLE_WINDOW_MS = 18_000
const SETTLE_POLL_INTERVAL_MS = 3_000

export function TwitterPage() {
  const [isSettling, setIsSettling] = useState(false)
  const settleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleRefreshed() {
    setIsSettling(true)
    if (settleTimeout.current) clearTimeout(settleTimeout.current)
    settleTimeout.current = setTimeout(() => setIsSettling(false), SETTLE_WINDOW_MS)
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Twitter"
        description="Trusted-account and viral tweet feed, signal scoring, and X auth status."
      />

      <AuthStatusBanner />
      <TrustedAccountsSection />

      <section className="space-y-3">
        <h2 className="font-semibold">Feed</h2>
        <FeedControls onRefreshed={handleRefreshed} />
        <FeedTable refetchInterval={isSettling ? SETTLE_POLL_INTERVAL_MS : false} />
      </section>
    </div>
  )
}
