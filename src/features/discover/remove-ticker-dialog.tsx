import { useState } from 'react'
import { Archive } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useArchiveTicker, useHardDeleteTicker } from './hooks'

export function RemoveTickerDialog({
  ticker,
  trigger = 'icon',
  onRemoved,
}: {
  ticker: string
  /** "icon" for a compact row action (universe table); "labeled" for a
   * standalone page action (ticker detail page header). */
  trigger?: 'icon' | 'labeled'
  /** Called after a successful archive or hard-delete — e.g. to navigate
   * away from a now-gone ticker's own detail page. */
  onRemoved?: () => void
}) {
  const [open, setOpen] = useState(false)
  const archiveTicker = useArchiveTicker()
  const hardDeleteTicker = useHardDeleteTicker()
  const pending = archiveTicker.isPending || hardDeleteTicker.isPending

  function handleArchive() {
    archiveTicker.mutate(ticker, {
      onSuccess: () => {
        toast.success(`${ticker} archived`)
        setOpen(false)
        onRemoved?.()
      },
      onError: () => toast.error(`Failed to archive ${ticker}`),
    })
  }

  function handleHardDelete() {
    hardDeleteTicker.mutate(ticker, {
      onSuccess: () => {
        toast.success(`${ticker} deleted permanently`)
        setOpen(false)
        onRemoved?.()
      },
      onError: () => toast.error(`Failed to delete ${ticker}`),
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger === 'icon' ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${ticker}`}>
            <Archive />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Archive />
            Remove
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {ticker}?</DialogTitle>
          <DialogDescription>
            Archive keeps it out of the way but reversible — it stops appearing here and in
            scheduled jobs, and won't come back on its own. Delete permanently removes it from
            the database and from the tracked-ticker source files, so it can never come back.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleArchive} disabled={pending}>
            {archiveTicker.isPending ? 'Archiving…' : 'Archive'}
          </Button>
          <Button variant="destructive" onClick={handleHardDelete} disabled={pending}>
            {hardDeleteTicker.isPending ? 'Deleting…' : 'Delete permanently'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
