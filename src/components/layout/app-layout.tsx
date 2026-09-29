import { NavLink, Outlet } from 'react-router'
import { Flame, LineChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TickerSearch } from './ticker-search'

const NAV_ITEMS = [
  { to: '/', label: 'Digest', end: true },
  { to: '/discover', label: 'Discover' },
  { to: '/watchlists', label: 'Watchlists' },
  { to: '/twitter', label: 'Twitter' },
  { to: '/reddit', label: 'Reddit' },
  { to: '/macro', label: 'Macro' },
  { to: '/events', label: 'Events' },
  { to: '/trending', label: 'Trending', accent: true },
  { to: '/system', label: 'System' },
  { to: '/settings', label: 'Settings' },
]

export function AppLayout() {
  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="border-border bg-background/95 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3 md:flex-nowrap md:gap-6">
          <NavLink to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <LineChart className="text-primary size-5" />
            MarketScout
          </NavLink>
          <nav aria-label="Main navigation" className="order-3 flex w-full min-w-0 items-center gap-1 overflow-x-auto md:order-2 md:w-auto md:gap-0.5">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                    item.accent
                      ? isActive
                        ? 'bg-orange-500/15 text-orange-500'
                        : 'text-orange-500/80 hover:bg-orange-500/10 hover:text-orange-500'
                      : isActive
                        ? 'bg-secondary text-secondary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                {item.accent && <Flame className="size-3.5" />}
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="order-2 ml-auto md:order-3">
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
