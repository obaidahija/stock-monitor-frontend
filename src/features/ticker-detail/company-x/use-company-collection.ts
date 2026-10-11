import { useCallback, useEffect, useRef, useState } from 'react'
import { isCancelledError, useQueryClient } from '@tanstack/react-query'
import { ensureCompanyPosts, getCompanyAccount, getCompanyPosts, refreshCompanyPosts } from '@/api/twitter-company'
import { useTwitterOperationPoll } from '@/features/twitter/use-operation-poll'
import { ApiError } from '@/lib/api-client'
import type { TwitterOperationOut } from '@/types/api'
import type { CompanyAccountOut, CompanyCollectionPhase } from '@/types/twitter-company'
import { companyAccountKey, companyPostsKey } from './hooks'

const ACTIVE_STATUSES = new Set<TwitterOperationOut['status']>(['queued', 'running', 'deferred'])

interface CollectionWork {
  operation: TwitterOperationOut
  phase: CompanyCollectionPhase
  activation: string
  collectAfterLookup: boolean
}

/**
 * An activation is one visit of a confirmed mapping in the visible Twitter tab:
 * the ticker plus the mapping revision the user is looking at. Unconfirmed,
 * missing and inactive mappings have none, so they can never collect.
 */
function activationOf(ticker: string, account: CompanyAccountOut | undefined, active: boolean) {
  if (!active || !account || account.confirmation_state !== 'confirmed') return null
  if (account.ticker.toUpperCase() !== ticker.toUpperCase()) return null
  return `${ticker}:${account.mapping_revision}`
}

/**
 * Starts company-post collection for the active ticker tab, at most once per
 * activation, and finishes the two-phase flow the server describes:
 *
 * - On activation it sends one cache-aware ensure (a fresh cache answers without work).
 * - If the server first looks the account up, a successful lookup re-reads the
 *   directory and sends one more ensure (or refresh, if the user forced it) — but only
 *   while the same confirmed ticker and revision are still active. Leaving the tab,
 *   switching ticker or platform, or a changed revision drops the follow-up; work the
 *   worker already started may still finish on the server.
 * - A finished operation refreshes the directory and cache, following any work
 *   already queued behind it. A post-fetch identity recheck never collects again.
 *
 * Query refetches never authorize a request; nothing here runs on a timer.
 */
