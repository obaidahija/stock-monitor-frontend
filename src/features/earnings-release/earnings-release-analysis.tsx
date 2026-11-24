import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { displayAmount } from '@/lib/display-amount'
import { cn } from '@/lib/utils'
import type { FilingAnalysis, FilingEvidence, FilingFinding, FilingKeyFact } from '@/types/api'
import {
  analysisSettled, buildFigureRows, commonPeriod, figureAmount, IMPORTANCE, periodLabel, type FigureColumn, type FigureRow,
} from './earnings-figures'

const TABS = [
  { value: 'guidance', label: 'Guidance', topics: ['guidance'] },
  { value: 'highlights', label: 'Highlights', topics: ['performance'] },
  { value: 'developments', label: 'Developments', topics: ['liquidity', 'financing', 'agreement', 'leadership', 'other'] },
  { value: 'risks', label: 'Risks & notes', topics: ['risk', 'accounting'] },
]
const DOT: Record<FilingFinding['direction'], string> = {
  positive: 'bg-emerald-600', negative: 'bg-red-600', mixed: 'bg-amber-500',
  neutral: 'bg-muted-foreground/50', unclear: 'bg-muted-foreground/50',
}
const COLUMN_LABEL: Record<FigureColumn, string> = { reported: 'Reported', adjusted: 'Adjusted' }
const BASIS_LABEL: Record<FilingKeyFact['basis'], string> = { gaap: 'GAAP', adjusted: 'Adjusted', reported: 'Reported' }

function Evidence({ evidence }: { evidence: FilingEvidence }) {
  return <blockquote className="border-l-2 pl-3 text-xs text-muted-foreground">
    <p className="whitespace-normal">“{evidence.excerpt}”</p>
    <a href={evidence.source_url} target="_blank" rel="noreferrer" className="underline">
      Release source · {evidence.section}
    </a>
  </blockquote>
}

/** One stated figure in full: the release's own wording, its year-ago row and evidence. */
function FigureDetail({ fact }: { fact: FilingKeyFact }) {
  return <div className="flex min-w-0 flex-col gap-1.5">
    <p className="text-sm">
      <span className="text-muted-foreground">{BASIS_LABEL[fact.basis]} {fact.label} · {periodLabel(fact)}: </span>
      <span className="font-medium">{displayAmount(fact, fact.value)}</span>
    </p>
    {fact.prior_value && <p className="text-xs text-muted-foreground">
      Year ago {displayAmount(fact, fact.prior_value)}{fact.prior_period ? ` (${fact.prior_period})` : ''}{fact.yoy_change ? ` · ${fact.yoy_change}` : ''}
    </p>}
    {fact.evidence.map((item, index) => <Evidence key={index} evidence={item} />)}
  </div>
}

function FigureCell({ fact }: { fact: FilingKeyFact | undefined }) {
  if (!fact) return <td className="px-2 py-2 text-right text-muted-foreground">—</td>
  return <td className="px-2 py-2 text-right align-top tabular-nums">
    <span className="block font-medium">{figureAmount(fact)}</span>
    {fact.yoy_change && <span className="block text-xs text-muted-foreground">{fact.yoy_change} y/y</span>}
  </td>
}

function FigureTableRow({ row, columns, showPeriod }: { row: FigureRow; columns: FigureColumn[]; showPeriod: boolean }) {
  const [open, setOpen] = useState(false)
  const facts = columns.map((side) => row.cells[side]).filter((fact): fact is FilingKeyFact => Boolean(fact))
  return <>
    <tr className="cursor-pointer border-t hover:bg-muted/40" onClick={() => setOpen((value) => !value)}>
      <th scope="row" className="py-2 pr-2 text-left align-top font-normal">
        <button type="button" aria-expanded={open} onClick={(event) => { event.stopPropagation(); setOpen((value) => !value) }}
          className="flex items-start gap-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronRight aria-hidden="true" className={cn('mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
          <span className="flex flex-col">
            <span>{row.label}</span>
            {showPeriod && <span className="text-xs text-muted-foreground">{row.period}</span>}
          </span>
        </button>
      </th>
      {columns.map((side) => <FigureCell key={side} fact={row.cells[side]} />)}
    </tr>
    {open && <tr>
      <td colSpan={columns.length + 1} className="pb-3 pl-5">
        <div className="flex flex-col gap-3 [overflow-wrap:anywhere]">
          {facts.map((fact, index) => <FigureDetail key={index} fact={fact} />)}
        </div>
      </td>
    </tr>}
  </>
}

