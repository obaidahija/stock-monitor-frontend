import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Shown when the research capability check fails. Existing flows stay usable;
 * only the new research controls wait for a successful check.
 */
export function CapabilityNotice({
  isError,
  onRetry,
}: {
  isError: boolean
  onRetry: () => void
}) {
  if (!isError) return null
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
      <span>Short-term research options could not be checked.</span>
      <Button variant="ghost" size="sm" onClick={onRetry}>
        <RefreshCw /> Retry
      </Button>
    </div>
  )
}
