import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { downloadEventStudy, getEventStudy, getHistoricalEventFacts, getEventStudyProgress } from '@/api/event-study'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { FilingEstimatePanel, SourceFacts } from './filing-estimate'
import { categoryLabel } from './event-study-types'
import type { EventStudy } from './event-study-types'

const pct = (value: number) => `${(value * 100).toFixed(1)}%`
const modelLabel = (name: string) => categoryLabel(name).replace('grounded ', 'Grounded filing facts + ').replace('full ', 'LLM facts + ').replace('deterministic ', 'Rule facts + ')

function StudyResults({ study }: { study: EventStudy }) {
  const [horizon, setHorizon] = useState(5)
  const selected = study.horizons.find((value) => value.horizon === horizon)!
  const model = selected.models[selected.selected_model]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">Outcome horizon
          <select aria-label="Outcome horizon" className="bg-background ml-2 rounded-md border px-2 py-1" value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>
            {[1, 3, 5].map((value) => <option key={value} value={value}>{value} {value === 1 ? 'session' : 'sessions'}{value === 5 ? ' (primary)' : ''}</option>)}
          </select>
        </label>
        <p className="text-muted-foreground text-sm">{selected.split_counts.train} train · {selected.split_counts.validation} validation · {selected.split_counts.test} test · {selected.split_counts.purged} purged</p>
      </div>
      <p className="text-sm">{study.confirmation}</p>
      {selected.deployment && <div className="rounded-md border p-3 text-sm">
        <p>Direction estimates: {selected.deployment.enabled ? 'Eligible for supported categories' : 'Withheld after historical checks'}</p>
        {selected.deployment.reasons.map(reason => <p key={reason}>{reason}</p>)}
        {selected.historical_confirmation && <table className="mt-2 w-full text-left tabular-nums">
          <caption className="text-left">Separate historical confirmation</caption>
          <thead><tr><th>Model</th><th>Balanced accuracy</th><th>Macro-F1</th></tr></thead>
          <tbody>{Object.entries(selected.historical_confirmation).map(([name, metrics]) =>
            <tr key={name}><td>{modelLabel(name)}</td><td>{pct(metrics.balanced_accuracy)}</td><td>{metrics.macro_f1.toFixed(3)}</td></tr>
          )}</tbody>
        </table>}
      </div>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <thead><tr className="border-b">
            <th className="py-2 pr-3">Model</th><th className="px-3">Accuracy</th><th className="px-3">Balanced accuracy</th><th className="px-3">Macro-F1</th><th className="pl-3">Mean net signal return</th>
          </tr></thead>
          <tbody>
            {Object.entries(selected.models).map(([name, metrics]) => {
              const net = metrics.cost_sensitivity['20'].mean_net_return_pct
              return (
                <tr key={name} className="border-b last:border-0">
                  <td className="py-3 pr-3 capitalize">{modelLabel(name)}{name === selected.selected_model && <span className="text-muted-foreground mt-1 block text-xs normal-case">Selected using validation</span>}</td>
                  <td className="px-3">{pct(metrics.accuracy)}</td><td className="px-3">{pct(metrics.balanced_accuracy)}</td><td className="px-3">{metrics.macro_f1.toFixed(3)}</td>
                  <td className="pl-3">{net == null ? 'No signals' : `${net.toFixed(2)}%`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-xs">Returns are hypothetical averages per non-flat signal after 0.20% round-trip costs, not portfolio returns. Balanced accuracy weights up, down, and flat equally.</p>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Evaluation details for the validation-selected model</summary>
        <p className="mt-2">{model.uncertainty?.dates ?? 0} independent entry dates. Too few dates for a reliable uncertainty interval.</p>
        <p>Calibration error: {model.calibration_error?.toFixed(3) ?? 'Unavailable'} · Brier score: {model.multiclass_brier?.toFixed(3) ?? 'Unavailable'}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="text-left tabular-nums">
            <caption className="mb-1 text-left">Confusion matrix · actual rows, predicted columns</caption>
            <thead><tr><th className="pr-4">Actual</th>{['Down', 'Flat', 'Up'].map((label) => <th className="px-3" key={label}>{label}</th>)}</tr></thead>
            <tbody>{model.confusion_matrix.map((row, index) => <tr key={index}><th className="py-1 pr-4">{['Down', 'Flat', 'Up'][index]}</th>{row.map((value, column) => <td className="px-3" key={column}>{value}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="mt-3">Test class balance: {model.class_support.down} down · {model.class_support.flat} flat · {model.class_support.up} up.</p>
        <p className="mt-2">Selected-model mean net return at 0.20% / 0.50% / 1.00% costs: {['20', '50', '100'].map((cost) => {
          const net = model.cost_sensitivity[cost].mean_net_return_pct
          return net == null ? 'No signals' : `${net.toFixed(2)}%`
        }).join(' / ')}.</p>
      </details>
    </div>
  )
}

function ReviewedFacts() {
  const query = useQuery({ queryKey: ['event-study', 'facts'], queryFn: () => getHistoricalEventFacts(), staleTime: Infinity, retry: false })
  const [filter, setFilter] = useState('')
  const rows = query.data?.filter((row) => row.ticker.includes(filter.trim().toUpperCase())) ?? []
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">Historical facts with source grounding checks. Independent human validation and extraction recall are not available.</p>
      <input aria-label="Filter reviewed facts by ticker" placeholder="Filter by ticker" value={filter} onChange={(event) => setFilter(event.target.value)} className="bg-background rounded-md border px-3 py-2 text-sm" />
      {query.isPending && <p role="status">Loading reviewed facts…</p>}
      {query.isError && <p role="alert">{query.error.message}</p>}
      {!query.isPending && !query.isError && rows.length === 0 && <p>No reviewed facts match this ticker.</p>}
      {rows.map((row, index) => (
        <details key={`${row.ticker}-${row.entry_session}-${index}`} className="rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-medium">{row.ticker} · historical entry {row.entry_session} · {row.facts.length} {row.facts.length === 1 ? 'fact' : 'facts'}</summary>
          <div className="mt-3"><SourceFacts facts={row.facts} /></div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">{row.source_urls.filter((url) => /^https?:\/\//i.test(url)).map((url, i) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="underline">Source {i + 1}</a>)}</div>
        </details>
      ))}
    </div>
  )
}

export function EventStudyPanel({ tickers }: { tickers: string[] }) {
  const query = useQuery({ queryKey: ['event-study'], queryFn: getEventStudy, staleTime: Infinity, retry: false })
  const progress = useQuery({ queryKey: ['event-study', 'progress'], queryFn: getEventStudyProgress, refetchInterval: 15000, retry: false })
  useEffect(() => {
    if (progress.data?.published_study_id && query.data?.study_id !== progress.data.published_study_id) {
      void query.refetch()
    }
  }, [progress.data?.published_study_id, query.data?.study_id, query.refetch])
  const download = useMutation({ mutationFn: downloadEventStudy })
  const [tab, setTab] = useState<'estimates' | 'results' | 'facts'>('estimates')
  const [input, setInput] = useState('')
  const [ticker, setTicker] = useState('')
  const [invalid, setInvalid] = useState(false)
  const study = query.data
  const suggestions = [...new Set([...tickers, ...(study?.tickers ?? [])])]
  return (
    <Card>
      <CardHeader className="space-y-2">
        <h2 className="font-semibold">Filing direction research</h2>
        {progress.data && !['not_started', 'complete'].includes(progress.data.status) && <p role="status" className="text-sm">
          Historical retraining: {progress.data.status} · {progress.data.stocks} stocks
          {progress.data.total ? ` · ${progress.data.completed ?? 0} / ${progress.data.total} events` : ''}
        </p>}
        <p className="text-muted-foreground text-sm">Experimental estimates and reviewed historical evidence</p>
        {study && <p className="text-muted-foreground text-xs">{study.stock_count} selected tickers · {study.outcome_count} outcomes · {study.start}–{study.end} · Unvalidated</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isPending && <p role="status">Loading historical study…</p>}
        {query.isError && <div role="alert" className="space-y-2"><p>Historical study unavailable: {query.error.message}</p><Button variant="outline" size="sm" onClick={() => query.refetch()}>Retry study</Button></div>}
        {study && <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filing research view">
            {(['estimates', 'results', 'facts'] as const).map((value) => <Button key={value} size="sm" variant={tab === value ? 'secondary' : 'ghost'} aria-pressed={tab === value} onClick={() => setTab(value)}>{value === 'estimates' ? 'Direction estimates' : value === 'results' ? 'Historical results' : 'Reviewed facts'}</Button>)}
          </div>
          {tab === 'estimates' && <div className="space-y-3">
            <p className="text-sm">Analyze a filing to see source-backed facts and experimental up/down/flat probabilities. Analysis runs on demand with the installed local model.</p>
            <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); const next = input.trim().toUpperCase(); const valid = /^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(next); setInvalid(!valid); if (valid) setTicker(next) }}>
              <label htmlFor="filing-estimate-ticker" className="text-sm">Ticker</label>
              <input id="filing-estimate-ticker" list="filing-study-tickers" placeholder="e.g. NTAP" value={input} onChange={(event) => setInput(event.target.value)} className="bg-background w-32 rounded-md border px-3 py-2 text-sm uppercase" />
              <datalist id="filing-study-tickers">{suggestions.map((symbol) => <option value={symbol} key={symbol} />)}</datalist>
              <Button size="sm" type="submit" variant="outline">Select ticker</Button>
            </form>
            {invalid && <p role="alert" className="text-sm">Enter a valid ticker symbol.</p>}
            {ticker && <FilingEstimatePanel key={ticker} ticker={ticker} />}
          </div>}
          {tab === 'results' && <StudyResults study={study} />}
          {tab === 'facts' && <ReviewedFacts />}
          <details className="text-muted-foreground text-xs">
            <summary className="cursor-pointer">Study scope and limitations</summary>
            <p className="mt-2">{study.label_definition}. {study.entry_definition}.</p>
            <p className="mt-2">{study.confirmation}. The historical results do not establish a reliable filing-based forecast.</p>
            <p className="mt-2">Checked {study.audit.original_retained_facts} retained facts for source grounding; kept {study.audit.retained_after_checks_and_review} after checks.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">{study.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
          </details>
          <Button variant="outline" size="sm" onClick={() => download.mutate()} disabled={download.isPending}>{download.isPending ? 'Downloading…' : 'Download study and model artifacts'}</Button>
          {download.isError && <p role="alert" className="text-sm">{download.error.message}</p>}
        </>}
      </CardContent>
    </Card>
  )
}
