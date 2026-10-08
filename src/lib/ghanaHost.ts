import type { GhanaHistoryBackup } from "@core/ghanaBackup";
export interface GhanaHost {
  exportHistory(): Promise<GhanaHistoryBackup>;
  restoreHistory(data: GhanaHistoryBackup): Promise<number>;
  reload(): Promise<void>;
  syncDeviceProfiles?(profiles: Record<string, { name: string; group: string }>): Promise<void>;
  syncBudgets(settings: {
    budgetAlerts: boolean;
    costBudget: number;
    dataBudget: number;
    quietStart: number;
    quietEnd: number;
    planFee: number;
    billingDay: number;
    tariff: string;
    homeKwh: number;
    customRate: number;
    watts: number;
    hours: number;
    model: string;
    detectedModel?: string;
    bundlePrice?: number;
    bundleGb?: number;
  }): Promise<void>;
}
let host: GhanaHost | null = null;
export function setGhanaHost(next: GhanaHost) {
  host = next;
}
export function ghanaHost() {
  return host;
}
