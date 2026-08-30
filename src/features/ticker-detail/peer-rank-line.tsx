import type { PeerRankOut } from '@/types/api'

/** Descriptive context, not a signal: where this ticker's composite score
 * sits among its sector peers. */
export function PeerRankLine({ peerRank }: { peerRank: PeerRankOut | null }) {
  if (!peerRank) return null

  return (
    <span
      className="text-muted-foreground text-sm"
      title={`${peerRank.percentile.toFixed(0)}th percentile by composite score within its ${peerRank.group_kind}`}
    >
      #{peerRank.rank} of {peerRank.group_size} in {peerRank.group_label}
    </span>
  )
}
