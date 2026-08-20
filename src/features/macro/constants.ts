// Fixed display/legend order + colors for the 7 macro categories
// (app/intelligence/macro_classification.py's MACRO_CATEGORY_KEYWORDS keys).
// Colors are slots 1/2/3/4/5/6/7 of the app's validated 8-hue categorical
// palette (the same palette SentimentTrendChart already draws slots 1 "blue"
// and 8 "red" from) -- reusing it keeps the CVD-safe adjacent-pair ordering
// intact rather than picking new hues ad hoc. Slot 8 (red) is deliberately
// unused here: it's reserved app-wide for negative-sentiment coloring, and
// reusing it for a category would let "geopolitical_conflict" (identity) and
// "negative" (sentiment polarity) collide on the same hue.
export const MACRO_CATEGORIES = [
  'rates_fed',
  'oil_energy',
  'banking_credit',
  'inflation',
  'trade_tariffs',
  'treasury_debt',
  'geopolitical_conflict',
] as const

export type MacroCategory = (typeof MACRO_CATEGORIES)[number]

export const MACRO_CATEGORY_META: Record<
  MacroCategory,
  { label: string; light: string; dark: string }
> = {
  rates_fed: { label: 'Rates & Fed', light: '#2a78d6', dark: '#3987e5' },
  oil_energy: { label: 'Oil & Energy', light: '#eb6834', dark: '#d95926' },
  banking_credit: { label: 'Banking & Credit', light: '#1baf7a', dark: '#199e70' },
  inflation: { label: 'Inflation', light: '#eda100', dark: '#c98500' },
  trade_tariffs: { label: 'Trade & Tariffs', light: '#e87ba4', dark: '#d55181' },
  treasury_debt: { label: 'Treasury & Debt', light: '#008300', dark: '#008300' },
  geopolitical_conflict: { label: 'Geopolitical', light: '#4a3aa7', dark: '#9085e9' },
}

export function macroCategoryLabel(category: string): string {
  return MACRO_CATEGORY_META[category as MacroCategory]?.label ?? category
}

export function macroCategoryColor(category: string, isDark: boolean): string {
  const meta = MACRO_CATEGORY_META[category as MacroCategory]
  if (!meta) return isDark ? '#898781' : '#898781' // muted fallback for an unmapped category
  return isDark ? meta.dark : meta.light
}
