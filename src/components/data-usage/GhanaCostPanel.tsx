// Ghana-first cost and usage overview. Uses Dishylink's real local history when
// available; model figures are only a clearly marked fallback for gaps.
import { useState } from "react";
import type { DishStatusJson } from "@core/dishClient";
import { dishModelFor, specForModel, type DishModel } from "../../lib/dishMesh";
import { useDataUsage } from "../../hooks/useDataUsage";
import { useEnergyHistory, type EnergyBucket, type EnergyRange } from "../../hooks/useEnergyHistory";
import { formatGigabytes } from "../../lib/format";
import { RangeBars, type RangeBarColumn } from "../shared/RangeBarChart";
import { bucketLabel } from "../shared/rangeTabs";
import { SegmentedControl, type SegmentedOption } from "../ui/segmented-control";
import { Callout } from "../ui/callout";
import { Explainer } from "../ui/explainer";
import { DeviceUsageList } from "./DeviceUsageList";

type CostRange = Extract<EnergyRange, "today" | "week" | "month">;
type TariffId = "lifeline" | "residential" | "residentialHigh";
type ModelChoice = "auto" | "mini" | "standard4" | "standard5" | "custom";

const COST_RANGES = [
  { label: "Today", value: "today" },
  { label: "7 days", value: "week" },
  { label: "Month", value: "month" },
] as const satisfies readonly SegmentedOption<CostRange>[];

const TARIFFS: Record<TariffId, { label: string; rate: number; pesewas: string }> = {
  lifeline: { label: "Lifeline · 0–30 kWh", rate: 0.899315, pesewas: "89.9315 GHp" },
  residential: { label: "Residential · 0–300 kWh", rate: 2.037509, pesewas: "203.7509 GHp" },
  residentialHigh: { label: "Residential · 301+ kWh", rate: 2.692235, pesewas: "269.2235 GHp" },
};

const MODEL_CHOICES: readonly ModelChoice[] = ["auto", "mini", "standard4", "standard5", "custom"];

function readStored(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preferences are optional; the dashboard remains usable when storage is blocked.
  }
}

