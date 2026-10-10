import { describe, expect, it } from "vitest";
import { archiveBatchPlan, eligibleArchiveMinutes } from "./ghanaArchive";
const minute = (n: number, samples = 60) => ({
  minute: n * 60,
  samples,
  wattSeconds: samples * 30,
  downlinkBits: samples * 1000,
  uplinkBits: samples * 100,
});
describe("append-only archive batches", () => {
  it("does not send a minute while it can still change", () => {
    const now = 1000 * 60;
    const rows = [minute(996), minute(997), minute(998), minute(999)];
    expect(eligibleArchiveMinutes(rows, now).map((r) => r.minute / 60)).toEqual([996]);
  });
  it("preserves real 61- and 62-sample records with exact values", () => {
    const rows = [minute(1, 61), minute(2, 62), minute(3, 63)];
    expect(eligibleArchiveMinutes(rows, 10000).map((r) => r.samples)).toEqual([61, 62]);
  });
  it("sends recent minutes even if years of older minutes need backfill", () => {
    const rows = Array.from({ length: 500 }, (_, i) => minute(i + 1));
    const plan = archiveBatchPlan(rows, 500 * 60 + 40000, 0);
    expect(plan.older.length).toBe(150);
    expect(plan.olderRemaining).toBe(true);
    expect(plan.recent.length).toBe(0);
    expect(plan.older[0].minute).toBe(60);
    expect(plan.older[149].minute).toBe(150 * 60);
  });
  it("resumes from last successfully archived checkpoint", () => {
    const rows = Array.from({ length: 250 }, (_, i) => minute(i + 1));
    const plan = archiveBatchPlan(rows, 250 * 60 + 40000, 151 * 60);
    expect(plan.older[0].minute).toBe(151 * 60);
    expect(plan.older[99].minute).toBe(250 * 60);
  });
  it("preserves original traffic totals without converting missing readings to zero", () => {
    const rows = [{ minute: 60, samples: 61, wattSeconds: 1800 }];
    expect(eligibleArchiveMinutes(rows, 10000)).toEqual(rows);
  });
});
