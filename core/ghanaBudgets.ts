import { electricityCost, type GhanaTariff } from "./ghanaCost";
import { quietNow, type GhanaInsights } from "./ghanaInsights";
export interface BudgetSettings {
  budgetAlerts: boolean;
  costBudget: number;
  dataBudget: number;
  quietStart: number;
  quietEnd: number;
  planFee: number;
  tariff: GhanaTariff;
  homeKwh: number;
  customRate: number;
}
export interface BudgetMemory {
  month: string;
  sent: string[];
  lastSent: number;
}
export function nextBudgetAlert(
  s: BudgetSettings,
  insights: GhanaInsights,
  memory: BudgetMemory | undefined,
  now = new Date(),
) {
  if (
    !s.budgetAlerts ||
    quietNow(now.getUTCHours(), s.quietStart, s.quietEnd) ||
    (memory && now.getTime() - memory.lastSent < 6 * 3600000)
  )
    return null;
  const month = now.toISOString().slice(0, 7),
    period = insights.periods.month,
    current = period.current;
  if (!current.latest || now.getTime() / 1000 - current.latest > 300) return null;
  const sent = memory?.month === month ? memory.sent : [];
  const elapsed =
    (period.window.end - period.window.start) / (period.window.fullEnd - period.window.start);
  // Apply the same marginal tariff/time allocation used by the Costs screen.
  const forecast =
    current.kWh === null || current.sampledSeconds === 0
      ? null
      : (current.kWh / current.sampledSeconds) * (period.window.fullEnd - period.window.start);
  const electricity =
    forecast === null
      ? null
      : forecast > 0
        ? (electricityCost(forecast, s.tariff, s.homeKwh, s.customRate) * (current.kWh ?? 0)) /
          forecast
        : 0;
  const cost = electricity === null ? null : electricity + s.planFee * elapsed;
  for (const [kind, value, target, coverage] of [
    ["data", current.gb, s.dataBudget, current.trafficCoverage],
    ["cost", cost, s.costBudget, current.coverage],
  ] as const) {
    if (value === null || !(target > 0) || coverage < 0.8) continue;
    const threshold = value / target >= 1 - 1e-9 ? 100 : value / target >= 0.8 - 1e-9 ? 80 : 0;
    const key = `${kind}:${threshold}`;
    if (!threshold || sent.includes(key)) continue;
    const updated = [...sent, key];
    if (threshold === 100 && !updated.includes(`${kind}:80`)) updated.push(`${kind}:80`);
    return {
      key: `ghana-${month}-${key}`,
      title: `${threshold}% of your monthly ${kind === "data" ? "data" : "spending"} target`,
      body:
        kind === "data"
          ? `${value.toFixed(1)} GB recorded of your ${target.toFixed(1)} GB target. Open Costs for details.`
          : `GH₵${value.toFixed(2)} estimated so far against GH₵${target.toFixed(2)}. Includes plan time share and recorded electricity.`,
      memory: { month, sent: updated, lastSent: now.getTime() },
    };
  }
  return null;
}
