import { describe, expect, it } from "vitest";
import { effectiveObservedPricePerGb, observedGbPerCedi } from "./ghanaDataValue";

describe("Starlink flat-rate data value with partial history", () => {
  it("shows GH₵/GB immediately at low recording coverage", () => {
    const cost = effectiveObservedPricePerGb(549.27, 44.63);
    expect(cost).toBeCloseTo(12.307, 2);
    expect(observedGbPerCedi(cost)).toBeCloseTo(0.08125, 3);
  });
  it("becomes better value as recorded GB increases", () => {
    const early = effectiveObservedPricePerGb(549.27, 44.63)!;
    const later = effectiveObservedPricePerGb(549.27, 100)!;
    expect(later).toBeLessThan(early);
    expect(observedGbPerCedi(later)!).toBeGreaterThan(observedGbPerCedi(early)!);
  });
  it("does not fabricate value when no usage or valid cost is known", () => {
    expect(effectiveObservedPricePerGb(500, 0)).toBeNull();
    expect(effectiveObservedPricePerGb(500, null)).toBeNull();
    expect(effectiveObservedPricePerGb(null, 10)).toBeNull();
    expect(effectiveObservedPricePerGb(NaN, 10)).toBeNull();
    expect(effectiveObservedPricePerGb(Infinity, 10)).toBeNull();
    expect(observedGbPerCedi(0)).toBeNull();
  });
});
