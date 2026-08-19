import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import type { RedditCommentOut } from '@/types/api'
import { RedditCommentTree } from './reddit-comment-tree'

function eightLevelFlatComments(): RedditCommentOut[] {
  return Array.from({ length: 8 }, (_, index) => ({
    id: `c${index}`,
    fullname: `t1_c${index}`,
    post_id: 'post',
    parent_fullname: index === 0 ? 't3_post' : `t1_c${index - 1}`,
    author: `author${index}`,
    body: `Level ${index + 1}`,
    score: index,
    created_at: '2026-08-16T12:00:00Z',
    depth: index,
    tree_order: index,
    content_state: 'visible',
    ticker_matches: [],
    sentiment_label: null,
    sentiment_confidence: null,
  }))
}

test('renders six levels and requires expansion beyond level six', async () => {
  const user = userEvent.setup()
  render(<RedditCommentTree comments={eightLevelFlatComments()} />)
  expect(screen.getAllByTestId('reddit-comment')).toHaveLength(6)
  await user.click(screen.getByRole('button', { name: 'Show deeper replies' }))
  expect(screen.getAllByTestId('reddit-comment')).toHaveLength(8)
})
