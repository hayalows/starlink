import { describe, expect, it } from "vitest";
import {
  electricityCost,
  selectPeriod,
  effectiveCostPerGb,
  forecastUsage,
  csvRows,
} from "./ghanaCost";
describe("Ghana cost analysis", () => {
  it("splits an incremental monthly dish load at the 300 kWh household tier", () => {
    expect(electricityCost(20, "residential", 290)).toBeCloseTo(10 * 2.037509 + 10 * 2.692235, 6);
  });
  it("does not apply a lifeline block after household eligibility is lost", () => {
    expect(electricityCost(15, "lifeline", 20)).toBeCloseTo(35 * 2.037509 - 20 * 0.899315, 6);
    expect(electricityCost(10, "lifeline", 10)).toBeCloseTo(10 * 0.899315, 6);
  });
  it("uses an entered rate and sanitizes invalid energy", () => {
    expect(electricityCost(3, "custom", 0, 2.5)).toBe(7.5);
    expect(electricityCost(NaN, "residential")).toBe(0);
  });
  it("keeps only the current month from the recorder's year-wide response", () => {
    const now = new Date(2026, 9, 7, 12);
    const result = selectPeriod(
      [
        { t: new Date(2026, 8, 1).getTime() / 1000, kWh: 900, sampledSeconds: 86400 },
        { t: new Date(2026, 9, 1).getTime() / 1000, kWh: 4, sampledSeconds: 86400 },
      ],
      "month",
      now,
    );
    expect(result.kWh).toBe(4);
    expect(result.coverage).toBeCloseTo(1 / 6.5);
  });
  it("filters daily buckets to six prior days and today, not 12 weeks", () => {
    const now = new Date(2026, 9, 7, 12);
    const result = selectPeriod(
      [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
        t: new Date(2026, 9, i).getTime() / 1000,
        downGB: 10,
        upGB: 1,
        sampledSeconds: i === 7 ? 43200 : 86400,
      })),
      "week",
      now,
    );
    expect(result.gb).toBe(77);
    expect(result.coverage).toBe(1);
  });
  it("does not equate missing history to zero or show a misleading per-GB cost", () => {
    expect(selectPeriod([], "month").gb).toBeNull();
    expect(effectiveCostPerGb(500, 0, 1)).toBeNull();
    expect(effectiveCostPerGb(500, 100, 0.1)).toBeNull();
    expect(effectiveCostPerGb(500, 100, 0.9)).toBe(5);
  });
  it("requires 24 sampled hours for a traffic projection", () => {
    expect(forecastUsage(10, 3600, 31)).toBeNull();
    expect(forecastUsage(10, 86400, 31)).toBe(310);
  });
  it("exports quoted cells without spreadsheet formulas", () => {
    expect(csvRows([["=CMD()", 'a"b', 1]])).toBe('"\'=CMD()","a""b","1"');
  });
});
