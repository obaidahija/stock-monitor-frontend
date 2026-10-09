import { NavLink, Outlet, useLocation } from 'react-router'
import { ChevronDown, Flame, LineChart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { TickerSearch } from './ticker-search'

const NAV_ITEMS = [
  { to: '/', label: 'Digest', end: true },
  { to: '/discover', label: 'Discover' },
  { to: '/research', label: 'Research' },
  { to: '/watchlists', label: 'Watchlists' },
  { to: '/social', label: 'Social', accent: true },
  { to: '/macro', label: 'Macro' },
  { to: '/events', label: 'Events' },
  { to: '/system', label: 'System' },
  { to: '/settings', label: 'Settings' },
]

function currentNavItem(pathname: string) {
  return NAV_ITEMS.find((item) =>
    item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`),
  )
}

/**
 * Below xl the page links, logo and search do not fit one row (they need about
 * 1,050px): one button names the page and opens them all.
 */
function CompactNavMenu() {
  const { pathname } = useLocation()
  const current = currentNavItem(pathname)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="xl:hidden"
          // The visible label stays part of the name, so voice control can still say "Social".
          aria-label={current ? `Pages: ${current.label}` : 'Pages'}
        >
          {current?.label ?? 'Pages'}
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {NAV_ITEMS.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <NavLink to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppLayout() {
  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="border-border bg-background/95 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3 md:flex-nowrap md:gap-6">
          <NavLink to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <LineChart className="text-primary size-5" />
            <span className="hidden sm:inline">MarketScout</span>
          </NavLink>
          <CompactNavMenu />
          {/* min-w-0 + overflow-x-auto: should the links ever outgrow the row, the nav scrolls instead of the page. */}
          <nav aria-label="Main navigation" className="hidden min-w-0 items-center gap-0.5 overflow-x-auto xl:flex">
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
