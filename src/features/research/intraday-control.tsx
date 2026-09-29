import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { ResearchSubscriptionOrigin } from '@/types/api'
import { intradayErrorMessage, useIntradayToggle } from './intraday'

/**
 * Explicit opt-in to 5-minute research bars for one track or catalyst.
 * Evidence collection only -- not a trading action or an entry check.
 */
export function IntradayControl({
  origin,
  subscriptionId,
}: {
  origin: ResearchSubscriptionOrigin
  subscriptionId: number | null
}) {
  const { subscribe, unsubscribe } = useIntradayToggle()
  const busy = subscribe.isPending || unsubscribe.isPending

  async function toggle() {
    try {
      if (subscriptionId === null) {
        await subscribe.mutateAsync(origin)
        toast.success('Collecting 5-minute research bars')
      } else {
        await unsubscribe.mutateAsync(subscriptionId)
        toast.success('Stopped 5-minute collection')
      }
    } catch (error) {
      toast.error(intradayErrorMessage(error))
    }
  }

  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={() => void toggle()}>
      {subscriptionId === null ? 'Collect 5-minute bars' : 'Stop 5-minute collection'}
    </Button>
  )
}
