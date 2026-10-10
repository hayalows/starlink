import type { MinuteBucket, MonthBucket } from "./energyBuckets";
export interface GhanaHistoryBackup {
  minutes: MinuteBucket[];
  months: MonthBucket[];
}

// The recorder can persist 61–62 samples in a wall-clock minute when a drain
// crosses timestamp boundaries. Treat those as recoverable originals, not as
// evidence that the archive should be normalized or re-scaled. Coverage
// calculations already cap a minute at 60 seconds. Larger anomalies still
// require a separate integrity investigation before restoration.
const MAX_RECOVERABLE_MINUTE_SAMPLES = 62;
export function validateHistory(value: unknown, now = Date.now()): GhanaHistoryBackup {
  if (!value || typeof value !== "object") throw Error("This file has no supported history.");
  const v = value as Partial<GhanaHistoryBackup>;
  if (
    !Array.isArray(v.minutes) ||
    !Array.isArray(v.months) ||
    v.minutes.length > 600000 ||
    v.months.length > 1200
  )
    throw Error("Unsupported history size or format.");
  const number = (n: unknown, max: number) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max;
  const keys = new Set<number>();
  const minutes = v.minutes.map((b) => {
    if (
      !b ||
      !number(b.minute, now / 1000 + 60) ||
      b.minute % 60 !== 0 ||
      keys.has(b.minute) ||
      !number(b.samples, MAX_RECOVERABLE_MINUTE_SAMPLES) ||
      !number(b.wattSeconds, 600000) ||
      !number(b.downlinkBits ?? 0, 1e16) ||
      !number(b.uplinkBits ?? 0, 1e16)
    )
      throw Error("Invalid or duplicate minute in backup.");
    keys.add(b.minute);
    return {
      minute: b.minute,
      samples: b.samples,
      wattSeconds: b.wattSeconds,
      ...(b.downlinkBits != null ? { downlinkBits: b.downlinkBits } : {}),
      ...(b.uplinkBits != null ? { uplinkBits: b.uplinkBits } : {}),
    };
  });
  keys.clear();
  const months = v.months.map((b) => {
    if (
      !b ||
      !number(b.month, now / 1000) ||
      keys.has(b.month) ||
      !number(b.samples, 32 * 86400) ||
      !number(b.wattSeconds, 3e10) ||
      !number(b.downlinkBits, 1e20) ||
      !number(b.uplinkBits, 1e20)
    )
      throw Error("Invalid or duplicate monthly archive in backup.");
    keys.add(b.month);
    return {
      month: b.month,
      samples: b.samples,
      wattSeconds: b.wattSeconds,
      downlinkBits: b.downlinkBits,
      uplinkBits: b.uplinkBits,
    };
  });
  return { minutes, months };
}
