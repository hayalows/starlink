import { expect, it } from "vitest";
import { mergeRescueMinutes, rescueDay } from "./ghanaRescue";
const first = { minute: 60, samples: 60, wattSeconds: 1200, downlinkBits: 2000 };
it("keeps rescued history when the active database is wiped", () => {
  expect(mergeRescueMinutes([first], [])).toEqual([first]);
});
it("does not downgrade old traffic after a collector restart", () => {
  expect(mergeRescueMinutes([first], [{ ...first, samples: 10, downlinkBits: 1 }])).toEqual([
    first,
  ]);
});
it("accepts a later complete version without double-counting", () => {
  const later = { ...first, samples: 62, wattSeconds: 1300, downlinkBits: 2100 };
  expect(mergeRescueMinutes([first], [later])).toEqual([later]);
});
it("preserves distinct recovered minutes in chronological order", () => {
  expect(mergeRescueMinutes([first], [{ ...first, minute: 120 }]).map((r) => r.minute)).toEqual([
    60, 120,
  ]);
});
it("uses UTC dates aligned with Ghana's year-round timezone", () => {
  expect(rescueDay(Date.UTC(2026, 9, 10, 0, 1) / 1000)).toBe("2026-10-10");
});
