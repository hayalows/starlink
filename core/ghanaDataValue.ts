/** An observed effective price for an unmetered flat-fee Starlink plan.
 * A forecast for the full month's subscription + energy is spread across
 * only the GB confirmed by recordings so far. The ratio generally improves
 * as the tracked GB grows; it is *not* an extra bill for each GB.
 *
 * Do not gate on recording coverage: gaps reduce the observed denominator,
 * which makes the current rate conservative until more of the month is
 * recorded. Only absence of usable cost or traffic produces null. */
export function effectiveObservedPricePerGb(
  fullMonthEstimate: number | null | undefined,
  observedGb: number | null | undefined,
): number | null {
  if (
    typeof fullMonthEstimate !== "number" ||
    !Number.isFinite(fullMonthEstimate) ||
    fullMonthEstimate < 0 ||
    typeof observedGb !== "number" ||
    !Number.isFinite(observedGb) ||
    observedGb <= 0
  )
    return null;
  return fullMonthEstimate / observedGb;
}

export function observedGbPerCedi(pricePerGb: number | null): number | null {
  return pricePerGb !== null && Number.isFinite(pricePerGb) && pricePerGb > 0
    ? 1 / pricePerGb
    : null;
}
