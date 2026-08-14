const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const API_KEY = import.meta.env.VITE_API_KEY as string | undefined

/**
 * Builds an absolute ws(s):// URL for `path`. Native WebSocket requires an
 * absolute URL (unlike fetch, which can use a relative path through the
 * Vite dev proxy), so this derives one from VITE_API_BASE_URL when set, or
 * falls back to the current page's origin (matching the dev-proxy setup,
 * which forwards /v1 -> the backend). The API key travels as a query param
 * since browsers can't set custom headers on a native WebSocket.
 */
export function buildWsUrl(path: string): string {
  const base = API_BASE_URL || window.location.origin
  const url = new URL(path, base)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  if (API_KEY) url.searchParams.set('api_key', API_KEY)
  return url.toString()
}
