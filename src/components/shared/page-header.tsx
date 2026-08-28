import type { ReactNode } from 'react'

export function PageHeader({
  title,
  meta,
  description,
  actions,
}: {
  title: ReactNode
  /** Rendered directly under the title, above the description -- e.g. a live price block. */
  meta?: ReactNode
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">{title}</h1>
        {meta && <div className="mt-1">{meta}</div>}
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
