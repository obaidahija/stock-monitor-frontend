import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { FilingFinancialOverview } from '@/types/api'
import { FilingKeyFacts } from '@/components/shared/filing-key-facts'
import { Skeleton } from '@/components/ui/skeleton'

const LABELS: Record<string, string> = {
  outstanding_debt: 'Outstanding debt', unrestricted_cash: 'Unrestricted cash',
  operating_cash_flow: 'Operating cash flow', free_cash_flow: 'Free cash flow',
}

export function FilingFinancialOverviewPanel({ ticker }: { ticker: string }) {
  const query = useQuery({
    queryKey: ['filing-financial-overview', ticker],
    queryFn: () => apiClient.get<FilingFinancialOverview>(`/v1/stocks/${encodeURIComponent(ticker)}/filings/financial-overview`),
  })
  return (
    <section className="rounded-xl border p-4 space-y-3" aria-label="Latest reported financial position">
      <h2 className="font-semibold">Latest reported financial position</h2>
      <p className="text-xs text-muted-foreground">From manually analyzed filings. Each fact has its own reporting date; these are not live balances.</p>
      {query.isPending && <Skeleton className="h-24" />}
      {query.isError && <button className="text-sm underline" onClick={() => query.refetch()}>Could not load saved financial facts. Retry</button>}
      {query.data && <>
        <FilingKeyFacts facts={query.data.facts} title="Reported financial facts" />
        {query.data.missing_metrics.length > 0 && <div className="text-xs text-muted-foreground">
          <p>Not available from analyzed filings: {query.data.missing_metrics.map((m) => LABELS[m] ?? m).join(', ')}.</p>
          {!query.data.facts.length && <p>Use Analyze on a filing, or Update highlights on an older analysis.</p>}
        </div>}
      </>}
    </section>
  )
}