function formatGhs(amount: number): string {
  return "GH₵" + new Intl.NumberFormat("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatKwh(value: number): string {
  return value.toFixed(value < 1 ? 3 : 2);
}

function rangeName(range: CostRange): string {
  if (range === "today") return "Today";
  if (range === "week") return "Last 7 days";
  return "Month to date";
}

function rangeDays(range: CostRange, date: Date): number {
  if (range === "today") return 1;
  if (range === "week") return 7;
  return date.getDate();
}

function assumptionFor(choice: ModelChoice, model: DishModel, customWatts: number) {
  if (choice === "mini") return { label: "Mini", lowW: 25, highW: 40 };
  if (choice === "standard4") return { label: "Standard 4", lowW: 75, highW: 100 };
  if (choice === "standard5") return { label: "Standard V5", lowW: 35, highW: 50 };
  if (choice === "custom" && customWatts > 0) {
    return { label: "your entered average", lowW: customWatts, highW: customWatts };
  }
  if (choice !== "auto") return null;
  if (model === "mini1" || model === "mini2") return { label: "Mini", lowW: 25, highW: 40 };
  if (model === "rev4Standard") return { label: "Standard 4", lowW: 75, highW: 100 };
  if (model === "rev5Standard") return { label: "Standard V5", lowW: 35, highW: 50 };
  return null;
}

function EnergyBars({ buckets, range }: { buckets: EnergyBucket[]; range: EnergyRange }) {
  const maxKwh = Math.max(...buckets.map((bucket) => bucket.kWh ?? 0), 1e-9);
  const columns: RangeBarColumn[] = buckets.map((bucket) => {
    const label = bucketLabel(bucket.t, range);
    const partial =
      bucket.kWh !== null &&
      bucket.expectedSeconds > 0 &&
      bucket.sampledSeconds / bucket.expectedSeconds < 0.9;
    return {
      key: bucket.t,
      label,
      title:
        bucket.kWh === null
          ? label + " · no reading recorded"
          : label + " · " + formatKwh(bucket.kWh) + " kWh" + (partial ? " · partial sample" : ""),
      bar:
        bucket.kWh === null ? (
          <div
            className='h-full w-full rounded-t-[3px] bg-ink opacity-[0.06]'
            aria-hidden='true'
          />
        ) : (
          <div
            className='min-h-0.5 w-full rounded-t-[3px] bg-chart-warm'
            style={{
              height: (bucket.kWh > 0 ? Math.max(2, (bucket.kWh / maxKwh) * 100) : 0) + "%",
              opacity: partial ? 0.45 : 1,
            }}
          />
        ),
    };
  });
  return (
    <RangeBars
      columns={columns}
      range={range}
      heightPx={126}
      yAxis={{ max: maxKwh, format: (value) => formatKwh(value) + " kWh" }}
    />
  );
}

export function GhanaCostPanel({ status }: { status: DishStatusJson | null }) {
  const [range, setRange] = useState<CostRange>("month");
  const model = dishModelFor(status);
  const modelSpec = specForModel(model);
  const [modelChoice, setModelChoice] = useState<ModelChoice>(() => {
    const saved = readStored("dishylink.ghana.model-choice", "auto");
    return MODEL_CHOICES.includes(saved as ModelChoice) ? (saved as ModelChoice) : "auto";
  });
  const [tariff, setTariff] = useState<TariffId>(() => {
    const saved = readStored("dishylink.ghana.ecg-tariff", "residential");
    return saved === "lifeline" || saved === "residentialHigh" ? saved : "residential";
  });
  const [hoursPerDay, setHoursPerDay] = useState(() => {
    const saved = Number(readStored("dishylink.ghana.hours-per-day", "24"));
    return Number.isFinite(saved) ? Math.max(1, Math.min(24, saved)) : 24;
  });
  const [customWatts, setCustomWatts] = useState(() => {
    const saved = Number(readStored("dishylink.ghana.custom-watts", "50"));
    return Number.isFinite(saved) ? Math.max(1, saved) : 50;
  });
  const [planFeeText, setPlanFeeText] = useState(() =>
    readStored("dishylink.ghana.plan-fee", ""),
  );

  const energy = useEnergyHistory(range, true);
  const usage = useDataUsage(range, true);
  const now = new Date();
  const elapsedTodayHours = now.getHours() + now.getMinutes() / 60;
  const daysInPeriod = rangeDays(range, now);
  const selectedTariff = TARIFFS[tariff];
  const assumption = assumptionFor(modelChoice, model, customWatts);
  const measuredEnergy = energy.data?.range === range ? energy.data : null;
  const periodUsage = usage.data?.range === range ? usage.data : null;
  const energyIsMeasured = measuredEnergy !== null;
  const modeledHours =
    range === "today"
      ? Math.min(hoursPerDay, elapsedTodayHours)
      : daysInPeriod * hoursPerDay;
  const modeledKwh = assumption ? ((assumption.lowW + assumption.highW) / 2) * modeledHours / 1000 : null;
  const energyKwh = measuredEnergy ? measuredEnergy.totalKWh : modeledKwh;
  const electricityCost = energyKwh === null ? null : energyKwh * selectedTariff.rate;
  const planFee = Math.max(0, Number(planFeeText) || 0);
  const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const planAllocation = planFee > 0 ? (planFee * daysInPeriod) / monthDays : 0;
  const totalCost = electricityCost === null ? null : electricityCost + planAllocation;
  const dataTotal = periodUsage ? periodUsage.totalDownGB + periodUsage.totalUpGB : null;
  const dataFigure = dataTotal === null ? null : formatGigabytes(dataTotal);
  const coveragePct = measuredEnergy ? Math.round(measuredEnergy.coverage.fraction * 100) : null;
  const detectedName = model === "unknown" ? "Dishylink could not identify the model" : modelSpec.displayName;

  const updateModelChoice = (value: string) => {
    if (!MODEL_CHOICES.includes(value as ModelChoice)) return;
    const choice = value as ModelChoice;
    setModelChoice(choice);
    saveStored("dishylink.ghana.model-choice", choice);
  };

  const updateTariff = (value: string) => {
    if (value !== "lifeline" && value !== "residential" && value !== "residentialHigh") return;
    setTariff(value);
    saveStored("dishylink.ghana.ecg-tariff", value);
  };

  const updateHours = (value: number) => {
    const next = Math.max(1, Math.min(24, value));
    setHoursPerDay(next);
    saveStored("dishylink.ghana.hours-per-day", String(next));
  };

  const updateCustomWatts = (value: number) => {
    const next = Math.max(1, Math.min(500, value || 1));
    setCustomWatts(next);
    saveStored("dishylink.ghana.custom-watts", String(next));
  };

  const updatePlanFee = (value: string) => {
    setPlanFeeText(value);
    saveStored("dishylink.ghana.plan-fee", value);
  };

  return (
    <div className='pb-1'>
      <div className='mt-3 flex flex-wrap items-center justify-between gap-2'>
        <div>
          <div className='font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground'>
            Ghana · ECG · GH₵
          </div>
          <div className='mt-0.5 text-[13px] text-ink-secondary'>
            Real Dishylink readings first. Model estimates when history is not available.
          </div>
        </div>
        <span className='rounded-full border border-hairline px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground'>
          PURC rates · from 1 Oct 2026
        </span>
      </div>

      <div className='mt-3 grid gap-3 lg:grid-cols-[1.08fr_0.92fr]'>
        <section className='relative overflow-hidden rounded-[18px] border border-hairline bg-[color-mix(in_srgb,var(--chart-warm)_9%,var(--surface))] p-4 sm:p-5'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <span className='font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
              Electricity · {range === "today" ? "Today" : range === "week" ? "7 days" : "Month to date"}
            </span>
            <span className='rounded-full bg-card px-2.5 py-1 text-[10.5px] font-semibold text-foreground'>
              {energyIsMeasured ? "Measured kWh" : assumption ? "Model estimate" : "Needs a model"}
            </span>
          </div>
          <div className='mt-4 text-[12px] font-medium text-muted-foreground'>
            Estimated dish electricity cost
          </div>
          <div className='mt-0.5 text-[34px] leading-none font-bold tracking-[-0.035em] tabular-nums text-foreground sm:text-[40px]'>
            {electricityCost === null ? "—" : formatGhs(electricityCost)}
          </div>
          <div className='mt-2 text-[12px] text-ink-secondary'>
            {energyKwh === null
              ? "Choose a dish model to see an estimate."
              : formatKwh(energyKwh) +
                " kWh × GH₵" +
                selectedTariff.rate.toFixed(6) +
                "/kWh"}
          </div>

          <div className='mt-4 flex flex-wrap items-center justify-between gap-2'>
            <span className='text-[12px] font-semibold text-foreground'>Energy over time</span>
            <SegmentedControl
              options={COST_RANGES}
              value={range}
              onChange={setRange}
              label='Cost period'
            />
          </div>
          {measuredEnergy ? (
            <>
              <div className='mt-1.5'>
                <EnergyBars buckets={measuredEnergy.buckets} range={range} />
              </div>
              <div className='mt-0.5 text-[11.5px] text-muted-foreground'>
                Collected {coveragePct}% of this period
                {coveragePct !== null && coveragePct < 95
                  ? " · actual cost may be higher because some hours are missing"
                  : ""}
              </div>
            </>
          ) : (
            <div className='mt-3 rounded-xl border border-dashed border-hairline px-3 py-3 text-[12px] text-muted-foreground'>
              {assumption
                ? "No measured chart for this period. The cost above uses " +
                  assumption.label +
                  " average power, with " +
                  hoursPerDay +
                  " powered hours per day."
                : "Select Mini, Standard, or enter average watts to see a model estimate."}
            </div>
          )}
        </section>

        <div className='grid content-start gap-3'>
          <section className='rounded-[18px] border border-hairline bg-card p-4 sm:p-5'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <div className='font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
                  Data · {range === "today" ? "Today" : range === "week" ? "7 days" : "Month to date"}
                </div>
                <div className='mt-1 text-[26px] leading-none font-bold tracking-[-0.025em] tabular-nums'>
                  {dataFigure ? dataFigure.value + " " + dataFigure.unit : "—"}
                </div>
                <div className='mt-1 text-[11.5px] text-muted-foreground'>Total download + upload</div>
              </div>
              <div className='rounded-full bg-[color-mix(in_srgb,var(--series-down)_12%,var(--surface))] px-2.5 py-1 font-mono text-[10px] font-semibold text-series-down'>
                Local WAN meter
              </div>
            </div>
            {periodUsage ? (
              <div className='mt-4 grid grid-cols-2 gap-3 border-t border-hairline pt-3'>
                <div>
                  <div className='font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground'>
                    Download
                  </div>
                  <div className='mt-1 font-mono text-[14px] font-semibold tabular-nums'>
                    {formatGigabytes(periodUsage.totalDownGB).value}{" "}
                    {formatGigabytes(periodUsage.totalDownGB).unit}
                  </div>
                </div>
                <div>
                  <div className='font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground'>
                    Upload
                  </div>
                  <div className='mt-1 font-mono text-[14px] font-semibold tabular-nums'>
                    {formatGigabytes(periodUsage.totalUpGB).value}{" "}
                    {formatGigabytes(periodUsage.totalUpGB).unit}
                  </div>
                </div>
              </div>
            ) : (
              <div className='mt-3 text-[12px] text-muted-foreground'>
                {usage.unavailable
                  ? "Local data history is unavailable. Start the Dishylink history recorder to collect it."
                  : "Waiting for this period’s local data totals."}
              </div>
            )}
          </section>

          <section className='rounded-[18px] border border-hairline bg-card p-4 sm:p-5'>
            <div className='mb-3 flex items-center justify-between gap-2'>
              <div className='text-[14px] font-bold'>Estimate settings</div>
              <span className='font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground'>
                Saved on this device
              </span>
            </div>

            <label className='block text-[11.5px] font-semibold text-ink-secondary' htmlFor='ghana-dish-model'>
              Dish model
            </label>
            <select
              id='ghana-dish-model'
              value={modelChoice}
              onChange={(event) => updateModelChoice(event.currentTarget.value)}
              className='mt-1 w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring'
            >
              <option value='auto'>Auto-detect · {detectedName}</option>
              <option value='mini'>Starlink Mini</option>
              <option value='standard4'>Standard 4</option>
              <option value='standard5'>Standard V5</option>
              <option value='custom'>I know my average watts</option>
            </select>
            <div className='mt-1.5 text-[11px] leading-relaxed text-muted-foreground'>
              {energyIsMeasured
                ? "Dishylink detected " + detectedName + ". Measured energy takes priority over these model estimates."
                : assumption
                  ? "Using " +
                    assumption.label +
                    " published average power: " +
                    assumption.lowW +
                    "–" +
                    assumption.highW +
                    " W."
                  : "No supported wattage spec for " +
                    detectedName +
                    ". Choose Mini / Standard or enter a known average to estimate."}
            </div>

            {modelChoice === "custom" && (
              <label className='mt-3 block text-[11.5px] font-semibold text-ink-secondary' htmlFor='ghana-custom-watts'>
                Average draw in watts
                <input
                  id='ghana-custom-watts'
                  type='number'
                  min='1'
                  max='500'
                  step='1'
                  value={customWatts}
                  onChange={(event) => updateCustomWatts(Number(event.currentTarget.value))}
                  className='mt-1 w-full rounded-lg border border-hairline bg-surface px-3 py-2 font-mono text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring'
                />
              </label>
            )}

            {!energyIsMeasured && (
              <label className='mt-3 block text-[11.5px] font-semibold text-ink-secondary' htmlFor='ghana-hours'>
                Powered hours per day
                <input
                  id='ghana-hours'
                  type='range'
                  min='1'
                  max='24'
                  step='1'
                  value={hoursPerDay}
                  onChange={(event) => updateHours(Number(event.currentTarget.value))}
                  className='mt-2 block w-full accent-[var(--chart-warm)]'
                />
                <span className='mt-1 flex justify-between font-mono text-[10.5px] text-muted-foreground'>
                  <span>1 hour</span>
                  <span>{hoursPerDay} h/day</span>
                  <span>24 hours</span>
                </span>
              </label>
            )}

            <label className='mt-3 block text-[11.5px] font-semibold text-ink-secondary' htmlFor='ghana-ecg-tariff'>
              ECG residential rate
            </label>
            <select
              id='ghana-ecg-tariff'
              value={tariff}
              onChange={(event) => updateTariff(event.currentTarget.value)}
              className='mt-1 w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring'
            >
              {Object.entries(TARIFFS).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.label} · GH₵{item.rate.toFixed(6)}/kWh
                </option>
              ))}
            </select>
            <div className='mt-1 text-[10.5px] text-muted-foreground'>
              Current rate: {selectedTariff.pesewas} per kWh · PURC schedule effective 1 Oct 2026.
            </div>

            <label className='mt-3 block text-[11.5px] font-semibold text-ink-secondary' htmlFor='ghana-plan-fee'>
              Starlink monthly plan · optional
              <span className='mt-1 flex items-center rounded-lg border border-hairline bg-surface pl-3 focus-within:ring-2 focus-within:ring-ring'>
                <span className='font-mono text-[12px] text-muted-foreground'>GH₵</span>
                <input
                  id='ghana-plan-fee'
                  type='number'
                  min='0'
                  step='0.01'
                  inputMode='decimal'
                  placeholder='Enter your monthly plan price'
                  value={planFeeText}
                  onChange={(event) => updatePlanFee(event.currentTarget.value)}
                  className='min-w-0 flex-1 border-0 bg-transparent px-2 py-2 font-mono text-[12px] text-foreground outline-none'
                />
              </span>
            </label>
            <div className='mt-1 flex items-center justify-between gap-2 text-[10.5px] text-muted-foreground'>
              <span>
                {planFee > 0
                  ? "Estimated plan allocation: " + formatGhs(planAllocation) + " for " + rangeName(range).toLowerCase()
                  : "Enter your plan price to include it in total cost."}
              </span>
              {totalCost !== null && (
                <span className='shrink-0 font-semibold text-foreground'>
                  Total {formatGhs(totalCost)}
                </span>
              )}
            </div>
          </section>
        </div>
      </div>

      {energy.unavailable && !energyIsMeasured && (
        <Callout className='mt-3'>
          The local history recorder is not reachable. Start <code>npm run historian</code> to
          collect measured energy and usage; the dish estimate above remains available.
        </Callout>
      )}

      <Callout className='mt-3'>
        Electricity is an estimate for the dish only: selected ECG rate × measured kWh, or the
        selected model’s average watts when history is missing. Fixed service charges, levies,
        household tier crossings, and router or mesh power may change the actual bill.
        <a
          className='ml-1 font-semibold text-foreground underline underline-offset-2'
          href='https://purc.com.gh/attachment/67864-20261001121001.pdf'
          target='_blank'
          rel='noopener noreferrer'
        >
          View PURC tariff schedule
        </a>
      </Callout>

      <div className='mt-5 border-t border-hairline pt-4'>
        <div className='mb-1 text-[14px] font-bold'>Per-device data share</div>
        <div className='mb-1 text-[11.5px] leading-relaxed text-muted-foreground'>
          Shares use each router-reported device’s data this month. They are separate from the dish’s WAN total above.
        </div>
        <DeviceUsageList />
      </div>

      <Explainer title='How to read these numbers'>
        Dishylink detects the dish model from its local hardware version. Where a published Starlink
        power range is available, the estimate uses its midpoint and your powered-hours setting.
        When the history recorder is running, its measured kWh replaces the model estimate. Device
        percentages are each device’s share of router-reported traffic, not a measured split of
        electricity use. The current ECG end-user rates come from PURC’s Fourth Schedule.
      </Explainer>
    </div>
  );
}
