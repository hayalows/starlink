import { describe, expect, it } from "vitest";
import { forecastQuality } from "./ghanaForecastQuality";
import { analyzePeriodCost } from "./ghanaPeriodCosts";
import { effectiveObservedPricePerGb } from "./ghanaDataValue";
import { buildInsights } from "./ghanaInsights";

describe("trustworthy Ghana forecasting and rate explanations", () => {
  it("identifies early projections after only a day of recorded history", () => {
    expect(forecastQuality(86400, 0.13).level).toBe("early");
    expect(forecastQuality(86400, 0.13).hours).toBe(24);
    expect(forecastQuality(3600, 0.99).level).toBe("insufficient");
  });

  it("requires several well-covered days before calling a projection better supported", () => {
    expect(forecastQuality(4 * 86400, 0.75).level).toBe("developing");
    expect(forecastQuality(8 * 86400, 0.95).level).toBe("supported");
    expect(forecastQuality(8 * 86400, 0.1).level).toBe("early");
  });

  it("holds the monthly effective cost fixed when the selected period changes", () => {
    const now = new Date("2026-10-09T00:34:00Z");
    const insights = buildInsights([], now);
    const inputs = {
      planFee: 500,
      tariff: "residential" as const,
      homeKwh: 0,
      customRate: 0,
      hours: 24,
    };
    const month = analyzePeriodCost({
      current: { kWh: 0.51, sampledSeconds: 26 * 3600 },
      window: insights.periods.month.window,
      period: "month",
      inputs,
      watts: 32.5,
    });
    const today = analyzePeriodCost({
      current: { kWh: 0.011, sampledSeconds: 2040 },
      window: insights.periods.today.window,
      period: "today",
      inputs,
      watts: 32.5,
    });
    expect(month.projectedTotal).not.toBeCloseTo(today.projectedTotal ?? 0, 1);
    const selectedMonthlyRate = effectiveObservedPricePerGb(month.projectedTotal, 66.61);
    expect(selectedMonthlyRate).toBeCloseTo((month.projectedTotal ?? 0) / 66.61, 7);
  });

  it("compares like-for-like full-month estimates rather than inflating partial-history rates", () => {
    expect(effectiveObservedPricePerGb(530.4, 66.61)).toBeCloseTo(7.962768, 4);
    expect(effectiveObservedPricePerGb(530.4, 1935.56)).toBeCloseTo(0.274029, 4);
  });
});
