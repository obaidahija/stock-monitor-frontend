import { useId } from 'react'
import { ApiError } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { SwingWindow } from '@/types/api'
import { formatWindowExpiry, RESEARCH_WINDOW_OPTIONS, sessionsLabel } from './research-window'

/**
 * A controlled 1/3/5/7 trading-session selector. Choosing a value only calls
 * onChange -- it never saves, and the browser never computes the expiry.
 */
export function ResearchWindowControl({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: number
  onChange: (sessions: number) => void
  disabled?: boolean
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium">
        Research window
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm disabled:opacity-60"
      >
        {RESEARCH_WINDOW_OPTIONS.map((sessions) => (
          <option key={sessions} value={sessions}>
            {sessionsLabel(sessions)}
          </option>
        ))}
      </select>
    </div>
  )
}

/** One line describing a resolved or previewed window, or why there is none. */
export function WindowExpiryLine({
  window,
  isPending = false,
  error = null,
}: {
  window: SwingWindow | null | undefined
  isPending?: boolean
  error?: unknown
}) {
  if (window) {
    return (
      <p className="text-muted-foreground text-xs">
        Expires {formatWindowExpiry(window.expires_at)}
      </p>
    )
  }
  if (isPending) {
    return <p className="text-muted-foreground text-xs">Resolving exchange sessions…</p>
  }
  if (error) {
    const disabled = error instanceof ApiError && error.status === 503
    return (
      <p className="text-destructive text-xs">
        {disabled
          ? 'Swing research windows are turned off.'
          : 'Could not preview the expiry; the server resolves it when you save.'}
      </p>
    )
  }
  return null
}
