import { useEffect, useState } from 'react'
import { marketDate } from './dates'

export function useMarketDate(): string {
  const [today, setToday] = useState(marketDate)
  useEffect(() => {
    const update = () => setToday(marketDate())
    const interval = window.setInterval(update, 30_000)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('focus', update)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('focus', update)
    }
  }, [])
  return today
}
