import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { analyzeFiling, getFilingEstimate } from '@/api/event-study'
import { Button } from '@/components/ui/button'
import { formatEasternDateTime } from '@/lib/format'
import type { FilingEstimate, FilingFact } from './event-study-types'
import { categoryLabel } from './event-study-types'

export function SourceFacts({ facts }: { facts: FilingFact[] }) {
  return (
    <ul className="space-y-2">
      {facts.map((fact, index) => (
        <li key={`${fact.category}-${index}`} className="rounded-md border p-3 text-sm">
          <p className="font-medium capitalize">{categoryLabel(fact.category)}</p>
          <blockquote className="text-muted-foreground mt-1">{fact.quote}</blockquote>
        </li>
      ))}
    </ul>
  )
}

export function EstimateResult({ data }: { data: FilingEstimate }) {
  return (
    <div className="space-y-3 text-sm">
      {data.retrospective && (
        <p className="font-medium">Historical reconstruction · the entry open has already passed.</p>
      )}
      {data.preliminary && <p className="font-medium">Preliminary · inputs may change before entry.</p>}
      {data.public_at && <p>Published {formatEasternDateTime(data.public_at)} · Entry {data.entry_session}</p>}
      <p className="text-muted-foreground">Up &gt; +1%, down &lt; −1%, flat otherwise. Model probabilities are unvalidated.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {data.estimates.map((estimate) => (
          <div key={estimate.horizon} className="rounded-md border p-3">
            <p className="text-muted-foreground text-xs">{estimate.horizon} {estimate.horizon === 1 ? 'session' : 'sessions'}</p>
            <p className="mt-1 font-semibold capitalize">{estimate.direction ? `${estimate.direction} estimate` : 'No direction estimate'}</p>
            <dl className="mt-2 space-y-1 tabular-nums">
              {estimate.direction && (['up', 'down', 'flat'] as const).map((direction) => (
                <div key={direction} className="flex justify-between gap-4">
                  <dt className="capitalize">{direction}</dt>
                  <dd>{((estimate.probabilities[direction] ?? 0) * 100).toFixed(1)}%</dd>
                </div>
              ))}
            </dl>
            {estimate.withheld_reasons?.map((reason) => <p key={reason} className="mt-2 text-xs">{reason}</p>)}
            {estimate.overlaps_training_period && <p className="mt-2 text-xs">Overlaps training period; not an out-of-sample forecast.</p>}
          </div>
        ))}
      </div>
      <details>
        <summary className="cursor-pointer font-medium">Filing facts and evidence ({data.facts.length})</summary>
        <div className="mt-2"><SourceFacts facts={data.facts} /></div>
        {data.facts.length === 0 && <p className="text-muted-foreground mt-2">No supported LLM facts were extracted.</p>}
        {data.rule_facts.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer">Deterministic rule facts ({data.rule_facts.length})</summary>
            <div className="mt-2"><SourceFacts facts={data.rule_facts} /></div>
          </details>
        )}
        {data.filing_url && /^https?:\/\//i.test(data.filing_url) && (
          <a className="mt-2 inline-block underline" href={data.filing_url} target="_blank" rel="noopener noreferrer">Read SEC source</a>
        )}
      </details>
      <details>
        <summary className="cursor-pointer">Inputs and limitations</summary>
        <p className="mt-2">Last completed price session: {data.feature_last_session ?? 'Unavailable'}</p>
        {data.decision_at && <p>Information cutoff: {formatEasternDateTime(data.decision_at)}</p>}
        <p>Publication verified from the SEC acceptance header.</p>
        <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5">
          {data.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      </details>
    </div>
  )
}

export function FilingEstimatePanel({ ticker, filingUrl, compact = false }: { ticker: string; filingUrl?: string; compact?: boolean }) {
  const [expanded, setExpanded] = useState(!compact)
  const client = useQueryClient()
  const key = ['filing-estimate', ticker, filingUrl ?? 'latest']
  const query = useQuery({
    queryKey: key,
    queryFn: () => getFilingEstimate(ticker, filingUrl),
    enabled: expanded,
    retry: false,
    staleTime: 30_000,
    refetchInterval: (state) => ['queued', 'running'].includes(state.state.data?.status ?? '') ? 2000 : false,
  })
  const analyze = useMutation({
    mutationFn: (force: boolean) => analyzeFiling(ticker, filingUrl, force),
    onSuccess: (data) => client.setQueryData(key, data),
  })
  const data = query.data
  const busy = analyze.isPending || data?.status === 'queued' || data?.status === 'running'
  return (
    <div className="space-y-3">
      {compact && (
        <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="text-xs underline underline-offset-2">
          Experimental filing direction
        </button>
      )}
      {expanded && (
        <div className="space-y-3 rounded-md border border-amber-500/25 bg-amber-500/5 p-3">
          <p className="text-sm font-medium">Experimental · unvalidated direction estimates</p>
          <p className="text-muted-foreground text-xs">The 50-stock historical study has not established a reliable prediction advantage.</p>
          {query.isPending && <p role="status" className="text-sm">Checking saved analysis…</p>}
          {query.isError && <p role="alert" className="text-sm">{query.error.message}</p>}
          {analyze.isError && <p role="alert" className="text-sm">{analyze.error.message}</p>}
          {busy && <p role="status" className="text-sm">{data?.phase ?? 'Starting analysis…'}</p>}
          {data?.reason && <p className="text-sm">{data.reason}</p>}
          {data?.status === 'complete' && <EstimateResult data={data} />}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy || query.isPending} onClick={() => analyze.mutate(data?.status === 'complete')}>
              {busy ? 'Analyzing…' : data?.status === 'complete' ? 'Refresh analysis' : 'Analyze filing'}
            </Button>
            {query.isError && <Button size="sm" variant="ghost" onClick={() => query.refetch()}>Retry connection</Button>}
          </div>
        </div>
      )}
    </div>
  )
}
