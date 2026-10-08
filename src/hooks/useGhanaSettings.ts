import { useSyncExternalStore } from "react";
import { GHANA_TARIFFS, nonNegative, type GhanaTariff } from "@core/ghanaCost";
export interface GhanaSettings {
  billingDay: number;
  setupDone: boolean;
  budgetAlerts: boolean;
  quietStart: number;
  quietEnd: number;
  model: "auto" | "mini" | "standard4" | "standard5" | "custom";
  hours: number;
  watts: number;
  tariff: GhanaTariff;
  homeKwh: number;
  customRate: number;
  planFee: number;
  costBudget: number;
  dataBudget: number;
  people: number;
  bundlePrice: number;
  bundleGb: number;
  sleepHours: number;
}
const KEY = "starlink.ghana.settings.v2";
const defaults: GhanaSettings = {
  billingDay: 1,
  setupDone: false,
  budgetAlerts: false,
  quietStart: 22,
  quietEnd: 7,
  model: "auto",
  hours: 24,
  watts: 50,
  tariff: "residential",
  homeKwh: 0,
  customRate: 2.037509,
  planFee: 0,
  costBudget: 0,
  dataBudget: 0,
  people: 1,
  bundlePrice: 0,
  bundleGb: 0,
  sleepHours: 6,
};
function read(): GhanaSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    const old = (key: string, fallback: string) =>
      localStorage.getItem("dishylink.ghana." + key) ?? fallback;
    const source = saved ?? {
      ...defaults,
      model: old("model-choice", "auto"),
      hours: Number(old("hours-per-day", "24")),
      watts: Number(old("custom-watts", "50")),
      tariff: old("ecg-tariff", "residential"),
      planFee: Number(old("plan-fee", "0")),
    };
    return normalizeGhanaSettings(source);
  } catch {
    return defaults;
  }
}
export function normalizeGhanaSettings(source: unknown): GhanaSettings {
  const raw = source && typeof source === "object" ? (source as Record<string, unknown>) : {};
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof GhanaSettings)[]) {
    if (typeof defaults[key] === "number" && typeof raw[key] === "number")
      Object.assign(result, { [key]: Math.min(100000, nonNegative(raw[key] as number)) });
  }
  if (typeof raw.tariff === "string" && Object.hasOwn(GHANA_TARIFFS, raw.tariff))
    result.tariff = raw.tariff as GhanaTariff;
  if (
    typeof raw.model === "string" &&
    ["auto", "mini", "standard4", "standard5", "custom"].includes(raw.model)
  )
    result.model = raw.model as GhanaSettings["model"];
  result.billingDay = Math.max(1, Math.min(31, Math.floor(result.billingDay)));
  result.quietStart = Math.min(23, Math.floor(result.quietStart));
  result.quietEnd = Math.min(23, Math.floor(result.quietEnd));
  result.hours = Math.min(24, result.hours);
  result.sleepHours = Math.min(24, result.sleepHours);
  result.watts = Math.min(500, result.watts);
  result.people = Math.max(1, Math.min(100, Math.floor(result.people)));
  result.setupDone = raw.setupDone === true;
  result.budgetAlerts = raw.budgetAlerts === true;
  return result;
}

let settings = read();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const get = () => settings;
export function updateGhanaSettings(patch: Partial<GhanaSettings>) {
  const next = normalizeGhanaSettings({ ...settings, ...patch });
  localStorage.setItem(KEY, JSON.stringify(next));
  settings = next;
  listeners.forEach((listener) => listener());
}
export function useGhanaSettings() {
  return [useSyncExternalStore(subscribe, get), updateGhanaSettings] as const;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY) return;
    settings = read();
    listeners.forEach((listener) => listener());
  });
}
