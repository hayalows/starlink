import { electricityCost, type GhanaTariff } from "./ghanaCost";
import type { ViewPeriod } from "./ghanaInsights";

const DAY = 86400;
export interface PeriodWindow {
  start: number;
  end: number;
  fullEnd: number;
}
export interface CostSamples {
  kWh: number | null;
  sampledSeconds: number;
}
export interface CostInputs {
  planFee: number;
  tariff: GhanaTariff;
  homeKwh: number;
  customRate: number;
  hours: number;
}
export type DishPowerModel = "auto" | "mini" | "standard4" | "standard5" | "custom";

/** Match the extension's dish model assumptions rather than falling back to
 * an arbitrary custom wattage when the owner chose auto-detect. */
export function modeledWatts(
  model: DishPowerModel,
  detected: string,
  customWatts: number,
): number | null {
  const actual =
    model === "auto"
      ? detected.startsWith("mini")
        ? "mini"
        : detected === "rev4Standard"
          ? "standard4"
          : detected === "rev5Standard"
            ? "standard5"
            : "unknown"
      : model;
  return actual === "mini"
    ? 32.5
    : actual === "standard4"
      ? 87.5
      : actual === "standard5"
        ? 42.5
        : actual === "custom" && Number.isFinite(customWatts)
          ? Math.max(0, customWatts)
          : null;
}

/** A monthly subscription must NOT be allocated over the 1-day chart range.
 * For non-cycle periods sum the fractional days in each intersected calendar
 * month, including seven-day windows which straddle a month boundary. UTC
 * matches the Ghana calendar (Africa/Accra is UTC+0 year-round).
 * For custom billing cycles use the actual configured cycle length. */
export function allocatedPlanFee(
  planFee: number,
  window: PeriodWindow,
  period: ViewPeriod,
): number {
  const fee = Number.isFinite(planFee) ? Math.max(0, planFee) : 0;
  const start = Math.max(0, window.start);
  const end = Math.max(start, window.end);
  if (period === "cycle") {
    const seconds = Math.max(1, window.fullEnd - window.start);
    return (fee * (end - start)) / seconds;
  }
  let cursor = start;
  let result = 0;
  for (let i = 0; cursor < end && i < 5; i++) {
    const date = new Date(cursor * 1000);
    const firstNext = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 1000;
    const firstThis = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000;
    const segmentEnd = Math.min(end, firstNext);
    result += (fee * (segmentEnd - cursor)) / (firstNext - firstThis);
    cursor = segmentEnd;
  }
  return result;
}

export function analyzePeriodCost({
  current,
  window,
  period,
  inputs,
  watts,
}: {
  current: CostSamples;
  window: PeriodWindow;
  period: ViewPeriod;
  inputs: CostInputs;
  watts: number | null;
}) {
  const days =
    period === "cycle"
      ? (window.fullEnd - window.start) / DAY
      : new Date(
          Date.UTC(
            new Date(window.end * 1000).getUTCFullYear(),
            new Date(window.end * 1000).getUTCMonth() + 1,
            0,
          ),
        ).getUTCDate();
  const elapsed = Math.max(0, (window.end - window.start) / DAY);
  const modeledKwh = watts === null ? null : (watts * inputs.hours * elapsed) / 1000;
  const kwh = current.kWh ?? modeledKwh;
  const forecastKwh =
    current.sampledSeconds >= DAY && current.kWh !== null
      ? (current.kWh / current.sampledSeconds) * DAY * days
      : watts === null
        ? null
        : (watts * inputs.hours * days) / 1000;
  const costFor = (units: number) =>
    electricityCost(units, inputs.tariff, inputs.homeKwh, inputs.customRate);
  const projectedElectricity = forecastKwh === null ? null : costFor(forecastKwh);
  const electricity =
    kwh === null
      ? null
      : forecastKwh && projectedElectricity !== null
        ? (kwh / forecastKwh) * projectedElectricity
        : costFor(kwh);
  const planAllocation = allocatedPlanFee(inputs.planFee, window, period);
  const total = electricity === null ? null : electricity + planAllocation;
  const projectedTotal =
    projectedElectricity === null ? null : projectedElectricity + inputs.planFee;
  return {
    days,
    elapsed,
    kwh,
    forecastKwh,
    electricity,
    planAllocation,
    total,
    projectedElectricity,
    projectedTotal,
    modeledKwh,
  };
}
