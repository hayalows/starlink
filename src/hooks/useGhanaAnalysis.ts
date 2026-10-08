import { effectiveObservedPricePerGb } from "@core/ghanaDataValue";
import type { DishStatusJson } from "@core/dishClient";
import { electricityCost, forecastUsage } from "@core/ghanaCost";
import { analyzePeriodCost, modeledWatts } from "@core/ghanaPeriodCosts";
import {
  buildInsights,
  comparisonPercent,
  type GhanaInsights,
  type ViewPeriod,
} from "@core/ghanaInsights";
import { usePersistedHistory } from "./usePersistedHistory";
import { useGhanaSettings } from "./useGhanaSettings";
import { useNow } from "./useNow";
import { dishModelFor } from "../lib/dishMesh";
export function useGhanaAnalysis(status: DishStatusJson | null, period: ViewPeriod = "month") {
  const [settings, update] = useGhanaSettings();
  const now = new Date(useNow(30_000));
  const history = usePersistedHistory<GhanaInsights>(
    `/api/ghana/insights?billingDay=${settings.billingDay}`,
    true,
  );
  const selected = (history.data ?? buildInsights([], now, settings.billingDay)).periods[period];
  const energy = selected.current;
  const usage = {
    ...energy,
    coverage: energy.trafficCoverage,
    sampledSeconds: energy.trafficSeconds,
  };
  const energyState = history,
    usageState = history;
  const change = comparisonPercent(
    selected.comparison.gb,
    selected.previous.gb,
    selected.comparison.trafficCoverage,
    selected.previous.trafficCoverage,
  );
  const energyChange = comparisonPercent(
    selected.comparison.kWh,
    selected.previous.kWh,
    selected.comparison.coverage,
    selected.previous.coverage,
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
  const watts = modeledWatts(settings.model, detected, settings.watts);
  const calculated = analyzePeriodCost({
    current: energy,
    window: selected.window,
    period,
    inputs: settings,
    watts,
  });
  const {
    days,
    elapsed,
    kwh,
    electricity,
    planAllocation,
    total,
    forecastKwh,
    projectedElectricity,
    projectedTotal,
  } = calculated;
  const costFor = (units: number) =>
    electricityCost(units, settings.tariff, settings.homeKwh, settings.customRate);
  const dataForecast = forecastUsage(usage.gb, usage.sampledSeconds, days);
  // A fixed subscription buys the month, not a metered GB allowance. Divide
  // the full projected monthly bill by GB actually observed so far. This is a
  // partial-month effective ratio, useful from the first GB; never label missing
  // samples as zero or turn coverage into a permission gate.
  const monthlyObservedGb =
    period === "month"
      ? usage.gb
      : (history.data ?? buildInsights([], now, settings.billingDay)).periods.month.current.gb;
  const perGb = effectiveObservedPricePerGb(projectedTotal, monthlyObservedGb);
  const dataValueCoverage = (history.data ?? buildInsights([], now, settings.billingDay)).periods.month.current.trafficCoverage;
  return {
    settings,
    update,
    window: selected.window,
    change,
    energyChange,
    loading: history.loading && !history.data,
    stale: history.unavailable || (energy.latest > 0 && now.getTime() / 1000 - energy.latest > 180),
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
    dataValueCoverage,
    costFor,
  };
}
