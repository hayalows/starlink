import { ghs } from "../../lib/ghanaFormat";
import { useState, type ReactNode } from "react";
import type { DishStatusJson } from "@core/dishClient";
import {
  csvRows,
  GHANA_TARIFFS,
  TARIFF_SOURCE,
  type GhanaPeriod,
  type GhanaTariff,
} from "@core/ghanaCost";
import { useGhanaAnalysis } from "../../hooks/useGhanaAnalysis";
import type { GhanaSettings } from "../../hooks/useGhanaSettings";
import { SegmentedControl } from "../ui/segmented-control";
import { DeviceUsageList } from "./DeviceUsageList";
import { Callout } from "../ui/callout";
import { Explainer } from "../ui/explainer";
import { RangeBars } from "../shared/RangeBarChart";
import { bucketLabel } from "../shared/rangeTabs";

const gb = (n: number | null) => (n === null ? "—" : n.toFixed(2) + " GB");
const card = "rounded-2xl border border-hairline bg-card p-4 sm:p-5";
const field =
  "mt-1 min-h-11 w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-[13px] text-foreground focus-visible:ring-2 focus-visible:ring-ring";
const button =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-hairline bg-card px-3 text-[12px] font-semibold text-foreground hover:bg-fill-raised focus-visible:ring-2 focus-visible:ring-ring";
function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={card}>
      <div className='text-[11px] font-semibold text-muted-foreground'>{label}</div>
      <div className='mt-2 text-[27px] font-bold tracking-tight tabular-nums'>{value}</div>
      <p className='mt-2 text-[11px] leading-relaxed text-muted-foreground'>{note}</p>
    </div>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={card}>
      <h3 className='mb-3 text-[15px] font-bold'>{title}</h3>
      {children}
    </section>
  );
}
function Budget({
  label,
  value,
  target,
  money = false,
}: {
  label: string;
  value: number | null;
  target: number;
  money?: boolean;
}) {
  const ratio = target && value !== null ? value / target : 0;
  return (
    <div className='mt-3'>
      <div className='flex flex-wrap justify-between gap-1 text-[12px]'>
        <span>{label}</span>
        <strong>
          {target > 0
            ? money
              ? ghs(value) + " / " + ghs(target)
              : gb(value) + " / " + gb(target)
            : "Set a target below"}
        </strong>
      </div>
      <div
        className='mt-2 h-2 overflow-hidden rounded-full bg-fill-raised'
        role='progressbar'
        aria-label={label}
        aria-valuenow={Math.round(Math.min(100, ratio * 100))}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={
            ratio >= 1
              ? "h-full bg-status-critical"
              : ratio >= 0.8
                ? "h-full bg-chart-warm"
                : "h-full bg-status-good"
          }
          style={{ width: Math.min(100, ratio * 100) + "%" }}
        />
      </div>
      {target > 0 && value !== null && (
        <p className='mt-1 text-[11px] text-muted-foreground'>
          {ratio >= 1
            ? "Target passed. This is a planning alert; it does not stop devices."
            : Math.round(ratio * 100) + "% of your target used"}
        </p>
      )}
    </div>
  );
}
export function GhanaCostPanel({ status }: { status: DishStatusJson | null }) {
  const [period, setPeriod] = useState<GhanaPeriod>("month");
  const a = useGhanaAnalysis(status, period);
  const month = useGhanaAnalysis(status, "month");
  const { settings: s, update } = a;
  const [exported, setExported] = useState(false);
  const numberField = (key: keyof GhanaSettings, label: string, max = 100000) => (
    <label className='block text-[12px] font-medium'>
      {label}
      <input
        className={field}
        type='number'
        inputMode='decimal'
        min={key === "people" ? 1 : 0}
        max={max}
        step={key === "people" ? 1 : "any"}
        value={s[key]}
        onChange={(e) =>
          update({
            [key]: Math.max(
              key === "people" ? 1 : 0,
              Math.min(max, Number(e.currentTarget.value) || 0),
            ),
          })
        }
      />
    </label>
  );
  const energyMeasured = a.energy.kWh !== null;
  const offline = a.energyState.unavailable || a.usageState.unavailable;
  const savingsKwh =
    a.watts === null ? null : (a.watts * Math.min(s.sleepHours, s.hours) * a.days) / 1000;
  const savings =
    savingsKwh === null || a.forecastKwh === null
      ? null
      : Math.max(0, a.costFor(a.forecastKwh) - a.costFor(Math.max(0, a.forecastKwh - savingsKwh)));
  const bundleRate = s.bundleGb > 0 && s.bundlePrice > 0 ? s.bundlePrice / s.bundleGb : null;
  const monthLabel = a.now.toLocaleDateString("en-GH", { month: "long", year: "numeric" });
  const maxUsage = Math.max(1, ...a.usage.buckets.map((b) => (b.downGB ?? 0) + (b.upGB ?? 0)));
  const exportCsv = () => {
    const rows: unknown[][] = [
      ["Starlink Ghana Monitor", monthLabel],
      ["Period", period],
      ["Cost basis", energyMeasured ? "Recorded energy (may be partial)" : "Model estimate"],
      ["Recorded energy coverage %", a.energy.coverage * 100],
      ["Data coverage %", a.usage.coverage * 100],
      ["Energy kWh", a.kwh],
      ["Electricity GHS", a.electricity],
      ["Plan allocation GHS", a.planAllocation],
      ["Combined cost GHS", a.total],
      ["Recorded traffic GB", a.usage.gb],
      ["Effective GHS per GB", a.perGb],
      ["Full month forecast GHS", month.projectedTotal],
      [],
      ["Bucket timestamp", "Download GB", "Upload GB", "Sampled seconds"],
    ];
    a.usage.buckets.forEach((b) =>
      rows.push([new Date(b.t * 1000).toISOString(), b.downGB, b.upGB, b.sampledSeconds]),
    );
    const url = URL.createObjectURL(new Blob([csvRows(rows)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "starlink-ghana-" + a.now.toISOString().slice(0, 10) + ".csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
  };
  return (
    <div className='space-y-4 pb-2'>
      <div className='mt-4 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-[18px] font-bold'>Your internet, in cedis</h2>
          <p className='mt-1 text-[12px] text-muted-foreground'>
            {monthLabel} · Ghana · {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </p>
        </div>
        <button className={button} onClick={exportCsv}>
          {exported ? "Export again" : "Download report"}
        </button>
      </div>
      <SegmentedControl
        options={[
          { label: "Today", value: "today" },
          { label: "Last 7 days", value: "week" },
          { label: "This month", value: "month" },
        ]}
        value={period}
        onChange={setPeriod}
        label='Cost and usage period'
      />
      <Callout tone='info'>
        {offline
          ? "Recorder unavailable. Last recorded figures may be stale. Keep Chrome open on your Starlink Wi-Fi, or check your desktop recorder."
          : energyMeasured
            ? "Recorded energy covers " +
              Math.round(a.energy.coverage * 100) +
              "% of this period. Missing time is excluded from recorded totals."
            : "No energy recorded yet. Choose your dish model below for an estimate. Keep Chrome running on your Starlink Wi-Fi to collect history."}
      </Callout>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <Metric
          label='Combined cost so far'
          value={ghs(a.total)}
          note={
            (s.planFee > 0
              ? "Includes the time share of your plan fee"
              : "Electricity only. Add your plan fee below") +
            (energyMeasured && a.energy.coverage < 0.95 ? ". Energy is partial." : ".")
          }
        />
        <Metric
          label='Electricity'
          value={ghs(a.electricity)}
          note={
            (a.kwh === null ? "Choose your dish model" : a.kwh.toFixed(3) + " kWh") +
            " · " +
            (energyMeasured ? "recorded energy" : "model estimate")
          }
        />
        <Metric
          label='Data recorded'
          value={gb(a.usage.gb)}
          note={Math.round(a.usage.coverage * 100) + "% recorded · download + upload"}
        />
        <Metric
          label='Effective cost per GB'
          value={ghs(a.perGb)}
          note={
            a.perGb === null
              ? "Needs a plan fee, traffic, and at least 80% coverage."
              : "Cost so far ÷ recorded GB. This is not a per-GB charge."
          }
        />
      </div>
      <div className='grid gap-3 lg:grid-cols-2'>
        <Section title='How much data, and when?'>
          {a.usage.gb === null ? (
            <p className='text-[12px] text-muted-foreground'>
              Your first readings will appear here. Missing time stays empty, rather than showing
              invented usage.
            </p>
          ) : (
            <RangeBars
              range={period === "week" ? "day" : period}
              heightPx={125}
              columns={a.usage.buckets.map((b) => {
                const total = (b.downGB ?? 0) + (b.upGB ?? 0),
                  label = bucketLabel(b.t, period === "week" ? "day" : period);
                return {
                  key: b.t,
                  label,
                  title: label + " · " + (b.downGB === null ? "No recording" : gb(total)),
                  bar: (
                    <div
                      className='w-full rounded-t bg-chart-warm'
                      style={{ height: (total / maxUsage) * 100 + "%" }}
                    />
                  ),
                };
              })}
              yAxis={{ max: maxUsage, format: (n) => n.toFixed(1) + " GB" }}
            />
          )}
          <p className='mt-3 text-[11px] text-muted-foreground'>
            The local WAN meter may differ from Starlink billing and router device counters. Use
            “Starlink billing” for your account’s authoritative usage.
          </p>
        </Section>
        <Section title='Plan ahead'>
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <p className='text-[11px] text-muted-foreground'>Full month cost forecast</p>
              <strong className='mt-1 block text-[22px]'>{ghs(month.projectedTotal)}</strong>
            </div>
            <div>
              <p className='text-[11px] text-muted-foreground'>Full month data projection</p>
              <strong className='mt-1 block text-[22px]'>{gb(month.dataForecast)}</strong>
            </div>
          </div>
          <p className='mt-2 text-[11px] text-muted-foreground'>
            Cost uses sampled average power after 24 recorded hours, otherwise your model settings.
            Data needs 24 recorded hours and assumes the sampled rate continues.
          </p>
          <Budget
            label='Monthly spending target · forecast'
            value={month.projectedTotal}
            target={s.costBudget}
            money
          />
          <Budget
            label='Monthly data target · recorded'
            value={month.usage.gb}
            target={s.dataBudget}
          />
          {s.dataBudget > 0 && month.usage.gb !== null && (
            <p className='mt-2 text-[12px]'>
              {Math.max(0, s.dataBudget - month.usage.gb).toFixed(1)} GB left in your personal
              target.{" "}
              {Math.max(0, s.dataBudget - month.usage.gb) /
                Math.max(1, a.days - a.now.getDate() + 1) >
              0
                ? "About " +
                  (
                    Math.max(0, s.dataBudget - month.usage.gb) /
                    Math.max(1, a.days - a.now.getDate() + 1)
                  ).toFixed(1) +
                  " GB/day for the rest of this month."
                : ""}
            </p>
          )}
          {s.costBudget > 0 &&
            month.projectedTotal !== null &&
            month.projectedTotal > s.costBudget && (
              <p className='mt-2 text-[12px] font-semibold text-status-critical'>
                Forecast is {ghs(month.projectedTotal - s.costBudget)} above your spending target.
              </p>
            )}
        </Section>
      </div>
      <details className={card} open={s.planFee === 0}>
        <summary className='cursor-pointer text-[14px] font-bold'>
          Your setup & monthly targets
        </summary>
        <p className='mt-2 text-[12px] text-muted-foreground'>
          Use the amount on your Starlink bill. Your settings stay on this device.
        </p>
        <div className='mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          <label className='text-[12px] font-medium'>
            Dish model
            <select
              className={field}
              value={s.model}
              onChange={(e) => update({ model: e.currentTarget.value as GhanaSettings["model"] })}
            >
              <option value='auto'>
                Auto-detect{a.model ? " · " + a.model : " · not detected yet"}
              </option>
              <option value='mini'>Starlink Mini</option>
              <option value='standard4'>Standard 4</option>
              <option value='standard5'>Standard V5</option>
              <option value='custom'>Enter average watts</option>
            </select>
          </label>
          {s.model === "custom" && numberField("watts", "Average dish watts", 500)}
          {numberField("hours", "Powered hours each day", 24)}
          <label className='text-[12px] font-medium'>
            Electricity tariff
            <select
              className={field}
              value={s.tariff}
              onChange={(e) => update({ tariff: e.currentTarget.value as GhanaTariff })}
            >
              {Object.entries(GHANA_TARIFFS).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {s.tariff === "custom"
            ? numberField("customRate", "Your electricity rate · GH₵/kWh", 100)
            : numberField("homeKwh", "Other household electricity · kWh/month", 10000)}
          {numberField("planFee", "Monthly Starlink plan · GH₵")}
          {numberField("costBudget", "Monthly spending target · GH₵ (0 = off)")}
          {numberField("dataBudget", "Monthly data target · GB (0 = off)")}
          {numberField("people", "People sharing the bill", 100)}
        </div>
      </details>
      <div className='grid gap-3 lg:grid-cols-2'>
        <Section title='Could switching off at night help?'>
          {numberField("sleepHours", "Hours off each day · what-if only", 24)}
          <p className='mt-3 text-[22px] font-bold'>
            {ghs(savings)}{" "}
            <span className='text-[12px] font-normal text-muted-foreground'>
              possible electricity saving / month
            </span>
          </p>
          <p className='mt-2 text-[11px] text-muted-foreground'>
            Model scenario, capped at your powered hours. Your subscription stays the same, and you
            lose internet while the dish is off. No schedule is changed by this calculator.
          </p>
        </Section>
        <Section title='Compare a mobile data bundle'>
          <div className='grid grid-cols-2 gap-3'>
            {numberField("bundlePrice", "Bundle price · GH₵")}
            {numberField("bundleGb", "Bundle size · GB")}
          </div>
          <p className='mt-3 text-[22px] font-bold'>
            {ghs(bundleRate)}{" "}
            <span className='text-[12px] font-normal text-muted-foreground'>
              per GB for your entered bundle
            </span>
          </p>
          <p className='mt-2 text-[11px] text-muted-foreground'>
            {bundleRate !== null && a.perGb !== null
              ? "Your recorded Starlink effective rate is " +
                ghs(Math.abs(bundleRate - a.perGb)) +
                "/GB " +
                (a.perGb < bundleRate ? "lower" : "higher") +
                "."
              : "Enter a current bundle offer to compare it with Starlink’s effective cost."}{" "}
            Bundle expiry, network coverage and speed also matter.
          </p>
        </Section>
      </div>
      <Section title='Who uses the data?'>
        <p className='text-[12px] text-muted-foreground'>
          Equal full-month split:{" "}
          <strong className='text-foreground'>
            {ghs(
              month.projectedTotal === null ? null : month.projectedTotal / Math.max(1, s.people),
            )}
          </strong>{" "}
          per person across {s.people} {s.people === 1 ? "person" : "people"}. Device cost shares
          below split the same forecast by recorded router traffic. They are planning allocations,
          not bills or measured electricity per device.
        </p>
        <DeviceUsageList allocatedCost={month.projectedTotal} />
      </Section>
      <Explainer title='What is measured, and what is estimated?'>
        Recorded GB and kWh cover sampled time only. Forecasts include assumptions about missing and
        future hours. Effective cost per GB is plan allocation plus electricity divided by recorded
        traffic, shown only with at least 80% coverage. Starlink may use a different billing cycle;
        these are calendar-month views in your recorder’s timezone. ECG/NEDCo residential energy
        rates use the same PURC schedule. Fixed charges, taxes, levies, router power and mesh power
        are excluded. Lifeline applies only if total household usage stays within 30 kWh; tier
        crossings can raise the estimate.
        <a className='ml-1 underline' href={TARIFF_SOURCE} target='_blank' rel='noreferrer'>
          PURC tariff source · effective 1 Oct 2026
        </a>
      </Explainer>
      <p className='text-[11px] text-muted-foreground' role='status'>
        {exported
          ? "CSV report downloaded. It includes the period and recording coverage."
          : "History refreshes every 30 seconds. Device totals refresh every 10 seconds."}
      </p>
    </div>
  );
}
