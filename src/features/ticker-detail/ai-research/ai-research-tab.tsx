import { Sparkles } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAiResearch, useRefreshAiResearch } from '../hooks'
import { DriversRisks } from './drivers-risks'
import { EvidencePanel } from './evidence-panel'
import { PriceReferenceLadder } from './price-reference-ladder'
import { ProgressPanel } from './progress-panel'
import { ScoreGauge } from './score-gauge'
import { SaveAiSetupDialog } from '@/features/watchlists/save-ai-setup-dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

const ResearchChat = lazy(() =>
  import('./research-chat').then((module) => ({ default: module.ResearchChat })),
)

export function AiResearchTab({ ticker }: { ticker: string }) {
  const [started, setStarted] = useState(false)
  const query = useAiResearch(ticker, started)
  const refresh = useRefreshAiResearch(ticker)

  const isLoading = query.isFetching || refresh.isPending
  const data = refresh.data ?? query.data
  const isError = started && !isLoading && !data && (query.isError || refresh.isError)

  function handleGenerate() {
    setStarted(true)
  }

  function handleRefresh() {
    refresh.mutate()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          LLM-synthesized research read combining quantitative facts, news, X/Twitter, and
          Reddit discussion — informational only, not a trading signal.
        </p>
        <div className="flex items-center gap-2">
          {data?.source.ok && data.snapshot_id !== null && <SaveAiSetupDialog data={data} />}
          <Button
            size="sm"
            variant="outline"
            disabled={isLoading}
            onClick={data ? handleRefresh : handleGenerate}
          >
            <Sparkles className={cn(isLoading && 'animate-pulse')} />
            {isLoading ? 'Generating…' : data ? 'Refresh' : 'Generate AI research'}
          </Button>
        </div>
      </div>

      <ProgressPanel ticker={ticker} active={isLoading} />

      {!data && !isLoading && !isError && (
        <p className="text-muted-foreground text-sm">
          Click "Generate AI research" to run this — takes 20-60s and calls a local or hosted
          LLM.
        </p>
      )}

      {!data && !isLoading && isError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Couldn't generate AI research for {ticker}.
        </p>
      )}

      {data && !data.source.ok && (
        <p className="text-muted-foreground text-sm">
          AI research unavailable right now{data.source.error ? `: ${data.source.error}` : '.'}
        </p>
      )}

      {data && data.source.ok && data.lean && data.score !== null && data.confidence !== null && (
        <div className="flex flex-col gap-4">
          <ScoreGauge score={data.score} confidence={data.confidence} lean={data.lean} />

          <PriceReferenceLadder
            priceReference={data.price_reference}
            currentPrice={data.current_price}
          />

          <DriversRisks keyDrivers={data.key_drivers} risks={data.risks} />

          {data.summary && <p className="text-sm">{data.summary}</p>}

          <EvidencePanel inputsUsed={data.inputs_used} />

          <p className="text-muted-foreground text-xs">{data.caveat}</p>
        </div>
      )}

      <Separator />
      <Suspense fallback={<Skeleton className="h-[42rem]" />}>
        <ResearchChat ticker={ticker} />
      </Suspense>
    </div>
  )
}