/** Reported results as one row per metric, reported and adjusted side by side. */
function FiguresTable({ facts }: { facts: FilingKeyFact[] }) {
  const rows = buildFigureRows(facts)
  if (rows.length === 0) return null
  const columns: FigureColumn[] = rows.some((row) => row.cells.adjusted) ? ['reported', 'adjusted'] : ['reported']
  const period = commonPeriod(rows)
  return <table aria-label="Reported results" className="w-full text-sm">
    <caption className="pb-1 text-left text-xs text-muted-foreground">
      Reported results{period ? ` · ${period}` : ''} · select a row for the release's wording and source
    </caption>
    <thead>
      <tr className="text-xs text-muted-foreground">
        <th scope="col" className="pb-1 pl-4.5 text-left font-normal">Figure</th>
        {columns.map((side) => <th key={side} scope="col" className="px-2 pb-1 text-right font-normal">
          {columns.length === 1 ? 'Value' : COLUMN_LABEL[side]}
        </th>)}
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => <FigureTableRow key={row.key} row={row} columns={columns} showPeriod={row.period !== period} />)}
    </tbody>
  </table>
}

function GuidanceFactLine({ fact }: { fact: FilingKeyFact }) {
  const qualifier = [fact.basis === 'reported' ? null : BASIS_LABEL[fact.basis], periodLabel(fact)].filter(Boolean).join(' · ')
  return <li className="border-b last:border-b-0">
    <details className="group py-1.5">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium">{displayAmount(fact, fact.value)}</span>
        {qualifier && <span className="text-xs text-muted-foreground">{qualifier}</span>}
      </summary>
      <div className="ml-4 mt-1 flex flex-col gap-2 pb-1 [overflow-wrap:anywhere]">
        {fact.evidence.map((item, index) => <Evidence key={index} evidence={item} />)}
      </div>
    </details>
  </li>
}

function FindingLine({ finding }: { finding: FilingFinding }) {
  return <li className="border-b last:border-b-0">
    <details className="group py-1.5">
      <summary className="flex cursor-pointer list-none items-baseline gap-2 text-sm">
        <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', DOT[finding.direction])} />
        <span className="sr-only">{finding.direction}</span>
        <span className="min-w-0 flex-1 group-open:whitespace-normal">{finding.fact}</span>
      </summary>
      <div className="ml-4 mt-1 flex flex-col gap-2 pb-1 [overflow-wrap:anywhere]">
        <p className="text-sm text-muted-foreground">{finding.why_it_matters}</p>
        <Evidence evidence={finding.evidence} />
        {finding.numbers.map((number, i) => <div key={i} className="flex flex-col gap-1 text-xs">
          <p>{number.name}: {number.value} {number.unit} · {number.period} · {number.comparison_basis}</p>
          <Evidence evidence={number.evidence} />
        </div>)}
      </div>
    </details>
  </li>
}

/** The analysis's own short summary, once it is final; shown first in an opened row. */
export function ReleaseSummary({ analysis }: { analysis: FilingAnalysis | null }) {
  return analysisSettled(analysis) && analysis.summary
    ? <p className="text-sm leading-relaxed">{analysis.summary}</p> : null
}

