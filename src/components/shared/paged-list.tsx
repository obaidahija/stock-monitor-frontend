import { useState, type ReactNode } from 'react'
import { pageSlice } from '@/lib/paging'
import { Pagination } from './pagination'

/**
 * Pages a list the API returns whole. Give it a `key` built from the list's
 * filters so changing a filter starts again at page 1.
 */
export function PagedList<T>({
  items,
  pageSize,
  children,
}: {
  items: readonly T[]
  pageSize: number
  children: (pageItems: T[]) => ReactNode
}) {
  const [page, setPage] = useState(1)
  const slice = pageSlice(items, page, pageSize)

  return (
    <div className="space-y-3">
      {children(slice.items)}
      {slice.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            Showing {slice.start}–{slice.end} of {slice.total}
          </p>
          <Pagination page={slice.page} totalPages={slice.totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}
