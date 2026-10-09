import type { ViewPeriod } from "@core/ghanaInsights";
import { ghs } from "../../lib/ghanaFormat";
import { useState, type ReactNode } from "react";
import type { DishStatusJson } from "@core/dishClient";
import { csvRows, GHANA_TARIFFS, TARIFF_SOURCE, type GhanaTariff } from "@core/ghanaCost";
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
  "mt-1 min-h-11 w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-[16px] text-foreground focus-visible:ring-2 focus-visible:ring-ring";
const button =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-hairline bg-card px-3 text-[12px] font-semibold text-foreground hover:bg-fill-raised focus-visible:ring-2 focus-visible:ring-ring";
function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={card}>
      <div className='text-[13px] font-semibold text-muted-foreground'>{label}</div>
      <div className='mt-2 text-[27px] font-bold tracking-tight tabular-nums'>{value}</div>
      <p className='mt-2 text-[13px] leading-relaxed text-muted-foreground'>{note}</p>
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
  forecast = false,
}: {
  label: string;
  value: number | null;
  target: number;
  money?: boolean;
  forecast?: boolean;
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
        <p className='mt-1 text-[13px] text-muted-foreground'>
          {ratio >= 1
            ? "Target passed. This is a planning alert; it does not stop devices."
            : Math.round(ratio * 100) +
              (forecast ? "% of your target forecast for month-end" : "% of your target recorded so far")}
        </p>
      )}
    </div>
  );
}
export function GhanaCostPanel({ status }: { status: DishStatusJson | null }) {
  const [period, setPeriod] = useState<ViewPeriod>("month");
  const a = useGhanaAnalysis(status, period);
  const month = useGhanaAnalysis(status, "month");
  const { settings: s } = a;
  const [saveMessage, setSaveMessage] = useState("");
  const update = (patch: Partial<GhanaSettings>) => {
    try {
      a.update(patch);
      setSaveMessage("Settings saved on this device.");
    } catch {
      setSaveMessage("Could not save settings. Check browser storage and retry.");
    }
  };
  const [setupOpen, setSetupOpen] = useState(s.planFee === 0);
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
        value={typeof s[key] === "number" ? (s[key] as number) : ""}
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
  const selectedLabel =
    period === "today"
      ? "today so far"
      : period === "week"
        ? "the selected seven-day period so far"
        : period === "month"
          ? "October's elapsed time so far"
          : "the billing cycle's elapsed time so far";
  const offline = a.stale;
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
      <p role='status'>{saveMessage}</p>
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
          { label: "Billing cycle", value: "cycle" },
        ]}
        value={period}
        onChange={setPeriod}
        label='Cost and usage period'
      />
      <Callout tone='info'>
        {offline
          ? "Recorder unavailable. Last recorded figures may be stale. Keep Chrome open on your Starlink Wi-Fi, or check your desktop recorder."
          : energyMeasured
            ? "Energy recorded for " +
              Math.round(a.energy.coverage * 100) +
              "% of " +
              selectedLabel +
              " (" +
              (a.energy.sampledSeconds / 3600).toFixed(1) +
              " recorded hours). This is not coverage of the entire calendar period. Missing time is excluded."
            : "No energy recorded yet. Choose your dish model below for an estimate. Keep Chrome running on your Starlink Wi-Fi to collect history."}
      </Callout>
      <p className='text-sm text-muted-foreground'>
        {new Date(a.window.start * 1000).toLocaleDateString("en-GH", { timeZone: "Africa/Accra" })}{" "}
        to {a.now.toLocaleDateString("en-GH", { timeZone: "Africa/Accra" })} · Ghana time
      </p>
      <details className={card}>
        <summary className='cursor-pointer font-semibold'>How these costs are calculated</summary>
        <p className='mt-3 text-sm leading-relaxed'>
          Plan allocation {ghs(a.planAllocation)} + electricity estimate {ghs(a.electricity)} ={" "}
          {ghs(a.total)} so far. Your full plan fee is {ghs(s.planFee)}. It does not increase as you
          use more GB. Electricity uses {a.kwh?.toFixed(3) ?? "unknown"} kWh and your saved tariff.
          This is a planning estimate, not an ECG or Starlink invoice.
        </p>
      </details>
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
          note={
            Math.round(a.usage.coverage * 100) +
            "% of elapsed time sampled (" +
            (a.usage.sampledSeconds / 3600).toFixed(1) +
            " h) · download + upload"
          }
        />
        <Metric
          label='Full-month cost ÷ recorded GB'
          value={ghs(a.perGb)}
          note={
            a.perGb === null
              ? "Waiting for recorded traffic and a usable monthly cost forecast."
              : "Same monthly forecast in every tab, divided by GB captured so far. Not an extra charge."
          }
        />
      </div>
      <Section title='What will each GB effectively cost?'>
        <div className='grid gap-3 sm:grid-cols-2'>
          <div>
            <p className='text-[12px] text-muted-foreground'>Early-month ratio · limited history</p>
            <p className='text-[22px] font-bold'>{ghs(month.perGb)} / recorded GB</p>
            <p className='mt-1 text-[12px] text-muted-foreground'>
              Full month's predicted bill ÷ only the GB recorded so far. This usually falls as
              recording continues.
            </p>
          </div>
          <div>
            <p className='text-[12px] text-muted-foreground'>Projected full-month effective rate</p>
            <p className='text-[22px] font-bold'>{ghs(month.projectedPerGb)} / projected GB</p>
            <p className='mt-1 text-[12px] text-muted-foreground'>
              Full month's predicted bill ÷ predicted full-month usage. {month.monthlyDataQuality.label}:
              {" "}{month.monthlyDataQuality.explanation}
            </p>
          </div>
        </div>
      </Section>
      <div className='grid gap-3 lg:grid-cols-2'>
        <Section title='How much data, and when?'>
          {a.usage.gb === null ? (
            <p className='text-[12px] text-muted-foreground'>
              Your first readings will appear here. Missing time stays empty, rather than showing
              invented usage.
            </p>
          ) : (
            <RangeBars
              range={period === "today" ? "today" : "day"}
              heightPx={125}
              columns={a.usage.buckets.map((b) => {
                const total = (b.downGB ?? 0) + (b.upGB ?? 0),
                  label = bucketLabel(b.t, "day");
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
          <p className='mt-3 text-[13px] text-muted-foreground'>
            The local WAN meter may differ from Starlink billing and router device counters. Use
            “Starlink billing” for your account’s authoritative usage.
          </p>
        </Section>
        <Section title='Plan ahead'>
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <p className='text-[13px] text-muted-foreground'>Full month cost forecast</p>
              <strong className='mt-1 block text-[22px]'>{ghs(month.projectedTotal)}</strong>
            </div>
            <div>
              <p className='text-[13px] text-muted-foreground'>Full month data projection</p>
              <strong className='mt-1 block text-[22px]'>{gb(month.dataForecast)}</strong>
            </div>
          </div>
          <p className='mt-2 text-[13px] text-muted-foreground'>
            Cost basis: {month.monthlyPowerBasis === "recorded"
              ? "sampled dish power"
              : "dish model assumption"} ({month.monthlyEnergyQuality.hours.toFixed(1)}
            {" "}recorded hours). Data forecast: {month.monthlyDataQuality.label.toLowerCase()}
            {" "}from {month.monthlyDataQuality.hours.toFixed(1)} recorded hours.
            {" "}{month.monthlyDataQuality.explanation} Electricity forecasts can change as more
            samples arrive; this is not a Starlink or ECG bill.
          </p>
          <Budget
            label='Monthly spending target · forecast'
            value={month.projectedTotal}
            target={s.costBudget}
            money
            forecast
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
                Math.max(1, month.days - a.now.getDate() + 1) >
              0
                ? "About " +
                  (
                    Math.max(0, s.dataBudget - month.usage.gb) /
                    Math.max(1, a.days - a.now.getDate() + 1)
                  ).toFixed(1) +
                  " GB/day available against your personal target for the remaining calendar days, including today."
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
      <details
        className={card}
        open={setupOpen}
        onToggle={(event) => setSetupOpen(event.currentTarget.open)}
      >
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
          {numberField("billingDay", "Billing starts on day (1–31)", 31)}
          {numberField("costBudget", "Monthly spending target · GH₵ (0 = off)")}
          {numberField("dataBudget", "Monthly data target · GB (0 = off)")}
          {numberField("people", "People sharing the bill", 100)}
        </div>
      </details>
      <details className={card}>
        <summary className='cursor-pointer font-semibold'>Explore savings & mobile bundles</summary>
        <div className='mt-4 grid gap-3 lg:grid-cols-2'>
          <Section title='Could switching off at night help?'>
            {numberField("sleepHours", "Hours off each day · what-if only", 24)}
            <p className='mt-3 text-[22px] font-bold'>
              {ghs(savings)}{" "}
              <span className='text-[12px] font-normal text-muted-foreground'>
                possible electricity saving / month
              </span>
            </p>
            <p className='mt-2 text-[13px] text-muted-foreground'>
              Model scenario, capped at your powered hours. Your subscription stays the same, and
              you lose internet while the dish is off. No schedule is changed by this calculator.
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
            <p className='mt-2 text-[13px] text-muted-foreground'>
              {bundleRate !== null && month.projectedPerGb !== null
                ? "Your early full-month Starlink projection is " +
                  ghs(Math.abs(bundleRate - month.projectedPerGb)) +
                  "/GB " +
                  (month.projectedPerGb < bundleRate ? "lower" : "higher") +
                  ". Forecast quality: " +
                  month.monthlyDataQuality.label.toLowerCase() +
                  "."
                : "Enter a current bundle offer; a Starlink comparison also needs 24 recorded hours of usage."}{" "}
              Bundle expiry, network coverage and speed also matter.
            </p>
          </Section>
        </div>
      </details>
      <Section title='Who uses the data?'>
        <p className='text-[12px] text-muted-foreground'>
          Equal full-month split:{" "}
          <strong className='text-foreground'>
            {ghs(
              month.projectedTotal === null ? null : month.projectedTotal / Math.max(1, s.people),
            )}
          </strong>{" "}
          per person across {s.people} {s.people === 1 ? "person" : "people"}. Device cost shares
          below divide that forecast using the router's tracked device traffic. The router counters
          are separate from the dish's {gb(month.usage.gb)} recorded WAN usage, so the two totals
          may differ. These are hypothetical planning shares, not device bills or measured power.
        </p>
        <DeviceUsageList allocatedCost={month.projectedTotal} />
      </Section>
      <Explainer title='What is measured, and what is estimated?'>
        Recorded GB and kWh cover sampled time only. Coverage is measured against elapsed time,
        not the entire calendar day or month. Forecasts extrapolate recorded hours to future and
        missing hours. The observed GH₵/GB metric divides the full-month estimate by confirmed
        monthly GB; the projected rate divides the same full-month estimate by projected monthly GB.
        Neither is an extra per-GB charge. No 80% coverage threshold is required to display the
        observed ratio. Starlink may use a different billing cycle; choose Billing cycle for your
        saved plan dates. Daily cost views use Ghana time. Device allocations and the monthly
        targets remain calendar-month estimates. ECG/NEDCo residential
        energy rates use the same PURC schedule. Fixed charges, taxes, levies, router power and mesh
        power are excluded. Lifeline applies only if total household usage stays within 30 kWh; tier
        crossings can raise the estimate.
        <a className='ml-1 underline' href={TARIFF_SOURCE} target='_blank' rel='noreferrer'>
          PURC tariff source · effective 1 Oct 2026
        </a>
      </Explainer>
      <p className='text-[13px] text-muted-foreground' role='status'>
        {exported
          ? "CSV report downloaded. It includes the period and recording coverage."
          : "History refreshes every 30 seconds. Device totals refresh every 10 seconds."}
      </p>
    </div>
  );
}
