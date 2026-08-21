import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'
import { useAddCustomTicker } from './hooks'

/** Standalone "Add to tracked universe" action for a ticker whose symbol is
 * already known (e.g. the ticker detail page header) — unlike
 * AddTickerDialog, there's no form: it just POSTs the ticker straight away. */
export function AddTrackedTickerButton({ ticker }: { ticker: string }) {
  const addCustomTicker = useAddCustomTicker()

  function handleClick() {
    addCustomTicker.mutate(
      { ticker },
      {
        onSuccess: () => toast.success(`${ticker} added to tracked universe`),
        onError: (err) => {
          toast.error(
            err instanceof ApiError && typeof err.detail === 'string'
              ? err.detail
              : `Failed to add ${ticker}`,
          )
        },
      },
    )
  }

  return (
    <Button size="sm" onClick={handleClick} disabled={addCustomTicker.isPending} className="cursor-pointer">
      <Plus />
      {addCustomTicker.isPending ? 'Adding…' : 'Add to tracked universe'}
    </Button>
  )
}
