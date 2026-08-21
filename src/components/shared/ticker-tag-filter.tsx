import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useUniverseTickerSearch } from '@/features/discover/hooks'

/**
 * "Jump to ticker"-style search, but multi-select: matches become removable
 * tag chips instead of navigating away, so callers can filter a list by
 * more than one ticker at once.
 */
export function TickerTagFilter({
  selected,
  onChange,
  placeholder = 'Filter by ticker…',
}: {
  selected: string[]
  onChange: (tickers: string[]) => void
  placeholder?: string
}) {
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data } = useUniverseTickerSearch(value)
  const matches = (data ?? []).filter((item) => !selected.includes(item.ticker))

  useEffect(() => {
    setHighlighted(0)
  }, [value])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function addTicker(ticker: string) {
    if (!selected.includes(ticker)) onChange([...selected, ticker])
    setValue('')
    setHighlighted(0)
  }

  function removeTicker(ticker: string) {
    onChange(selected.filter((t) => t !== ticker))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && value === '' && selected.length > 0) {
      removeTicker(selected[selected.length - 1])
      return
    }
    if (!open || matches.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((i) => (i + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((i) => (i - 1 + matches.length) % matches.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = matches[highlighted] ?? matches[0]
      if (target) addTicker(target.ticker)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="border-input flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1 focus-within:ring-1 focus-within:ring-ring">
        {selected.map((ticker) => (
          <span
            key={ticker}
            className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-xs font-medium"
          >
            ${ticker}
            <button
              type="button"
              aria-label={`Remove ${ticker} filter`}
              onClick={() => removeTicker(ticker)}
              className="hover:bg-secondary-foreground/20 rounded-full p-0.5"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? placeholder : undefined}
          aria-label={placeholder}
          autoComplete="off"
          className="h-7 min-w-24 flex-1 border-none px-1 shadow-none focus-visible:ring-0"
        />
      </div>

      {open && matches.length > 0 && (
        <div className="bg-popover border-border absolute top-full left-0 z-20 mt-1 w-64 overflow-hidden rounded-lg border shadow-md">
          <ul className="max-h-80 overflow-y-auto py-1">
            {matches.map((item, i) => (
              <li key={item.ticker}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    addTicker(item.ticker)
                  }}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm ${
                    i === highlighted ? 'bg-secondary text-secondary-foreground' : 'text-foreground'
                  }`}
                >
                  <span className="font-medium">{item.ticker}</span>
                  {item.company_name && (
                    <span className="text-muted-foreground truncate text-xs">
                      {item.company_name}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
