type PhoneAction = "status" | "create" | "sync" | "disconnect";
export interface PhoneSyncHost {
  send(action: PhoneAction): Promise<unknown>;
}
let host: PhoneSyncHost | null = null;
export function setPhoneSyncHost(next: PhoneSyncHost): void {
  host = next;
}
export function phoneSyncHost(): PhoneSyncHost | null {
  return host;
}
