import { ApiError } from '@/lib/api-client'

/**
 * A readable reason for a rejected save. A 422 carries pydantic error
 * objects; show their messages (e.g. which research flag a switch needs)
 * rather than a bare status code.
 */
export function settingsErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const detail = error.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => (typeof item?.msg === 'string' ? item.msg : null))
        .filter((message): message is string => message !== null)
        .map((message) => message.replace(/^Value error, /, ''))
      if (messages.length > 0) return messages.join('; ')
    }
  }
  return error instanceof Error ? error.message : String(error)
}
