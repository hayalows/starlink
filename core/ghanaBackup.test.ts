import { it, expect } from "vitest";
import { validateHistory } from "./ghanaBackup";
const minute = { minute: 600, samples: 60, wattSeconds: 3000, downlinkBits: 8000000000 };
it("keeps only supported history fields and does not import controls", () => {
  expect(
    validateHistory({ minutes: [{ ...minute, password: "secret" }], months: [], meterRules: [1] }),
  ).toEqual({ minutes: [minute], months: [] });
});
it("keeps recorded 61–62-sample minutes unchanged for safe recovery", () => {
  for (const samples of [61, 62]) {
    const recorded = {
      ...minute,
      samples,
      wattSeconds: 3100,
      downlinkBits: 8100000000,
      uplinkBits: 1000000,
    };
    expect(validateHistory({ minutes: [recorded], months: [] }, 1000000)).toEqual({
      minutes: [recorded],
      months: [],
    });
  }
});
it("rejects duplicate, invalid, future and oversized minute data", () => {
  for (const minutes of [
    [minute, minute],
    [{ ...minute, samples: 63 }],
    [{ ...minute, wattSeconds: NaN }],
    [{ ...minute, minute: 601 }],
    [{ ...minute, minute: 6000000 }],
  ])
    expect(() => validateHistory({ minutes, months: [] }, 1000000)).toThrow();
});
it("accepts an empty backup without inventing records", () =>
  expect(validateHistory({ minutes: [], months: [] })).toEqual({ minutes: [], months: [] }));
