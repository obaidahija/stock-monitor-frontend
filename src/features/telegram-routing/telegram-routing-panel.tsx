import { Fragment, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
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
import { formatEasternDateTime } from '@/lib/format'
import type { TelegramRouteOut, TelegramStatusOut, TopicSetupItemOut } from '@/types/api'
import {
  useClearTelegramRoute,
  useSaveTelegramRoute,
  useSetupTelegramTopics,
  useTelegramStatus,
  useTelegramTest,
} from './hooks'

const OUTCOME_LABELS: Record<TopicSetupItemOut['outcome'], string> = {
  created: 'Created',
  recreated: 'Recreated',
  kept: 'Kept',
  failed: 'Failed',
  not_reached: 'Not reached',
}

function Destination({ route }: { route: TelegramRouteOut }) {
  if (route.source === 'none' || !route.chat_id) return <span>not set</span>
  if (route.source === 'default') {
    return (
      <>
        <span>default chat</span>
        {route.chat_title ? <span className="block text-xs">{route.chat_title}</span> : null}
      </>
    )
  }
  const topic =
    route.thread_id === null ? '' : ` › ${route.topic_name ?? `topic ${route.thread_id}`}`
  const ids = route.thread_id === null ? route.chat_id : `${route.chat_id} · topic ${route.thread_id}`
  return (
    <>
      <span className="text-foreground">{`${route.chat_title ?? route.chat_id}${topic}`}</span>
      {route.chat_title ? <span className="block text-xs">{ids}</span> : null}
    </>
  )
}

function DeliveryHealth({ route }: { route: TelegramRouteOut }) {
  const failures = route.consecutive_failures ?? 0
  if (failures > 0) {
    return (
      <span className="text-destructive block text-xs">
        {`${failures} failed in a row, last ${formatEasternDateTime(route.last_failure_at)}: ${route.last_error ?? 'unknown error'}`}
      </span>
    )
  }
  if (route.last_sent_at) {
    return (
      <span className="text-muted-foreground block text-xs">
        Last sent {formatEasternDateTime(route.last_sent_at)}
      </span>
    )
  }
  return null
}

function BotAndDefaultChat({ status }: { status: TelegramStatusOut }) {
  const botReady = status.bot_ready ?? status.ready
  const defaultChat = status.default_chat_title ?? status.default_chat_id
  return (
    <div className="space-y-1 text-sm">
      <p>
        Bot:{' '}
        {status.bot_username ? <span className="font-medium">@{status.bot_username}</span> : null}{' '}
        {botReady ? (
          <span className="text-emerald-600 dark:text-emerald-400">ready</span>
        ) : (
          <span className="text-destructive">{status.bot_error ?? status.error ?? 'not ready'}</span>
        )}
      </p>
      {botReady ? (
        <p>
          Default chat (TELEGRAM_CHAT_ID):{' '}
          {defaultChat ? <span className="font-medium">{defaultChat}</span> : 'not set'}{' '}
          {defaultChat && status.ready ? (
            <span className="text-emerald-600 dark:text-emerald-400">ready</span>
          ) : defaultChat ? (
            <span className="text-destructive">{status.error ?? 'not ready'}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}

function SetupTopics() {
  const [chatId, setChatId] = useState('')
  const setup = useSetupTelegramTopics()

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Set up topics in a forum group</p>
        <p className="text-muted-foreground text-xs">
          Creates one coloured topic per category and routes each category to it. Needs Topics
          turned on in the group, and the bot as an admin with “Manage topics”. Pressing it again
          only creates what is missing, including topics deleted in Telegram.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <Label htmlFor="telegram-setup-chat">Forum group: chat ID, @username or a message link</Label>
          <Input
            id="telegram-setup-chat"
            placeholder="blank = default chat · e.g. https://t.me/c/1234567890/5"
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
  const routed = route.source === 'route'
  const [link, setLink] = useState('')
  const [chatId, setChatId] = useState(routed ? (route.chat_id ?? '') : '')
  const [threadId, setThreadId] = useState(
    routed && route.thread_id !== null ? String(route.thread_id) : '',
  )
  const save = useSaveTelegramRoute()
  const id = `telegram-route-${route.category}`
  const topicLink = link.trim()
  const manualChatId = chatId.trim()
  const manualThreadId = threadId.trim() ? Number(threadId) : null
  const topicInvalid =
    !topicLink &&
    manualThreadId !== null &&
    (/\D/.test(threadId) || manualThreadId < 1 || manualThreadId > 2_147_483_647)
  const canSave = Boolean(topicLink || (manualChatId && !topicInvalid))

  function submit() {
    if (!canSave) return
    const body = topicLink
      ? { link: topicLink }
      : { chat_id: manualChatId, thread_id: manualThreadId }
    save.mutate({ category: route.category, body }, { onSuccess: onDone })
  }

  return (
    <FieldGroup className="gap-2 py-2">
      <Field className="gap-1">
        <FieldLabel htmlFor={`${id}-link`}>Topic link</FieldLabel>
        <Input
          id={`${id}-link`}
          placeholder="https://t.me/c/1234567890/45"
          value={link}
          onChange={(event) => setLink(event.target.value)}
        />
      </Field>
      <p className="text-muted-foreground text-xs">or</p>
      <div className="flex gap-2">
        <Field className="min-w-0 flex-1 gap-1" data-disabled={Boolean(topicLink)}>
          <FieldLabel htmlFor={`${id}-chat`}>Chat ID</FieldLabel>
          <Input
            id={`${id}-chat`}
            placeholder="-1001234567890"
            value={chatId}
            disabled={Boolean(topicLink)}
            onChange={(event) => setChatId(event.target.value)}
          />
        </Field>
        <Field
          className="w-32 shrink-0 gap-1"
          data-disabled={Boolean(topicLink)}
          data-invalid={topicInvalid}
        >
          <FieldLabel htmlFor={`${id}-thread`}>Topic ID</FieldLabel>
          <Input
            id={`${id}-thread`}
            inputMode="numeric"
            placeholder="optional"
            value={threadId}
            disabled={Boolean(topicLink)}
            aria-invalid={topicInvalid}
            aria-describedby={topicInvalid ? `${id}-thread-error` : undefined}
            onChange={(event) => setThreadId(event.target.value)}
          />
          {topicInvalid ? (
            <FieldError id={`${id}-thread-error`} className="text-xs whitespace-normal">
              Enter digits only, from 1 to 2,147,483,647.
            </FieldError>
          ) : null}
        </Field>
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
    </FieldGroup>
  )
}

function RouteRow({ route }: { route: TelegramRouteOut }) {
  const [editing, setEditing] = useState(false)
  const { category, source, chat_id, thread_id } = route
  // A destination change starts a new test context, even if the route changes back later.
  const testDestination = useMemo(
    () => ({ category, source, chat_id, thread_id }),
    [category, source, chat_id, thread_id],
  )
  const test = useTelegramTest()
  const clear = useClearTelegramRoute()
  const isCurrentTest = test.variables === testDestination
  const testError = isCurrentTest && test.error ? settingsErrorMessage(test.error) : null
  const clearError = clear.error ? settingsErrorMessage(clear.error) : null

  return (
    <Fragment>
      <TableRow>
        <TableCell className="font-medium">{route.name}</TableCell>
        <TableCell className="text-muted-foreground">
          <Destination route={route} />
        </TableCell>
        <TableCell>
          {route.ready ? (
            <span className="text-emerald-600 dark:text-emerald-400">✓ ready</span>
          ) : (
            <span className="text-destructive">{route.error ?? 'Not ready'}</span>
          )}
          <DeliveryHealth route={route} />
          {isCurrentTest && test.isSuccess ? (
            <span className="text-muted-foreground block text-xs">Test sent</span>
          ) : null}
          {testError ? <span className="text-destructive block text-xs">{testError}</span> : null}
          {clearError ? <span role="alert" className="text-destructive block text-xs">{clearError}</span> : null}
        </TableCell>
        <TableCell className="text-right whitespace-nowrap">
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={(isCurrentTest && test.isPending) || source === 'none'}
              onClick={() => test.mutate(testDestination)}
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
        {data ? <BotAndDefaultChat status={data} /> : null}
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
