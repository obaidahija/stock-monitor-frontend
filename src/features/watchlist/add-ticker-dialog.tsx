import { useState } from 'react'
import { Plus } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api-client'
import { useAddToWatchlist } from './hooks'

const TICKER_RE = /^[A-Z]{1,5}(\.[A-Z])?$/

export function AddTickerDialog() {
  const [open, setOpen] = useState(false)
  const [ticker, setTicker] = useState('')
  const [note, setNote] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const addToWatchlist = useAddToWatchlist()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const normalized = ticker.trim().toUpperCase()
    if (!TICKER_RE.test(normalized)) {
      setValidationError('Must look like a US equity symbol, e.g. NVDA or BRK.B')
      return
    }
    setValidationError(null)

    addToWatchlist.mutate(
      { ticker: normalized, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(`${normalized} added to watchlist`)
          setTicker('')
          setNote('')
          setOpen(false)
        },
        onError: (err) => {
          toast.error(
            err instanceof ApiError && typeof err.detail === 'string'
              ? err.detail
              : 'Failed to add ticker',
          )
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Add ticker
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add ticker to watchlist</DialogTitle>
            <DialogDescription>
              Tracked for filings, earnings, news, and premarket movement.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="ticker">Ticker</Label>
              <Input
                id="ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="NVDA"
                autoFocus
              />
              {validationError && <p className="text-destructive text-xs">{validationError}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="note">Note (optional)</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why you're watching this"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={addToWatchlist.isPending}>
              {addToWatchlist.isPending ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
