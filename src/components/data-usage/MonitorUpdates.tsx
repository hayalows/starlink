import { useState } from "react";
const DOWNLOAD =
  "https://github.com/hayalows/starlink/releases/latest/download/starlink-ghana-monitor-chrome.zip";
export function MonitorUpdates() {
  const [state, setState] = useState(""),
    [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(false);
  const check = async () => {
    setBusy(true);
    setState("");
    try {
      const response = await fetch("https://starlink-ghana.vercel.app/version.json", {
        cache: "no-store",
        credentials: "omit",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("unavailable");
      const payload = (await response.json()) as { version: string };
      if (!/^\d+\.\d+\.\d+$/.test(payload.version)) throw new Error("invalid version");
      const newer =
        payload.version.localeCompare(__APP_VERSION__, undefined, { numeric: true }) > 0;
      setAvailable(newer);
      setState(
        newer
          ? "Version " + payload.version + " is ready to download."
          : "You have the latest version.",
      );
    } catch {
      setState("Could not check right now. You can still open the download page.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className='mx-4 mb-3 rounded-xl border border-hairline bg-card px-4 py-2 text-[11px] sm:mx-6'>
      <summary className='cursor-pointer font-semibold'>
        Monitor v{__APP_VERSION__} · Updates & install help
      </summary>
      <div className='mt-3 flex flex-wrap items-center gap-3'>
        <button
          disabled={busy}
          onClick={() => void check()}
          className='min-h-10 rounded-lg border border-hairline px-3 font-semibold focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'
        >
          {busy ? "Checking…" : "Check for updates"}
        </button>
        <a
          href={DOWNLOAD}
          target='_blank'
          rel='noreferrer'
          className='inline-flex min-h-10 items-center font-semibold underline'
        >
          {available ? "Download update" : "Download latest extension"}
        </a>
        <span role='status'>{state}</span>
      </div>
      <p className='mt-2 leading-relaxed'>
        For an unpacked extension: close its dashboard, unzip the new package into the same folder
        you originally loaded (replace the files), then click Reload on its card at
        chrome://extensions. Reopen the monitor. Keep the same folder and extension ID to retain
        your history; do not remove the extension.
      </p>
      <p className='mt-2 leading-relaxed'>
        The website updates on refresh. The unpacked Chrome extension needs the step above. A
        store-published extension can update automatically. Checking versions contacts this website
        without sending your readings or account details.
      </p>
    </details>
  );
}
