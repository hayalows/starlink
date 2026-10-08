import type { MinuteBucket } from "./energyBuckets";
import type { RecordedBucket } from "./ghanaCost";
export type ViewPeriod = "today" | "week" | "month" | "cycle";
const DAY = 86400;
export function cycleBounds(now: Date, billingDay = 1) {
  const day = Math.max(1, Math.min(31, Math.floor(billingDay) || 1));
  const anchor = (offset: number) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
    return d.getTime() / 1000;
  };
  const current = anchor(0);
  const offset = now.getTime() / 1000 < current ? -1 : 0;
  return { start: anchor(offset), end: anchor(offset + 1), previousStart: anchor(offset - 1) };
}
export function periodWindow(period: ViewPeriod, now = new Date(), billingDay = 1) {
  const end = Math.floor(now.getTime() / 60000) * 60;
  const today = Math.floor(end / DAY) * DAY;
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000;
  const cycle = cycleBounds(now, billingDay);
  const start =
    period === "today"
      ? today
      : period === "week"
        ? today - 6 * DAY
        : period === "month"
          ? monthStart
          : cycle.start;
  const fullEnd =
    period === "cycle"
      ? cycle.end
      : period === "month"
        ? Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) / 1000
        : today + DAY;
  const previousStart =
    period === "today"
      ? start - DAY
      : period === "week"
        ? start - 7 * DAY
        : period === "cycle"
          ? cycle.previousStart
          : Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1) / 1000;
  // Compare the same elapsed duration, limited by the shorter billing month.
  const comparisonSeconds = Math.max(0, Math.min(end - start, start - previousStart));
  return {
    start,
    end,
    fullEnd,
    previousStart,
    previousEnd: previousStart + comparisonSeconds,
    comparisonEnd: start + comparisonSeconds,
  };
}
export function summarizeWindow(
  rows: MinuteBucket[],
  start: number,
  end: number,
  bucketSeconds = DAY,
) {
  const selected = rows.filter((b) => b.minute >= start && b.minute < end);
  const buckets = new Map<number, RecordedBucket>();
  let latest = 0;
  for (const b of selected) {
    const t = Math.floor(b.minute / bucketSeconds) * bucketSeconds;
    const row = buckets.get(t) ?? { t, kWh: null, downGB: null, upGB: null, sampledSeconds: 0 };
    row.kWh = (row.kWh ?? 0) + b.wattSeconds / 3600000;
    if (b.downlinkBits != null || b.uplinkBits != null) {
      row.downGB = (row.downGB ?? 0) + (b.downlinkBits ?? 0) / 8e9;
      row.upGB = (row.upGB ?? 0) + (b.uplinkBits ?? 0) / 8e9;
    }
    row.sampledSeconds += Math.min(60, Math.max(0, b.samples));
    buckets.set(t, row);
    latest = Math.max(latest, b.minute + Math.min(60, b.samples));
  }
  const values = [...buckets.values()].sort((a, b) => a.t - b.t);
  const sampledSeconds = values.reduce((a, b) => a + b.sampledSeconds, 0);
  const expectedSeconds = Math.max(1, end - start);
  const trafficSeconds = selected.reduce(
    (a, b) => a + (b.downlinkBits != null || b.uplinkBits != null ? Math.min(60, b.samples) : 0),
    0,
  );
  return {
    buckets: values,
    sampledSeconds,
    expectedSeconds,
    coverage: Math.min(1, sampledSeconds / expectedSeconds),
    trafficCoverage: Math.min(1, trafficSeconds / expectedSeconds),
    trafficSeconds,
    latest,
    kWh: values.length ? values.reduce((a, b) => a + (b.kWh ?? 0), 0) : null,
    gb: values.some((b) => b.downGB != null)
      ? values.reduce((a, b) => a + (b.downGB ?? 0) + (b.upGB ?? 0), 0)
      : null,
  };
}
export function buildInsights(rows: MinuteBucket[], now = new Date(), billingDay = 1) {
  const periods = Object.fromEntries(
    (["today", "week", "month", "cycle"] as const).map((period) => {
      const window = periodWindow(period, now, billingDay);
      return [
        period,
        {
          window,
          current: summarizeWindow(rows, window.start, window.end, period === "today" ? 3600 : DAY),
          comparison: summarizeWindow(rows, window.start, window.comparisonEnd),
          previous: summarizeWindow(rows, window.previousStart, window.previousEnd),
        },
      ];
    }),
  ) as Record<
    ViewPeriod,
    {
      window: ReturnType<typeof periodWindow>;
      current: ReturnType<typeof summarizeWindow>;
      comparison: ReturnType<typeof summarizeWindow>;
      previous: ReturnType<typeof summarizeWindow>;
    }
  >;
  return { at: now.getTime(), periods };
}
export type GhanaInsights = ReturnType<typeof buildInsights>;
export function comparisonPercent(
  current: number | null,
  previous: number | null,
  coverage: number,
  previousCoverage: number,
) {
  return current !== null &&
    previous !== null &&
    previous > 0 &&
    coverage >= 0.8 &&
    previousCoverage >= 0.8 &&
    Math.abs(coverage - previousCoverage) <= 0.1
    ? (current / previous - 1) * 100
    : null;
}
export function quietNow(hour: number, start: number, end: number) {
  return start === end
    ? false
    : start < end
      ? hour >= start && hour < end
      : hour >= start || hour < end;
}
