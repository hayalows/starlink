import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { BackupRestore } from "./BackupRestore";
import { setGhanaHost } from "../../lib/ghanaHost";
const restore = vi.fn(async () => 1);
setGhanaHost({
  exportHistory: async () => ({ minutes: [], months: [] }),
  restoreHistory: restore,
  reload: async () => {},
  syncBudgets: async () => {},
});
afterEach(() => {
  cleanup();
  restore.mockClear();
});
function choose(data: unknown) {
  const input = document.querySelector<HTMLInputElement>("input[type=file]")!;
  const transfer = new DataTransfer();
  transfer.items.add(new File([JSON.stringify(data)], "backup.json", { type: "application/json" }));
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
function open() {
  render(<BackupRestore />);
  document.querySelector("summary")!.click();
}
it("shows a restore preview and makes no changes until the explicit restore action", async () => {
  open();
  choose({
    kind: "starlink-ghana-backup",
    version: 1,
    createdAt: "2026-01-01T00:00:00Z",
    history: { minutes: [], months: [] },
    settings: { planFee: 400 },
    profiles: {},
  });
  await expect.poll(() => document.body.textContent).toContain("Review restore");
  expect(restore).not.toHaveBeenCalled();
  expect(document.querySelector<HTMLInputElement>("input[type=checkbox]")!.checked).toBe(false);
  const button = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === "Restore reviewed backup",
  )!;
  button.click();
  await expect.poll(() => restore.mock.calls.length).toBe(1);
  await expect.poll(() => document.body.textContent).toContain("Existing readings were kept");
});
it("rejects a malformed backup and leaves restore unavailable", async () => {
  open();
  choose({
    kind: "starlink-ghana-backup",
    version: 1,
    createdAt: "2026-01-01",
    history: { minutes: [{ minute: 1 }], months: [] },
  });
  await expect.poll(() => document.body.textContent).toContain("Invalid or duplicate minute");
  expect(document.body.textContent).not.toContain("Review restore");
  expect(restore).not.toHaveBeenCalled();
});
