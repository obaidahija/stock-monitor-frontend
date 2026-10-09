import type { SocialPlatform } from './social-tab'

export const DETAIL_TABS = ['analysis', 'ai-research', 'news', 'earnings', 'social', 'filings', 'peers'] as const
export type DetailTab = (typeof DETAIL_TABS)[number]
export type FilingsView = 'insider' | 'all'
export type PeersView = 'competitors' | 'pairs'

export interface DetailTabState {
  tab: DetailTab
  socialPlatform: SocialPlatform
  filingsView: FilingsView
  peersView: PeersView
}

// Tabs that were merged into another one. Old bookmarks and links still land on the same content.
const RETIRED_TABS: Record<string, Partial<DetailTabState> & { tab: DetailTab }> = {
  catalysts: { tab: 'earnings' },
  competitors: { tab: 'peers', peersView: 'competitors' },
  pairs: { tab: 'peers', peersView: 'pairs' },
  insider: { tab: 'filings', filingsView: 'insider' },
  twitter: { tab: 'social', socialPlatform: 'twitter' },
  reddit: { tab: 'social', socialPlatform: 'reddit' },
}

export function resolveDetailTab(params: URLSearchParams): DetailTabState {
  const requested = params.get('tab') ?? ''
  const view = params.get('view')
  const state: DetailTabState = {
    tab: (DETAIL_TABS as readonly string[]).includes(requested) ? (requested as DetailTab) : 'analysis',
    socialPlatform: params.get('platform') === 'reddit' ? 'reddit' : 'twitter',
    filingsView: view === 'all' ? 'all' : 'insider',
    peersView: view === 'pairs' ? 'pairs' : 'competitors',
  }
  const retired = RETIRED_TABS[requested]
  return retired ? { ...state, ...retired } : state
}
