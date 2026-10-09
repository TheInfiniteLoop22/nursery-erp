/**
 * Stored `rate_percentage` on products and order lines is a price multiplier (e.g. 2.25),
 * not a percent add-on. Final unit price = base × rate.
 */
export function finalUnitPriceFromBaseAndRate(base: number, rateMultiplier: number): number {
  if (!Number.isFinite(base) || !Number.isFinite(rateMultiplier)) return Number.NaN
  return base * rateMultiplier
}

export function rateMultiplierFromBaseAndFinalUnit(base: number, finalUnit: number): number {
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(finalUnit)) return Number.NaN
  return finalUnit / base
}

export function formatRateMultiplierString(rate: number, digits = 6): string {
  if (!Number.isFinite(rate)) return ''
  return String(Number(rate.toFixed(digits)))
}
