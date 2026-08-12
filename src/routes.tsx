import { Route, Routes } from 'react-router'
import { AppLayout } from '@/components/layout/app-layout'
import { DigestPage } from '@/pages/digest-page'
import { TickerDetailPage } from '@/pages/ticker-detail-page'
import { DiscoverPage } from '@/pages/discover-page'
import { TwitterPage } from '@/pages/twitter-page'
import { SystemPage } from '@/pages/system-page'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DigestPage />} />
        <Route path="/stocks/:ticker" element={<TickerDetailPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/twitter" element={<TwitterPage />} />
        <Route path="/system" element={<SystemPage />} />
      </Route>
    </Routes>
  )
}
