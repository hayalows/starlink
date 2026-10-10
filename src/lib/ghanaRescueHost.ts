export type RescueAction = "status" | "sync" | "restore";
export interface RescueState {
  count: number;
  days: number;
  newest: number | null;
  lastGood: number;
  restored?: number;
  error?: string;
}
export interface RescueHost {
  send(action: RescueAction): Promise<RescueState>;
}
let host: RescueHost | null = null;
export function setRescueHost(next: RescueHost) {
  host = next;
}
export function rescueHost(): RescueHost | null {
  return host;
}
