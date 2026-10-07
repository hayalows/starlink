import {
  electricityCost,
  selectPeriod,
  monthLength,
  csvRows,
  type GhanaTariff,
  type GhanaPeriod,
  type RecordedBucket,
} from "../../../core/ghanaCost";
type Summary = { buckets: RecordedBucket[] };
type Device = {
  name?: string;
  hostname?: string;
  macAddress?: string;
  sinceMs?: number;
  rxBytes?: number;
  txBytes?: number;
};
interface Settings {
  model: string;
  hours: number;
  tariff: GhanaTariff;
  homeKwh: number;
  customWatts: number;
  customRate: number;
  period: GhanaPeriod;
  planFee: number;
  manualGb: number;
  costBudget: number;
  people: number;
  sleepHours: number;
  bundlePrice: number;
  bundleGb: number;
}
const defaults: Settings = {
  model: "mini",
  hours: 24,
  tariff: "residential",
  homeKwh: 0,
  customWatts: 50,
  customRate: 2.037509,
  period: "today",
  planFee: 0,
  manualGb: 0,
  costBudget: 0,
  people: 1,
  sleepHours: 6,
  bundlePrice: 0,
  bundleGb: 0,
};
let s = { ...defaults };
try {
  s = { ...s, ...JSON.parse(localStorage.getItem("starlinkGhanaSettings") ?? "{}") };
} catch {
  /* optional settings */
}
// Migrate the original calculator labels.
if ((s.tariff as string) === "residential-high") s.tariff = "residentialHigh";
if ((s.period as string) === "day") s.period = "today";
const models: Record<string, { watts: number; label: string }> = {
  mini: { watts: 32.5, label: "Starlink Mini · 25–40 W" },
  standard4: { watts: 87.5, label: "Standard 4 · 75–100 W" },
  standard5: { watts: 42.5, label: "Standard V5 · 35–50 W" },
  custom: { watts: 50, label: "Your entered average watts" },
};
if (!(s.model in models)) s.model = "mini";
if (!["lifeline", "residential", "residentialHigh", "custom"].includes(s.tariff))
  s.tariff = "residential";
if (!["today", "week", "month"].includes(s.period)) s.period = "today";
for (const key of Object.keys(defaults) as (keyof Settings)[])
  if (typeof defaults[key] === "number")
    Object.assign(s, {
      [key]: Math.max(0, Number.isFinite(Number(s[key])) ? Number(s[key]) : defaults[key]),
    });
s.hours = Math.min(24, s.hours);
s.customWatts = Math.min(500, s.customWatts);
s.people = Math.max(1, Math.min(100, Math.floor(s.people)));
const el = (id: string) => document.getElementById(id)!;
const input = (id: string) => el(id) as HTMLInputElement;
const text = (id: string, value: string) => {
  el(id).textContent = value;
};
const money = (v: number) =>
  "GH₵" + v.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let energy: Partial<Record<GhanaPeriod, Summary>> = {},
  usage: Summary | null = null,
  devices: Device[] = [],
  connected = false,
  token = "",
  lastRead: Date | null = null;
