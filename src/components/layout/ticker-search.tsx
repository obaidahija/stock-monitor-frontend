import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function TickerSearch() {
  const [value, setValue] = useState('')
  const navigate = useNavigate()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ticker = value.trim().toUpperCase()
    if (!ticker) return
    navigate(`/stocks/${ticker}`)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Jump to ticker…"
        className="w-40 pl-8 sm:w-52"
      />
    </form>
  )
}
