import { Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SentimentBadge } from '@/components/shared/sentiment-badge'
import { StageBadge } from '@/components/shared/stage-badge'
import { formatEasternDateTime, formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DigestItem, DigestTopFiling } from '@/types/api'
import { DigestLivePrice } from './live-quotes'
import { FilingEstimatePanel } from './filing-estimate'
import { useDismissDigestItem } from './hooks'

function safeUrl(url: string | undefined): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null
}

function FilingLink({ filing }: { filing: DigestTopFiling }) {
  const url = safeUrl(filing.url)
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {filing.form_type}
    </a>
  ) : (
    <span>{filing.form_type}</span>
  )
}

export function DigestItemCard({ item }: { item: DigestItem }) {
  const pattern = item.recent_pattern
  const dismissItem = useDismissDigestItem()

  function handleDismiss() {
    dismissItem.mutate(item.ticker, {
      onSuccess: () => toast.success(`${item.ticker} hidden from the digest for 7 days`),
      onError: () => toast.error(`Failed to hide ${item.ticker}`),
    })
  }

  return (
    <Card className="group relative">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <Link
            to={`/stocks/${item.ticker}`}
            className="text-lg font-semibold tracking-tight hover:underline"
          >
            {item.ticker}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {item.new_today && (
              <span
                className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                title="New in this list since the last digest"
              >
                New
              </span>
            )}
            {item.sentiment && (
              <SentimentBadge label={item.sentiment.label} score={item.sentiment.net_score} />
            )}
            {item.stages.map((stage) => (
              <StageBadge key={stage} stage={stage} />
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Hide ${item.ticker} from digest`}
                className="cursor-pointer opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                disabled={dismissItem.isPending}
                onClick={handleDismiss}
              >
                <Trash2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Hide from digest for 7 days</TooltipContent>
          </Tooltip>
          <DigestLivePrice ticker={item.ticker} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {pattern && (
          <div
            className={cn(
              'rounded-md border p-2 text-sm',
              pattern.bias === 'bearish'
                ? 'border-rose-500/30 bg-rose-500/5'
                : 'border-teal-500/30 bg-teal-500/5',
            )}
          >
            <p
              className={cn(
                'font-medium',
                pattern.bias === 'bearish'
                  ? 'text-rose-700 dark:text-rose-300'
                  : 'text-teal-700 dark:text-teal-300',
              )}
            >
              {pattern.label} pattern detected ({(pattern.confidence * 100).toFixed(0)}% confidence)
            </p>
            {item.pct_from_12wk_avg !== null && (
              <p className="text-muted-foreground text-xs">
                {formatSignedPct(item.pct_from_12wk_avg)} vs 12-week average close
              </p>
            )}
          </div>
        )}
        {(item.premarket_gap_pct !== null || item.volume_ratio !== null) && (
          <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums">
            {item.premarket_gap_pct !== null && (
              <span className="text-sky-600 dark:text-sky-400">
                Premarket {formatSignedPct(item.premarket_gap_pct)}
              </span>
            )}
            {item.volume_ratio !== null && <span>{item.volume_ratio.toFixed(1)}× avg volume</span>}
          </div>
        )}

        {item.reasons.map((reason, i) => (
          <p key={i} className="text-sm">
            {reason}
          </p>
        ))}
        {item.top_filing?.prominence_reason && (
          <p className="text-muted-foreground text-xs">
            <FilingLink filing={item.top_filing} /> topic: {item.top_filing.prominence_reason}.
            Item codes name the disclosed topic, not its effect.
          </p>
        )}
        {item.top_filing && (
          <FilingEstimatePanel ticker={item.ticker} filingUrl={item.top_filing.url} compact />
        )}
        {item.supporting_filings && item.supporting_filings.length > 0 && (
          <details className="text-xs">
            <summary className="text-muted-foreground cursor-pointer">
              Other filings ({item.supporting_filings.length})
            </summary>
            <ul className="text-muted-foreground mt-1 space-y-1">
              {item.supporting_filings.map((filing) => (
                <li key={`${filing.url}-${filing.filed_at}`}>
                  <FilingLink filing={filing} /> · {formatEasternDateTime(filing.filed_at)}
                  {filing.item_codes && ` · Item codes: ${filing.item_codes}`}
                  {filing.prominence_reason && ` · ${filing.prominence_reason}`}
                </li>
              ))}
            </ul>
          </details>
        )}
        {item.headline_snippets.length > 0 && (
          <ul className="text-muted-foreground space-y-1 text-sm">
            {item.headline_snippets.map((headline, i) => (
              <li key={i} className="truncate">
                · {headline}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
