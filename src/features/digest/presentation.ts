import type { DigestItem } from '@/types/api'
import { sectionOf } from './sections'

/** Digest cards shown before expansion, besides the Research First cards. */
export const PROMINENT_LIMIT = 12

export interface DigestPresentation {
  prominent: DigestItem[]
  remaining: DigestItem[]
  total: number
}

function isSecondary(item: DigestItem): boolean {
  return sectionOf(item) === 'other_filings'
}

/**
 * Split the complete payload into the compact view and the rest of the
 * coverage. Nothing is dropped: prominent and remaining together are every
 * item, each in payload order.
 *
 * Unfiltered, at most PROMINENT_LIMIT non-secondary items are prominent,
 * skipping tickers already shown as Research First cards so no ticker
 * appears twice; empty slots are never padded with routine filings. With a
 * stage filter every matching item is prominent, with no exclusions.
 */
export function selectDigestPresentation(
  items: DigestItem[],
  researchTickers: string[],
  selectedStages: string[],
): DigestPresentation {
  let isProminent: (item: DigestItem) => boolean
  if (selectedStages.length > 0) {
    const stages = new Set(selectedStages)
    isProminent = (item) => item.stages.some((stage) => stages.has(stage))
  } else {
    const excluded = new Set(researchTickers)
    const chosen = new Set<string>()
    for (const item of items) {
      if (chosen.size >= PROMINENT_LIMIT) break
      if (!isSecondary(item) && !excluded.has(item.ticker)) chosen.add(item.ticker)
    }
    isProminent = (item) => chosen.has(item.ticker)
  }
  const prominent: DigestItem[] = []
  const remaining: DigestItem[] = []
  for (const item of items) (isProminent(item) ? prominent : remaining).push(item)
  return { prominent, remaining, total: items.length }
}
