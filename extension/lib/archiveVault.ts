import { browser } from "wxt/browser";
import { archiveBatchPlan, VAULT_BATCH_LIMIT } from "@core/ghanaArchive";
import type { MinuteBucket } from "@core/energyBuckets";
import { IndexedDbHistory } from "./history";
import { readPair } from "./phoneSync";

const URL = "https://starlink-ghana.vercel.app/api/archive";
const ENABLED = "ghanaVaultOptInV1";
const CURSOR = "ghanaVaultBackfillCursorV1";
const RESTORE_CURSOR = "ghanaVaultRestoreCursorV1";
const LAST_SUCCESS = "ghanaVaultLastSuccessV1";
const MAX_BACKFILL_BATCHES = 12;
const MAX_RESTORE_BATCHES = 32;
let uploading: Promise<VaultState> | null = null;

export interface VaultState {
  enabled: boolean;
  paired: boolean;
  localMinutes?: number;
  remoteMinutes?: number | null;
  oldest?: number | null;
  newest?: number | null;
  lastSuccess?: number;
  received?: number;
  rejected?: number;
  restored?: number;
  more?: boolean;
  error?: string;
}

async function enabled() {
  return (await browser.storage.local.get(ENABLED))[ENABLED] === true;
}
async function request(action: string, token: string, body?: unknown, cursor?: number) {
  const query = new URLSearchParams({ action });
  if (cursor !== undefined) query.set("before", String(cursor));
  if (action === "read") query.set("limit", String(VAULT_BATCH_LIMIT));
  const response = await fetch(URL + "?" + query, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: "Bearer " + token,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    credentials: "omit",
    signal: AbortSignal.timeout(20000),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw Error(String(data.error || "Vault service HTTP " + response.status));
  return data;
}
async function cloudSummary(
  token: string,
): Promise<Pick<VaultState, "remoteMinutes" | "oldest" | "newest">> {
  const data = await request("summary", token);
  return {
    remoteMinutes: typeof data.count === "number" ? data.count : null,
    oldest: typeof data.oldest === "number" ? data.oldest : null,
    newest: typeof data.newest === "number" ? data.newest : null,
  };
}

export async function vaultStatus(): Promise<VaultState> {
  const isEnabled = await enabled();
  const pair = await readPair();
  const state: VaultState = { enabled: isEnabled, paired: Boolean(pair) };
  const data = await browser.storage.local.get(LAST_SUCCESS);
  state.lastSuccess = Number(data[LAST_SUCCESS]) || 0;
  try {
    const db = await IndexedDbHistory.open();
    try {
      const history = await db.exportGhanaHistory();
      state.localMinutes = history.minutes.length;
    } finally {
      db.close();
    }
    if (pair) Object.assign(state, await cloudSummary(pair.writeToken));
  } catch (error) {
    state.error = error instanceof Error ? error.message : "History check failed";
  }
  return state;
}

export async function vaultSetEnabled(value: boolean): Promise<VaultState> {
  if (value && !(await readPair()))
    return { enabled: false, paired: false, error: "Pair your phone first." };
  await browser.storage.local.set({ [ENABLED]: value });
  if (value) return vaultUploadNow(true);
  return vaultStatus();
}

async function uploadBatch(token: string, rows: MinuteBucket[]) {
  if (!rows.length) return 0;
  const response = await request("push", token, { minutes: rows });
  if (response.ok !== true) throw Error("The vault did not confirm your upload");
  return rows.length;
}

/** Cloud writes are additive only and NEVER delete or replace older minutes.
 * Recent settled readings are sent first even during a long initial backfill. */
export async function vaultUploadNow(backfill = false): Promise<VaultState> {
  if (uploading) return uploading;
  uploading = (async () => {
    if (!(await enabled())) return { enabled: false, paired: Boolean(await readPair()) };
    const pair = await readPair();
    if (!pair)
      return { enabled: true, paired: false, error: "Pair your phone to enable cloud protection." };
    const db = await IndexedDbHistory.open();
    let uploaded = 0;
    let rejected = 0;
    let more = false;
    try {
      const rows = await db.readMinutes(0, Date.now() / 1000);
      const stored = await browser.storage.local.get(CURSOR);
      let cursor = Math.max(0, Number(stored[CURSOR]) || 0);
      // Do not advance a checkpoint until the remote service confirms the batch.
      // Prioritize fresh readings so a prolonged backfill never puts today at risk.
      const rounds = backfill ? MAX_BACKFILL_BATCHES : 1;
      for (let i = 0; i < rounds; i++) {
        const plan = archiveBatchPlan(rows, Date.now() / 1000, cursor);
        rejected = Math.max(rejected, plan.rejectedCount);
        if (i === 0) {
          const lastSent =
            Number((await browser.storage.local.get(LAST_SUCCESS))[LAST_SUCCESS]) || 0;
          const fresh = plan.recent.filter((row) => row.minute >= lastSent / 1000 - 300);
          for (let offset = 0; offset < fresh.length; offset += VAULT_BATCH_LIMIT) {
            uploaded += await uploadBatch(
              pair.writeToken,
              fresh.slice(offset, offset + VAULT_BATCH_LIMIT),
            );
          }
        }
        if (plan.older.length) {
          uploaded += await uploadBatch(pair.writeToken, plan.older);
          cursor = plan.older[plan.older.length - 1].minute + 60;
          await browser.storage.local.set({ [CURSOR]: cursor });
        }
        more = plan.olderRemaining;
        if (!more) break;
      }
      const updated = Date.now();
      await browser.storage.local.set({ [LAST_SUCCESS]: updated });
      return {
        enabled: true,
        paired: true,
        received: uploaded,
        rejected,
        more,
        lastSuccess: updated,
      };
    } finally {
      db.close();
    }
  })()
    .catch(async (error): Promise<VaultState> => ({
      enabled: await enabled(),
      paired: Boolean(await readPair()),
      error: error instanceof Error ? error.message : "Cloud archive failed",
    }))
    .finally(() => {
      uploading = null;
    });
  return uploading;
}

/** Explicit, merge-only recovery with persisted cursor. Existing minutes are
 * never overwritten, and the current 30-minute collector window is untouched. */
export async function vaultRestore(): Promise<VaultState> {
  const pair = await readPair();
  if (!pair)
    return {
      enabled: await enabled(),
      paired: false,
      error: "Pairing key unavailable. Download the vault from your previously paired phone.",
    };
  let cursor =
    Number((await browser.storage.local.get(RESTORE_CURSOR))[RESTORE_CURSOR]) || 4102444800;
  let restored = 0;
  let more = false;
  try {
    const db = await IndexedDbHistory.open();
    try {
      for (let i = 0; i < MAX_RESTORE_BATCHES; i++) {
        const response = await request("read", pair.writeToken, undefined, cursor);
        const raw = Array.isArray(response.minutes) ? response.minutes : [];
        if (!raw.length) {
          more = false;
          break;
        }
        // mergeGhanaHistory validates every numeric field and restores missing
        // rows only. Never silently clip malformed cloud rows.
        const minutes = raw as MinuteBucket[];
        restored += await db.mergeGhanaHistory({ minutes, months: [] });
        cursor = Number(response.nextBefore);
        more = response.hasMore === true;
        await browser.storage.local.set({ [RESTORE_CURSOR]: cursor });
        if (!more) break;
      }
    } finally {
      db.close();
    }
    if (!more) await browser.storage.local.remove(RESTORE_CURSOR);
    return { enabled: await enabled(), paired: true, restored, more };
  } catch (error) {
    return {
      enabled: await enabled(),
      paired: true,
      restored,
      more: true,
      error: error instanceof Error ? error.message : "Could not restore vault history",
    };
  }
}

export async function handleVaultAction(action: string): Promise<VaultState> {
  switch (action) {
    case "status":
      return vaultStatus();
    case "enable":
      return vaultSetEnabled(true);
    case "disable":
      return vaultSetEnabled(false);
    case "sync":
      return vaultUploadNow(true);
    case "restore":
      return vaultRestore();
    default:
      return {
        enabled: await enabled(),
        paired: Boolean(await readPair()),
        error: "Unknown vault action",
      };
  }
}
