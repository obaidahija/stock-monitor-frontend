import type { QueryClient } from '@tanstack/react-query'
import type { QuoteOut } from '@/types/api'

/** Issuance numbers of two requests for the same ticker, used only to break a tie. */
export interface QuoteOrder {
  incoming: number
  current: number
}

function providerTime(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

function compareTimes(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0
  // An untimed quote never outranks a timed one, in either direction.
  if (a === null) return -1
  if (b === null) return 1
  return Math.sign(a - b)
}

/**
 * Orders two quotes for one ticker by provider observation time: the active
 * session's time first (a pre/post-market print is newer than the regular close
 * it sits on), then the regular-session time. Positive when `a` is newer,
 * negative when older, 0 when tied or both untimed.
 */
export function compareQuoteObservations(a: QuoteOut, b: QuoteOut): number {
  return (
    compareTimes(
      providerTime(a.session_time ?? a.regular_market_time),
      providerTime(b.session_time ?? b.regular_market_time),
    ) || compareTimes(providerTime(a.regular_market_time), providerTime(b.regular_market_time))
  )
}

/**
 * Whether `incoming` may replace the cached quote. A late older observation
 * never downgrades a newer one; a tie goes to the later-issued request when the
 * order is known.
 */
export function shouldAcceptQuote(
  incoming: QuoteOut,
  current: QuoteOut | undefined,
  order?: QuoteOrder,
): boolean {
  if (current === undefined) return true
  const comparison = compareQuoteObservations(incoming, current)
  if (comparison !== 0) return comparison > 0
  return order === undefined || order.incoming > order.current
}

export function normalizeQuoteTicker(ticker: string): string {
  return ticker.trim().toUpperCase()
}

export function quoteQueryKey(ticker: string) {
  return ['quote', normalizeQuoteTicker(ticker)] as const
}

export class QuoteIdentityError extends Error {
  constructor(requested: string, returned: string) {
    super(`A quote for ${returned} answered a ${requested} request`)
    this.name = 'QuoteIdentityError'
  }
}

interface QuoteRequests {
  issued: number
  versions: WeakMap<QuoteOut, number>
  refreshing: number
}

// Request bookkeeping belongs to each ticker's cache entry (per client and
// ticker), never to a rendered closure: a response is judged against whatever
// its own ticker's cache holds when it lands.
const requestsByClient = new WeakMap<QueryClient, Map<string, QuoteRequests>>()

function requestsFor(client: QueryClient, ticker: string): QuoteRequests {
  let byTicker = requestsByClient.get(client)
  if (!byTicker) {
    byTicker = new Map()
    requestsByClient.set(client, byTicker)
  }
  let requests = byTicker.get(ticker)
  if (!requests) {
    requests = { issued: 0, versions: new WeakMap(), refreshing: 0 }
    byTicker.set(ticker, requests)
  }
  return requests
}

/** Issues the next request number for one ticker's quote. */
export function issueQuoteRequest(client: QueryClient, ticker: string): number {
  const requests = requestsFor(client, ticker)
  requests.issued += 1
  return requests.issued
}

/** A response naming another ticker is an error and never reaches any cache. */
export function assertQuoteIdentity(ticker: string, incoming: QuoteOut): void {
  if (normalizeQuoteTicker(incoming.ticker ?? '') !== ticker) {
    throw new QuoteIdentityError(ticker, incoming.ticker)
  }
}

function sameQuote(a: QuoteOut, b: QuoteOut): boolean {
  // Query's structural sharing may clone a response before retaining it.
  // Quote payloads are flat, so compare all fields rather than object identity.
  const keys = Object.keys(a) as (keyof QuoteOut)[]
  return keys.length === Object.keys(b).length && keys.every((key) => Object.is(a[key], b[key]))
}

/**
 * The quote the ticker's cache should hold once this response lands: the
 * response when it is newer, otherwise what is already cached.
 */
export function reconcileQuote(
  client: QueryClient,
  ticker: string,
  incoming: QuoteOut,
  sequence: number,
): QuoteOut {
  assertQuoteIdentity(ticker, incoming)
  const requests = requestsFor(client, ticker)
  const current = client.getQueryData<QuoteOut>(quoteQueryKey(ticker))
  // A GET can be cancelled after reconciliation but before Query publishes
  // it, reverting to earlier data. Its sequence must not outrank that data.
  const currentSequence = current ? requests.versions.get(current) ?? 0 : 0
  if (!shouldAcceptQuote(incoming, current, { incoming: sequence, current: currentSequence })) {
    return current as QuoteOut
  }
  requests.versions.set(incoming, sequence)
  return incoming
}

/** Preserve request order on the exact object Query retains, including an unchanged payload. */
export function shareQuote(
  client: QueryClient,
  ticker: string,
  current: QuoteOut | undefined,
  incoming: QuoteOut,
): QuoteOut {
  const versions = requestsFor(client, ticker).versions
  const sequence = versions.get(incoming)
  const order = sequence === undefined ? undefined : {
    incoming: sequence,
    current: current ? versions.get(current) ?? 0 : 0,
  }
  if (!shouldAcceptQuote(incoming, current, order)) return current as QuoteOut
  const retained = current && sameQuote(current, incoming) ? current : incoming
  versions.set(retained, sequence ?? 0)
  return retained
}

/** Publish a refresh and attach its order even when Query clones it without an active reader. */
export function publishQuote(
  client: QueryClient,
  ticker: string,
  incoming: QuoteOut,
  sequence: number,
): QuoteOut {
  const quote = reconcileQuote(client, ticker, incoming, sequence)
  if (quote !== incoming) return quote
  const retained = client.setQueryData<QuoteOut>(quoteQueryKey(ticker), quote) ?? quote
  if (sameQuote(retained, quote)) requestsFor(client, ticker).versions.set(retained, sequence)
  return retained
}

export function isQuoteRefreshPending(client: QueryClient, ticker: string): boolean {
  return requestsFor(client, ticker).refreshing > 0
}

/** Tracks one in-flight refresh so automatic refreshes never overlap it. */
export async function trackQuoteRefresh<T>(
  client: QueryClient,
  ticker: string,
  run: () => Promise<T>,
): Promise<T> {
  const requests = requestsFor(client, ticker)
  requests.refreshing += 1
  try {
    return await run()
  } finally {
    requests.refreshing -= 1
  }
}
