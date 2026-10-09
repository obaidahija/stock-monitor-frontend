import { Loader2 } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useResearchCapabilities } from '@/features/research/hooks'
import { formatCurrency, formatDate } from '@/lib/format'
import type { ShortSqueezeDetailOut } from '@/types/short-squeeze'
import { useCreateWatchlist, useWatchlists } from './hooks'
import { DEFAULT_RESEARCH_WINDOW } from './research-window'
import { SetupFormDialog, type SetupInitialValues } from './setup-form-dialog'

const PROPOSED_TARGET_PCT = 8

/**
 * Save a long research setup from a Short Squeeze match: pick one watchlist,
 * then confirm every level in the shared setup form. Nothing is created,
 * replaced or subscribed until the user presses Save there.
 */
export function SaveShortSqueezeSetupDialog({ detail }: { detail: ShortSqueezeDetailOut }) {
  if (detail.status !== 'matched' || detail.observation_id === null) return null
  // A new evaluation or ticker remounts the flow, so no list, level or origin
  // chosen for the previous selection can be submitted for this one.
  return (
    <SaveFlow
      key={`${detail.evaluation_id}:${detail.observation_id}:${detail.ticker}`}
      detail={detail}
      observationId={detail.observation_id}
    />
  )
}

function SaveFlow({ detail, observationId }: { detail: ShortSqueezeDetailOut; observationId: number }) {
  const idPrefix = useId()
  const lists = useWatchlists(detail.ticker)
  const createList = useCreateWatchlist()
  const capabilities = useResearchCapabilities()
  const swingEnabled = capabilities.data?.swing_research_enabled === true
  const [choosing, setChoosing] = useState(false)
  const [listId, setListId] = useState<number | null>(null)
  const [replaceConfirmed, setReplaceConfirmed] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [newName, setNewName] = useState('')

  const rows = lists.data ?? []
  const selected =
    rows.find((list) => list.id === listId) ?? rows.find((list) => list.contains_ticker) ?? rows[0]
  const needsReplace = selected?.has_setup === true
  const canContinue = selected !== undefined && (!needsReplace || replaceConfirmed)
  const entry = detail.signal_close ?? detail.first_match?.signal_close ?? null

  const selectedId = selected?.id ?? null
  // Keyed on primitives only: a refetched list must not reset typed levels.
  const initialValues = useMemo<SetupInitialValues | null>(() => {
    if (entry === null || selectedId === null) return null
    return {
      identity: `short-squeeze:${detail.evaluation_id}:${observationId}:${selectedId}`,
      side: 'long',
      horizon: swingEnabled ? 'swing' : 'short_term',
      horizonSessions: DEFAULT_RESEARCH_WINDOW,
      entryPrimary: entry,
      referenceLabel: `Signal close ${formatCurrency(entry)} on ${formatDate(detail.signal_session)}: an editable reference, not a fill.`,
      proposedTargetPct: PROPOSED_TARGET_PCT,
      strategyObservationId: observationId,
      reviewLabel: detail.source_corrected
        ? 'I reviewed the corrected source data for this match.'
        : undefined,
      enforceLevelOrder: true,
    }
  }, [detail.evaluation_id, detail.signal_session, detail.source_corrected, entry, observationId, selectedId, swingEnabled])

  function closeForm(open: boolean) {
    setFormOpen(open)
    if (!open) {
      setChoosing(false)
      setReplaceConfirmed(false)
    }
  }

  async function createWatchlist() {
    const name = newName.trim()
    if (!name) return
    try {
      await createList.mutateAsync(name)
      setNewName('')
    } catch {
      toast.error('Could not create the watchlist')
    }
  }

  return (
    <div className="space-y-2">
      {!choosing && (
        <Button size="sm" variant="outline" onClick={() => setChoosing(true)} disabled={entry === null}>
          Save setup
        </Button>
      )}
      {choosing && (
        <div className="space-y-2 rounded-md border p-3 text-xs">
          <p className="text-muted-foreground">
            Choose one watchlist. You enter and confirm the levels next; nothing is saved until you press Save.
          </p>
          {lists.isPending && <Loader2 className="animate-spin" />}
          {rows.length > 0 && (
            <label className="flex items-center gap-2" htmlFor={`${idPrefix}-list`}>
              Watchlist
              <select
                id={`${idPrefix}-list`}
                className="border-input bg-background h-8 rounded-md border px-2"
                value={selected?.id ?? ''}
                onChange={(event) => {
                  setListId(Number(event.target.value))
                  setReplaceConfirmed(false)
                }}
              >
                {rows.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                    {list.has_setup ? ' (has a setup)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!lists.isPending && rows.length === 0 && (
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-new-list`}>New watchlist name</Label>
              <div className="flex gap-2">
                <Input id={`${idPrefix}-new-list`} value={newName} onChange={(event) => setNewName(event.target.value)} />
                <Button size="sm" variant="outline" onClick={() => void createWatchlist()} disabled={!newName.trim() || createList.isPending}>
                  Create watchlist
                </Button>
              </div>
            </div>
          )}
          {needsReplace && selected && (
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={replaceConfirmed}
                onChange={(event) => setReplaceConfirmed(event.target.checked)}
              />
              <span>Replace the current {detail.ticker} setup in {selected.name}</span>
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setChoosing(false)}>Back</Button>
            <Button size="sm" disabled={!canContinue || initialValues === null} onClick={() => setFormOpen(true)}>
              Continue
            </Button>
          </div>
        </div>
      )}
      {selected && initialValues && (
        <SetupFormDialog
          key={initialValues.identity}
          watchlistId={selected.id}
          ticker={detail.ticker}
          initialValues={initialValues}
          open={formOpen}
          onOpenChange={closeForm}
          replaceExisting={needsReplace && replaceConfirmed}
        />
      )}
    </div>
  )
}
