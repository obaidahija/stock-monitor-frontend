import { Button } from '@/components/ui/button'
import type { RedditOperationOut } from '@/types/api'

type ActiveStatus = 'queued' | 'running' | 'deferred'

const MAX_FAILURE_LENGTH = 300

/** The backend's public failure message, collapsed and bounded; never the error code. */
function operationFailureText(operation: RedditOperationOut): string {
  const message = operation.public_error_message?.replace(/\s+/g, ' ').trim()
  if (!message) return 'Reddit did not complete the request.'
  return message.length > MAX_FAILURE_LENGTH ? `${message.slice(0, MAX_FAILURE_LENGTH - 1)}…` : message
}

export function OperationProgress({
  operation,
  labels,
  failure,
  retryLabel,
  onRetry,
  retrying,
}: {
  operation: RedditOperationOut | null
  labels: Record<ActiveStatus, string>
  failure: string
  retryLabel: string
  onRetry: () => void
  retrying: boolean
}) {
  if (!operation) return null
  if (operation.status === 'failed') {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-600 dark:text-red-400"
      >
        <span>
          {failure}: {operationFailureText(operation)}
        </span>
        <Button size="sm" variant="outline" disabled={retrying} onClick={onRetry}>
          {retryLabel}
        </Button>
      </div>
    )
  }
  if (operation.status === 'succeeded') return null
  return (
    <p role="status" className="text-muted-foreground text-xs">
      {labels[operation.status]}
    </p>
  )
}
