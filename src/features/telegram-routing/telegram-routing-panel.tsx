import { Fragment, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { settingsErrorMessage } from '@/features/settings/errors'
import type { TelegramRouteOut, TopicSetupItemOut } from '@/types/api'
import {
  useClearTelegramRoute,
  useSaveTelegramRoute,
  useSetupTelegramTopics,
  useTelegramStatus,
  useTelegramTest,
} from './hooks'

const OUTCOME_LABELS: Record<TopicSetupItemOut['outcome'], string> = {
  created: 'Created',
  kept: 'Kept',
  failed: 'Failed',
  not_reached: 'Not reached',
}

function destination(route: TelegramRouteOut): string {
  if (route.source === 'none' || !route.chat_id) return 'not set'
  if (route.source === 'default') return 'default chat'
  if (route.thread_id === null) return route.chat_id
  const name = route.topic_name ? ` "${route.topic_name}"` : ''
  return `${route.chat_id} · topic ${route.thread_id}${name}`
}

function SetupTopics() {
  const [chatId, setChatId] = useState('')
  const setup = useSetupTelegramTopics()

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Set up topics in a forum group</p>
        <p className="text-muted-foreground text-xs">
          Creates one topic per category and routes each category to it. Needs Topics turned on in
          the group, and the bot as an admin with “Manage topics”. Pressing it again only creates
          what is missing.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <Label htmlFor="telegram-setup-chat">Forum group chat ID</Label>
          <Input
            id="telegram-setup-chat"
            placeholder="blank = default chat"
            value={chatId}
            onChange={(event) => setChatId(event.target.value)}
          />
        </div>
        <Button
          type="button"
          disabled={setup.isPending}
          onClick={() => setup.mutate(chatId.trim() || undefined)}
        >
          {setup.isPending ? 'Setting up…' : 'Set up topics'}
        </Button>
      </div>
      {setup.error ? (
        <p role="alert" className="text-destructive text-sm">
          {settingsErrorMessage(setup.error)}
        </p>
      ) : null}
      {setup.data ? (
        <div className="space-y-1 text-sm">
          {setup.data.error ? (
            <p role="alert" className="text-destructive">
              Stopped: {setup.data.error}. Press again to finish.
            </p>
          ) : null}
          <ul className="grid gap-x-4 sm:grid-cols-2">
            {setup.data.items.map((item) => (
              <li key={item.category} className="flex justify-between gap-2">
                <span>{item.name}</span>
                <span className="text-muted-foreground">{OUTCOME_LABELS[item.outcome]}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function RouteEditor({ route, onDone }: { route: TelegramRouteOut; onDone: () => void }) {
  const [link, setLink] = useState('')
  const [chatId, setChatId] = useState('')
  const [threadId, setThreadId] = useState('')
  const save = useSaveTelegramRoute()
  const id = `telegram-route-${route.category}`
  const canSave = Boolean(link.trim() || chatId.trim())

  function submit() {
    const body = link.trim()
      ? { link: link.trim() }
      : { chat_id: chatId.trim(), thread_id: threadId.trim() ? Number(threadId) : null }
    save.mutate({ category: route.category, body }, { onSuccess: onDone })
  }

  return (
    <div className="space-y-2 py-2">
      <div className="space-y-1">
        <Label htmlFor={`${id}-link`}>Topic link</Label>
        <Input
          id={`${id}-link`}
          placeholder="https://t.me/c/1234567890/45"
          value={link}
          onChange={(event) => setLink(event.target.value)}
        />
      </div>
      <p className="text-muted-foreground text-xs">or</p>
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor={`${id}-chat`}>Chat ID</Label>
          <Input
            id={`${id}-chat`}
            placeholder="-1001234567890"
            value={chatId}
            disabled={Boolean(link.trim())}
            onChange={(event) => setChatId(event.target.value)}
          />
        </div>
        <div className="w-32 space-y-1">
          <Label htmlFor={`${id}-thread`}>Topic ID</Label>
          <Input
            id={`${id}-thread`}
            inputMode="numeric"
            placeholder="optional"
            value={threadId}
            disabled={Boolean(link.trim())}
            onChange={(event) => setThreadId(event.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>
      {save.error ? (
        <p role="alert" className="text-destructive text-sm">
          {settingsErrorMessage(save.error)}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={!canSave || save.isPending} onClick={submit}>
          Save
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function RouteRow({ route }: { route: TelegramRouteOut }) {
  const [editing, setEditing] = useState(false)
  const test = useTelegramTest()
  const clear = useClearTelegramRoute()
  const testError = test.error ? settingsErrorMessage(test.error) : null

  return (
    <Fragment>
      <TableRow>
        <TableCell className="font-medium">{route.name}</TableCell>
        <TableCell className="text-muted-foreground">{destination(route)}</TableCell>
        <TableCell>
          {route.ready ? (
            <span className="text-emerald-600 dark:text-emerald-400">✓ ready</span>
          ) : (
            <span className="text-destructive">{route.error ?? 'Not ready'}</span>
          )}
          {test.isSuccess ? <span className="text-muted-foreground block text-xs">Test sent</span> : null}
          {testError ? <span className="text-destructive block text-xs">{testError}</span> : null}
        </TableCell>
        <TableCell className="text-right whitespace-nowrap">
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={test.isPending || route.source === 'none'}
              onClick={() => test.mutate(route.category)}
            >
              Test
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing((on) => !on)}>
              Edit
            </Button>
            {route.source === 'route' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={clear.isPending}
                onClick={() => clear.mutate(route.category)}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </TableCell>
      </TableRow>
      {editing ? (
        <TableRow>
          <TableCell colSpan={4}>
            <RouteEditor route={route} onDone={() => setEditing(false)} />
          </TableCell>
        </TableRow>
      ) : null}
    </Fragment>
  )
}

export function TelegramRoutingPanel() {
  const { data, isLoading, error } = useTelegramStatus()
  const routes = data?.routes ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Telegram</CardTitle>
        <CardDescription>
          Each kind of message goes to its own chat or forum topic. A category without a route goes
          to the default chat (TELEGRAM_CHAT_ID in .env).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? <p className="text-muted-foreground text-sm">Loading Telegram status…</p> : null}
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            Could not load Telegram status.
          </p>
        ) : null}
        {data ? (
          <p className="text-sm">
            Bot:{' '}
            {data.ready ? (
              <span className="text-emerald-600 dark:text-emerald-400">ready</span>
            ) : (
              <span className="text-destructive">{data.error ?? 'not ready'}</span>
            )}
          </p>
        ) : null}
        <SetupTopics />
        {routes.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((route) => (
                <RouteRow key={route.category} route={route} />
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  )
}
