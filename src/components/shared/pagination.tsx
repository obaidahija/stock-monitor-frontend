import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Page numbers to render, with `'ellipsis'` markers for gaps — always
 * includes first, last, current, and one neighbor on each side. */
function buildPageList(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages = new Set([1, totalPages, page, page - 1, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)

  const result: (number | 'ellipsis')[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('ellipsis')
    result.push(sorted[i])
  }
  return result
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon-sm"
        variant="outline"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft />
      </Button>

      {buildPageList(page, totalPages).map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="text-muted-foreground px-1 text-sm">
            …
          </span>
        ) : (
          <Button
            key={p}
            size="icon-sm"
            variant={p === page ? 'secondary' : 'ghost'}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        ),
      )}

      <Button
        size="icon-sm"
        variant="outline"
        aria-label="Next page"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight />
      </Button>
    </div>
  )
}
