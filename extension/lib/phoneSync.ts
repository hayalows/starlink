import { browser } from "wxt/browser";
import { buildInsights } from "@core/ghanaInsights";
import { forecastUsage, type GhanaTariff } from "@core/ghanaCost";
import { analyzePeriodCost, modeledWatts } from "@core/ghanaPeriodCosts";
import { ClientTotalsCore, migrateSnapshot } from "@core/clientTotals";
import { usageKey } from "@core/clientUsage";
import { IndexedDbHistory } from "./history";

const ENDPOINT = "https://starlink-ghana.vercel.app/api/monitor";
const STORAGE_KEY = "ghanaPhonePair";
const STATUS_KEY = "ghanaPhoneLastSync";
const PERIOD_MINUTES = 10;
type Pair = { monitorId: string; viewToken: string; writeToken: string; pairedAt: number };
type SyncResult = { paired: boolean; url?: string; lastSync?: number; error?: string };
const num = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;

async function readPair(): Promise<Pair | null> {
  const record = (await browser.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as Pair | undefined;
  return record?.writeToken && record?.viewToken ? record : null;
}
function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
const readerUrl = (token: string) =>
  `https://starlink-ghana.vercel.app/live/#pair=${encodeURIComponent(token)}`;
async function post(action: string, body: unknown, token?: string) {
  const response = await fetch(`${ENDPOINT}?action=${action}`, {
    method: "POST",
    cache: "no-store",
    credentials: "omit",
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };
  if (!response.ok) throw Error(data.error ?? `Sync HTTP ${response.status}`);
  return data;
}

let pending: Promise<void> | null = null;
/** Upload only coarse recorded metrics; no browser history, device names,
 * Starlink sessions, MAC addresses, service IDs or raw router state. */
export async function syncPhoneNow(): Promise<void> {
  if (pending) return pending;
  pending = (async () => {
    const pair = await readPair();
    if (!pair) return;
    const now = new Date();
    const stored = await browser.storage.local.get(["ghanaBudgetSettings", "ghanaDeviceProfiles"]);
    const prefs = stored.ghanaBudgetSettings as Record<string, unknown> | undefined;
    const settings = {
      planFee: num(prefs?.planFee),
      billingDay: Math.max(1, Math.min(31, Math.floor(num(prefs?.billingDay) || 1))),
      tariff: (["residential", "residentialHigh", "lifeline", "custom"].includes(
        String(prefs?.tariff),
      )
        ? prefs?.tariff
        : "residential") as GhanaTariff,
      customRate: num(prefs?.customRate),
      homeKwh: num(prefs?.homeKwh),
      watts: num(prefs?.watts),
      hours: num(prefs?.hours),
      model: (typeof prefs?.model === "string" ? prefs.model : "auto") as
        "auto" | "mini" | "standard4" | "standard5" | "custom",
      detectedModel: String(prefs?.detectedModel ?? "unknown"),
      bundlePrice: num(prefs?.bundlePrice),
      bundleGb: num(prefs?.bundleGb),
    };
    const db = await IndexedDbHistory.open();
    const rows = await db.readMinutes(now.getTime() / 1000 - 95 * 86400, now.getTime() / 1000);
    const insights = buildInsights(rows, now, settings.billingDay);
    const lastDrain = (await browser.storage.local.get("lastDrain")).lastDrain as
      { ok: boolean; at: number } | undefined;
    const periods = Object.fromEntries(
      (["today", "week", "month", "cycle"] as const).map((id) => {
        const item = insights.periods[id];
        const current = item.current;
        const costs = analyzePeriodCost({
          current,
          window: item.window,
          period: id,
          inputs: settings,
          watts: modeledWatts(settings.model, settings.detectedModel, settings.watts),
        });
        return [
          id,
          {
            gb: current.gb,
            kWh: current.kWh,
            coverage: current.coverage,
            trafficCoverage: current.trafficCoverage,
            latest: current.latest,
            cost: costs.total,
            electricityCost: costs.electricity,
            planAllocation: costs.planAllocation,
            projectedCost: costs.projectedTotal,
            forecastGb:
              id === "month" ? forecastUsage(current.gb, current.trafficSeconds, costs.days) : null,
            forecastCoverageEligible: current.trafficSeconds >= 86400,
            projectedElectricity: costs.projectedElectricity,
            modeledKwh: costs.modeledKwh,
            // Null means no observation, not zero use.
            buckets: current.buckets.map((b) => ({
              t: b.t,
              gb: b.downGB == null ? null : b.downGB + (b.upGB ?? 0),
              downGB: b.downGB,
              upGB: b.upGB,
              kWh: b.kWh,
            })),
            window: { start: item.window.start, end: item.window.end },
          },
        ];
      }),
    );
    // Router device totals and dish WAN usage are different meters. Upload a
    // ranked *subset* of monthly device totals without MACs or client IDs.
    // Device names are included only when the owner explicitly paired the phone.
    const snapshot = migrateSnapshot(await db.readTotalsSnapshot());
    const odometer = new ClientTotalsCore();
    if (snapshot) odometer.loadSnapshot(snapshot);
    const profiles = stored.ghanaDeviceProfiles as
      Record<string, { name?: string; group?: string }> | undefined;
    const monthKey = now.getUTCFullYear() * 12 + now.getUTCMonth();
    const all = odometer
      .totals()
      .filter((t) => {
        const d = new Date(t.sinceMs);
        return d.getUTCFullYear() * 12 + d.getUTCMonth() === monthKey;
      })
      .map((t) => {
        const p = profiles?.[usageKey(t.clientId, t.macAddress)];
        return {
          name: (p?.name || t.name || "Unnamed device").slice(0, 60),
          group: (p?.group || "").slice(0, 50),
          gb: (num(t.rxBytes) + num(t.txBytes)) / 1e9,
        };
      })
      .filter((t) => t.gb > 0)
      .sort((a, b) => b.gb - a.gb);
    const deviceTotalGb = all.reduce((sum, item) => sum + item.gb, 0);
    const top = all.slice(0, 15).map((item) => ({
      ...item,
      share: deviceTotalGb > 0 ? item.gb / deviceTotalGb : 0,
    }));
    if (all.length > 15) {
      const otherGb = all.slice(15).reduce((sum, item) => sum + item.gb, 0);
      top.push({ name: "Other devices", group: "", gb: otherGb, share: otherGb / deviceTotalGb });
    }
    db.close();
    await post(
      "push",
      {
        snapshot: {
          version: 1,
          calculationVersion: 2,
          sourceVersion: "1.5.2",
          recordedAt: now.getTime(),
          latestSampleAt: Math.max(
            ...Object.values(insights.periods).map((p) => p.current.latest),
            0,
          ),
          collectorOk: lastDrain?.ok === true,
          lastCollectorAt: lastDrain?.at ?? null,
          periods,
          planFee: settings.planFee,
          bundle: { price: settings.bundlePrice, gb: settings.bundleGb },
          devices: top,
          deviceTotalGb,
        },
      },
      pair.writeToken,
    );
    await browser.storage.local.set({ [STATUS_KEY]: Date.now() });
  })().finally(() => {
    pending = null;
  });
  return pending;
}

export async function handlePhoneSync(action: string): Promise<SyncResult> {
  try {
    if (action === "create") {
      if (await readPair()) return handlePhoneSync("status");
      const pair: Pair = {
        monitorId: crypto.randomUUID(),
        viewToken: newToken(),
        writeToken: newToken(),
        pairedAt: Date.now(),
      };
      // Do not persist either capability until the server successfully creates it.
      await post("create", pair);
      await browser.storage.local.set({ [STORAGE_KEY]: pair });
      try {
        await syncPhoneNow();
      } catch {
        // The pairing is valid even if there is not yet a usable history sample.
      }
      return { paired: true, url: readerUrl(pair.viewToken) };
    }
    const pair = await readPair();
    if (action === "status") {
      const data = await browser.storage.local.get(STATUS_KEY);
      return {
        paired: Boolean(pair),
        url: pair ? readerUrl(pair.viewToken) : undefined,
        lastSync: Number(data[STATUS_KEY] ?? 0),
      };
    }
    if (!pair) return { paired: false, error: "Connect this monitor first." };
    if (action === "sync") {
      await syncPhoneNow();
      return handlePhoneSync("status");
    }
    if (action === "disconnect") {
      await post("revoke", {}, pair.writeToken);
      await browser.storage.local.remove([STORAGE_KEY, STATUS_KEY]);
      return { paired: false };
    }
    return { paired: true, error: "Unknown action" };
  } catch (e) {
    const pair = await readPair();
    return {
      paired: Boolean(pair),
      url: pair ? readerUrl(pair.viewToken) : undefined,
      error: e instanceof Error ? e.message : "Cannot connect to sync service",
    };
  }
}

export function startPhoneSync(): void {
  void browser.alarms.get("ghanaPhoneSync").then((alarm) => {
    if (!alarm) browser.alarms.create("ghanaPhoneSync", { periodInMinutes: PERIOD_MINUTES });
  });
}
