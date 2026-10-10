import { browser } from "wxt/browser";
import { mergeRescueMinutes, rescueDay, LOCAL_RESCUE_DAYS } from "@core/ghanaRescue";
import { validateHistory } from "@core/ghanaBackup";
import type { MinuteBucket } from "@core/energyBuckets";
import { IndexedDbHistory } from "./history";

const PREFIX = "ghanaRescueDayV1:";
const INDEX = "ghanaRescueIndexV1";
const LAST = "ghanaRescueLastGoodV1";
const DAY = 86400;
let pending: Promise<RescueState> | null = null;
type Day = { minutes: MinuteBucket[] };
export interface RescueState {
  count: number;
  days: number;
  newest: number | null;
  lastGood: number;
  restored?: number;
  error?: string;
}
const dayStart = (key: string) => Date.parse(key + "T00:00:00.000Z") / 1000;
async function indexDays(): Promise<string[]> {
  const data = (await browser.storage.local.get(INDEX))[INDEX];
  return Array.isArray(data)
    ? [...new Set(data.filter((d): d is string => typeof d === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort()
    : [];
}
async function readDay(key: string): Promise<MinuteBucket[]> {
  const value = (await browser.storage.local.get(PREFIX + key))[PREFIX + key] as Day | undefined;
  return Array.isArray(value?.minutes) ? value.minutes : [];
}
export async function rescueStatus(): Promise<RescueState> {
  const keys = await indexDays();
  let count = 0;
  let newest: number | null = null;
  for (const key of keys) {
    const rows = await readDay(key);
    count += rows.length;
    for (const row of rows) newest = Math.max(newest ?? 0, row.minute);
  }
  const last = (await browser.storage.local.get(LAST))[LAST];
  return { count, days: keys.length, newest, lastGood: Number(last) || 0 };
}
/** A second storage engine for recent, actual minute rows. Never replace a
 * complete rescued day with a shorter/empty day after an IndexedDB reset. */
export async function rescueNow(): Promise<RescueState> {
  if (pending) return pending;
  pending = (async () => {
    const db = await IndexedDbHistory.open();
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const keys = await indexDays();
      const rows = await db.readMinutes(nowSec - 2 * DAY, nowSec);
      const groups = new Map<string, MinuteBucket[]>();
      for (const row of rows) {
        const day = rescueDay(row.minute);
        groups.set(day, [...(groups.get(day) ?? []), row]);
      }
      for (const [key, current] of groups) {
        const merged = mergeRescueMinutes(await readDay(key), current);
        // A bad source must not replace a previously valid rescue copy.
        const checked = validateHistory({ minutes: merged, months: [] });
        await browser.storage.local.set({ [PREFIX + key]: { minutes: checked.minutes } });
        if (!keys.includes(key)) keys.push(key);
      }
      keys.sort();
      // Prune an old duplicate only after confirming the complete same-day
      // minute set is STILL present in primary IndexedDB. If the main store was
      // wiped, preserve that independent rescue copy instead of expiring it.
      const cutoff = nowSec - LOCAL_RESCUE_DAYS * DAY;
      const remaining: string[] = [];
      for (const key of keys) {
        if (dayStart(key) >= cutoff) { remaining.push(key); continue; }
        const rescued = await readDay(key);
        const original = await db.readMinutes(dayStart(key), dayStart(key) + DAY - 1);
        const inPrimary = new Set(original.map((r) => r.minute));
        if (rescued.length && rescued.every((row) => inPrimary.has(row.minute))) {
          await browser.storage.local.remove(PREFIX + key);
        } else remaining.push(key);
      }
      await browser.storage.local.set({ [INDEX]: remaining, [LAST]: Date.now() });
      return rescueStatus();
    } finally { db.close(); }
  })().catch(async (error): Promise<RescueState> => ({
    ...(await rescueStatus().catch(() => ({
      count: 0, days: 0, newest: null, lastGood: 0,
    }))),
    error: error instanceof Error ? error.message : "Local safety copy failed",
  })).finally(() => { pending = null; });
  return pending;
}
export async function rescueRestore(): Promise<RescueState> {
  const keys = await indexDays();
  const db = await IndexedDbHistory.open();
  let added = 0;
  try {
    for (const key of keys) {
      const rows = await readDay(key);
      if (rows.length) added += await db.mergeGhanaHistory({ minutes: rows, months: [] });
    }
  } catch (error) {
    return { ...(await rescueStatus()), restored: added,
      error: error instanceof Error ? error.message : "Local restore failed" };
  } finally { db.close(); }
  return { ...(await rescueStatus()), restored: added };
}
export async function handleRescueAction(action: string): Promise<RescueState> {
  if (action === "status") return rescueStatus();
  if (action === "sync") return rescueNow();
  if (action === "restore") return rescueRestore();
  return { ...(await rescueStatus()), error: "Unknown rescue action" };
}
