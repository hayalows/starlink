import { useEffect, useState } from "react";
import { ghanaHost } from "../../lib/ghanaHost";
const DOWNLOAD =
  "https://github.com/hayalows/starlink/releases/latest/download/starlink-ghana-monitor-chrome.zip";
const KEY = "starlink.ghana.updateCheck";
function savedCheck(): { auto: boolean; at: number; version: string } {
  try {
    return { auto: false, at: 0, version: "", ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { auto: false, at: 0, version: "" };
  }
}
export function MonitorUpdates() {
  const [preferences, setPreferences] = useState(savedCheck);
  const [state, setState] = useState(""),
    [busy, setBusy] = useState(false),
    [replaced, setReplaced] = useState(false);
  const available =
    /^\d+\.\d+\.\d+$/.test(preferences.version) &&
    preferences.version.localeCompare(__APP_VERSION__, undefined, { numeric: true }) > 0;
  useEffect(() => {
    if (!preferences.auto || Date.now() - preferences.at < 86400000) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 10000);
    void fetch("https://starlink-ghana.vercel.app/version.json", {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const payload = await r.json();
        if (!/^\d+\.\d+\.\d+$/.test(payload.version)) throw Error();
        if (active) {
          const next = { auto: true, at: Date.now(), version: payload.version };
          localStorage.setItem(KEY, JSON.stringify(next));
          setPreferences(next);
        }
      })
      .catch(() => {
        if (active) setState("Automatic check could not finish. Try Check now.");
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [preferences.auto, preferences.at]);
  async function check() {
    setBusy(true);
    try {
      const response = await fetch("https://starlink-ghana.vercel.app/version.json", {
        cache: "no-store",
        credentials: "omit",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw Error();
      const payload = await response.json();
      if (!/^\d+\.\d+\.\d+$/.test(payload.version)) throw Error();
      const next = { ...preferences, at: Date.now(), version: payload.version };
      localStorage.setItem(KEY, JSON.stringify(next));
      setPreferences(next);
      setState(
        payload.version.localeCompare(__APP_VERSION__, undefined, { numeric: true }) > 0
          ? `Version ${payload.version} is available. The download is published after release checks pass.`
          : "You have the latest version.",
      );
    } catch {
      setState("Could not check. Retry or open the download page.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className='ghana-section'>
      <h2>Keep your monitor up to date</h2>
      <p>
        Installed version <strong>{__APP_VERSION__}</strong>
        {available && (
          <>
            {" "}
            · <strong>Version {preferences.version} available</strong>
          </>
        )}
      </p>
      <label className='ghana-check'>
        <input
          type='checkbox'
          checked={preferences.auto}
          onChange={(e) => {
            try {
              const next = { ...preferences, auto: e.target.checked };
              localStorage.setItem(KEY, JSON.stringify(next));
              setPreferences(next);
            } catch {
              setState("Could not save the update preference.");
            }
          }}
        />{" "}
        Check once a day when Overview is open
      </label>
      <p className='ghana-muted'>
        Version checks contact our website without your readings or account details.{" "}
        {preferences.at > 0
          ? `Last checked ${new Date(preferences.at).toLocaleString("en-GH", { timeZone: "Africa/Accra" })}.`
          : ""}
      </p>
      <div className='ghana-actions'>
        <button className='ghana-button' disabled={busy} onClick={() => void check()}>
          {busy ? "Checking…" : "Check now"}
        </button>
        <a className='ghana-button ghana-primary' href={DOWNLOAD} target='_blank' rel='noreferrer'>
          {available ? "Download update" : "Download latest package"}
        </a>
        <a
          className='ghana-button'
          href='https://github.com/hayalows/starlink/releases'
          target='_blank'
          rel='noreferrer'
        >
          Release notes
        </a>
      </div>
      <details>
        <summary>Update safely in the same folder</summary>
        <ol className='ml-5 list-decimal space-y-3 py-4'>
          <li>
            Export a backup using Backup & restore above. Keep the same installation folder and
            extension ID.
          </li>
          <li>
            Close the dashboard. Run <code>Update-Starlink.ps1</code> from your installation folder
            on Windows (PowerShell), or <code>bash Update-Starlink.command</code> in Terminal on
            macOS. The helper downloads the latest package, verifies its checksum and keeps a copy
            of your old extension files.
          </li>
          <li>
            Alternatively, unzip the downloaded package into that same folder and replace its files.
          </li>
          <li>
            Reopen the dashboard, confirm below and reload. You can also click Reload on the
            extension card at <code>chrome://extensions</code>.
          </li>
        </ol>
        <p className='ghana-muted'>
          Do not remove the extension: that erases its browser data. The helper updates files only;
          Chrome keeps history and settings. Fully automatic extension delivery requires a Chrome
          Web Store release.
        </p>
        {ghanaHost() && (
          <>
            <label className='ghana-check'>
              <input
                type='checkbox'
                checked={replaced}
                onChange={(e) => setReplaced(e.target.checked)}
              />{" "}
              I have replaced the files in my existing installation folder
            </label>
            <button
              className='ghana-button'
              disabled={!replaced}
              onClick={() => {
                void ghanaHost()
                  ?.reload()
                  .catch(() =>
                    setState("Could not reload. Use chrome://extensions and click Reload."),
                  );
              }}
            >
              Reload monitor & reopen
            </button>
          </>
        )}
      </details>
      <p role='status'>{state}</p>
    </section>
  );
}
