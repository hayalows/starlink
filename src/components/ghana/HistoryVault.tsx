import { useEffect, useState } from "react";
import { ghanaVaultHost, type VaultAction, type VaultState } from "../../lib/ghanaVaultHost";

export function HistoryVault() {
  const host = ghanaVaultHost();
  const [state, setState] = useState<VaultState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    if (host) {
      void host.send("status").then((result) => {
        if (alive) setState(result);
      }).catch(() => {
        if (alive) setMessage("Could not check the history vault.");
      });
    }
    return () => { alive = false; };
  }, [host]);
  if (!host) return null;
  async function act(action: VaultAction) {
    if (action === "restore" && !window.confirm(
      "Restore ONLY missing recorded minutes from your cloud vault? Existing history stays untouched. This can take a little time.",
    )) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await host!.send(action);
      if (result.error) {
        setMessage("Archive operation needs attention: " + result.error);
      } else {
        setMessage(
          action === "enable" ? "Cloud protection is on. Initial backfill started; use Protect now to continue." :
          action === "disable" ? "Future cloud minute backups are paused. Older archived minutes remain stored." :
          action === "restore" ?
            `Restored ${result.restored ?? 0} missing historical minutes. ${result.more ? "There are older pages; select Restore again to continue." : "Recovery scan completed."}` :
          action === "sync" ?
            `Sent ${result.received ?? 0} settled minute records. ${result.more ? "Older history is still being backed up." : "Caught up with accessible local history."}` :
            "Vault checked.",
        );
        if (result.rejected) {
          setMessage((old) => old + ` ${result.rejected} abnormal rows need review; they were not uploaded.`);
        }
      }
      const refreshed = await host!.send("status");
      setState(refreshed);
    } catch {
      setMessage("The archive could not be reached. Local recording is unaffected; retry later.");
    } finally {
      setBusy(false);
    }
  }
  const count = state?.remoteMinutes;
  const time = (seconds?: number | null) =>
    seconds ? new Date(seconds * 1000).toLocaleString("en-GH") : "No history yet";
  return (
    <section className="ghana-section" aria-label="History vault and recovery">
      <div className="ghana-split">
        <div>
          <p className="ghana-eyebrow">HISTORY PROTECTION · V1.6</p>
          <h2>History vault</h2>
        </div>
        <span className="text-[12px] text-muted-foreground">
          {state?.enabled ? "Protection enabled" : "Not enabled"}
        </span>
      </div>
      <p className="ghana-muted">
        Your browser saves every minute locally. This optional second copy keeps
        settled power and download/upload readings in a private cloud archive,
        independent of Chrome's database. It never replaces an older archived minute
        with zero if your laptop resets.
      </p>
      <p className="ghana-muted" role="status">
        {state === null ? "Checking…" :
          !state.paired ? "Pair your phone to use private cloud protection." :
          state.error ? "Vault check: " + state.error :
          count === null || count === undefined ? "Cloud history count unavailable." :
          `${count.toLocaleString()} archived minute records · Newest: ${time(state.newest)}`}
      </p>
      {state?.paired && (
        <>
          <p className="ghana-muted">
            Local records: {state.localMinutes?.toLocaleString() ?? "—"}
            {state.lastSuccess ? " · Last verified upload: " +
              new Date(state.lastSuccess).toLocaleString("en-GH") : ""}
          </p>
          <div className="ghana-actions">
            <button className="ghana-button ghana-primary" type="button"
              disabled={busy} onClick={() => void act(state.enabled ? "disable" : "enable")}>
              {state.enabled ? "Pause protection" : "Enable protection"}
            </button>
            <button className="ghana-button" type="button"
              disabled={busy || !state.enabled} onClick={() => void act("sync")}>
              {busy ? "Working…" : "Protect now"}
            </button>
            <button className="ghana-button" type="button"
              disabled={busy || !state.remoteMinutes || state.remoteMinutes <= 0}
              onClick={() => void act("restore")}>
              Restore missing history
            </button>
          </div>
        </>
      )}
      <p className="ghana-muted">
        Opt-in privacy: the vault stores raw minute-level usage, timestamps and dish
        energy, not device names, account credentials or browsing history. Access is
        guarded by your existing private phone pairing keys. The vault is hosted on
        Supabase; it is not end-to-end encrypted with a separate key. To protect against
        losing all Chrome extension storage, download an archive from your paired phone
        and keep a separate private copy. Backups work while Chrome is open and connected.
      </p>
      {message && <p role="status" className="ghana-muted">{message}</p>}
    </section>
  );
}
