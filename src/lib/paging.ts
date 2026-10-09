export interface PageSlice<T> {
  items: T[]
  page: number
  totalPages: number
  total: number
  /** 1-based index of the first row shown; 0 when the list is empty. */
  start: number
  end: number
}

/** One page of `items`. `page` is clamped so a list that shrank never shows an empty page. */
export function pageSlice<T>(items: readonly T[], page: number, pageSize: number): PageSlice<T> {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, Math.floor(page)), totalPages)
  const offset = (current - 1) * pageSize
  const pageItems = items.slice(offset, offset + pageSize)
  return {
    items: pageItems,
    page: current,
    totalPages,
    total,
    start: total === 0 ? 0 : offset + 1,
    end: offset + pageItems.length,
  }
}
