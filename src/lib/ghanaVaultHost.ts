export type VaultAction = "status" | "enable" | "disable" | "sync" | "restore";
export interface VaultState {
  enabled: boolean;
  paired: boolean;
  localMinutes?: number;
  remoteMinutes?: number | null;
  oldest?: number | null;
  newest?: number | null;
  lastSuccess?: number;
  received?: number;
  rejected?: number;
  restored?: number;
  more?: boolean;
  error?: string;
}
export interface GhanaVaultHost {
  send(action: VaultAction): Promise<VaultState>;
}
let host: GhanaVaultHost | null = null;
export function setGhanaVaultHost(next: GhanaVaultHost) {
  host = next;
}
export function ghanaVaultHost(): GhanaVaultHost | null {
  return host;
}
