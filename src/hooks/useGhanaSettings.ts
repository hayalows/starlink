import { useSyncExternalStore } from "react";
import { GHANA_TARIFFS, nonNegative, type GhanaTariff } from "@core/ghanaCost";
export interface GhanaSettings {
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
    const result = { ...defaults, ...source };
    for (const key of Object.keys(defaults) as (keyof GhanaSettings)[]) {
      if (typeof defaults[key] === "number")
        Object.assign(result, { [key]: nonNegative(Number(result[key])) });
    }
    if (!(result.tariff in GHANA_TARIFFS)) result.tariff = "residential";
    if (!["auto", "mini", "standard4", "standard5", "custom"].includes(result.model))
      result.model = "auto";
    result.hours = Math.min(24, result.hours);
    result.watts = Math.min(500, result.watts);
    result.people = Math.max(1, Math.min(100, Math.floor(result.people)));
    return result;
  } catch {
    return defaults;
  }
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
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* optional persistence */
  }
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
