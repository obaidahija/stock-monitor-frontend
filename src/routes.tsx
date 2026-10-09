import { Navigate, Route, Routes, useLocation } from 'react-router'
import { AppLayout } from '@/components/layout/app-layout'
import { DigestPage } from '@/pages/digest-page'
import { TickerDetailPage } from '@/pages/ticker-detail-page'
import { DiscoverPage } from '@/pages/discover-page'
import { ResearchPage } from '@/pages/research-page'
import { SocialPage } from '@/pages/social-page'
import { MacroPage } from '@/pages/macro-page'
import { EventsPage } from '@/pages/events-page'
import { SystemPage } from '@/pages/system-page'
import { SettingsPage } from '@/pages/settings-page'
import { WatchlistsPage } from '@/pages/watchlists-page'

/** Like <Navigate>, but keeps the query string, so an old link's filters survive the move. */
function RedirectKeepingQuery({ to }: { to: string }) {
  const { search } = useLocation()
  return <Navigate to={{ pathname: to, search }} replace />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DigestPage />} />
        <Route path="/stocks/:ticker" element={<TickerDetailPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/watchlists" element={<WatchlistsPage />} />
        <Route path="/social/:view?" element={<SocialPage />} />
        <Route path="/macro" element={<MacroPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/system" element={<SystemPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/* AI settings moved from the System page's AI tab to /settings; keep both old paths linkable. */}
        <Route path="/ai-settings" element={<Navigate to="/settings" replace />} />
        {/* Trending, Twitter and Reddit became views of /social; keep their old paths linkable. */}
        <Route path="/trending" element={<RedirectKeepingQuery to="/social/trending" />} />
        <Route path="/twitter" element={<RedirectKeepingQuery to="/social/twitter" />} />
        <Route path="/reddit" element={<RedirectKeepingQuery to="/social/reddit" />} />
      </Route>
    </Routes>
  )
}
