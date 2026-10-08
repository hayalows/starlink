import { describe, it, expect } from "vitest";
import {
  cycleBounds,
  periodWindow,
  summarizeWindow,
  comparisonPercent,
  quietNow,
} from "./ghanaInsights";
const sec = (s: string) => Date.parse(s) / 1000;
describe("Ghana billing and coverage", () => {
  it("clamps a 31st billing date through leap February and year boundaries", () => {
    expect(cycleBounds(new Date("2024-02-29T10:00:00Z"), 31)).toEqual({
      start: sec("2024-02-29"),
      end: sec("2024-03-31"),
      previousStart: sec("2024-01-31"),
    });
    expect(cycleBounds(new Date("2026-01-03"), 15).start).toBe(sec("2025-12-15"));
  });
  it("uses the shorter equal elapsed window rather than whole previous months", () => {
    const w = periodWindow("month", new Date("2026-03-31T12:00:00Z"));
    expect(w.comparisonEnd - w.start).toBe(28 * 86400);
    expect(w.previousEnd - w.previousStart).toBe(w.comparisonEnd - w.start);
  });
  it("excludes the unfinished minute and uses UTC despite an offset date", () => {
    const w = periodWindow("today", new Date("2026-10-08T01:01:59+02:00"));
    expect(w.start).toBe(sec("2026-10-07"));
    expect(w.end % 60).toBe(0);
  });
  it("preserves missing traffic and energy rather than creating zero usage", () => {
    expect(summarizeWindow([], 0, 120).gb).toBeNull();
    const r = summarizeWindow([{ minute: 0, samples: 60, wattSeconds: 3600 }], 0, 120);
    expect(r.kWh).toBe(0.001);
    expect(r.gb).toBeNull();
    expect(r.coverage).toBe(0.5);
    expect(r.trafficCoverage).toBe(0);
  });
  it("requires comparable coverage and a nonzero baseline", () => {
    expect(comparisonPercent(12, 10, 1, 1)).toBeCloseTo(20);
    expect(comparisonPercent(12, 10, 0.9, 0.7)).toBeNull();
    expect(comparisonPercent(12, 10, 1, 0.8)).toBeNull();
    expect(comparisonPercent(12, 0, 1, 1)).toBeNull();
  });
  it("supports overnight and same-day quiet hours", () => {
    expect(quietNow(23, 22, 7)).toBe(true);
    expect(quietNow(6, 22, 7)).toBe(true);
    expect(quietNow(7, 22, 7)).toBe(false);
    expect(quietNow(12, 10, 14)).toBe(true);
    expect(quietNow(12, 0, 0)).toBe(false);
  });
});
