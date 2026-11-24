import { Badge } from '@/components/ui/badge'
import type { FilingIntelFilingOut, QuoteOut } from '@/types/filing-intel'
import { marketDisagreement } from './market-disagreement'

export function MarketDisagreedBadge({
  filing,
  now,
}: {
  filing: Pick<FilingIntelFilingOut, 'signal' | 'ref_close' | 'close_1d'>
  now: QuoteOut | undefined
}) {
  const result = marketDisagreement(filing, now)
  if (!result) return null
  return (
    <Badge
      variant="outline"
      className="border-amber-500/60 text-amber-700 dark:text-amber-400"
      title="The filing reads one way and the stock moved the other: often the news was already expected or other news moved it. Check the coverage before trusting the label."
    >
      Market disagreed: {result.move > 0 ? '+' : ''}
      {result.move.toFixed(1)}% ({result.basis})
    </Badge>
  )
}
