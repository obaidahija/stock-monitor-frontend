import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTickerDescription } from '@/api/stocks'

export function TickerDescription({ ticker }: { ticker: string }) {
  return <TickerDescriptionContent key={ticker} ticker={ticker} />
}

function TickerDescriptionContent({ ticker }: { ticker: string }) {
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()
  const { data, isPending } = useQuery({
    queryKey: ['ticker-description', ticker],
    queryFn: () => getTickerDescription(ticker),
    staleTime: (query) => !query.state.data?.fetched_at || query.state.data.stale
      ? 60_000 : 24 * 60 * 60 * 1000,
    retry: false,
  })
  if (isPending) return <p className="text-muted-foreground text-xs" role="status">Loading company description…</p>
  if (!data?.description) return null

  const description = data.description
  const isLong = description.length > 250
  const prefix = description.slice(0, 250)
  const wordBreak = prefix.lastIndexOf(' ')
  const preview = `${prefix.slice(0, wordBreak > 0 ? wordBreak : 250).trimEnd()}…`

  return (
    <section aria-label={`About ${ticker}`} className="space-y-1.5">
      <h2 className="text-xs font-semibold">About {ticker}</h2>
      <p id={contentId} className="text-muted-foreground text-sm leading-relaxed [overflow-wrap:anywhere]">
        {expanded || !isLong ? description : preview}
      </p>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {isLong && <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((value) => !value)}
          className="text-foreground focus-visible:ring-ring rounded font-medium outline-none hover:underline focus-visible:ring-2"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>}
        <a href={data.source_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          {data.source_name}
        </a>
        {data.stale && <span>Cached description; refresh temporarily unavailable.</span>}
      </div>
    </section>
  )
}
