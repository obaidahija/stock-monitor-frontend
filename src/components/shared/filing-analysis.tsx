import { FilingKeyFacts } from '@/components/shared/filing-key-facts'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api-client'
import type { FilingAnalysis, FilingEvidence } from '@/types/api'

function Evidence({ evidence }: { evidence: FilingEvidence }) {
  return (
    <blockquote className="border-l-2 pl-3 text-muted-foreground">
      <p>“{evidence.excerpt}”</p>
      <a className="underline" href={evidence.source_url} target="_blank" rel="noreferrer">
        SEC source · {evidence.section}
      </a>
    </blockquote>
  )
}

export function FilingAnalysisView({ analysis, ticker, filingId }: {
  analysis?: FilingAnalysis | null
  ticker?: string | null
  filingId?: number
}) {
  if (!analysis) return null
  return <AnalysisBody analysis={analysis} ticker={ticker} filingId={filingId} />
}

function AnalysisBody({ analysis, ticker, filingId }: {
  analysis: FilingAnalysis
  ticker?: string | null
  filingId?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const queryClient = useQueryClient()
  const queryKey = ['filing-analysis', ticker, filingId]
  const endpoint = `/v1/stocks/${encodeURIComponent(ticker ?? '')}/filings/${filingId}/analysis`
  const analyze = useMutation({
    mutationFn: () => apiClient.post<FilingAnalysis>(endpoint),
    retry: false,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<FilingAnalysis>(queryKey) ?? analysis
      queryClient.setQueryData(queryKey, { ...previous, status: 'processing' })
      return { previous }
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result)
      queryClient.invalidateQueries({ queryKey: ['filings', ticker] })
      queryClient.invalidateQueries({ queryKey: ['discover', 'filings'] })
      queryClient.invalidateQueries({ queryKey: ['filing-financial-overview', ticker] })
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previous ?? analysis)
    },
  })
  const detail = useQuery({
    queryKey,
    queryFn: () => apiClient.get<FilingAnalysis>(endpoint),
    enabled: Boolean(ticker && filingId) && !analyze.isPending && (
      expanded || analysis.status === 'processing' ||
      queryClient.getQueryData<FilingAnalysis>(queryKey)?.status === 'processing'
    ),
    refetchInterval: (query) => query.state.data?.status === 'processing' ? 2000 : false,
    staleTime: 60_000,
  })
  const value = detail.data ?? analysis
  const ready = value.status === 'completed' || value.status === 'partial'
  const failureReason: Record<string, string> = {
    invalid_model_json: 'The model did not return complete readable JSON.',
    model_schema_rejected: 'The model response did not match the required analysis format.',
    grounding_rejected: 'A model citation could not be verified against the filing.',
    numeric_grounding_rejected: 'A reported number, unit or period could not be verified.',
    comparison_ungrounded: 'The model comparison was not supported by matching source evidence.',
    timeout: 'The analysis exceeded its time limit.',
    context_budget_too_small: 'The selected model context is too small for this analysis.',
    context_window_exceeded: 'The selected model context is too small for this analysis.',
    llm_unavailable: 'The model provider was unavailable.',
    interrupted: 'The backend stopped before this analysis finished.',
  }
  const status = {
    not_analyzed: 'Not analyzed', pending: 'Not analyzed', processing: 'Analyzing disclosure',
    completed: 'Analyzed', partial: 'Partial coverage', failed: 'Analysis unavailable',
    unsupported: 'No document analysis for this form',
  }[value.status]
  return (
    <div className="space-y-2 whitespace-normal text-sm">
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline">{status}</Badge>
        {ready && value.direction && <Badge variant="secondary">{value.direction}</Badge>}
        {ready && value.importance && <Badge variant="outline">{value.importance} importance</Badge>}
      </div>
      {ticker && filingId && value.status !== 'unsupported' && (value.status !== 'completed' || value.needs_highlights_update) && (
        <Button size="sm" variant="outline" disabled={analyze.isPending || value.status === 'processing'} onClick={() => analyze.mutate()}>
          {analyze.isPending || value.status === 'processing' ? 'Analyzing…' :
            value.needs_highlights_update ? 'Update highlights' :
            value.status === 'failed' || value.status === 'partial' ? 'Retry analysis' : 'Analyze'}
        </Button>
      )}
      {analyze.isError && <p role="alert" className="text-xs text-destructive">Could not request analysis. Please try again.</p>}
      {ready && <FilingKeyFacts facts={value.key_facts ?? []} />}
      {ready && value.needs_highlights_update && <p className="text-xs text-muted-foreground">Saved analysis available. Update highlights to extract financial facts.</p>}
      {ready && ((value.omitted_key_facts ?? 0) > 0 || (value.omitted_findings ?? 0) > 0 || value.model_warning) && <p className="text-xs text-muted-foreground">Some proposed facts could not be verified and were omitted. The facts shown have source evidence.</p>}
      {ready && <p>{value.summary}</p>}
      {!ready && value.previous_analysis && <details className="border-t pt-2" onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary className="cursor-pointer text-xs underline">Previous saved analysis</summary>
        <p>{value.previous_analysis.summary}</p>
        {detail.isPending && <p className="text-xs">Loading saved evidence…</p>}
        {value.previous_analysis.findings?.map((finding, i) => <div className="mt-2 space-y-1" key={i}>
          <p>{finding.fact}</p><Evidence evidence={finding.evidence} />
        </div>)}
      </details>}
      {value.status === 'partial' && <p className="text-xs text-muted-foreground">Coverage or extraction is incomplete. Highlights and findings cover only the cited evidence.</p>}
      {value.status === 'failed' && <p className="text-xs text-muted-foreground">
        {failureReason[value.error_code ?? ''] ?? 'Analysis did not finish.'} Click Retry analysis to try again.
      </p>}
      {ready && ticker && filingId && (
        <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
          <summary className="cursor-pointer text-xs underline">Findings, changes and evidence</summary>
          <div className="mt-3 space-y-4">
            {detail.isPending && <p>Loading evidence…</p>}
            {detail.isError && <button className="underline" onClick={() => detail.refetch()}>Could not load evidence. Retry</button>}
            {value.coverage && <div className="text-xs text-muted-foreground space-y-1">
              <p>{value.coverage.selected_chars.toLocaleString()} of {value.coverage.available_chars.toLocaleString()} characters in selected sections analyzed.</p>
              {!!value.coverage.financial_selected_chars && <p>Plus {value.coverage.financial_selected_chars.toLocaleString()} characters of targeted financial evidence.</p>}
              <p>Prior report comparison: {value.coverage.comparison_status.replaceAll('_', ' ')}. {value.coverage.prior_accession}</p>
              <p>{value.coverage.comparison_kind}</p>
              {!value.coverage.document_discovery_complete && <p>Exhibit discovery incomplete or capped.</p>}
              {value.coverage.missing_documents?.map((document) => <p key={document.source_url}>
                <a className="underline" href={document.source_url} target="_blank" rel="noreferrer">Exhibit unavailable during analysis</a>
              </p>)}
              <p>Sections: {value.coverage.sections.map((s) => s.section).join(', ')}</p>
              {value.coverage.excluded_sections.length > 0 && <p>Outside analysis scope: {value.coverage.excluded_sections.map((s) => s.section).join(', ')}</p>}
            </div>}
            {value.findings?.map((finding, index) => <article key={index} className="space-y-2 border-t pt-3">
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline">{finding.topic}</Badge>
                <Badge variant="secondary">{finding.direction}</Badge>
                <Badge variant="outline">{finding.importance} importance</Badge>
                <Badge variant="outline">{finding.change.replaceAll('_', ' ')}</Badge>
              </div>
              <p className="font-medium">{finding.fact}</p>
              <p><span className="font-medium">Why it may matter: </span>{finding.why_it_matters}</p>
              <p className="text-xs text-muted-foreground">Evidence: {finding.evidence_quality}. Interpretation describes business impact.</p>
              <Evidence evidence={finding.evidence} />
              {finding.prior_evidence && <div><p className="text-xs">Previous report:</p><Evidence evidence={finding.prior_evidence} /></div>}
              {finding.numbers.map((number, i) => <div key={i} className="text-xs space-y-1">
                <p>{number.name}: {number.value} {number.unit} · {number.period} · Comparison: {number.comparison_basis}</p>
                <Evidence evidence={number.evidence} />
              </div>)}
            </article>)}
            {value.usage && <p className="text-xs text-muted-foreground">
              {value.usage.calls} model calls · {value.usage.prompt_tokens.toLocaleString()} input / {value.usage.completion_tokens.toLocaleString()} output tokens
              {value.usage.cost_usd !== null ? ` · $${Number(value.usage.cost_usd).toFixed(4)}` : ' · Cost not reported by provider'}
            </p>}
            <p className="text-xs text-muted-foreground">Business impact assessment, not a stock-return prediction. {value.model} · analysis v{value.version}</p>
          </div>
        </details>
      )}
    </div>
  )
}
