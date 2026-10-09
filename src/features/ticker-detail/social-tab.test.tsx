import { useState } from 'react'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import type { TwitterOperationOut } from '@/types/api'
import { companyAccount, companyPage, twitterOperation } from './company-x/test-fixtures'
import { SocialTab, type SocialPlatform } from './social-tab'

vi.mock('./reddit-tab', () => ({ RedditTab: () => <div>Reddit content</div> }))

type Call = { method: string; path: string }
let calls: Call[]
let lookup: Promise<TwitterOperationOut>
let releaseLookup: (operation: TwitterOperationOut) => void

const account = companyAccount({ mapping_revision: 1 })

beforeEach(() => {
  calls = []
  lookup = new Promise((resolve) => (releaseLookup = resolve))
  vi.spyOn(apiClient, 'get').mockImplementation(async (path: string) => {
    calls.push({ method: 'GET', path })
    if (path.startsWith('/v1/twitter/operations/')) return (await lookup) as never
    if (path.includes('/posts')) return companyPage(account) as never
    if (path.startsWith('/v1/twitter/company-accounts/')) return account as never
    if (path.startsWith('/v1/twitter/feed')) {
      return { items: [], total: 0, page: 1, page_size: 25, generated_at: '', stale: false, reason: null } as never
    }
    return {} as never
  })
  vi.spyOn(apiClient, 'post').mockImplementation(async (path: string) => {
    calls.push({ method: 'POST', path })
    return companyPage(account, {
      cache_state: 'missing',
      cache_fetched_at: null,
      phase: 'account_lookup',
      operation: twitterOperation('lookup-1', 'queued', 'company_account_validate'),
    }) as never
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function Harness({ initial }: { initial: SocialPlatform }) {
  const [platform, setPlatform] = useState<SocialPlatform>(initial)
  return <SocialTab ticker="GOOG" platform={platform} onPlatformChange={setPlatform} />
}

const companyCalls = () => calls.filter((call) => call.path.includes('/company-accounts/'))
const collectionPosts = () =>
  calls.filter((call) => call.method === 'POST' && call.path.includes('/company-accounts/'))

test('the Reddit platform never touches company accounts', async () => {
  renderWithProviders(<Harness initial="reddit" />)
  expect(await screen.findByText('Reddit content')).toBeVisible()
  await new Promise((resolve) => setTimeout(resolve, 30))
  expect(companyCalls()).toEqual([])
})

test('activating Twitter ensures once; leaving during the lookup stops the second phase', async () => {
  const user = userEvent.setup()
  renderWithProviders(<Harness initial="reddit" />)
  await screen.findByText('Reddit content')

  await user.click(screen.getByRole('tab', { name: 'Twitter' }))
  await waitFor(() => expect(collectionPosts()).toHaveLength(1))
  await waitFor(() =>
    expect(calls.some((call) => call.path === '/v1/twitter/operations/lookup-1')).toBe(true),
  )

  await user.click(screen.getByRole('tab', { name: 'Reddit' }))
  expect(await screen.findByText('Reddit content')).toBeVisible()
  releaseLookup(twitterOperation('lookup-1', 'succeeded', 'company_account_validate'))
  await new Promise((resolve) => setTimeout(resolve, 50))

  expect(collectionPosts()).toHaveLength(1)
})

test('returning to Twitter is a new visit with its own ensure', async () => {
  const user = userEvent.setup()
  releaseLookup(twitterOperation('lookup-1', 'failed', 'company_account_validate'))
  renderWithProviders(<Harness initial="twitter" />)
  await waitFor(() => expect(collectionPosts()).toHaveLength(1))

  await user.click(screen.getByRole('tab', { name: 'Reddit' }))
  await screen.findByText('Reddit content')
  await user.click(screen.getByRole('tab', { name: 'Twitter' }))
  await waitFor(() => expect(collectionPosts()).toHaveLength(2))
})
