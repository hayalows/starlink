import { effectiveObservedPricePerGb } from "@core/ghanaDataValue";
import { forecastQuality } from "@core/ghanaForecastQuality";
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
  const insights = history.data ?? buildInsights([], now, settings.billingDay);
  const selected = insights.periods[period];
  const monthly = insights.periods.month;
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
  // Today's/week's electricity projection can legitimately differ from the
  // month-long one. Monthly GH₵/GB must NEVER change with the selected tab.
  const monthlyCosts =
    period === "month"
      ? calculated
      : analyzePeriodCost({
          current: monthly.current,
          window: monthly.window,
          period: "month",
          inputs: settings,
          watts,
        });
  const monthlyDataForecast = forecastUsage(
    monthly.current.gb,
    monthly.current.trafficSeconds,
    monthlyCosts.days,
  );
  // This is a conservative early-month figure: full forecast divided only by
  // confirmed traffic, not a charge Starlink adds per gigabyte.
  const perGb = effectiveObservedPricePerGb(monthlyCosts.projectedTotal, monthly.current.gb);
  // Like-for-like full-month numerator and full-month denominator, useful for
  // comparing a fixed Starlink plan with a per-GB mobile bundle.
  const projectedPerGb = effectiveObservedPricePerGb(
    monthlyCosts.projectedTotal,
    monthlyDataForecast,
  );
  const dataValueCoverage = monthly.current.trafficCoverage;
  const monthlyDataQuality = forecastQuality(
    monthly.current.trafficSeconds,
    monthly.current.trafficCoverage,
  );
  const monthlyEnergyQuality = forecastQuality(
    monthly.current.sampledSeconds,
    monthly.current.coverage,
  );
  const monthlyPowerBasis =
    monthly.current.kWh !== null && monthly.current.sampledSeconds >= 86400
      ? "recorded" as const
      : "model" as const;
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
    projectedPerGb,
    monthlyDataQuality,
    monthlyEnergyQuality,
    monthlyPowerBasis,
    monthlyProjectedElectricity: monthlyCosts.projectedElectricity,
    dataValueCoverage,
    costFor,
  };
}