export function EarningsReleaseAnalysis({ analysis }: { analysis: FilingAnalysis | null }) {
  const [tab, setTab] = useState('guidance')
  // Nothing to show for a release not (or never to be) analyzed.
  if (!analysis || analysis.status === 'not_analyzed' || analysis.status === 'unsupported') return null
  const facts = analysis.key_facts ?? []
  const findings = [...(analysis.findings ?? [])].sort((a, b) => IMPORTANCE[a.importance] - IMPORTANCE[b.importance])
  const guidanceFacts = facts.filter((fact) => fact.metric === 'guidance')
  const lists = TABS.map((item) => findings.filter((finding) => item.topics.includes(finding.topic)
    || (item.value === 'developments' && !TABS.some((known) => known.topics.includes(finding.topic)))))
  const counts = lists.map((list, i) => list.length + (TABS[i].value === 'guidance' ? guidanceFacts.length : 0))
  const processing = analysis.status === 'processing' || analysis.status === 'pending'
  const coverage = analysis.coverage
  const fullText = coverage?.source_text_complete === true && coverage?.document_discovery_complete !== false
  const progress = coverage?.chunks_total ? `${coverage.chunks_processed ?? 0} of ${coverage.chunks_total} parts processed.` : ''
  const partial = analysis.status === 'partial' && !fullText
  const omitted = (analysis.omitted_key_facts ?? 0) > 0 || (analysis.omitted_findings ?? 0) > 0 || Boolean(analysis.model_warning)

  return <div className="flex min-w-0 flex-col gap-4 whitespace-normal">
    {processing && <p role="status" className="text-sm text-muted-foreground">
      {analysis.status === 'pending' ? 'Queued for full-release analysis.' : 'Analyzing full earnings release…'} {progress}
      {(facts.length > 0 || findings.length > 0) && ' Extracted results are available below while analysis continues.'}
    </p>}
    {analysis.status === 'failed' && <p className="text-sm text-muted-foreground">
      Analysis did not finish. Available figures cover only the cited evidence; review the original release.
    </p>}
    <FiguresTable facts={facts} />
    {(facts.length > 0 || findings.length > 0 || analysis.status === 'completed' || analysis.status === 'partial') && <Tabs value={tab} onValueChange={setTab}>
      <TabsList variant="line" className="grid w-full grid-cols-2 justify-start group-data-horizontal/tabs:h-auto sm:inline-flex sm:w-fit">
        {TABS.map((item, i) => <TabsTrigger key={item.value} value={item.value} className="h-8 flex-none">
          {item.label} <span className="text-muted-foreground">{counts[i]}</span>
        </TabsTrigger>)}
      </TabsList>
      {TABS.map((item, i) => <TabsContent key={item.value} value={item.value}>
        {item.value === 'guidance' && (guidanceFacts.length > 0 || lists[i].length > 0) && <p className="pb-1 text-xs text-muted-foreground">
          Management forecasts; actual outcomes may differ.
        </p>}
        {item.value === 'guidance' && guidanceFacts.length > 0 && <ul>
          {guidanceFacts.map((fact, j) => <GuidanceFactLine key={j} fact={fact} />)}
        </ul>}
        {lists[i].length > 0
          ? <ul>{lists[i].map((finding, j) => <FindingLine key={j} finding={finding} />)}</ul>
          : counts[i] === 0 && <p className="py-2 text-sm text-muted-foreground">
            {processing ? (item.value === 'guidance' ? 'Guidance is still being assessed.' : 'This part of the release is still being assessed.')
              : item.value !== 'guidance' ? 'None identified in the analyzed text.'
                : partial || analysis.status === 'failed' ? 'Guidance could not be fully assessed from the available text.'
                  : 'No guidance identified in the analyzed text.'}
          </p>}
      </TabsContent>)}
    </Tabs>}
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {fullText && <Badge variant="outline" title={analysis.status === 'partial'
        ? 'All release text was processed. Unverified claims were excluded; review the cited release for context.'
        : 'All release text was processed.'}>Full release read</Badge>}
      {partial && <Badge variant="secondary">Partial coverage</Badge>}
      {partial && <span>{progress} Some release text or findings could not be fully assessed. Review the original release for context.</span>}
      {omitted && <span>Some proposed facts could not be verified and were omitted. The facts shown have source evidence.</span>}
    </div>
  </div>
}


/** Figures and stated guidance read straight from a release, before any model analysis. */
export function ReleaseFigures({ facts }: { facts: FilingKeyFact[] }) {
  const guidanceFacts = facts.filter((fact) => fact.metric === 'guidance')
  return <div className="flex min-w-0 flex-col gap-3 whitespace-normal">
    <FiguresTable facts={facts} />
    {guidanceFacts.length > 0 && <div>
      <p className="pb-1 text-xs text-muted-foreground">Guidance (management forecasts; actual outcomes may differ)</p>
      <ul>{guidanceFacts.map((fact, j) => <GuidanceFactLine key={j} fact={fact} />)}</ul>
    </div>}
  </div>
}
