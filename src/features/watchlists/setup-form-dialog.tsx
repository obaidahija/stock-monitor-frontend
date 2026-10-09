import { Loader2, Pencil, Plus } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
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
import type { ManualSetupInput, SetupUpdateInput } from '@/api/watchlists'
import { useResearchCapabilities, useSetupWindowPreview } from '@/features/research/hooks'
import type {
  WatchlistSetupHorizon,
  WatchlistSetupOut,
  WatchlistSetupSide,
} from '@/types/api'
import { useCreateManualSetup, useUpdateWatchlistSetup } from './hooks'
import { DEFAULT_RESEARCH_WINDOW, isSwingDisabledError } from './research-window'
import { ResearchWindowControl, WindowExpiryLine } from './research-window-control'

/**
 * Proposed values for a new setup, e.g. from a Short Squeeze match. Every
 * level stays editable and stop/target are still entered by the user. Pass a
 * memoized object: a new one resets the form, which is how nothing carries
 * from one origin (``identity``) to the next.
 */
export interface SetupInitialValues {
  identity: string
  side: WatchlistSetupSide
  horizon: WatchlistSetupHorizon
  horizonSessions?: number
  entryPrimary: number
  /** Dated description of where the entry came from; never a fill. */
  referenceLabel?: string
  /** Offers an explicit "Use N% target" proposal from the chosen entry. */
  proposedTargetPct?: number
  strategyObservationId?: number
  /** Requires this checkbox before Save, e.g. after a source correction. */
  reviewLabel?: string
  /** Disable Save until the levels are in valid long/short order. */
  enforceLevelOrder?: boolean
}

function proposeTarget(entry: string, pct: number): string {
  const value = Number(entry)
  if (!(value > 0)) return ''
  return String(Math.round(value * (1 + pct / 100) * 100) / 100)
}

function levelsInOrder(
  side: WatchlistSetupSide,
  primary: number,
  secondary: number | null,
  stop: number,
  target: number,
): boolean {
  const entries = secondary === null ? [primary] : [primary, secondary]
  const low = Math.min(...entries)
  const high = Math.max(...entries)
  if (secondary !== null && (side === 'long' ? secondary > primary : secondary < primary)) {
    return false
  }
  return side === 'long' ? stop < low && high < target : target < low && high < stop
}

