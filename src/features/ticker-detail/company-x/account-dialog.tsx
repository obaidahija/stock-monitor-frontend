import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorState } from '@/components/shared/error-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTwitterOperationPoll } from '@/features/twitter/use-operation-poll'
import { ApiError } from '@/lib/api-client'
import type { CompanyAccountOut, CompanyAccountType } from '@/types/twitter-company'
import { companyAccountKey, useSaveCompanyAccount, useValidateCompanyAccount } from './hooks'
import {
  ACCOUNT_TYPE_HINTS,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES,
  endSentence,
  previewHandle,
} from './labels'

function isHttpLink(value: string) {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0
  } catch {
    return false
  }
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const detail = error.detail as { message?: unknown } | string | null
    if (typeof detail === 'string') return detail
    if (detail && typeof detail.message === 'string') return detail.message
  }
  return 'The account could not be saved. Try again.'
}

function isRevisionConflict(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    (error.detail as { code?: unknown } | null)?.code === 'revision_conflict'
  )
}

/**
 * Add, change or confirm the X account a ticker's company posts come from. Saving for
 * review never confirms; "Save and confirm" is the user's explicit confirmation of
 * exactly the handle shown, at the revision this dialog was showing.
 */
export function CompanyAccountDialog({
  ticker,
  account,
  open,
  onOpenChange,
}: {
  ticker: string
  account: CompanyAccountOut
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [selection, setSelection] = useState(account.username ?? '')
  const [accountType, setAccountType] = useState<CompanyAccountType>(
    account.account_type ?? 'corporate',
  )
  const [sourceUrl, setSourceUrl] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [editRevision, setEditRevision] = useState(account.mapping_revision)
  const needsReview = conflict || editRevision !== account.mapping_revision
  const save = useSaveCompanyAccount(ticker)
  const validate = useValidateCompanyAccount(ticker)
  const lookup = useTwitterOperationPoll(validate.data?.id ?? null, () => {
    void queryClient.invalidateQueries({ queryKey: companyAccountKey(ticker) })
    void queryClient.invalidateQueries({ queryKey: ['twitter', 'company-posts', ticker] })
  })

  const handle = previewHandle(selection)
  const company = account.company_name ?? ticker
  const savedHandle = account.username
  const checking =
    validate.isPending ||
    lookup.data?.status === 'queued' ||
    lookup.data?.status === 'running' ||
    lookup.data?.status === 'deferred'
  const canCheck =
    savedHandle !== null && handle !== null && handle.toLowerCase() === savedHandle.toLowerCase()

  function submit(confirmAccount: boolean) {
    if (needsReview) return
    setFormError(null)
    const source = sourceUrl.trim()
    if (source && !isHttpLink(source)) {
      setFormError('Enter a full http:// or https:// link.')
      return
    }
    if (!selection.trim()) {
      setFormError('Enter an X handle (@name) or an x.com profile URL.')
      return
    }
    save.mutate(
      {
        selection: selection.trim(),
        account_type: accountType,
        source_urls: source ? [source] : [],
        expected_revision: editRevision,
        confirm_account: confirmAccount,
      },
      {
        onSuccess: () => {
          setConflict(false)
          onOpenChange(false)
        },
        onError: (error) => {
          if (isRevisionConflict(error)) {
            setConflict(true)
            return
          }
          setFormError(errorMessage(error))
        },
      },
    )
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    submit(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {savedHandle ? 'Change the X account for ' : 'Add an X account for '}
              {ticker}
            </DialogTitle>
            <DialogDescription>{company}</DialogDescription>
          </DialogHeader>

          {savedHandle && (
            <p className="text-muted-foreground text-sm">
              Current selection: @{savedHandle}
              {account.confirmation_state === 'confirmed' ? ' (confirmed)' : ' (not confirmed)'}
            </p>
          )}

          {needsReview && (
            <div className="space-y-2">
              <p role="alert" className="text-destructive text-sm">
                This account changed while you were editing. Review the current selection before
                saving again.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditRevision(account.mapping_revision)
                  setConflict(false)
                }}
              >
                Review current selection
              </Button>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="company-x-handle">X account</Label>
            <Input
              id="company-x-handle"
              value={selection}
              onChange={(event) => setSelection(event.target.value)}
              placeholder="@handle or https://x.com/handle"
              autoComplete="off"
              autoFocus
            />
            {handle && (
              <a
                href={`https://x.com/${handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary w-fit text-xs underline-offset-2 hover:underline"
              >
                x.com/{handle}
              </a>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="company-x-type">Account type</Label>
            <Select
              value={accountType}
              onValueChange={(value) => setAccountType(value as CompanyAccountType)}
            >
              <SelectTrigger id="company-x-type" aria-label="Account type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {ACCOUNT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {ACCOUNT_TYPE_HINTS[accountType] && (
              <p className="text-muted-foreground text-xs">{ACCOUNT_TYPE_HINTS[accountType]}</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="company-x-source">Company source link (optional)</Label>
            <Input
              id="company-x-source"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://investor.example.com/contact"
              inputMode="url"
              autoComplete="off"
            />
            <p className="text-muted-foreground text-xs">
              A company page that links this account. It is stored as evidence, not visited.
            </p>
          </div>

          {savedHandle && (
            <div className="bg-muted/40 space-y-2 rounded-lg p-3">
              {account.profile ? (
                <div className="flex items-start gap-3">
                  {account.profile.profile_image_url && (
                    <img
                      src={account.profile.profile_image_url}
                      alt=""
                      className="size-10 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">{account.profile.name ?? account.profile.username}</p>
                    <p className="text-muted-foreground">@{account.profile.username}</p>
                    {account.profile.bio && <p className="mt-1">{account.profile.bio}</p>}
                  </div>
                </div>
              ) : null}
              <p className="text-muted-foreground text-xs">
                Checking the profile looks it up on X. It does not confirm the account.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canCheck || checking || needsReview}
                onClick={() => validate.mutate(editRevision)}
              >
                {checking ? `Checking @${savedHandle}…` : 'Check profile'}
              </Button>
            </div>
          )}

          {account.candidates.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Leads found during research</p>
              <p className="text-muted-foreground text-xs">
                These were not confirmed as belonging to {company}. Choose one only after
                checking it.
              </p>
              <ul className="space-y-1.5">
                {account.candidates.map((candidate) => (
                  <li
                    key={candidate.handle}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0">
                      <a
                        href={`https://x.com/${candidate.handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline-offset-2 hover:underline"
                      >
                        @{candidate.handle}
                      </a>
                      {candidate.excluded && (
                        <span className="text-muted-foreground"> (ruled out)</span>
                      )}
                      {candidate.source_url && (
                        <a
                          href={candidate.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground ml-2 text-xs underline-offset-2 hover:underline"
                        >
                          Where it was found
                        </a>
                      )}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelection(candidate.handle)}
                    >
                      Use @{candidate.handle}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {formError && (
            <p role="alert" className="text-destructive text-sm">
              {formError}
            </p>
          )}
          {validate.error && <ErrorState error={validate.error} />}
          {lookup.error && (
            <ErrorState error={lookup.error} onRetry={() => { void lookup.refetch() }} />
          )}
          {lookup.data?.status === 'failed' && lookup.data.public_error_message && (
            <p role="alert" className="text-destructive text-sm">{lookup.data.public_error_message}</p>
          )}

          <p className="text-muted-foreground text-xs">
            Save and confirm means you confirm @{handle ?? selection.trim()} is the X account to use
            for {endSentence(company)}
          </p>

          <DialogFooter>
            <Button type="submit" variant="outline" disabled={save.isPending || needsReview}>
              Save for review
            </Button>
            <Button type="button" disabled={save.isPending || needsReview} onClick={() => submit(true)}>
              Save and confirm
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
