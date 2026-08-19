import type { RedditSignalScoreOut } from '@/types/api'

export function SignalScoreDetail({ score }: { score: RedditSignalScoreOut }) {
  const parts = [
    ['Relevance', score.relevance_score], ['Sentiment', score.sentiment_strength_score],
    ['Velocity', score.engagement_velocity_score], ['Discussion', score.discussion_quality_score],
    ['Trust', score.source_trust_score], ['Penalties', -score.penalty_score],
  ] as const
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">{parts.map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd>{value.toFixed(1)}</dd></div>)}</dl>
}
