import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from '@/components/layout/app-layout'
import { DigestPage } from '@/pages/digest-page'
import { TickerDetailPage } from '@/pages/ticker-detail-page'
import { DiscoverPage } from '@/pages/discover-page'
import { TwitterPage } from '@/pages/twitter-page'
import { RedditPage } from '@/pages/reddit-page'
import { MacroPage } from '@/pages/macro-page'
import { TrendingPage } from '@/pages/trending-page'
import { SystemPage } from '@/pages/system-page'
import { WatchlistsPage } from '@/pages/watchlists-page'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DigestPage />} />
        <Route path="/stocks/:ticker" element={<TickerDetailPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/watchlists" element={<WatchlistsPage />} />
        <Route path="/twitter" element={<TwitterPage />} />
        <Route path="/reddit" element={<RedditPage />} />
        <Route path="/macro" element={<MacroPage />} />
        <Route path="/trending" element={<TrendingPage />} />
        <Route path="/system" element={<SystemPage />} />
        {/* AI settings now live in the System page's AI tab; keep the old path linkable. */}
        <Route path="/ai-settings" element={<Navigate to="/system?tab=ai" replace />} />
      </Route>
    </Routes>
  )
}
