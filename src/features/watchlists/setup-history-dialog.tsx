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
import { useResearchCapabilities } from '@/features/research/hooks'
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/format'
import type { WatchlistSetupOut } from '@/types/api'
import { useCloneSetup, useSetupHistory } from './hooks'
import { setupExpiryLabel, setupHorizonLabel } from './research-window'

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
  const capabilities = useResearchCapabilities()
  const swingEnabled = capabilities.data?.swing_research_enabled === true

  async function restore(setup: WatchlistSetupOut) {
    // A swing setup restores as a fresh window of the same length, anchored
    // now; with the feature off it falls back to the legacy 20-day horizon.
    const sessions = setup.horizon === 'swing' && swingEnabled ? setup.horizon_sessions : null
    const message = sessions
      ? `Restore this as a new current setup with a fresh ${sessions}-session swing window?`
      : 'Restore this as a new current setup with a fresh 20-day horizon?'
    if (!window.confirm(message)) return
    try {
      await clone.mutateAsync({
        id: setup.id,
        body: sessions
          ? { side: setup.side, horizon: 'swing', horizon_sessions: sessions, replace_existing: true }
          : { side: setup.side, horizon: 'short_term', replace_existing: true },
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
                <Button variant="ghost" size="sm" onClick={() => void restore(setup)} disabled={clone.isPending}>
                  <RotateCcw /> Restore
                </Button>
              </div>
              <div className="text-muted-foreground mt-1 grid grid-cols-2 gap-1 text-xs">
                <span>Entry {formatCurrency(setup.entry_primary)}</span>
                <span>Target {formatCurrency(setup.take_profit)}</span>
                <span>Stop {formatCurrency(setup.stop_loss)}</span>
                <span>Expires {setupExpiryLabel(setup)}</span>
                <span className="col-span-2">{setupHorizonLabel(setup)}</span>
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                {setup.source_mode === 'ai_managed' ? 'AI-managed' : 'Manual'} · {formatRelativeTime(setup.created_at)}
              </p>
              {setup.strategy_provenance && (
                <p className="text-muted-foreground text-xs">
                  From a Short Squeeze match · signal session {formatDate(setup.strategy_provenance.signal_session)}
                </p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
