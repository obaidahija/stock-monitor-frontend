import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof ApiError
      ? typeof error.detail === 'string'
        ? error.detail
        : error.message
      : error instanceof Error
        ? error.message
        : 'Something went wrong.'

  return (
    <div className="border-border bg-card flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center">
      <AlertTriangle className="text-muted-foreground size-6" />
      <p className="text-muted-foreground max-w-sm text-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
