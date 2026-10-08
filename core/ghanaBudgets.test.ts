import { it, expect } from "vitest";
import { buildInsights } from "./ghanaInsights";
import { nextBudgetAlert, type BudgetSettings } from "./ghanaBudgets";
const now = new Date("2026-10-01T12:00:00Z");
const start = Date.parse("2026-10-01") / 1000;
const readings = Array.from({ length: 720 }, (_, i) => ({
  minute: start + i * 60,
  samples: 60,
  wattSeconds: 600,
  downlinkBits: 8e9 / 720,
}));
const insights = buildInsights(readings, now);
const settings: BudgetSettings = {
  budgetAlerts: true,
  costBudget: 0,
  dataBudget: 1,
  quietStart: 22,
  quietEnd: 7,
  planFee: 0,
  tariff: "custom",
  homeKwh: 0,
  customRate: 1,
};
it("crossing 100% also marks 80% delivered and survives worker restarts", () => {
  const first = nextBudgetAlert(settings, insights, undefined, now)!;
  expect(first.title).toContain("100%");
  expect(first.memory.sent).toEqual(["data:100", "data:80"]);
  expect(nextBudgetAlert(settings, insights, first.memory, now)).toBeNull();
});
it("requires opt-in, current history, sufficient coverage and outside quiet hours", () => {
  expect(
    nextBudgetAlert({ ...settings, budgetAlerts: false }, insights, undefined, now),
  ).toBeNull();
  expect(
    nextBudgetAlert({ ...settings, quietStart: 11, quietEnd: 13 }, insights, undefined, now),
  ).toBeNull();
  expect(
    nextBudgetAlert(settings, buildInsights(readings.slice(0, 300), now), undefined, now),
  ).toBeNull();
  expect(
    nextBudgetAlert(settings, insights, undefined, new Date("2026-10-01T13:00:00Z")),
  ).toBeNull();
});
it("starts threshold tracking again in a new month", () => {
  const old = {
    month: "2026-09",
    sent: ["data:80", "data:100"],
    lastSent: now.getTime() - 7 * 3600000,
  };
  expect(nextBudgetAlert(settings, insights, old, now)).not.toBeNull();
});
