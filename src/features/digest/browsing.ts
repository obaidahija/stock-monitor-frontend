import type { DigestItem } from '@/types/api'
import { stagesForDigestFilter } from './coverage-filters'

export interface DigestFilters {
  query: string
  stages: string[]
  newOnly: boolean
}

export function filterDigestItems(items: DigestItem[], filters: DigestFilters): DigestItem[] {
  const query = filters.query.trim().toLowerCase()
  const stages = new Set(filters.stages)
  return items.filter((item) => {
    if (filters.newOnly && item.new_today !== true) return false
    if (stages.size > 0 && !stagesForDigestFilter(item).some((stage) => stages.has(stage))) return false
    if (!query) return true
    return [item.ticker, ...item.reasons, ...item.headline_snippets,
      ...(item.headlines ?? []).map((headline) => headline.title)]
      .some((text) => text.toLowerCase().includes(query))
  })
}

export function paginateDigestItems(items: DigestItem[], requestedPage: number, pageSize = 24) {
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(pageCount, Number.isInteger(requestedPage) && requestedPage >= 1 ? requestedPage : 1)
  const offset = (page - 1) * pageSize
  return {
    items: items.slice(offset, offset + pageSize), page, pageCount, total,
    start: total === 0 ? 0 : offset + 1,
    end: Math.min(offset + pageSize, total),
  }
}
