import { useId, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Source management folded under the feed: it is set up once and rarely changed. */
export function SourcesPanel({
  count,
  description,
  children,
}: {
  count: number | null
  description: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const contentId = useId()

  return (
    <section className="border-border rounded-xl border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium"
      >
        <ChevronRight
          className={cn('text-muted-foreground size-4 shrink-0 transition-transform', open && 'rotate-90')}
          aria-hidden="true"
        />
        <span>{count === null ? 'Sources' : `Sources (${count})`}</span>
        <span className="text-muted-foreground ml-auto hidden text-xs font-normal sm:inline">
          {description}
        </span>
      </button>
      {open && (
        <div id={contentId} className="border-border border-t p-4">
          {children}
        </div>
      )}
    </section>
  )
}
