import { describe, expect, it } from "vitest";
import { allocatedPlanFee, analyzePeriodCost, modeledWatts } from "./ghanaPeriodCosts";
import { periodWindow } from "./ghanaInsights";

const fee = 500;
const monthSettings = {
  planFee: fee,
  tariff: "residential" as const,
  homeKwh: 0,
  customRate: 0,
  hours: 24,
};
const now = new Date("2026-10-08T17:35:00.000Z");

describe("shared extension and phone money calculations", () => {
  it("allocates the fixed monthly plan over October, never over one day", () => {
    const w = periodWindow("today", now, 1);
    const actual = allocatedPlanFee(fee, w, "today");
    const expected = (fee * (17 + 35 / 60)) / 24 / 31;
    expect(actual).toBeCloseTo(expected, 7);
    expect(actual).toBeLessThan(12);
    expect(actual).not.toBeCloseTo(366.32, 0);
  });

  it("uses the full calendar month denominator on the month view", () => {
    const w = periodWindow("month", now, 1);
    expect(allocatedPlanFee(fee, w, "month")).toBeCloseTo(
      (fee * (7 + (17 + 35 / 60) / 24)) / 31,
      7,
    );
  });

  it("allocates the week across different month lengths", () => {
    const start = Date.parse("2026-09-29T00:00:00Z") / 1000;
    const oct1 = Date.parse("2026-10-01T00:00:00Z") / 1000;
    const end = Date.parse("2026-10-03T00:00:00Z") / 1000;
    expect(allocatedPlanFee(500, { start, end, fullEnd: end }, "week")).toBeCloseTo(
      (500 * 2) / 30 + (500 * 2) / 31,
      8,
    );
    expect(oct1).toBeGreaterThan(start);
  });

  it("uses the full custom billing cycle rather than calendar month", () => {
    const start = Date.parse("2026-09-20T00:00:00Z") / 1000;
    const end = Date.parse("2026-10-08T00:00:00Z") / 1000;
    const fullEnd = Date.parse("2026-10-20T00:00:00Z") / 1000;
    expect(allocatedPlanFee(500, { start, end, fullEnd }, "cycle")).toBeCloseTo((500 * 18) / 30, 7);
  });

  it("matches the GH₵549.27 Mini forecast and avoids the GH₵575.80 custom model", () => {
    const watts = modeledWatts("auto", "mini1", 50);
    expect(watts).toBe(32.5);
    const w = periodWindow("month", now, 1);
    const result = analyzePeriodCost({
      current: { kWh: null, sampledSeconds: 0 },
      window: w,
      period: "month",
      inputs: monthSettings,
      watts,
    });
    expect(result.projectedTotal).toBeCloseTo(549.27, 1);
    expect(result.planAllocation).toBeGreaterThan(100);
    expect(result.kwh).toBeGreaterThan(0);
    const wrong = analyzePeriodCost({
      current: { kWh: null, sampledSeconds: 0 },
      window: w,
      period: "month",
      inputs: monthSettings,
      watts: 50,
    });
    expect(wrong.projectedTotal).toBeCloseTo(575.8, 1);
  });

  it("preserves missing-data semantics when no model or recording exists", () => {
    const result = analyzePeriodCost({
      current: { kWh: null, sampledSeconds: 0 },
      window: periodWindow("today", now, 1),
      period: "today",
      inputs: monthSettings,
      watts: modeledWatts("auto", "unknown", 50),
    });
    expect(result.electricity).toBeNull();
    expect(result.total).toBeNull();
    expect(result.projectedTotal).toBeNull();
  });

  it("prefers actual sampled energy when at least 24 hours have been collected", () => {
    const result = analyzePeriodCost({
      current: { kWh: 0.78, sampledSeconds: 86400 },
      window: periodWindow("month", now, 1),
      period: "month",
      inputs: monthSettings,
      watts: 50,
    });
    expect(result.forecastKwh).toBeCloseTo(0.78 * 31, 7);
    expect(result.kwh).toBe(0.78);
    expect(result.total).toBeGreaterThan(result.planAllocation);
  });
});
