import { useState } from "react";
import { ghanaHost } from "../../lib/ghanaHost";
import { validateHistory, type GhanaHistoryBackup } from "@core/ghanaBackup";
import { useGhanaSettings, normalizeGhanaSettings } from "../../hooks/useGhanaSettings";
import {
  cleanProfiles,
  getProfiles,
  saveProfiles,
  type DeviceProfiles,
} from "../../lib/ghanaProfiles";
import type { GhanaSettings } from "../../hooks/useGhanaSettings";
export function BackupRestore() {
  const [settings, update] = useGhanaSettings();
  const [pending, setPending] = useState<{
    history: GhanaHistoryBackup;
    settings: GhanaSettings;
    profiles: DeviceProfiles;
    createdAt: string;
  } | null>(null);
  const [includeSettings, setIncludeSettings] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const host = ghanaHost();
  async function backup() {
    setBusy(true);
    setMessage("Preparing backup…");
    try {
      const history = host ? await host.exportHistory() : { minutes: [], months: [] };
      const file = {
        kind: "starlink-ghana-backup",
        version: 1,
        createdAt: new Date().toISOString(),
        settings,
        profiles: getProfiles(),
        history,
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(file)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `starlink-ghana-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      localStorage.setItem("starlink.ghana.lastBackup", new Date().toISOString());
      setMessage(
        `Backup downloaded: ${history.minutes.length.toLocaleString()} recorded minutes, settings and device names.`,
      );
    } catch {
      setMessage("Could not create the backup. Keep this page open and try again.");
    } finally {
      setBusy(false);
    }
  }
  async function preview(file: File | undefined) {
    if (!file) return;
    setPending(null);
    setMessage("Checking backup…");
    try {
      if (file.size > 100 * 1024 * 1024) throw Error("Choose a backup smaller than 100 MB.");
      const data = JSON.parse(await file.text());
      if (
        data.kind !== "starlink-ghana-backup" ||
        data.version !== 1 ||
        typeof data.createdAt !== "string" ||
        !Number.isFinite(Date.parse(data.createdAt))
      )
        throw Error("Choose a Starlink Ghana backup file.");
      const history = validateHistory(data.history);
      setPending({
        history,
        settings: normalizeGhanaSettings(data.settings),
        profiles: cleanProfiles(data.profiles),
        createdAt: data.createdAt,
      });
      setIncludeSettings(false);
      setMessage("Backup checked. Review the details before restoring.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read this backup.");
    }
  }
  async function restore() {
    if (!pending) return;
    setBusy(true);
    try {
      if (!host && (pending.history.minutes.length || pending.history.months.length))
        throw Error("Restore recorded history inside the Chrome extension.");
      const count = host ? await host.restoreHistory(pending.history) : 0;
      if (includeSettings) {
        update({ ...pending.settings, budgetAlerts: false });
        saveProfiles({ ...getProfiles(), ...pending.profiles });
      }
      setPending(null);
      setMessage(
        `Restored ${count.toLocaleString()} missing history rows. Existing readings were kept. The charts refresh within 30 seconds.${includeSettings ? " Settings and names restored; budget notifications remain off." : ""}`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Restore failed. Your existing history is kept. You can safely retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className='ghana-section'>
      <summary>Backup & restore</summary>
      <p className='ghana-muted'>
        Back up before updating or moving computers. Includes recorded energy/data history, your
        cost setup and local device names/groups. Account credentials, router controls and
        per-device traffic counters are excluded. Keep the file private.
      </p>
      <div className='ghana-actions'>
        <button className='ghana-button' disabled={busy} onClick={() => void backup()}>
          {busy ? "Working…" : "Download backup"}
        </button>
        <label className='ghana-button'>
          Choose a backup
          <input
            type='file'
            accept='.json,application/json'
            disabled={busy}
            className='max-w-52'
            onChange={(e) => void preview(e.target.files?.[0])}
          />
        </label>
      </div>
      {!host && (
        <p className='ghana-muted'>
          This view can back up settings. Use the extension for recorded history.
        </p>
      )}
      {pending && (
        <div className='ghana-inset'>
          <h3>Review restore</h3>
          <p>
            Created {new Date(pending.createdAt).toLocaleString("en-GH")} ·{" "}
            {pending.history.minutes.length.toLocaleString()} minutes ·{" "}
            {pending.history.months.length} monthly archives ·{" "}
            {Object.keys(pending.profiles).length} device profiles.
          </p>
          <p>
            Missing history is merged. Existing readings and the most recent 30 minutes stay
            untouched. Use a backup from the same Starlink dish.
          </p>
          <label>
            <input
              type='checkbox'
              checked={includeSettings}
              onChange={(e) => setIncludeSettings(e.target.checked)}
            />{" "}
            Also replace cost settings and merge names/groups (matching names will be replaced)
          </label>
          <div className='ghana-actions'>
            <button
              className='ghana-button ghana-primary'
              disabled={busy}
              onClick={() => void restore()}
            >
              Restore reviewed backup
            </button>
            <button
              className='ghana-button'
              disabled={busy}
              onClick={() => {
                setPending(null);
                setMessage("Restore cancelled.");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <p role='status'>{message}</p>
    </details>
  );
}
