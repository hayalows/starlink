import type { DishStatusJson } from "@core/dishClient";
import {
  electricityCost,
  effectiveCostPerGb,
  elapsedDays,
  forecastUsage,
  monthLength,
  selectPeriod,
  type GhanaPeriod,
} from "@core/ghanaCost";
import { useEnergyHistory } from "./useEnergyHistory";
import { useDataUsage } from "./useDataUsage";
import { useGhanaSettings } from "./useGhanaSettings";
import { useNow } from "./useNow";
import { dishModelFor } from "../lib/dishMesh";
export function useGhanaAnalysis(status: DishStatusJson | null, period: GhanaPeriod = "month") {
  const [settings, update] = useGhanaSettings();
  const now = new Date(useNow(30_000));
  const sourceRange = period === "week" ? "day" : period;
  const energyState = useEnergyHistory(sourceRange, true);
  const usageState = useDataUsage(sourceRange, true);
  const energy = selectPeriod(
    energyState.data?.range === sourceRange ? energyState.data.buckets : [],
    period,
    now,
  );
  const usage = selectPeriod(
    usageState.data?.range === sourceRange ? usageState.data.buckets : [],
    period,
    now,
  );
  const detected = dishModelFor(status);
  const model =
    settings.model === "auto"
      ? detected.startsWith("mini")
        ? "mini"
        : detected === "rev4Standard"
          ? "standard4"
          : detected === "rev5Standard"
            ? "standard5"
            : null
      : settings.model;
  const watts =
    model === "mini"
      ? 32.5
      : model === "standard4"
        ? 87.5
        : model === "standard5"
          ? 42.5
          : model === "custom"
            ? settings.watts
            : null;
  const days = monthLength(now),
    elapsed = elapsedDays(period, now);
  const modeledKwh = watts === null ? null : (watts * settings.hours * elapsed) / 1000;
  const kwh = energy.kWh ?? modeledKwh;
  // Model a full month, then allocate its tiered incremental cost across time.
  // Recorded energy is reported separately and never extrapolated as a measured total.
  const forecastKwh =
    energy.sampledSeconds >= 86400 && energy.kWh !== null
      ? (energy.kWh / energy.sampledSeconds) * 86400 * days
      : watts === null
        ? null
        : (watts * settings.hours * days) / 1000;
  const costFor = (units: number) =>
    electricityCost(units, settings.tariff, settings.homeKwh, settings.customRate);
  const projectedElectricity = forecastKwh === null ? null : costFor(forecastKwh);
  const electricity =
    kwh === null
      ? null
      : forecastKwh && projectedElectricity !== null
        ? (kwh / forecastKwh) * projectedElectricity
        : costFor(kwh);
  const planAllocation = (settings.planFee * elapsed) / days;
  const total = electricity === null ? null : electricity + planAllocation;
  const projectedTotal =
    projectedElectricity === null ? null : projectedElectricity + settings.planFee;
  const dataForecast = forecastUsage(usage.gb, usage.sampledSeconds, days);
  const perGb =
    settings.planFee > 0 && total !== null
      ? effectiveCostPerGb(
          total,
          usage.gb,
          Math.min(usage.coverage, energy.kWh !== null ? energy.coverage : 1),
        )
      : null;
  return {
    settings,
    update,
    now,
    period,
    energy,
    usage,
    energyState,
    usageState,
    model,
    watts,
    kwh,
    electricity,
    days,
    elapsed,
    planAllocation,
    total,
    forecastKwh,
    projectedElectricity,
    projectedTotal,
    dataForecast,
    perGb,
    costFor,
  };
}
