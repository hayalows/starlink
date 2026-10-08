import { browser } from "wxt/browser";
import { buildInsights } from "@core/ghanaInsights";
import { nextBudgetAlert, type BudgetMemory, type BudgetSettings } from "@core/ghanaBudgets";
import { IndexedDbHistory } from "./history";
export async function checkGhanaBudgetAlerts(
  deliver: (key: string, title: string, body: string) => Promise<{ delivered: boolean }>,
) {
  const data = await browser.storage.local.get([
    "ghanaBudgetSettings",
    "ghanaBudgetMemory",
    "ghanaBudgetCheck",
  ]);
  const settings = data.ghanaBudgetSettings as BudgetSettings | undefined;
  const now = Date.now();
  if (!settings?.budgetAlerts || now - Number(data.ghanaBudgetCheck ?? 0) < 300000) return;
  await browser.storage.local.set({ ghanaBudgetCheck: now });
  const date = new Date(now),
    start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000;
  const db = await IndexedDbHistory.open();
  try {
    const insights = buildInsights(await db.readMinutes(start, now / 1000), date);
    const alert = nextBudgetAlert(
      settings,
      insights,
      data.ghanaBudgetMemory as BudgetMemory | undefined,
      date,
    );
    if (alert && (await deliver(alert.key, alert.title, alert.body)).delivered)
      await browser.storage.local.set({ ghanaBudgetMemory: alert.memory });
  } finally {
    db.close();
  }
}
