/** Shared by the extension and public calculator. Amounts are GHS, traffic is decimal GB. */
export const GHANA_TARIFFS = {
  lifeline: { label: "Lifeline · household up to 30 kWh", rate: 0.899315 },
  residential: { label: "Residential · tiered", rate: 2.037509 },
  residentialHigh: { label: "Residential · already above 300 kWh", rate: 2.692235 },
  custom: { label: "My own electricity rate", rate: 0 },
} as const;
export type GhanaTariff = keyof typeof GHANA_TARIFFS;
export type GhanaPeriod = "today" | "week" | "month";
export const TARIFF_SOURCE = "https://www.purc.com.gh/attachment/545028-20260924090934.pdf";
export const nonNegative = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

/** Incremental energy charge, excluding fixed household charges and levies.
 * Lifeline eligibility applies to the whole household, not a 30-unit cheap block.
 */
export function electricityCost(
  kwh: number,
  tariff: GhanaTariff,
  homeKwh = 0,
  customRate = 0,
): number {
  const units = nonNegative(kwh),
    base = nonNegative(homeKwh);
  if (tariff === "custom") return units * nonNegative(customRate);
  if (tariff === "residentialHigh") return units * GHANA_TARIFFS.residentialHigh.rate;
  const bill = (n: number) =>
    tariff === "lifeline" && n <= 30
      ? n * GHANA_TARIFFS.lifeline.rate
      : Math.min(n, 300) * GHANA_TARIFFS.residential.rate +
        Math.max(0, n - 300) * GHANA_TARIFFS.residentialHigh.rate;
  return Math.max(0, bill(base + units) - bill(base));
}

export interface RecordedBucket {
  t: number;
  kWh?: number | null;
  downGB?: number | null;
  upGB?: number | null;
  sampledSeconds: number;
  expectedSeconds?: number;
}
/** The recorder groups in the host's local timezone. Filter its bars rather than
 * treating a 12-month/year summary as month-to-date, or 12 weeks as seven days.
 */
export function selectPeriod(buckets: RecordedBucket[], period: GhanaPeriod, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "week") start.setDate(start.getDate() - 6);
  if (period === "month") start.setDate(1);
  const startSec = start.getTime() / 1000,
    endSec = now.getTime() / 1000;
  const selected = buckets.filter((b) => b.t >= startSec && b.t <= endSec);
  const sampledSeconds = selected.reduce((n, b) => n + nonNegative(b.sampledSeconds), 0);
  const expectedSeconds = Math.max(1, endSec - startSec);
  return {
    buckets: selected,
    sampledSeconds,
    expectedSeconds,
    coverage: Math.min(1, sampledSeconds / expectedSeconds),
    kWh: selected.some((b) => b.kWh != null)
      ? selected.reduce((n, b) => n + nonNegative(b.kWh ?? 0), 0)
      : null,
    gb: selected.some((b) => b.downGB != null || b.upGB != null)
      ? selected.reduce((n, b) => n + nonNegative(b.downGB ?? 0) + nonNegative(b.upGB ?? 0), 0)
      : null,
  };
}

export function elapsedDays(period: GhanaPeriod, now = new Date()) {
  const fraction = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
  return (period === "month" ? now.getDate() - 1 : period === "week" ? 6 : 0) + fraction;
}
export function monthLength(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}
/** A forecast needs >=24 sampled hours. Missing hours are never sold as measured usage. */
export function forecastUsage(gb: number | null, sampledSeconds: number, days: number) {
  return gb !== null && sampledSeconds >= 86400 ? (gb / sampledSeconds) * 86400 * days : null;
}
export function effectiveCostPerGb(cost: number, gb: number | null, coverage: number) {
  return gb !== null && gb > 0 && coverage >= 0.8 ? nonNegative(cost) / gb : null;
}
export function csvCell(value: unknown) {
  const s = String(value ?? "");
  return '"' + (/^[=+\-@\t\r]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"';
}
export function csvRows(rows: unknown[][]) {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
