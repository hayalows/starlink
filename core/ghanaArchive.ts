import type { MinuteBucket } from "./energyBuckets";

// A closed minute is at least three minutes old. Never publish a live,
// still-accumulating minute: the cloud vault intentionally never overwrites
// a previously archived record, even after a restart with truncated storage.
export const VAULT_BATCH_LIMIT = 150;
export const VAULT_SETTLE_SECONDS = 180;
export const VAULT_RECENT_SECONDS = 6 * 3600;

export function eligibleArchiveMinutes(
  rows: MinuteBucket[],
  nowSec: number,
): MinuteBucket[] {
  const cutoff = Math.floor(nowSec / 60) * 60 - VAULT_SETTLE_SECONDS;
  return rows
    .filter(
      (b) =>
        Number.isSafeInteger(b.minute) &&
        b.minute >= 0 &&
        b.minute % 60 === 0 &&
        b.minute < cutoff &&
        Number.isInteger(b.samples) &&
        b.samples >= 0 &&
        b.samples <= 62 &&
        Number.isFinite(b.wattSeconds) &&
        b.wattSeconds >= 0 &&
        b.wattSeconds <= 600000 &&
        (b.downlinkBits === undefined ||
          (Number.isFinite(b.downlinkBits) && b.downlinkBits >= 0)) &&
        (b.uplinkBits === undefined ||
          (Number.isFinite(b.uplinkBits) && b.uplinkBits >= 0)),
    )
    .sort((a, b) => a.minute - b.minute);
}

export function archiveBatchPlan(rows: MinuteBucket[], nowSec: number, cursor: number) {
  const eligible = eligibleArchiveMinutes(rows, nowSec);
  const recentStart = nowSec - VAULT_RECENT_SECONDS;
  const older = eligible.filter((row) => row.minute >= cursor && row.minute < recentStart);
  const recent = eligible.filter((row) => row.minute >= recentStart);
  return {
    older: older.slice(0, VAULT_BATCH_LIMIT),
    recent: recent.slice(-VAULT_BATCH_LIMIT),
    olderRemaining: older.length > VAULT_BATCH_LIMIT,
    eligibleCount: eligible.length,
    rejectedCount: Math.max(0, rows.filter((r) => r.minute < Math.floor(nowSec / 60) * 60 - VAULT_SETTLE_SECONDS).length - eligible.length),
  };
}
