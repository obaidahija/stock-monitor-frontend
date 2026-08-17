import { Loader2, Pencil, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import type { SetupUpdateInput } from '@/api/watchlists'
import type {
  WatchlistSetupHorizon,
  WatchlistSetupOut,
  WatchlistSetupSide,
} from '@/types/api'
import { useCreateManualSetup, useUpdateWatchlistSetup } from './hooks'

export function SetupFormDialog({
  watchlistId,
  ticker,
  setup,
  compact = false,
}: {
  watchlistId: number
  ticker: string
  setup?: WatchlistSetupOut | null
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [side, setSide] = useState<WatchlistSetupSide>('long')
  const [horizon, setHorizon] = useState<WatchlistSetupHorizon>('short_term')
  const [expiresOn, setExpiresOn] = useState('')
  const [primary, setPrimary] = useState('')
  const [secondary, setSecondary] = useState('')
  const [stop, setStop] = useState('')
  const [target, setTarget] = useState('')
  const [note, setNote] = useState('')
  const create = useCreateManualSetup()
  const update = useUpdateWatchlistSetup()
  const isPending = create.isPending || update.isPending

  useEffect(() => {
    if (!open) return
    setSide(setup?.side ?? 'long')
    setHorizon(setup?.horizon ?? 'short_term')
    setExpiresOn(setup?.horizon === 'custom' ? setup.expires_on : '')
    setPrimary(setup ? String(setup.entry_primary) : '')
    setSecondary(setup?.entry_secondary !== null && setup?.entry_secondary !== undefined ? String(setup.entry_secondary) : '')
    setStop(setup ? String(setup.stop_loss) : '')
    setTarget(setup ? String(setup.take_profit) : '')
    setNote(setup?.note ?? '')
  }, [open, setup])

  async function handleSave() {
    const values = {
      side,
      horizon,
      expires_on: horizon === 'custom' ? expiresOn : undefined,
      entry_primary: Number(primary),
      entry_secondary: secondary ? Number(secondary) : undefined,
      stop_loss: Number(stop),
      take_profit: Number(target),
      note: note || undefined,
    }
    try {
      if (setup) {
        const body: SetupUpdateInput = {}
        if (side !== setup.side) body.side = side
        if (horizon !== setup.horizon) {
          body.horizon = horizon
          if (horizon === 'custom') body.expires_on = expiresOn
        } else if (horizon === 'custom' && expiresOn !== setup.expires_on) {
          body.expires_on = expiresOn
        }
        if (Number(primary) !== setup.entry_primary) body.entry_primary = Number(primary)
        if (Number(stop) !== setup.stop_loss) body.stop_loss = Number(stop)
        if (Number(target) !== setup.take_profit) body.take_profit = Number(target)
        const secondaryValue = secondary ? Number(secondary) : null
        if (secondaryValue !== setup.entry_secondary) {
          if (secondaryValue === null) body.clear_entry_secondary = true
          else body.entry_secondary = secondaryValue
        }
        if ((note || null) !== setup.note) body.note = note || null
        await update.mutateAsync({
          id: setup.id,
          body,
        })
      } else {
        await create.mutateAsync({ watchlist_id: watchlistId, ticker, ...values })
      }
      toast.success(`${ticker} setup ${setup ? 'updated' : 'created'}`)
      setOpen(false)
    } catch {
      toast.error('Check the long/short level order and try again')
    }
  }

  const complete =
    Number(primary) > 0 &&
    Number(stop) > 0 &&
    Number(target) > 0 &&
    (horizon !== 'custom' || Boolean(expiresOn))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size={compact ? 'icon-sm' : 'sm'}
          aria-label={compact ? (setup ? 'Edit setup' : 'Create setup') : undefined}
          title={compact ? `${setup ? 'Edit' : 'Create'} ${ticker} setup` : undefined}
        >
          {setup ? <Pencil /> : <Plus />}
          {!compact && (setup ? 'Edit setup' : 'Create setup')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{setup ? 'Edit' : 'Create'} {ticker} setup</DialogTitle>
          <DialogDescription>
            Editing the side or prices makes an AI-managed setup manual. Expiry-only changes keep AI sync enabled.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Side">
            <select value={side} onChange={(event) => setSide(event.target.value as WatchlistSetupSide)} className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm">
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </Field>
          <Field label="Horizon">
            <select value={horizon} onChange={(event) => setHorizon(event.target.value as WatchlistSetupHorizon)} className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm">
              <option value="short_term">Short term · 20 days</option>
              <option value="long_term">Long term · 60 days</option>
              <option value="custom">Custom date</option>
            </select>
          </Field>
          {horizon === 'custom' && (
            <Field label="Expires on" full><Input type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} /></Field>
          )}
          <Field label="Primary entry"><Input type="number" min="0" step="any" value={primary} onChange={(event) => setPrimary(event.target.value)} /></Field>
          <Field label="Secondary entry"><Input type="number" min="0" step="any" value={secondary} onChange={(event) => setSecondary(event.target.value)} placeholder="Optional" /></Field>
          <Field label="Stop loss"><Input type="number" min="0" step="any" value={stop} onChange={(event) => setStop(event.target.value)} /></Field>
          <Field label="Take profit"><Input type="number" min="0" step="any" value={target} onChange={(event) => setTarget(event.target.value)} /></Field>
          <Field label="Note" full><Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional context" /></Field>
        </div>

        <p className="text-muted-foreground text-xs">
          Long: stop &lt; secondary ≤ primary &lt; target. Short: target &lt; primary ≤ secondary &lt; stop.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={!complete || isPending}>
            {isPending && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? 'col-span-2 space-y-1.5' : 'space-y-1.5'}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}
