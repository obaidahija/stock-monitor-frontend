import { NavLink, Outlet } from 'react-router'
import { LineChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TickerSearch } from './ticker-search'

const NAV_ITEMS = [
  { to: '/', label: 'Digest', end: true },
  { to: '/discover', label: 'Discover' },
  { to: '/system', label: 'System' },
]

export function AppLayout() {
  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="border-border bg-background/95 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <LineChart className="text-primary size-5" />
            MarketScout
          </NavLink>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <TickerSearch />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
