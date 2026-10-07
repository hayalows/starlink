// Self-measured data usage from the historian's /api/usage (same per-minute
// buckets as energy, integrating the dish's throughput telemetry).
// Kept separate from useEnergyHistory so the two panels stay independent.

import type { EnergyRange } from "./useEnergyHistory";
import { usePersistedHistory } from "./usePersistedHistory";

export interface UsageBucket {
  t: number;
  /** null when nothing was recorded for this slot — absence, not zero traffic. */
  downGB: number | null;
  upGB: number | null;
  sampledSeconds: number;
}

export interface UsageSummary {
  range: EnergyRange;
  totalDownGB: number;
  totalUpGB: number;
  coverage: { sampledSeconds: number; expectedSeconds: number; fraction: number };
  buckets: UsageBucket[];
}

export function useDataUsage(range: EnergyRange, active: boolean) {
  return usePersistedHistory<UsageSummary>(`/api/usage?range=${range}`, active);
}
