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
 * Unfiltered, select across sections in rounds, so a large earnings section
 * cannot consume the whole budget. Keep the payload's ordering in the result,
 * skipping compact Research First tickers and routine filings. With a
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
    const sections = new Map<string, DigestItem[]>()
    for (const item of items) {
      if (isSecondary(item) || excluded.has(item.ticker)) continue
      const section = sectionOf(item)
      const bucket = sections.get(section)
      if (bucket) bucket.push(item)
      else sections.set(section, [item])
    }
    for (let round = 0; chosen.size < PROMINENT_LIMIT; round++) {
      let found = false
      for (const bucket of sections.values()) {
        const item = bucket[round]
        if (!item) continue
        found = true
        chosen.add(item.ticker)
        if (chosen.size === PROMINENT_LIMIT) break
      }
      if (!found) break
    }
    isProminent = (item) => chosen.has(item.ticker)
  }
  const prominent: DigestItem[] = []
  const remaining: DigestItem[] = []
  for (const item of items) (isProminent(item) ? prominent : remaining).push(item)
  return { prominent, remaining, total: items.length }
}
