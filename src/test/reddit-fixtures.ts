import type {
  RedditCommentOut,
  RedditOperationOut,
  RedditOperationStatus,
  RedditPostOut,
  RedditSearchResultOut,
  RedditThreadOut,
} from '@/types/api'

export function redditOperation(
  id: string,
  status: RedditOperationStatus,
  overrides: Partial<RedditOperationOut> = {},
): RedditOperationOut {
  return {
    id,
    kind: 'ticker_search',
    scope_key: null,
    priority: 100,
    status,
    attempt: 1,
    max_attempts: 3,
    available_at: '2026-10-26T12:00:00Z',
    created_at: '2026-10-26T12:00:00Z',
    started_at: null,
    finished_at: null,
    public_error_code: null,
    public_error_message: null,
    ...overrides,
  }
}

export function redditPost(id: string, title: string): RedditPostOut {
  return {
    id,
    fullname: `t3_${id}`,
    title,
    selftext: '',
    subreddit: 'stocks',
    author: 'investor',
    created_at: '2026-10-26T11:00:00Z',
    permalink: `https://reddit.com/r/stocks/comments/${id}`,
    url: `https://reddit.com/r/stocks/comments/${id}`,
    score: 10,
    num_comments: 6,
    metrics: { score: 10, num_comments: 6 },
    is_self: true,
    over_18: false,
    is_video: false,
    stickied: false,
    is_trusted: false,
    is_viral: false,
    content_state: 'visible',
    ticker_matches: [],
    signal_score: null,
    sentiment_label: null,
    sentiment_confidence: null,
    post_type: null,
    post_type_score: null,
  }
}

export function redditSearch(
  items: RedditPostOut[],
  operation: RedditOperationOut | null = null,
): RedditSearchResultOut {
  return {
    items,
    sentiment_pending: false,
    generated_at: '2026-10-26T12:00:00Z',
    cache_age_seconds: 0,
    operation,
    stale: items.length === 0,
    stale_reason: items.length === 0 ? 'missing' : null,
  }
}

export function redditComment(id: string, body: string, postId = 'p1'): RedditCommentOut {
  return {
    id,
    fullname: `t1_${id}`,
    post_id: postId,
    parent_fullname: `t3_${postId}`,
    author: 'commenter',
    body,
    score: 3,
    created_at: '2026-10-26T11:30:00Z',
    depth: 0,
    tree_order: 0,
    content_state: 'visible',
    ticker_matches: [],
    sentiment_label: null,
    sentiment_confidence: null,
  }
}

export function redditThread(
  post: RedditPostOut,
  comments: RedditCommentOut[],
  operation: RedditOperationOut | null = null,
): RedditThreadOut {
  return {
    post,
    comments,
    generated_at: '2026-10-26T12:00:00Z',
    stale: operation !== null,
    stale_reason: operation !== null ? 'stale' : null,
    operation,
  }
}
