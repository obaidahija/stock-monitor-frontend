import type { QuoteOut } from '@/types/api'

export function regularTradingDate(time: string | null): string | null {
  if (!time) return null
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

export function relativeGap(stock: QuoteOut | undefined, etf: QuoteOut): number | null {
  const stockDate = regularTradingDate(stock?.regular_market_time ?? null)
  if (!stockDate || stockDate !== regularTradingDate(etf.regular_market_time)) return null
  if (stock?.change_pct == null || etf.change_pct == null) return null
  return stock.change_pct - etf.change_pct
}
