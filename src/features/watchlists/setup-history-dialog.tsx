import { History, Loader2, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatCurrency, formatRelativeTime } from '@/lib/format'
import { useCloneSetup, useSetupHistory } from './hooks'

export function SetupHistoryDialog({
  itemId,
  ticker,
  compact = false,
}: {
  itemId: number
  ticker: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const history = useSetupHistory(itemId, open)
  const clone = useCloneSetup()

  async function restore(id: number, side: 'long' | 'short') {
    if (!window.confirm('Restore this as a new current setup with a fresh 20-day horizon?')) return
    try {
      await clone.mutateAsync({
        id,
        body: { side, horizon: 'short_term', replace_existing: true },
      })
      toast.success(`${ticker} setup restored`)
      setOpen(false)
    } catch {
      toast.error('Could not restore the setup')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? 'icon-sm' : 'sm'}
          aria-label={compact ? `View ${ticker} setup history` : undefined}
          title={compact ? `${ticker} setup history` : undefined}
        >
          <History />
          {!compact && 'History'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ticker} setup history</DialogTitle>
          <DialogDescription>Expired and superseded setups remain recoverable.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[28rem] space-y-3 overflow-y-auto">
          {history.isPending && <Loader2 className="mx-auto animate-spin" />}
          {history.data?.map((setup) => (
            <div key={setup.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium capitalize">{setup.side} · {setup.status}</div>
                <Button variant="ghost" size="sm" onClick={() => void restore(setup.id, setup.side)} disabled={clone.isPending}>
                  <RotateCcw /> Restore
                </Button>
              </div>
              <div className="text-muted-foreground mt-1 grid grid-cols-2 gap-1 text-xs">
                <span>Entry {formatCurrency(setup.entry_primary)}</span>
                <span>Target {formatCurrency(setup.take_profit)}</span>
                <span>Stop {formatCurrency(setup.stop_loss)}</span>
                <span>Expires {setup.expires_on}</span>
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                {setup.source_mode === 'ai_managed' ? 'AI-managed' : 'Manual'} · {formatRelativeTime(setup.created_at)}
              </p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
