import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useUniverseTickerSearch } from '@/features/discover/hooks'

export function TickerSearch() {
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)

  const { data } = useUniverseTickerSearch(value)
  const matches = data ?? []

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

  function goTo(ticker: string) {
    navigate(`/stocks/${ticker}`)
    setValue('')
    setOpen(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const target = matches[highlighted] ?? matches[0]
    const ticker = target?.ticker ?? value.trim().toUpperCase()
    if (!ticker) return
    goTo(ticker)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || matches.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((i) => (i + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((i) => (i - 1 + matches.length) % matches.length)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Jump to ticker…"
          className="w-40 pl-8 sm:w-52"
          autoComplete="off"
        />
      </form>
      {open && matches.length > 0 && (
        <div className="bg-popover border-border absolute top-full right-0 z-20 mt-1 w-64 overflow-hidden rounded-lg border shadow-md">
          <ul className="max-h-80 overflow-y-auto py-1">
            {matches.map((item, i) => (
              <li key={item.ticker}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    goTo(item.ticker)
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
