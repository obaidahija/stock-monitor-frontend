import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import type { DigestFilters } from './browsing'
import { DIGEST_FILTER_META } from './coverage-filters'

export function CoverageControls({ filters, stageCounts, unknownNewnessCount = 0, onChange, onClear, children }: {
  filters: DigestFilters
  stageCounts: Record<string, number>
  unknownNewnessCount?: number
  onChange: (change: Partial<DigestFilters>) => void
  onClear: () => void
  children?: ReactNode
}) {
  const filtering = filters.stages.length > 0 || filters.query.length > 0 || filters.newOnly
  return <div className="flex flex-col gap-3">
    <FieldGroup className="flex-row flex-wrap items-end gap-2">
      <Field className="min-w-40 flex-1">
        <FieldLabel htmlFor="digest-search" className="sr-only">Search digest coverage</FieldLabel>
        <InputGroup>
          <InputGroupAddon><Search /></InputGroupAddon>
          <InputGroupInput id="digest-search" type="search" placeholder="Search ticker or saved evidence…"
            value={filters.query} onChange={(event) => onChange({ query: event.target.value })} />
        </InputGroup>
      </Field>
      <Button variant={filters.newOnly ? 'secondary' : 'outline'} size="sm"
        aria-pressed={filters.newOnly} title="Show only entries carrying a recorded New label; some signal types do not track newness"
        onClick={() => onChange({ newOnly: !filters.newOnly })}>New only</Button>
      {children}
    </FieldGroup>
    <div role="group" aria-label="Filter by stage" className="flex flex-wrap items-center gap-1">
      <span className="text-muted-foreground mr-1 text-xs">Filter by stage</span>
      {Object.entries(DIGEST_FILTER_META).filter(([stage]) => stageCounts[stage] > 0).map(([stage, meta]) => {
        const active = filters.stages.includes(stage)
        return <Button key={stage} size="sm" variant={active ? 'secondary' : 'ghost'}
          aria-pressed={active} onClick={() => onChange({ stages: active
            ? filters.stages.filter((value) => value !== stage) : [...filters.stages, stage] })}>
          <meta.icon data-icon="inline-start" />{meta.label} ({stageCounts[stage]})
        </Button>
      })}
      {filtering && <Button size="sm" variant="ghost" onClick={onClear}>Clear</Button>}
    </div>
    {filters.newOnly && <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" data-testid="digest-newness-note">
      <p>Only entries carrying a recorded New label are shown.
        {unknownNewnessCount > 0 && ` ${unknownNewnessCount} matching ${unknownNewnessCount === 1 ? 'entry has' : 'entries have'} no recorded New label and ${unknownNewnessCount === 1 ? 'is' : 'are'} excluded.`}
      </p>
      {unknownNewnessCount > 0 && <Button size="sm" variant="ghost" onClick={() => onChange({ newOnly: false })}>
        Remove New only filter
      </Button>}
    </div>}
  </div>
}

export function CoveragePagination({ page, pageCount, onChange }: {
  page: number; pageCount: number; onChange: (page: number) => void
}) {
  if (pageCount <= 1) return null
  return <nav aria-label="Coverage pagination" className="flex flex-wrap items-center justify-center gap-3">
    <Button variant="outline" size="sm" aria-label="Previous page" disabled={page <= 1}
      onClick={() => onChange(page - 1)}><ChevronLeft data-icon="inline-start" />Previous</Button>
    <span className="text-muted-foreground text-sm tabular-nums" aria-live="polite">Page {page} of {pageCount}</span>
    <Button variant="outline" size="sm" aria-label="Next page" disabled={page >= pageCount}
      onClick={() => onChange(page + 1)}>Next<ChevronRight data-icon="inline-end" /></Button>
  </nav>
}
