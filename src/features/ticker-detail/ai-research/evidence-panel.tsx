import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AiResearchInputsOut } from '@/types/api'
import { FinancialPeriodsTable } from '../fundamentals/financial-history'

export function EvidencePanel({ inputsUsed }: { inputsUsed: AiResearchInputsOut }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence used</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="border-border rounded-full border px-2.5 py-1">
            {inputsUsed.news_item_count} news item{inputsUsed.news_item_count === 1 ? '' : 's'}
          </span>
          <span className="border-border rounded-full border px-2.5 py-1">
            {inputsUsed.twitter_post_count} X/Twitter post
            {inputsUsed.twitter_post_count === 1 ? '' : 's'}
          </span>
          <span className="border-border rounded-full border px-2.5 py-1">
            Twitter cache {inputsUsed.twitter_cache_is_fresh ? 'fresh' : 'stale'}
            {inputsUsed.twitter_cache_age_seconds !== null
              ? ` (${Math.round(inputsUsed.twitter_cache_age_seconds)}s old)`
              : ''}
          </span>
          <span className="border-border rounded-full border px-2.5 py-1">
            {inputsUsed.reddit_post_count} Reddit post
            {inputsUsed.reddit_post_count === 1 ? '' : 's'}
          </span>
          <span className="border-border rounded-full border px-2.5 py-1">
            Reddit cache {inputsUsed.reddit_cache_is_fresh ? 'fresh' : 'stale'}
            {inputsUsed.reddit_cache_age_seconds !== null
              ? ` (${Math.round(inputsUsed.reddit_cache_age_seconds)}s old)`
              : ''}
          </span>
        </div>
        {inputsUsed.quant_facts.length > 0 && (
          <details className="group">
            <summary className="text-muted-foreground cursor-pointer text-sm select-none">
              Quantitative facts sent to the model ({inputsUsed.quant_facts.length})
            </summary>
            <ul className="mt-2 space-y-1 text-sm">
              {inputsUsed.quant_facts.map((fact, i) => (
                <li key={i} className="text-muted-foreground">
                  • {fact}
                </li>
              ))}
            </ul>
          </details>
        )}
        {inputsUsed.sec_fundamentals ? (
          <details>
            <summary className="text-muted-foreground cursor-pointer text-sm">SEC financial evidence used by this saved report</summary>
            <div className="mt-3 flex min-w-0 flex-col gap-3 text-sm">
              <p>Snapshot {inputsUsed.sec_fundamentals.snapshot_id} · publication {inputsUsed.sec_fundamentals.publication_id} · cutoff {inputsUsed.sec_fundamentals.cutoff}</p>
              <p>Coverage: {inputsUsed.sec_fundamentals.quality.status}{inputsUsed.sec_fundamentals.quality.reasons.length > 0 ? ` · ${inputsUsed.sec_fundamentals.quality.reasons.join(' · ')}` : ''}</p>
              <p className="text-muted-foreground text-xs">Pinned evidence supplied to this report. Current financial history may differ.</p>
              <FinancialPeriodsTable periods={inputsUsed.sec_fundamentals.selected_periods} mode="evidence" />
              <details>
                <summary className="cursor-pointer text-xs">Exact SEC context sent to the model</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words text-xs">{inputsUsed.sec_fundamentals.context}</pre>
              </details>
            </div>
          </details>
        ) : <p className="text-muted-foreground text-xs">This saved report has no SEC financial context.</p>}
      </CardContent>
    </Card>
  )
}
