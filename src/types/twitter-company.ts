import type { TwitterAuthStateOut, TwitterOperationOut } from '@/types/api'

/** Mirrors app/schemas/twitter_company.py in the backend. */

export type CompanyAccountType = 'corporate' | 'investor_relations' | 'brand' | 'regional' | 'support'

export type CompanyConfirmationState = 'confirmed' | 'unverified' | 'missing'

export type CompanyConfirmationBasis = 'company_source' | 'user_confirmation'

export type CompanyRuntimeState =
  | 'unknown'
  | 'validating'
  | 'available'
  | 'not_found'
  | 'unavailable'
  | 'identity_conflict'

export type CompanyCacheState = 'missing' | 'empty' | 'ready' | 'blocked'

export type CompanyCollectionPhase = 'account_lookup' | 'posts_fetch'

/** A discovery lead. Never official until the ticker's binding confirms it. */
export interface CompanyCandidateOut {
  handle: string
  source_url: string | null
  evidence_type: string | null
  company_name: string | null
  account_type: string | null
  excluded: boolean
  notes: string | null
}

export interface CompanyProfileOut {
  name: string | null
  username: string
  bio: string | null
  profile_image_url: string | null
}

export interface CompanyAccountOut {
  ticker: string
  company_name: string | null
  /** 0 when the ticker has no saved directory record yet. */
  mapping_revision: number
  username: string | null
  confirmation_state: CompanyConfirmationState
  confirmation_basis: CompanyConfirmationBasis | null
  confirmed_at: string | null
  account_type: CompanyAccountType | null
  source_urls: string[]
  candidates: CompanyCandidateOut[]
  notes: string | null
  profile: CompanyProfileOut | null
  runtime_state: CompanyRuntimeState
  public_error_code: string | null
  public_error_message: string | null
  auth: TwitterAuthStateOut
}

export interface CompanyAccountSave {
  selection: string
  account_type: CompanyAccountType
  source_urls: string[]
  expected_revision: number
  /** Must be stated: false saves for review, true is the user's explicit confirmation. */
  confirm_account: boolean
}

export interface CompanyAccountConfirm {
  selected_handle: string
  expected_revision: number
  confirm_account: true
}

export interface CompanyRevisionRequest {
  expected_revision: number
}

/** null means X did not report the value; metrics never decide visibility. */
export interface CompanyPostMetricsOut {
  views: number | null
  likes: number | null
  retweets: number | null
  replies: number | null
  quotes: number | null
  bookmarks: number | null
}

export interface CompanyQuoteOut {
  id: string | null
  text: string | null
  author_username: string | null
  author_name: string | null
  url: string | null
}

/** A company-authored post: no social score, ticker matches or sentiment. */
export interface CompanyPostOut {
  analysis?: CompanyPostAnalysisOut | null
  id: string
  text: string
  author_id: string
  author_username: string
  author_name: string
  author_verified: boolean
  created_at: string
  url: string
  urls: string[]
  quote: CompanyQuoteOut | null
  metrics: CompanyPostMetricsOut
}

export interface CompanyPostsPageOut {
  analysis_pending_count?: number
  analysis_failed_count?: number
  account: CompanyAccountOut
  items: CompanyPostOut[]
  total: number
  page: number
  page_size: number
  mapping_revision: number
  window_start: string | null
  window_end: string | null
  cache_fetched_at: string | null
  cache_age_seconds: number | null
  cache_state: CompanyCacheState
  is_fresh: boolean
  is_truncated: boolean
  phase: CompanyCollectionPhase | null
  operation: TwitterOperationOut | null
  public_error_code: string | null
  public_error_message: string | null
}

export type CompanyPostsSort = 'newest' | 'importance'
export type CompanyPostsView = 'all' | 'company_news'
export interface CompanyPostAnalysisOut {
  status: 'pending' | 'completed' | 'uncertain' | 'failed' | 'unavailable'
  importance_score: number | null
  is_company_news: boolean | null
  reason: string | null
  needs_review: boolean
  analysed_at: string | null
}
