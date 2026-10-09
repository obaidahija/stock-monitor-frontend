import { useId, useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Pagination } from '@/components/shared/pagination'
import { formatEasternDate, formatEasternDateTime, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CompanyAccountOut, CompanyPostsPageOut, CompanyPostsSort, CompanyPostsView } from '@/types/twitter-company'
import { CompanyAccountDialog } from './account-dialog'
import { CompanyPostRow } from './company-post-row'
import { ACCOUNT_TYPE_LABELS, BASIS_LABELS, endSentence } from './labels'
import {
  useCompanyAccount,
  useCompanyPosts,
  useConfirmCompanyAccount,
  useRemoveCompanyAccount,
  useRetryCompanyAnalysis,
} from './hooks'
import { useCompanyCollection } from './use-company-collection'

const AUTH_PROBLEMS = new Set(['invalid', 'missing'])
const externalLink = 'underline-offset-2 hover:underline'

function profileUrl(handle: string) {
  return `https://x.com/${handle}`
}

function SourceDetails({ account }: { account: CompanyAccountOut }) {
  const [open, setOpen] = useState(false)
  const regionId = useId()
  const leads = account.candidates
  return (
    <div className="text-sm">
      <Button
        type="button"
        size="sm"
        variant="link"
        className="text-muted-foreground h-auto px-0 text-xs"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? 'Hide source details' : 'Source details'}
      </Button>
      {open && (
      <div id={regionId} className="mt-2 space-y-2" data-testid="company-source-details">
        {account.confirmed_at && (
          <p className="text-muted-foreground text-xs">
            Confirmed {formatEasternDate(account.confirmed_at)}
          </p>
        )}
        {account.notes && <p className="text-muted-foreground">{account.notes}</p>}
        {account.source_urls.length > 0 && (
          <ul className="space-y-0.5 text-xs">
            {account.source_urls.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer" className={cn(externalLink, 'break-all')}>
                  {url}
                </a>
              </li>
            ))}
          </ul>
        )}
        {leads.length > 0 && (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Other leads from research, not confirmed:</p>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {leads.map((lead) => (
                <li key={lead.handle}>
                  <a href={profileUrl(lead.handle)} target="_blank" rel="noopener noreferrer" className={externalLink}>
                    @{lead.handle}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      )}
    </div>
  )
}

/** One explanation at a time, most serious first; each says what to do next. */
function collectionProblem(
  account: CompanyAccountOut,
  page: CompanyPostsPageOut | undefined,
): { message: string; retry: boolean } | null {
  const handle = `@${account.username}`
  if (account.runtime_state === 'identity_conflict') {
    return {
      message: `${handle} now belongs to a different X account. Review and confirm the company account.`,
      retry: false,
    }
  }
  if (AUTH_PROBLEMS.has(account.auth.state) || page?.public_error_code === 'authentication_invalid') {
    return { message: "Twitter sign-in needs attention, so company posts can't refresh.", retry: false }
  }
  if (account.runtime_state === 'not_found') {
    return { message: `X couldn't find ${handle}. The handle may have changed.`, retry: true }
  }
  if (account.runtime_state === 'unavailable') {
    return { message: `Couldn't check ${handle} on X right now.`, retry: true }
  }
  if (page?.public_error_message) {
    const hasCache = page.cache_state === 'ready' || page.cache_state === 'empty'
    const when = page.cache_fetched_at ? ` Showing posts from ${formatRelativeTime(page.cache_fetched_at)}.` : ''
    return {
      message: hasCache
        ? `Couldn't refresh company posts: ${page.public_error_message}${when}`
        : `Couldn't load company posts: ${page.public_error_message}`,
      retry: true,
    }
  }
  return null
}

/**
 * Posts from the ticker's confirmed company X account, read from the server's cache.
 * Collection starts only while this section is active (see useCompanyCollection);
 * paging and every read here are cache reads. Unconfirmed and missing mappings show
 * what to do instead of posts.
 */
export function CompanyPostsSection({ ticker, active = true }: { ticker: string; active?: boolean }) {
  const headingId = useId()
  const accountQuery = useCompanyAccount(ticker)
  const account = accountQuery.data
  const confirmed = account?.confirmation_state === 'confirmed' && account.username !== null
  const revision = account?.mapping_revision ?? 0
  const collection = useCompanyCollection({ ticker, account, active })

  const [selection, setSelection] = useState<{ key: string; sort: CompanyPostsSort; view: CompanyPostsView }>({ key: ticker, sort: 'newest', view: 'all' })
  const sort = selection.key === ticker ? selection.sort : 'newest'
  const view = selection.key === ticker ? selection.view : 'all'
  const pageKey = `${ticker}:${revision}:${sort}:${view}`
  const [pageState, setPageState] = useState({ key: pageKey, page: 1 })
  const page = pageState.key === pageKey ? pageState.page : 1
  const postsQuery = useCompanyPosts(ticker, revision, page, { enabled: confirmed, active, sort, view })
  const retryAnalysis = useRetryCompanyAnalysis(ticker)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const confirmAccount = useConfirmCompanyAccount(ticker)
  const removeAccount = useRemoveCompanyAccount(ticker)

  const loadedPage = postsQuery.data
  if (
    loadedPage && !postsQuery.isPlaceholderData &&
    loadedPage.mapping_revision === revision && loadedPage.page === page
  ) {
    const lastPage = Math.max(1, Math.ceil(loadedPage.total / loadedPage.page_size))
    if (page > lastPage) setPageState({ key: pageKey, page: lastPage })
  }

  if (accountQuery.isPending) {
    return <Skeleton className="h-32 rounded-xl" />
  }
  if (accountQuery.isError || !account) {
    return <ErrorState error={accountQuery.error} onRetry={() => accountQuery.refetch()} />
  }

  const handle = account.username
  const company = account.company_name ?? ticker
  const data = postsQuery.data
  const cacheBlocked =
    account.runtime_state === 'identity_conflict' ||
    data?.cache_state === 'blocked' ||
    (data !== undefined && data.mapping_revision !== revision)
  const problem = confirmed ? collectionProblem(account, data) : null
  const collectingCopy =
    collection.phase === 'account_lookup' ? `Looking up @${handle} on X…` : `Collecting posts from @${handle}…`

  function openDialog() {
    setDialogOpen(true)
  }

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="space-y-1">
        <h3 id={headingId} className="text-sm font-semibold">
          Company posts
        </h3>
        {handle && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <a href={profileUrl(handle)} target="_blank" rel="noopener noreferrer" className={cn(externalLink, 'font-medium')}>
              @{handle}
            </a>
            {account.account_type && <Badge variant="outline">{ACCOUNT_TYPE_LABELS[account.account_type]}</Badge>}
            {confirmed && account.confirmation_basis && (
              <Badge variant="secondary">{BASIS_LABELS[account.confirmation_basis]}</Badge>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {confirmed && (
          <>
            <Button
              size="sm"
              variant="outline"
              aria-label="Refresh company posts"
              disabled={collection.isCollecting || account.runtime_state === 'identity_conflict'}
              onClick={() => collection.refresh()}
            >
              <RefreshCw className={cn(collection.isCollecting && 'animate-spin')} />
              Refresh
            </Button>
            <Button size="sm" variant="ghost" onClick={openDialog}>
              Change account
            </Button>
            <Button size="sm" variant="ghost" onClick={() => {
              removeAccount.reset()
              setRemoveOpen(true)
            }}>
              Remove account
            </Button>
          </>
        )}
      </div>
    </div>
  )

  let body
  if (!handle) {
    body =
      account.candidates.length > 0 ? (
        <Alert>
          <AlertTriangle />
          <AlertDescription className="space-y-2">
            <p>The company account has not been confirmed.</p>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {account.candidates.map((lead) => (
                <li key={lead.handle}>
                  <a href={profileUrl(lead.handle)} target="_blank" rel="noopener noreferrer" className={externalLink}>
                    @{lead.handle}
                  </a>
                </li>
              ))}
            </ul>
            <Button size="sm" onClick={openDialog}>
              Add account
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <EmptyState
          title={`No official X account has been added for ${ticker}.`}
          description="Add the company's X account to see its recent posts here."
          action={
            <Button size="sm" onClick={openDialog}>
              Add account
            </Button>
          }
        />
      )
  } else if (!confirmed) {
    body = (
      <Alert>
        <AlertTriangle />
        <AlertDescription className="space-y-2">
          <p>This account needs your confirmation. Company posts will load after you confirm it.</p>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={openDialog}>
              Review account
            </Button>
            <Button size="sm" onClick={() => {
              confirmAccount.reset()
              setConfirmOpen(true)
            }}>
              Confirm account
            </Button>
            <Button size="sm" variant="ghost" onClick={openDialog}>
              Change account
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  } else {
    const items = cacheBlocked ? [] : data?.items ?? []
    const hasCache = data?.cache_state === 'ready' || data?.cache_state === 'empty'
    body = (
      <div className="space-y-3">
        {!cacheBlocked && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={sort} onValueChange={(value) => setSelection({ key: ticker, sort: value as CompanyPostsSort, view })}>
                <SelectTrigger size="sm" aria-label="Sort company posts"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup><SelectItem value="newest">Newest</SelectItem><SelectItem value="importance">Importance</SelectItem></SelectGroup></SelectContent>
              </Select>
              <Select value={view} onValueChange={(value) => setSelection({ key: ticker, sort, view: value as CompanyPostsView })}>
                <SelectTrigger size="sm" aria-label="Company posts view"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup><SelectItem value="all">All posts</SelectItem><SelectItem value="company_news">Company news</SelectItem></SelectGroup></SelectContent>
              </Select>
              {((data?.analysis_failed_count ?? 0) > 0 || items.some((post) => post.analysis?.status === 'unavailable')) && (
                <Button size="sm" variant="outline" disabled={retryAnalysis.isPending} onClick={() => retryAnalysis.mutate(revision)}>Retry AI analysis</Button>
              )}
            </div>
            {(data?.analysis_pending_count ?? 0) > 0 && <p className="text-muted-foreground text-xs" aria-live="polite">Analyzing {data?.analysis_pending_count} company posts…</p>}
            {view === 'company_news' && <p className="text-muted-foreground text-xs">Potential company news and posts awaiting an AI decision.</p>}
            <details className="text-muted-foreground text-xs">
              <summary className="cursor-pointer">About AI importance</summary>
              <p className="mt-1">Estimated business significance: 0–29 routine promotion; 30–59 concrete updates; 60–79 significant developments; 80–100 potentially major events. Based on the post's stated facts; it is not a price prediction.</p>
            </details>
            {retryAnalysis.error && <ErrorState error={retryAnalysis.error} onRetry={() => retryAnalysis.mutate(revision)} />}
          </div>
        )}
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {collection.isCollecting
            ? collectingCopy
            : data?.cache_fetched_at
              ? `Updated ${formatRelativeTime(data.cache_fetched_at)}`
              : null}
          {!collection.isCollecting && data?.cache_fetched_at && (
            <span className="sr-only"> ({formatEasternDateTime(data.cache_fetched_at)})</span>
          )}
        </p>

        {problem && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>{problem.message}</span>
              {problem.retry && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={collection.isCollecting}
                  onClick={() => collection.refresh()}
                >
                  Retry
                </Button>
              )}
              {AUTH_PROBLEMS.has(account.auth.state) && (
                <Button asChild size="sm" variant="outline">
                  <Link to="/social/twitter">Open Twitter settings</Link>
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {collection.error && !cacheBlocked && (
          <ErrorState error={collection.error} onRetry={() => collection.retry()} />
        )}
        {postsQuery.isError && !cacheBlocked && (
          <ErrorState error={postsQuery.error} onRetry={() => { void postsQuery.refetch() }} />
        )}

        {cacheBlocked ? null : !data || !hasCache ? (
          collection.isCollecting || postsQuery.isPending ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : (
            !postsQuery.isError && !collection.error && (
              <EmptyState
                title="No company posts collected yet."
                description="Refresh to collect this account's posts from the last seven days."
              />
            )
          )
        ) : data.total === 0 ? (
          <EmptyState title={view === 'company_news' && data.cache_state === 'ready' ? 'No company news in this cached snapshot.' : `No posts from @${handle} in the last seven days.`} />
        ) : (
          <>
            <div className="space-y-2">
              {items.map((post) => (
                <CompanyPostRow key={post.id} post={post} />
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">
                {items.length > 0
                  ? `Showing ${(page - 1) * data.page_size + 1}–${(page - 1) * data.page_size + items.length} of ${data.total}`
                  : `No posts on this page. ${data.total} in total.`}
              </p>
              <Pagination
                page={page}
                totalPages={Math.max(1, Math.ceil(data.total / data.page_size))}
                onPageChange={(next) => setPageState({ key: pageKey, page: next })}
              />
            </div>
          </>
        )}

        {!cacheBlocked && data?.is_truncated && (
          <p className="text-muted-foreground text-xs">Showing up to 100 posts from the last seven days.</p>
        )}
      </div>
    )
  }

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      {header}
      {account.account_type === 'brand' && handle && (
        <p className="text-muted-foreground text-xs">
          A brand or subsidiary account of {company}, not the parent company's own account.
        </p>
      )}
      {body}
      {handle && <SourceDetails account={account} />}

      {dialogOpen && (
        <CompanyAccountDialog ticker={ticker} account={account} open={dialogOpen} onOpenChange={setDialogOpen} />
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm @{handle} for {ticker}?</AlertDialogTitle>
            <AlertDialogDescription>
              You confirm this is the X account to use for {endSentence(company)} Its recent posts
              will load here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmAccount.error && <ErrorState error={confirmAccount.error} />}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmAccount.isPending || !handle}
              onClick={(event) => {
                event.preventDefault()
                if (handle) {
                  confirmAccount.mutate({
                    selected_handle: handle,
                    expected_revision: account.mapping_revision,
                    confirm_account: true,
                  }, { onSuccess: () => setConfirmOpen(false) })
                }
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove @{handle} from {ticker}?</AlertDialogTitle>
            <AlertDialogDescription>
              Company posts stop loading for {ticker} until an account is added again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {removeAccount.error && <ErrorState error={removeAccount.error} />}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeAccount.isPending}
              onClick={(event) => {
                event.preventDefault()
                removeAccount.mutate(account.mapping_revision, { onSuccess: () => setRemoveOpen(false) })
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
