import { useSyncExternalStore } from "react";
export interface DeviceProfile {
  name: string;
  group: string;
}
export type DeviceProfiles = Record<string, DeviceProfile>;
export const PROFILES_KEY = "starlink.ghana.deviceProfiles.v1";
export function cleanProfiles(value: unknown): DeviceProfiles {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 500)
      .filter(
        ([key]) => key.length < 200 && !["__proto__", "constructor", "prototype"].includes(key),
      )
      .map(([key, v]) => {
        const p = v && typeof v === "object" ? (v as Partial<DeviceProfile>) : {};
        return [
          key,
          {
            name: typeof p.name === "string" ? p.name.slice(0, 80) : "",
            group: typeof p.group === "string" ? p.group.slice(0, 60) : "",
          },
        ];
      }),
  );
}
function read() {
  try {
    return cleanProfiles(JSON.parse(localStorage.getItem(PROFILES_KEY) ?? "{}"));
  } catch {
    return {};
  }
}
let profiles = read();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export function saveProfiles(next: DeviceProfiles) {
  const cleaned = cleanProfiles(next);
  localStorage.setItem(PROFILES_KEY, JSON.stringify(cleaned));
  profiles = cleaned;
  listeners.forEach((fn) => fn());
}
export function getProfiles() {
  return profiles;
}
export function useDeviceProfiles() {
  return useSyncExternalStore(subscribe, getProfiles);
}
if (typeof window !== "undefined")
  window.addEventListener("storage", (e) => {
    if (e.key === PROFILES_KEY) {
      profiles = read();
      listeners.forEach((fn) => fn());
    }
  });
