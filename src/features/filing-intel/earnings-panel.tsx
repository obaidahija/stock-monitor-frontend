import { useQuery } from '@tanstack/react-query'
import { FilingAnalysisView } from '@/components/shared/filing-analysis'
import { ConsensusSummary } from '@/features/earnings-release/consensus-summary'
import { ReleaseFigures } from '@/features/earnings-release/earnings-release-analysis'
import { apiClient } from '@/lib/api-client'
import type { FilingAnalysis } from '@/types/api'
import type { FilingIntelFilingOut } from '@/types/filing-intel'

/** The saved on-demand analysis of the linked filings row (same query FilingAnalysisView uses). */
function LinkedAnalysis({ ticker, filingId }: { ticker: string; filingId: number }) {
  const analysis = useQuery({
    queryKey: ['filing-analysis', ticker, filingId],
    queryFn: () => apiClient.get<FilingAnalysis>(`/v1/stocks/${encodeURIComponent(ticker)}/filings/${filingId}/analysis`),
    staleTime: 60_000,
  })
  return <>
    {analysis.isError && <p role="alert" className="pb-2 text-xs text-muted-foreground">
      {analysis.isRefetchError ? 'The saved analysis could not be refreshed.' : 'The saved analysis could not be loaded.'}{' '}
      <button type="button" className="underline" disabled={analysis.isFetching} onClick={() => void analysis.refetch()}>Retry</button>
    </p>}
    <FilingAnalysisView analysis={analysis.data} ticker={ticker} filingId={filingId} />
  </>
}

/**
 * An earnings filing as read by the app's release extractor (figures, consensus) and its
 * on-demand analysis. A filing the extractor could not read still offers the analysis.
 */
export function EarningsPanel({ filing }: { filing: FilingIntelFilingOut }) {
  const { earnings_result: result, ticker, filing_id: filingId } = filing
  const linked = typeof ticker === 'string' && typeof filingId === 'number'
  if (!result && !linked) return null
  return <section aria-label="Earnings release" className="space-y-3">
    <h3 className="text-sm font-semibold">Earnings release{result?.reported_quarter ? ` · ${result.reported_quarter}` : ''}</h3>
    {result && <ReleaseFigures facts={result.key_facts} />}
    {result?.estimates && ticker && <ConsensusSummary ticker={ticker} estimates={result.estimates} />}
    {linked && <div className="border-border rounded-lg border p-3">
      <p className="pb-2 text-xs text-muted-foreground">Full-release model analysis runs only when you ask for it.</p>
      <LinkedAnalysis ticker={ticker} filingId={filingId} />
    </div>}
  </section>
}