const calc = () => {
  const now = new Date(),
    days = monthLength(now),
    watts = s.model === "custom" ? s.customWatts : models[s.model].watts;
  const monthKwh = (watts * s.hours * days) / 1000;
  const cost = (kwh: number) => electricityCost(kwh, s.tariff, s.homeKwh, s.customRate);
  const monthPower = cost(monthKwh),
    total = s.planFee + monthPower;
  const period = selectPeriod(energy[s.period]?.buckets ?? [], s.period, now);
  const periodDays = s.period === "today" ? 1 : s.period === "week" ? 7 : days;
  const kwh = period.kWh ?? (watts * s.hours * periodDays) / 1000;
  const periodCost = monthKwh > 0 ? (cost(monthKwh) * kwh) / monthKwh : cost(kwh);
  const monthUsage = selectPeriod(usage?.buckets ?? [], "month", now);
  const sufficient = connected && monthUsage.gb !== null && monthUsage.coverage >= 0.8;
  const dataGb = sufficient ? monthUsage.gb! : s.manualGb;
  const perGb = s.planFee > 0 && dataGb > 0 ? total / dataGb : null;
  return {
    now,
    days,
    watts,
    monthKwh,
    monthPower,
    total,
    period,
    kwh,
    periodCost,
    dataGb,
    perGb,
    sufficient,
    monthUsage,
    cost,
  };
};
function recalc() {
  const a = calc();
  text("month-cost", a.monthPower.toFixed(2));
  text("month-energy", a.monthKwh.toFixed(1) + " kWh");
  text("rate-label", s.tariff === "custom" ? "your entered rate" : "PURC residential");
  text("watts-now", a.watts.toFixed(1));
  text("watts-mode", "model average");
  text("model-range", models[s.model].label);
  text("selected-cost", a.periodCost.toFixed(2));
  text("selected-kwh", a.kwh.toFixed(3) + " kWh");
  text(
    "selected-period",
    a.period.kWh !== null
      ? "Recorded energy only · cost estimated"
      : "Full " +
          (s.period === "today" ? "day" : s.period === "week" ? "7-day" : "month") +
          " model estimate",
  );
  text("selected-energy-label", a.period.kWh !== null ? "sampled time only" : "estimated energy");
  text(
    "coverage-label",
    a.period.kWh === null
      ? "No recorded energy"
      : Math.round(a.period.coverage * 100) + "% of period recorded",
  );
  text("cost-range", "Model estimate");
  text("chart-caption", "recorded energy only");
  text(
    "estimate-explain",
    "Electricity estimate uses PURC energy charges and your other household usage. Fixed charges, levies, router and mesh power are excluded. Lifeline only applies while total household use stays within 30 kWh.",
  );
  text("combined-month", money(a.total));
  text("effective-gb", a.perGb === null ? "—" : money(a.perGb) + "/GB");
  text(
    "cost-explanation",
    money(s.planFee) +
      " plan + " +
      money(a.monthPower) +
      " modelled electricity. Effective cost is this monthly estimate divided by " +
      (a.sufficient ? "recorded GB." : "your entered monthly GB.") +
      " It is not a charge for each GB used.",
  );
  text("data-total", a.monthUsage.gb === null ? "—" : a.monthUsage.gb.toFixed(1) + " GB");
  text(
    "data-footnote",
    a.monthUsage.gb === null
      ? "Open the extension for live usage"
      : Math.round(a.monthUsage.coverage * 100) + "% WAN recording coverage",
  );
  text(
    "gb-source",
    a.sufficient
      ? "Cost per GB uses recorded monthly WAN data with at least 80% coverage."
      : "Manual monthly data entry. Partial recordings are not used to imply complete monthly usage.",
  );
  (el("budget-progress") as HTMLProgressElement).value =
    s.costBudget > 0 ? Math.min(100, (a.total / s.costBudget) * 100) : 0;
  text(
    "budget-note",
    s.costBudget > 0
      ? a.total > s.costBudget
        ? "Your monthly estimate is " + money(a.total - s.costBudget) + " above target."
        : money(s.costBudget - a.total) + " below your monthly target."
      : "Set a spending target to compare your estimate.",
  );
  text(
    "equal-share",
    money(a.total / Math.max(1, s.people)) +
      " each for " +
      s.people +
      " people sharing the estimated monthly bill.",
  );
  const savedKwh = (a.watts * Math.min(s.sleepHours, s.hours) * a.days) / 1000;
  text(
    "sleep-saving",
    money(Math.max(0, a.cost(a.monthKwh) - a.cost(Math.max(0, a.monthKwh - savedKwh)))),
  );
  const bundle = s.bundleGb > 0 && s.bundlePrice > 0 ? s.bundlePrice / s.bundleGb : null;
  text(
    "bundle-comparison",
    bundle === null
      ? "Enter a current bundle price and size. No provider price is assumed."
      : "Your entered bundle costs " +
          money(bundle) +
          "/GB." +
          (a.perGb === null
            ? " Add your monthly Starlink GB and plan fee to compare."
            : " Starlink’s modelled effective rate is " +
              money(Math.abs(a.perGb - bundle)) +
              "/GB " +
              (a.perGb < bundle ? "lower." : "higher.")),
  );
  text("hours-value", s.hours + " hours");
  el("custom-field").hidden = s.model !== "custom";
  el("custom-rate-field").hidden = s.tariff !== "custom";
  text(
    "energy-status",
    a.period.kWh === null ? "Not recorded" : Math.round(a.period.coverage * 100) + "% recorded",
  );
  text("cost-status", a.period.kWh !== null ? "Partial energy" : "Model estimate");
  text("router-status", connected ? "Router totals" : "Not connected");
  text("connection-label", connected ? "COLLECTOR CONNECTED" : "CALCULATOR MODE");
  el("connection-strip").classList.toggle("connected", connected);
  {
    const copy = el("connection-strip").querySelector(".strip-copy")!;
    copy.replaceChildren();
    const strong = document.createElement("strong");
    strong.textContent =
      connected && lastRead
        ? "Collector connected · last read " + lastRead.toLocaleTimeString("en-GH")
        : lastRead
          ? "Collector unavailable · previous readings may be stale"
          : "Your dashboard is ready.";
    const span = document.createElement("span");
    span.textContent = connected
      ? "Local readings refresh every 30 seconds while this page is open."
      : lastRead
        ? "Check your monitor connection. Effective cost uses manual monthly GB until readings recover."
        : "Use the calculator below, or open the extension for live readings, budgets and device cost shares.";
    copy.append(strong, span);
  }
  const bars = el("cost-bars");
  bars.replaceChildren();
  const max = Math.max(0.001, ...a.period.buckets.map((b) => b.kWh ?? 0));
  if (a.period.kWh === null) {
    const note = document.createElement("p");
    note.className = "analysis-note";
    note.textContent = "No history yet. The cost estimate above uses your setup.";
    bars.append(note);
  } else
    a.period.buckets.forEach((b) => {
      const bar = document.createElement("span");
      bar.className = "bar";
      bar.style.height = ((b.kWh ?? 0) / max) * 100 + "%";
      bar.title =
        new Date(b.t * 1000).toLocaleString("en-GH") +
        " · " +
        (b.kWh == null ? "No reading" : b.kWh.toFixed(3) + " kWh");
      bars.append(bar);
    });
  el("data-meter-fill").style.width = "0%"; // No allowance entered: do not invent a progress percentage.
  document.querySelectorAll<HTMLButtonElement>("[data-period]").forEach((b) => {
    b.classList.toggle("active", b.dataset.period === s.period);
    b.setAttribute("aria-pressed", String(b.dataset.period === s.period));
  });
}
const fields: [string, keyof Settings, number?][] = [
  ["dish-model", "model"],
  ["hours", "hours", 24],
  ["tariff", "tariff"],
  ["home-use", "homeKwh", 10000],
  ["custom-watts", "customWatts", 500],
  ["custom-rate", "customRate", 100],
  ["plan-fee", "planFee"],
  ["manual-gb", "manualGb"],
  ["cost-budget", "costBudget"],
  ["people", "people", 100],
  ["sleep-hours", "sleepHours", 24],
  ["bundle-price", "bundlePrice"],
  ["bundle-gb", "bundleGb"],
];
function save() {
  try {
    localStorage.setItem("starlinkGhanaSettings", JSON.stringify(s));
  } catch {
    /* optional storage */
  }
  recalc();
}
fields.forEach(([id, key, max]) => {
  input(id).value = String(s[key]);
  input(id).addEventListener("input", () => {
    const value =
      typeof defaults[key] === "number"
        ? Math.max(key === "people" ? 1 : 0, Math.min(max ?? 1000000, Number(input(id).value) || 0))
        : input(id).value;
    Object.assign(s, { [key]: value });
    save();
  });
});
document.querySelectorAll<HTMLButtonElement>("[data-period]").forEach((b) =>
  b.addEventListener("click", () => {
    s.period = b.dataset.period as GhanaPeriod;
    save();
  }),
);
el("save-setup").addEventListener("click", () => {
  save();
  el("save-setup").textContent = "Setup saved on this device ✓";
});
el("export-report").addEventListener("click", () => {
  const a = calc();
  const rows = [
    ["Cost report basis", "Full-month model estimate"],
    ["Month", a.now.toLocaleDateString("en-GH", { year: "numeric", month: "long" })],
    ["Electricity GHS", a.monthPower],
    ["Plan GHS", s.planFee],
    ["Combined GHS", a.total],
    ["Data GB", a.dataGb],
    ["Data basis", a.sufficient ? "Recorded" : "Manual entry"],
    ["Effective GHS/GB", a.perGb],
    ["Equal share GHS", a.total / s.people],
  ];
  const url = URL.createObjectURL(new Blob([csvRows(rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "starlink-ghana-costs.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  text("export-status", "Report downloaded with its calculation basis.");
});
const dialog = el("connect-dialog") as HTMLDialogElement;
document
  .querySelectorAll("[data-open-connect]")
  .forEach((b) => b.addEventListener("click", () => dialog.showModal()));
document.querySelectorAll<HTMLElement>("[data-scroll]").forEach((b) =>
  b.addEventListener("click", () =>
    el(b.dataset.scroll!).scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    }),
  ),
);
async function getJson(base: string, path: string) {
  const response = await fetch(base + path, {
    headers: token ? { Authorization: "Bearer " + token } : {},
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Collector returned " + response.status);
  return response.json();
}
async function connect(base: string, auth: string) {
  const address = new URL(base);
  if (!["https:", "http:"].includes(address.protocol))
    throw new Error("Use an HTTP or HTTPS collector address.");
  const root = base.replace(/\/+$/, "");
  token = auth;
  const health = await getJson(root, "/api/health");
  if (health.ok !== true) throw new Error("This address is not a Starlink collector.");
  const paths = [
    "/api/energy?range=today",
    "/api/energy?range=day",
    "/api/energy?range=month",
    "/api/usage?range=month",
    "/api/clients/totals",
  ];
  const results = await Promise.allSettled(paths.map((path) => getJson(root, path)));
  const value = (i: number) => (results[i].status === "fulfilled" ? results[i].value : null);
  energy = { today: value(0), week: value(1), month: value(2) };
  usage = value(3);
  devices = value(4)?.totals ?? [];
  connected = true;
  lastRead = new Date();
  try {
    localStorage.setItem("starlinkGhanaCollector", root);
    localStorage.setItem("starlinkGhanaToken", token);
  } catch {
    /* optional storage */
  }
  renderDevices();
  recalc();
}
function renderDevices() {
  const current = devices.filter(
    (d) =>
      d.sinceMs &&
      new Date(d.sinceMs).getMonth() === new Date().getMonth() &&
      new Date(d.sinceMs).getFullYear() === new Date().getFullYear(),
  );
  const list = el("device-list");
  list.replaceChildren();
  list.hidden = current.length === 0;
  el("device-empty").hidden = current.length > 0;
  const bytes = (d: Device) =>
      Math.max(0, Number(d.rxBytes) || 0) + Math.max(0, Number(d.txBytes) || 0),
    total = current.reduce((n, d) => n + bytes(d), 0);
  current
    .sort((a, b) => bytes(b) - bytes(a))
    .forEach((d) => {
      const line = document.createElement("div");
      line.className = "device-row";
      const name = document.createElement("strong");
      name.textContent = d.name || d.hostname || d.macAddress || "Unknown device";
      const size = document.createElement("span");
      size.textContent = (bytes(d) / 1e9).toFixed(2) + " GB";
      const meta = document.createElement("small");
      meta.textContent = (total ? (bytes(d) / total) * 100 : 0).toFixed(1) + "% of router traffic";
      line.append(name, size, meta);
      list.append(line);
    });
}
const refresh = async () => {
  try {
    const base = localStorage.getItem("starlinkGhanaCollector");
    if (base) await connect(base, localStorage.getItem("starlinkGhanaToken") ?? "");
  } catch {
    connected = false;
    text(
      "connect-error",
      "Collector unavailable. Check its address, token and network. Previous readings may be stale.",
    );
    recalc();
  }
};
el("test-connection").addEventListener("click", async () => {
  const button = el("test-connection") as HTMLButtonElement;
  button.disabled = true;
  try {
    await connect(input("collector-url").value, input("collector-token").value);
    dialog.close();
    text("connect-error", "");
  } catch (error) {
    text("connect-error", error instanceof Error ? error.message : "Connection failed.");
  } finally {
    button.disabled = false;
  }
});
el("find-local").addEventListener("click", () => {
  input("collector-url").value = "http://127.0.0.1:8088";
  text(
    "connect-error",
    "For most users, download the extension above. This advanced option needs a running local collector.",
  );
});
el("disconnect").addEventListener("click", () => {
  try {
    localStorage.removeItem("starlinkGhanaCollector");
    localStorage.removeItem("starlinkGhanaToken");
  } catch {
    /* optional storage */
  }
  connected = false;
  energy = {};
  usage = null;
  devices = [];
  token = "";
  lastRead = null;
  dialog.close();
  renderDevices();
  recalc();
});
el("refresh-data").addEventListener("click", () => {
  void refresh();
  recalc();
});
let installPrompt: { prompt: () => Promise<void> } | null = null;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event as unknown as typeof installPrompt;
  el("install-app").hidden = false;
});
el("install-app").addEventListener("click", () => {
  if (installPrompt) void installPrompt.prompt();
});
if ("serviceWorker" in navigator)
  void navigator.serviceWorker.register("/service-worker.js").catch(() => {});
const clock = () =>
  text(
    "local-clock",
    new Date().toLocaleTimeString("en-GH", {
      timeZone: "Africa/Accra",
      hour: "2-digit",
      minute: "2-digit",
    }) + " · GHANA",
  );
clock();
recalc();
void refresh();
setInterval(() => {
  clock();
  void refresh();
  recalc();
}, 30000);
