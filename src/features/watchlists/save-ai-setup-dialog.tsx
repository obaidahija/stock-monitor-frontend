import { Loader2, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
import type { AiResearchOut, WatchlistSetupHorizon, WatchlistSetupSide } from '@/types/api'
import { useCreateAiSetups, useWatchlists } from './hooks'

function inferSide(data: AiResearchOut): WatchlistSetupSide | null {
  const levels = data.price_reference
  if (
    !levels ||
    levels.entry_primary === null ||
    levels.stop_loss === null ||
    levels.take_profit === null
  ) {
    return null
  }
  const entries = [levels.entry_primary]
  if (levels.entry_secondary !== null) entries.push(levels.entry_secondary)
  if (levels.stop_loss < Math.min(...entries) && Math.max(...entries) < levels.take_profit) {
    return 'long'
  }
  if (levels.take_profit < Math.min(...entries) && Math.max(...entries) < levels.stop_loss) {
    return 'short'
  }
  return null
}

export function SaveAiSetupDialog({ data }: { data: AiResearchOut }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [horizon, setHorizon] = useState<WatchlistSetupHorizon>('short_term')
  const [expiresOn, setExpiresOn] = useState('')
  const lists = useWatchlists(data.ticker)
  const save = useCreateAiSetups()

  useEffect(() => {
    if (!open || !lists.data) return
    const memberships = lists.data.filter((list) => list.contains_ticker).map((list) => list.id)
    setSelected(new Set(memberships.length ? memberships : lists.data.slice(0, 1).map((list) => list.id)))
  }, [open, lists.data])

  const inferredSide = useMemo(() => inferSide(data), [data])

  async function handleSave() {
    if (data.snapshot_id === null || selected.size === 0 || inferredSide === null) return
    if (horizon === 'custom' && !expiresOn) return
    try {
      await save.mutateAsync({
        ticker: data.ticker,
        snapshot_id: data.snapshot_id,
        watchlist_ids: [...selected],
        horizon,
        expires_on: horizon === 'custom' ? expiresOn : undefined,
      })
      toast.success(`${data.ticker} AI setup saved`)
      setOpen(false)
    } catch {
      toast.error('Could not save this AI setup')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={data.snapshot_id === null}>
          <Save /> Save AI setup
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Save {data.ticker} AI setup</DialogTitle>
          <DialogDescription>
            The AI levels determine the trade side. Choose a horizon and one or more lists. Existing setups in selected lists are moved to history and replaced.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>AI side</Label>
            <div className="border-input bg-muted/40 flex h-8 items-center rounded-lg border px-2 text-sm capitalize">
              {inferredSide ?? 'Unavailable'}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="setup-horizon">Horizon</Label>
            <select
              id="setup-horizon"
              value={horizon}
              onChange={(event) => setHorizon(event.target.value as WatchlistSetupHorizon)}
              className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
            >
              <option value="short_term">Short term · 20 days</option>
              <option value="long_term">Long term · 60 days</option>
              <option value="custom">Custom date</option>
            </select>
          </div>
          {horizon === 'custom' && (
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="setup-expiry">Expires on</Label>
              <Input id="setup-expiry" type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} />
            </div>
          )}
        </div>

        {inferredSide === null && (
          <p className="text-destructive text-sm">
            These AI levels are incomplete or do not form a valid long or short setup. Create a manual setup instead.
          </p>
        )}

        <div className="max-h-52 space-y-2 overflow-y-auto">
          {lists.isPending && <Loader2 className="mx-auto animate-spin" />}
          {lists.data?.map((list) => (
            <label key={list.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-3">
              <input
                type="checkbox"
                checked={selected.has(list.id)}
                onChange={(event) => setSelected((current) => {
                  const next = new Set(current)
                  if (event.target.checked) next.add(list.id)
                  else next.delete(list.id)
                  return next
                })}
              />
              <span className="flex-1 font-medium">{list.name}</span>
              <span className="text-muted-foreground text-xs">
                {list.has_setup ? 'Will replace setup' : list.contains_ticker ? 'Already saved' : 'Adds ticker'}
              </span>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => void handleSave()}
            disabled={save.isPending || selected.size === 0 || inferredSide === null || (horizon === 'custom' && !expiresOn)}
          >
            {save.isPending && <Loader2 className="animate-spin" />} Save setup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
