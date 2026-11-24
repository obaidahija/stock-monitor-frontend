import type { FilingKeyFact } from '@/types/api'

/** The fact's currency: the one it states, else "$" when its value is written with one. */
export function amountCurrency(fact: FilingKeyFact): string | null {
  return fact.currency ?? (fact.value.includes('$') ? '$' : null)
}

/** A stated figure with its currency sign and unit: "$10,409 million", "50.4%". */
export function displayAmount(fact: FilingKeyFact, value: string): string {
  if (!value.trim()) return ''  // a unit alone (" million") is not a value
  const currency = amountCurrency(fact)
  // Only a bare amount takes the sign; a guidance row such as
  // "Total revenue $ 11,100 +/- $ 500" already carries its own.
  const amount = currency && /^[\d(.+-]/.test(value) ? `${currency}${value}` : value
  // A model-proposed value can already carry its sign ("50.4%", "30% to 32%").
  if (fact.unit === '%') return amount.includes('%') ? amount : `${amount}%`
  return `${amount}${fact.unit ? ` ${fact.unit}` : ''}`
}
