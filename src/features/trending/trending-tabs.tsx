import { useSearchParams } from 'react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingLeaderboardTable } from './trending-leaderboard-table'
import { TrendingNewEntrantsList } from './trending-new-entrants-list'

export function TrendingTabs() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'today'

  return (
    <Tabs
      value={tab}
      onValueChange={(next) =>
        setParams((previous) => {
          const nextParams = new URLSearchParams(previous)
          if (next === 'today') nextParams.delete('tab')
          else nextParams.set('tab', next)
          nextParams.delete('page')
          return nextParams
        })
      }
      className="space-y-4"
    >
      <TabsList>
        <TabsTrigger value="today">Today</TabsTrigger>
        <TabsTrigger value="new">New today</TabsTrigger>
        <TabsTrigger value="general">Trending in general</TabsTrigger>
      </TabsList>
      <TabsContent value="today">
        <TrendingLeaderboardTable window="today" />
      </TabsContent>
      <TabsContent value="new">
        <TrendingNewEntrantsList />
      </TabsContent>
      <TabsContent value="general">
        <TrendingLeaderboardTable window="general" />
      </TabsContent>
    </Tabs>
  )
}
