import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AiResearchInputsOut } from '@/types/api'

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
      </CardContent>
    </Card>
  )
}
