import type { TwitterOperationOut } from '@/types/api'
import type {
  CompanyAccountOut,
  CompanyPostOut,
  CompanyPostsPageOut,
} from '@/types/twitter-company'

export function companyAccount(overrides: Partial<CompanyAccountOut> = {}): CompanyAccountOut {
  return {
    ticker: 'GOOG',
    company_name: 'Alphabet Inc.',
    mapping_revision: 1,
    username: 'Google',
    confirmation_state: 'confirmed',
    confirmation_basis: 'company_source',
    confirmed_at: '2026-10-07T00:00:00Z',
    account_type: 'brand',
    source_urls: ['https://blog.google/'],
    candidates: [],
    notes: 'Google is an Alphabet subsidiary/operating brand. Source may be historical.',
    profile: null,
    runtime_state: 'available',
    public_error_code: null,
    public_error_message: null,
    auth: { state: 'valid', checked_at: null, public_message: null, cooldown_until: null },
    ...overrides,
  }
}

export function companyPost(id: string, overrides: Partial<CompanyPostOut> = {}): CompanyPostOut {
  return {
    id,
    text: `Company update ${id}`,
    author_id: '20536157',
    author_username: 'Google',
    author_name: 'Google',
    author_verified: true,
    created_at: '2026-10-08T10:00:00Z',
    url: `https://x.com/Google/status/${id}`,
    urls: [],
    quote: null,
    metrics: { views: 1200, likes: 30, retweets: 4, replies: 2, quotes: 1, bookmarks: 0 },
    ...overrides,
  }
}

export function companyPage(
  account: CompanyAccountOut,
  overrides: Partial<CompanyPostsPageOut> = {},
): CompanyPostsPageOut {
  const items = overrides.items ?? []
  return {
    account,
    items,
    total: items.length,
    page: 1,
    page_size: 25,
    mapping_revision: account.mapping_revision,
    window_start: '2026-10-01T12:00:00Z',
    window_end: '2026-10-08T12:00:00Z',
    cache_fetched_at: '2026-10-08T12:00:00Z',
    cache_age_seconds: 60,
    cache_state: items.length ? 'ready' : 'empty',
    is_fresh: true,
    is_truncated: false,
    phase: null,
    operation: null,
    public_error_code: null,
    public_error_message: null,
    ...overrides,
  }
}

export function twitterOperation(
  id: string,
  status: TwitterOperationOut['status'],
  kind = 'company_posts_fetch',
): TwitterOperationOut {
  return {
    id,
    kind,
    status,
    priority: 90,
    attempts: 0,
    max_attempts: 3,
    created_at: '2026-10-08T12:00:00Z',
    started_at: null,
    finished_at: null,
    public_error_code: null,
    public_error_message: null,
  }
}