export function SetupFormDialog({
  watchlistId,
  ticker,
  setup,
  compact = false,
  initialValues,
  open: controlledOpen,
  onOpenChange,
  replaceExisting = false,
}: {
  watchlistId: number
  ticker: string
  setup?: WatchlistSetupOut | null
  compact?: boolean
  initialValues?: SetupInitialValues
  /** Controlled mode: the caller owns opening, and no trigger button renders. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Send replace_existing: the caller has had the user confirm the replacement. */
  replaceExisting?: boolean
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const controlled = controlledOpen !== undefined
  const open = controlled ? controlledOpen : uncontrolledOpen
  function setOpen(next: boolean) {
    if (controlled) onOpenChange?.(next)
    else setUncontrolledOpen(next)
  }
  const idPrefix = useId()
  const [side, setSide] = useState<WatchlistSetupSide>('long')
  const [horizon, setHorizon] = useState<WatchlistSetupHorizon>('short_term')
  const [sessions, setSessions] = useState(DEFAULT_RESEARCH_WINDOW)
  const [expiresOn, setExpiresOn] = useState('')
  const [primary, setPrimary] = useState('')
  const [secondary, setSecondary] = useState('')
  const [stop, setStop] = useState('')
  const [target, setTarget] = useState('')
  const [note, setNote] = useState('')
  // True only while the target is the explicit proposal and the user has not edited it.
  const [autoTarget, setAutoTarget] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const create = useCreateManualSetup()
  const update = useUpdateWatchlistSetup()
  const capabilities = useResearchCapabilities()
  const swingEnabled = capabilities.data?.swing_research_enabled === true
  const isPending = create.isPending || update.isPending
  const proposal = setup ? undefined : initialValues

  // A saved swing setup keeps its own window until the timing really changes.
  const showsSavedWindow =
    setup?.horizon === 'swing' && horizon === 'swing' && sessions === setup.horizon_sessions
  const preview = useSetupWindowPreview(
    sessions,
    open && horizon === 'swing' && swingEnabled && !showsSavedWindow,
  )

  useEffect(() => {
    if (!open) return
    setAutoTarget(false)
    setReviewed(false)
    if (proposal) {
      setSide(proposal.side)
      setHorizon(proposal.horizon)
      setSessions(proposal.horizonSessions ?? DEFAULT_RESEARCH_WINDOW)
      setExpiresOn('')
      setPrimary(String(proposal.entryPrimary))
      setSecondary('')
      setStop('')
      setTarget('')
      setNote('')
      return
    }
    setSide(setup?.side ?? 'long')
    setHorizon(setup?.horizon ?? 'short_term')
    setSessions(setup?.horizon_sessions ?? DEFAULT_RESEARCH_WINDOW)
    setExpiresOn(setup?.horizon === 'custom' ? setup.expires_on : '')
    setPrimary(setup ? String(setup.entry_primary) : '')
    setSecondary(setup?.entry_secondary !== null && setup?.entry_secondary !== undefined ? String(setup.entry_secondary) : '')
    setStop(setup ? String(setup.stop_loss) : '')
    setTarget(setup ? String(setup.take_profit) : '')
    setNote(setup?.note ?? '')
    // Reset on opening and when a new proposal arrives -- never on ordinary
    // re-renders, so typed values survive a failed save.
  }, [open, setup, proposal])

  function changePrimary(value: string) {
    setPrimary(value)
    if (autoTarget && proposal?.proposedTargetPct !== undefined) {
      setTarget(proposeTarget(value, proposal.proposedTargetPct))
    }
  }

  function changeTarget(value: string) {
    setTarget(value)
    setAutoTarget(false)
  }

  function applyProposedTarget() {
    if (proposal?.proposedTargetPct === undefined) return
    setTarget(proposeTarget(primary, proposal.proposedTargetPct))
    setAutoTarget(true)
  }

  async function handleSave() {
    const values = {
      side,
      horizon,
      expires_on: horizon === 'custom' ? expiresOn : undefined,
      // Only a swing window has a session count; the server resolves its expiry.
      ...(horizon === 'swing' ? { horizon_sessions: sessions } : {}),
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
          if (horizon === 'swing') body.horizon_sessions = sessions
        } else if (horizon === 'custom' && expiresOn !== setup.expires_on) {
          body.expires_on = expiresOn
        } else if (horizon === 'swing' && sessions !== setup.horizon_sessions) {
          body.horizon_sessions = sessions
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
        const body: ManualSetupInput = { watchlist_id: watchlistId, ticker, ...values }
        // Read from the current props at submit time, never from earlier state.
        if (proposal?.strategyObservationId !== undefined) {
          body.strategy_observation_id = proposal.strategyObservationId
        }
        if (replaceExisting) body.replace_existing = true
        await create.mutateAsync(body)
      }
      toast.success(`${ticker} setup ${setup ? 'updated' : 'created'}`)
      setOpen(false)
    } catch (error) {
      toast.error(
        isSwingDisabledError(error)
          ? 'Swing research windows are turned off'
          : 'Check the long/short level order and try again',
      )
    }
  }

  const complete =
    Number(primary) > 0 &&
    Number(stop) > 0 &&
    Number(target) > 0 &&
    (horizon !== 'custom' || Boolean(expiresOn))
  const ordered =
    !proposal?.enforceLevelOrder ||
    levelsInOrder(side, Number(primary), secondary ? Number(secondary) : null, Number(stop), Number(target))
  const reviewDone = !proposal?.reviewLabel || reviewed
  const offerSwing = swingEnabled || setup?.horizon === 'swing'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && (
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
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{setup ? 'Edit' : 'Create'} {ticker} setup</DialogTitle>
          <DialogDescription>
            {proposal
              ? 'Confirm the entry, stop, target and window yourself. Saving records a research setup; nothing is traded.'
              : 'Editing the side or prices makes an AI-managed setup manual. Expiry-only changes keep AI sync enabled.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Side" htmlFor={`${idPrefix}-side`}>
            <select id={`${idPrefix}-side`} value={side} onChange={(event) => setSide(event.target.value as WatchlistSetupSide)} className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm">
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </Field>
          <Field label="Horizon" htmlFor={`${idPrefix}-horizon`}>
            <select id={`${idPrefix}-horizon`} value={horizon} onChange={(event) => setHorizon(event.target.value as WatchlistSetupHorizon)} className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm">
              <option value="short_term">Short term · 20 days</option>
              <option value="long_term">Long term · 60 days</option>
              <option value="custom">Custom date</option>
              {offerSwing && <option value="swing">Swing · 1–7 trading sessions</option>}
            </select>
          </Field>
          {horizon === 'custom' && (
            <Field label="Expires on" htmlFor={`${idPrefix}-expires-on`} full><Input id={`${idPrefix}-expires-on`} type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} /></Field>
          )}
          {horizon === 'swing' && (
            <div className="col-span-2 space-y-1.5">
              <ResearchWindowControl value={sessions} onChange={setSessions} disabled={!swingEnabled} />
              <WindowExpiryLine
                window={showsSavedWindow ? setup?.window : preview.data?.window}
                isPending={!showsSavedWindow && swingEnabled && preview.isPending}
                error={showsSavedWindow ? null : preview.error}
              />
            </div>
          )}
          <Field label="Primary entry" htmlFor={`${idPrefix}-primary`}><Input id={`${idPrefix}-primary`} type="number" min="0" step="any" value={primary} onChange={(event) => changePrimary(event.target.value)} /></Field>
          <Field label="Secondary entry" htmlFor={`${idPrefix}-secondary`}><Input id={`${idPrefix}-secondary`} type="number" min="0" step="any" value={secondary} onChange={(event) => setSecondary(event.target.value)} placeholder="Optional" /></Field>
          {proposal?.referenceLabel && (
            <p className="text-muted-foreground col-span-2 -mt-1 text-xs">{proposal.referenceLabel}</p>
          )}
          <Field label="Stop loss" htmlFor={`${idPrefix}-stop`}><Input id={`${idPrefix}-stop`} type="number" min="0" step="any" value={stop} onChange={(event) => setStop(event.target.value)} /></Field>
          <Field label="Take profit" htmlFor={`${idPrefix}-target`}><Input id={`${idPrefix}-target`} type="number" min="0" step="any" value={target} onChange={(event) => changeTarget(event.target.value)} /></Field>
          {proposal?.proposedTargetPct !== undefined && (
            <div className="col-span-2 flex flex-wrap items-center gap-2 text-xs">
              <Button type="button" variant="outline" size="sm" onClick={applyProposedTarget} disabled={!(Number(primary) > 0)}>
                Use {proposal.proposedTargetPct}% target
              </Button>
              <span className="text-muted-foreground">
                {autoTarget
                  ? 'Follows the entry until you edit it.'
                  : `Optional: entry × ${(1 + proposal.proposedTargetPct / 100).toFixed(2)}. Not a reward/risk judgement.`}
              </span>
            </div>
          )}
          <Field label="Note" htmlFor={`${idPrefix}-note`} full><Input id={`${idPrefix}-note`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional context" /></Field>
          {proposal?.reviewLabel && (
            <label className="col-span-2 flex items-start gap-2 text-xs">
              <input type="checkbox" className="mt-0.5" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
              <span>{proposal.reviewLabel}</span>
            </label>
          )}
        </div>

        <p className="text-muted-foreground text-xs">
          Long: stop &lt; secondary ≤ primary &lt; target. Short: target &lt; primary ≤ secondary &lt; stop.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={!complete || !ordered || !reviewDone || isPending}>
            {isPending && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  htmlFor,
  full,
  children,
}: {
  label: string
  htmlFor: string
  full?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={full ? 'col-span-2 space-y-1.5' : 'space-y-1.5'}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
