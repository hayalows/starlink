import type { MinuteBucket } from "./energyBuckets";

// Do not reduce or erase a previously rescued minute because the primary DB
// disappeared, replayed a shorter drain, or restarted with a fresh cursor.
export function mergeRescueMinutes(
  preserved: MinuteBucket[],
  current: MinuteBucket[],
): MinuteBucket[] {
  const rows = new Map<number, MinuteBucket>();
  for (const row of preserved) rows.set(row.minute, row);
  for (const incoming of current) {
    const existing = rows.get(incoming.minute);
    if (!existing) {
      rows.set(incoming.minute, incoming);
      continue;
    }
    // Only a more complete monotonic minute may replace the old evidence.
    if (
      incoming.samples > existing.samples &&
      incoming.wattSeconds >= existing.wattSeconds &&
      (incoming.downlinkBits ?? 0) >= (existing.downlinkBits ?? 0) &&
      (incoming.uplinkBits ?? 0) >= (existing.uplinkBits ?? 0)
    ) rows.set(incoming.minute, incoming);
  }
  return [...rows.values()].sort((a, b) => a.minute - b.minute);
}
export const LOCAL_RESCUE_DAYS = 14;
export const rescueDay = (minuteSec: number) =>
  new Date(minuteSec * 1000).toISOString().slice(0, 10);
