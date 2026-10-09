import type { ComponentType } from 'react'
import { Navigate, NavLink, useParams } from 'react-router'
import { PageHeader } from '@/components/shared/page-header'
import { RedditAuthStatusIndicator } from '@/features/reddit/auth-status-banner'
import { AuthStatusIndicator } from '@/features/twitter/auth-status-banner'
import { cn } from '@/lib/utils'
import { RedditPage } from '@/pages/reddit-page'
import { TrendingPage } from '@/pages/trending-page'
import { TwitterPage } from '@/pages/twitter-page'

/**
 * Each view gets its own path rather than a shared `?view=` param: all three
 * keep their filters in the query string under overlapping names (`tab`,
 * `sort`, `page`, ...), so a shared URL would carry one view's filters into
 * another's API calls -- Reddit's `sort=comments` does not exist on Twitter.
 */
const SOCIAL_VIEWS: { view: string; label: string; Content: ComponentType; Status?: ComponentType }[] = [
  { view: 'trending', label: 'Trending', Content: TrendingPage },
  { view: 'twitter', label: 'Twitter', Content: TwitterPage, Status: AuthStatusIndicator },
  { view: 'reddit', label: 'Reddit', Content: RedditPage, Status: RedditAuthStatusIndicator },
]

export function SocialPage() {
  const { view } = useParams<{ view: string }>()
  const active = SOCIAL_VIEWS.find((item) => item.view === view)
  if (!active) return <Navigate to="/social/trending" replace />
  const { Content, Status } = active

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <PageHeader
          title={
            <>
              Social
              {Status && <Status />}
            </>
          }
        />
        <nav aria-label="Social views" className="border-border flex gap-4 border-b">
          {SOCIAL_VIEWS.map((item) => (
            <NavLink
              key={item.view}
              to={`/social/${item.view}`}
              className={({ isActive }) =>
                cn(
                  '-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-foreground text-foreground'
                    : 'text-muted-foreground hover:text-foreground border-transparent',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Content />
    </div>
  )
}
