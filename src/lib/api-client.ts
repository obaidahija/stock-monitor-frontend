const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const API_KEY = import.meta.env.VITE_API_KEY as string | undefined

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(status: number, detail: unknown) {
    super(typeof detail === 'string' ? detail : `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

async function requestWithResponse<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; response: Response }> {
  const headers = new Headers(init?.headers)
  if (API_KEY) headers.set('X-API-Key', API_KEY)
  if (init?.body) headers.set('Content-Type', 'application/json')

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })

  if (!res.ok) {
    let detail: unknown = null
    try {
      const body = await res.json()
      detail = body?.detail ?? body
    } catch {
      // no JSON body
    }
    throw new ApiError(res.status, detail)
  }

  const data = res.status === 204 ? (undefined as T) : ((await res.json()) as T)
  return { data, response: res }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await requestWithResponse<T>(path, init)
  return data
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  // Same as get, but also hands back the raw Response so callers can read
  // response headers (e.g. X-Total-Count for pagination) alongside the body.
  getWithResponse: <T>(path: string) => requestWithResponse<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