export function useCompanyCollection({
  ticker,
  account,
  active,
}: {
  ticker: string
  account: CompanyAccountOut | undefined
  active: boolean
}) {
  const queryClient = useQueryClient()
  const activation = activationOf(ticker, account, active)
  const revision = account?.mapping_revision ?? 0

  const currentActivation = useRef<string | null>(null)
  const ensuredActivation = useRef<string | null>(null)
  const inFlight = useRef<string | null>(null)
  const cacheReadRetry = useRef<string | null>(null)
  const forceIntent = useRef(false)
  const handledOperations = useRef(new Set<string>())
  const workRef = useRef<CollectionWork | null>(null)

  const [work, setWorkState] = useState<CollectionWork | null>(null)
  const [pendingActivation, setPendingActivation] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const setWork = useCallback((next: CollectionWork | null) => {
    workRef.current = next
    setWorkState(next)
  }, [])

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: companyAccountKey(ticker) })
    void queryClient.invalidateQueries({ queryKey: ['twitter', 'company-posts', ticker] })
  }, [queryClient, ticker])

  const refreshAfterOperation = useCallback(async (key: string) => {
    cacheReadRetry.current = key
    setError(null)
    try {
      const queryKey = companyPostsKey(ticker, revision, 1)
      // Inactive pages can still have an older request running. Cancel it before
      // invalidating, so fetchQuery can only share a post-operation cache read.
      await queryClient.cancelQueries({ queryKey, exact: true })
      if (cacheReadRetry.current !== key || currentActivation.current !== key) return
      invalidate()
      const readPage = () => queryClient.fetchQuery({
        queryKey,
        queryFn: () => getCompanyPosts(ticker),
        staleTime: 0,
      })
      let page = await readPage()
      if (cacheReadRetry.current !== key || currentActivation.current !== key) return
      // A lookup can finish between the account snapshot and queue read. Read
      // once more for that gap, without polling or authorizing more collection.
      if (page.account.runtime_state === 'validating' && page.operation === null) {
        page = await readPage()
      }
      // A new request or activation owns its own work; late reads cannot replace it.
      if (cacheReadRetry.current !== key || currentActivation.current !== key) return
      // The directory refetch can still contain the account from before this read.
      await queryClient.cancelQueries({ queryKey: companyAccountKey(ticker), exact: true })
      if (cacheReadRetry.current !== key || currentActivation.current !== key) return
      cacheReadRetry.current = null
      queryClient.setQueryData(companyAccountKey(ticker), page.account)
      if (activationOf(ticker, page.account, true) !== key) return
      if (
        page.operation && page.phase && ACTIVE_STATUSES.has(page.operation.status)
        && !handledOperations.current.has(page.operation.id)
      ) {
        setWork({
          operation: page.operation,
          phase: page.phase,
          activation: key,
          collectAfterLookup: false,
        })
      }
    } catch (caught) {
      // A newer follow-up deliberately cancels the previous read, even within
      // the same activation. That cancellation is not a collection failure.
      if (isCancelledError(caught)) return
      if (cacheReadRetry.current !== key || currentActivation.current !== key) return
      setError(caught instanceof Error ? caught : new Error('Company posts cache read failed'))
    }
  }, [invalidate, queryClient, revision, setWork, ticker])

  const request = useCallback(
    async (kind: 'ensure' | 'refresh', key: string, expectedRevision: number) => {
      if (inFlight.current === key) return
      inFlight.current = key
      cacheReadRetry.current = null
      setPendingActivation(key)
      setError(null)
      try {
        const page =
          kind === 'refresh'
            ? await refreshCompanyPosts(ticker, expectedRevision)
            : await ensureCompanyPosts(ticker, expectedRevision)
        if (currentActivation.current !== key) return
        queryClient.setQueryData(companyAccountKey(ticker), page.account)
        queryClient.setQueryData(companyPostsKey(ticker, page.mapping_revision, 1), page)
        void queryClient.invalidateQueries({
          queryKey: ['twitter', 'company-posts', ticker],
          predicate: (query) => !(query.queryKey[3] === page.mapping_revision && query.queryKey[4] === 1 && query.queryKey[5] === 'newest' && query.queryKey[6] === 'all'),
        })
        if (page.operation && page.phase) {
          setWork({
            operation: page.operation,
            phase: page.phase,
            activation: key,
            collectAfterLookup: page.phase === 'account_lookup',
          })
        } else {
          forceIntent.current = false
          setWork(null)
        }
      } catch (caught) {
        if (currentActivation.current !== key) return
        forceIntent.current = false
        setWork(null)
        setError(caught instanceof Error ? caught : new Error('Company posts request failed'))
        if (caught instanceof ApiError && caught.status === 409) invalidate()
      } finally {
        if (inFlight.current === key) inFlight.current = null
        setPendingActivation((current) => (current === key ? null : current))
      }
    },
    [invalidate, queryClient, setWork, ticker],
  )

  useEffect(() => {
    if (activation === null) {
      // A real deactivation (tab or platform left): the next visit ensures again.
      ensuredActivation.current = null
      return
    }
    currentActivation.current = activation
    if (ensuredActivation.current !== activation) {
      // Refs survive Strict Mode's simulated remount, so this fires once per visit.
      ensuredActivation.current = activation
      forceIntent.current = false
      void request('ensure', activation, revision)
    }
    return () => {
      if (currentActivation.current === activation) currentActivation.current = null
    }
  }, [activation, request, revision])

  const onTerminal = useCallback(
    (operation: TwitterOperationOut) => {
      if (handledOperations.current.has(operation.id)) return
      handledOperations.current.add(operation.id)
      const recorded = workRef.current
      if (!recorded || recorded.operation.id !== operation.id) return
      const key = recorded.activation
      if (currentActivation.current !== key) return
      setWork(null)

      if (
        recorded.phase === 'posts_fetch' || operation.status !== 'succeeded'
        || !recorded.collectAfterLookup
      ) {
        forceIntent.current = false
        void refreshAfterOperation(key)
        return
      }
      // The lookup succeeded: re-read the directory (a duplicate merge may have moved
      // the revision) and chain only while the same confirmed activation is current.
      void queryClient
        .fetchQuery({
          queryKey: companyAccountKey(ticker),
          queryFn: () => getCompanyAccount(ticker),
          staleTime: 0,
        })
        .then((fresh) => {
          if (currentActivation.current !== key) return
          if (activationOf(ticker, fresh, true) !== key) return
          void request(forceIntent.current ? 'refresh' : 'ensure', key, fresh.mapping_revision)
        })
        .catch(() => undefined)
    },
    [queryClient, refreshAfterOperation, request, setWork, ticker],
  )

  const poll = useTwitterOperationPoll(work?.operation.id ?? null, onTerminal)
  const operation = work ? (poll.data ?? work.operation) : null

  const refresh = useCallback(() => {
    if (activation === null) return
    forceIntent.current = true
    void request('refresh', activation, revision)
  }, [activation, request, revision])

  const isCollecting =
    (activation !== null && pendingActivation === activation) ||
    (operation !== null && ACTIVE_STATUSES.has(operation.status))

  return {
    refresh,
    operation,
    phase: work?.phase ?? null,
    isCollecting,
    error: error ?? poll.error,
    retry: () => {
      if (poll.isError) void poll.refetch()
      else if (activation !== null && cacheReadRetry.current === activation) {
        void refreshAfterOperation(activation)
      }
      else refresh()
    },
  }
}
