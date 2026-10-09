import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError, apiClient } from '@/lib/api-client'
import type { CompanyAccountOut, CompanyPostsPageOut } from '@/types/twitter-company'
import {
  confirmCompanyAccount,
  ensureCompanyPosts,
  getCompanyAccount,
  getCompanyPosts,
  refreshCompanyPosts,
  removeCompanyAccount,
  saveCompanyAccount,
  validateCompanyAccount,
} from './twitter-company'

beforeEach(() => vi.restoreAllMocks())
afterEach(() => vi.unstubAllGlobals())

const account = { ticker: 'BRK.B', mapping_revision: 4 } as CompanyAccountOut

test('reads the directory and cached posts with GET only', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({} as never)
  const post = vi.spyOn(apiClient, 'post')

  await getCompanyAccount('brk.b')
  await getCompanyPosts('BRK.B')
  await getCompanyPosts('goog', 3)

  expect(get.mock.calls).toEqual([
    ['/v1/twitter/company-accounts/BRK.B'],
    ['/v1/twitter/company-accounts/BRK.B/posts?page=1&sort=newest&view=all'],
    ['/v1/twitter/company-accounts/GOOG/posts?page=3&sort=newest&view=all'],
  ])
  expect(post).not.toHaveBeenCalled()
})

test('encodes the ticker path segment', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({} as never)
  await getCompanyAccount('a/b')
  expect(get).toHaveBeenCalledWith('/v1/twitter/company-accounts/A%2FB')
})

test('saves with an explicit confirm flag and the expected revision', async () => {
  const put = vi.spyOn(apiClient, 'put').mockResolvedValue(account as never)
  await saveCompanyAccount('GOOG', {
    selection: '@Google',
    account_type: 'brand',
    source_urls: ['https://blog.google/'],
    expected_revision: 2,
    confirm_account: false,
  })
  expect(put).toHaveBeenCalledWith('/v1/twitter/company-accounts/GOOG', {
    selection: '@Google',
    account_type: 'brand',
    source_urls: ['https://blog.google/'],
    expected_revision: 2,
    confirm_account: false,
  })
})

test('confirms exactly the reviewed handle at the reviewed revision', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue(account as never)
  await confirmCompanyAccount('GOOG', {
    selected_handle: 'Google',
    expected_revision: 3,
    confirm_account: true,
  })
  expect(post).toHaveBeenCalledWith('/v1/twitter/company-accounts/GOOG/confirm', {
    selected_handle: 'Google',
    expected_revision: 3,
    confirm_account: true,
  })
})

test('validation, ensure and refresh send only the expected revision', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({} as never)
  await validateCompanyAccount('GOOG', 1)
  await ensureCompanyPosts('GOOG', 1)
  await refreshCompanyPosts('GOOG', 2)
  expect(post.mock.calls).toEqual([
    ['/v1/twitter/company-accounts/GOOG/validate', { expected_revision: 1 }],
    ['/v1/twitter/company-accounts/GOOG/posts/ensure', { expected_revision: 1 }],
    ['/v1/twitter/company-accounts/GOOG/posts/refresh', { expected_revision: 2 }],
  ])
  for (const [path, body] of post.mock.calls) {
    expect(path).not.toContain('/searches')
    expect(JSON.stringify(body)).not.toContain('min_views')
  }
})

test('ensure returns the same page shape for 200 and 202 responses', async () => {
  const page = { mapping_revision: 1, items: [], operation: null } as unknown as CompanyPostsPageOut
  const queued = { ...page, operation: { id: 'op-1' }, phase: 'posts_fetch' }
  for (const [status, body] of [
    [200, page],
    [202, queued],
  ] as const) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })))
    await expect(ensureCompanyPosts('GOOG', 1)).resolves.toEqual(body)
  }
})

test('remove sends a revision-bearing DELETE and returns the cleared directory', async () => {
  const cleared = { ticker: 'GOOG', mapping_revision: 5, confirmation_state: 'missing' }
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(cleared), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)

  await expect(removeCompanyAccount('goog', 4)).resolves.toEqual(cleared)

  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/v1/twitter/company-accounts/GOOG')
  expect(init.method).toBe('DELETE')
  expect(JSON.parse(init.body)).toEqual({ expected_revision: 4 })
  expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
})

test('a stale revision surfaces as ApiError with the server detail', async () => {
  const detail = {
    code: 'revision_conflict',
    message: 'The company account changed. Review the current selection.',
    current_revision: 6,
  }
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail }), { status: 409 })),
  )

  const error = await removeCompanyAccount('GOOG', 4).catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(ApiError)
  expect((error as ApiError).status).toBe(409)
  expect((error as ApiError).detail).toEqual(detail)
})

test('non-2xx responses from the other wrappers propagate as ApiError', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: { code: 'account_unconfirmed' } }), { status: 409 }),
    ),
  )
  await expect(refreshCompanyPosts('GOOG', 1)).rejects.toBeInstanceOf(ApiError)
})
