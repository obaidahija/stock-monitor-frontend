import { displayAmount as display } from '@/lib/display-amount'
import type { FilingKeyFact } from '@/types/api'

function Fact({ fact, periodLabel }: { fact: FilingKeyFact; periodLabel?: string }) {
  return (
    <article className={`rounded-lg border p-3 space-y-1 ${fact.warning ? 'border-amber-500 bg-amber-500/10' : 'bg-muted/30'}`}>
      <p className="text-xs text-muted-foreground">
        {fact.warning && <span className="font-semibold text-amber-700 dark:text-amber-400">Warning · </span>}
        {fact.basis === 'adjusted' ? 'Adjusted ' : fact.basis === 'gaap' ? 'GAAP ' : ''}{fact.label}
      </p>
      <p className="text-base"><strong>{display(fact, fact.value)}</strong></p>
      <p className="text-xs text-muted-foreground">
        {periodLabel && <span className="font-medium">{periodLabel}: </span>}
        {fact.period_kind === 'not_disclosed' && fact.accepted_at ? `Reporting period not disclosed · filed ${fact.accepted_at.slice(0, 10)}` :
        <>{fact.period_kind === 'instant' ? 'As of ' : fact.period_kind === 'year_to_date' ? 'YTD through ' : fact.period_kind === 'quarter' ? 'Quarter · ' : ''}{fact.period}</>}
      </p>
      {fact.change && <p className="text-xs"><strong>{fact.change}</strong></p>}
      {fact.form_type && fact.filing_url && <a className="text-xs underline" href={fact.filing_url} target="_blank" rel="noreferrer">Source filing: {fact.form_type}</a>}
      <details className="text-xs">
        <summary className="cursor-pointer underline">Evidence</summary>
        <div className="mt-2 space-y-2">
          {fact.evidence.map((evidence, i) => <blockquote className="border-l-2 pl-2 text-muted-foreground" key={i}>
            <p>“{evidence.excerpt}”</p>
            <a className="underline" href={evidence.source_url} target="_blank" rel="noreferrer">SEC source · {evidence.section}</a>
          </blockquote>)}
        </div>
      </details>
    </article>
  )
}

export function FilingKeyFacts({ facts, title = 'Key facts', periodLabel }: { facts: FilingKeyFact[]; title?: string; periodLabel?: string }) {
  if (!facts.length) return null
  return (
    <section className="space-y-2 whitespace-normal" aria-label={title}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {facts.slice(0, 6).map((fact, i) => <Fact key={i} fact={fact} periodLabel={periodLabel} />)}
      </div>
      {facts.length > 6 && <details>
        <summary className="cursor-pointer text-xs underline">Show all facts ({facts.length})</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {facts.slice(6).map((fact, i) => <Fact key={i} fact={fact} periodLabel={periodLabel} />)}
        </div>
      </details>}
    </section>
  )
}
