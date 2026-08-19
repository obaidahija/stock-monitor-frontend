import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { EvidencePanel } from './evidence-panel'

test('renders Reddit evidence separately from Twitter', () => {
  render(
    <EvidencePanel
      inputsUsed={{
        news_item_ids: [],
        news_item_count: 1,
        twitter_post_ids: ['tweet-1'],
        twitter_post_count: 1,
        twitter_cache_is_fresh: true,
        twitter_cache_age_seconds: 30,
        reddit_post_ids: ['reddit-1', 'reddit-2'],
        reddit_post_count: 2,
        reddit_cache_is_fresh: false,
        reddit_cache_age_seconds: 90,
        quant_facts: [],
      }}
    />,
  )

  expect(screen.getByText('2 Reddit posts')).toBeInTheDocument()
  expect(screen.getByText('Reddit cache stale (90s old)')).toBeInTheDocument()
  expect(screen.getByText('1 X/Twitter post')).toBeInTheDocument()
})
