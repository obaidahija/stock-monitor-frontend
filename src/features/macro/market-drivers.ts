/** News driver (trained reader) -> measured market driver; mirrors the backend's NEWS_DRIVER_TO_MARKET. */
export const NEWS_TO_MARKET_DRIVER: Record<string, string> = {
  oil_price: 'oil',
  treasury_yields: 'yield_10y',
  rates_policy: 'yield_10y',
  dollar_fx: 'dollar',
}
