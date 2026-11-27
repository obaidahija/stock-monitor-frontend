import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatEasternDateTime, formatRelativeTime } from '@/lib/format'
import { formatSourceName } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { MacroNewsItemOut } from '@/types/api'
import { DriverChip } from './drivers'

export function MacroNewsCard({
  item,
  onOpen,
}: {
  item: MacroNewsItemOut
  /** Opens the explanation panel. */
  onOpen?: (item: MacroNewsItemOut) => void
}) {
  const drivers = Object.entries(item.model_drivers ?? {})
  const unread = item.model_relevant == null
  const noise = item.model_relevant === false

  return (
    <Card
      className={cn(noise && 'opacity-60', onOpen && 'hover:bg-muted/40 cursor-pointer transition-colors')}
      onClick={onOpen ? () => onOpen(item) : undefined}
    >
      <CardContent className="space-y-2">
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <span>{formatSourceName(item.source)}</span>
          <span aria-hidden="true">·</span>
          <span title={formatEasternDateTime(item.published_at)}>{formatRelativeTime(item.published_at)}</span>
        </div>
        {onOpen ? (
          <h3 className="font-medium leading-snug">{item.title}</h3>
        ) : (
          <a href={item.url} target="_blank" rel="noreferrer" className="block">
            <h3 className="font-medium leading-snug hover:underline">{item.title}</h3>
          </a>
        )}
        {item.summary && (
          <p className="text-muted-foreground line-clamp-2 text-sm">{item.summary}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {unread && (
            <Badge variant="outline" className="text-muted-foreground">
              Reading…
            </Badge>
          )}
          {noise && (
            <Badge variant="outline" className="text-muted-foreground">
              Not market-moving
            </Badge>
          )}
          {item.market_wrap && <Badge variant="outline">Market wrap</Badge>}
          {item.model_magnitude === 'major' && <Badge>Major</Badge>}
          {drivers.map(([driver, direction]) => (
            <DriverChip key={driver} driver={driver} direction={direction} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
