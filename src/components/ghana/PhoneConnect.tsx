import { useEffect, useState } from "react";

type PhoneState = {
  paired: boolean;
  url?: string;
  lastSync?: number;
  error?: string;
};
const send = async (action: "status" | "create" | "sync" | "disconnect"): Promise<PhoneState> => {
  const result = await chrome.runtime.sendMessage({ type: "phoneSync", action });
  return result as PhoneState;
};

export function PhoneConnect() {
  const [value, setValue] = useState<PhoneState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    void send("status")
      .then((result) => {
        if (alive) setValue(result);
      })
      .catch(() => {
        if (alive) setMessage("Phone sync is unavailable in this browser.");
      });
    return () => {
      alive = false;
    };
  }, []);
  async function run(action: "create" | "sync" | "disconnect") {
    setBusy(true);
    setMessage("");
    try {
      const result = await send(action);
      setValue(result);
      if (result.error)
        setMessage(
          result.error === "sync_not_configured"
            ? "Cloud storage is not connected yet. The laptop monitor continues working locally."
            : result.error,
        );
      else
        setMessage(
          action === "create"
            ? "Paired. Send the private link to your phone."
            : action === "sync"
              ? "Latest recorded data sent to your phone."
              : "Phone access revoked.",
        );
    } catch {
      setMessage("Could not contact the extension's background recorder.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className='ghana-section' aria-label='Phone companion'>
      <div className='ghana-split'>
        <div>
          <p className='ghana-eyebrow'>YOUR MONITOR, ON YOUR PHONE</p>
          <h2>Phone companion</h2>
        </div>
        <span className='text-[12px] text-muted-foreground'>
          {value?.paired ? "Paired" : "Not connected"}
        </span>
      </div>
      <p className='ghana-muted'>
        No account or sign-in. Pair this computer once, then open its private link on your phone.
        The public site stays open, but your usage requires the link. Readings sync every 10 minutes
        while Chrome runs; your phone shows the last saved reading when the laptop is off.
      </p>
      {value?.paired ? (
        <>
          {value.lastSync ? (
            <p className='ghana-muted'>
              Last sent {new Date(value.lastSync).toLocaleString("en-GH")}.
            </p>
          ) : (
            <p className='ghana-muted'>Waiting for the first sync.</p>
          )}
          <div className='ghana-actions'>
            <button
              type='button'
              className='ghana-button ghana-primary'
              disabled={busy || !value.url}
              onClick={() => {
                if (!value.url) return;
                void navigator.clipboard
                  .writeText(value.url)
                  .then(() => setMessage("Private link copied. Send it to your phone."))
                  .catch(() => setMessage("Copy unavailable. Open the phone link below."));
              }}
            >
              Copy phone link
            </button>
            <button
              type='button'
              className='ghana-button'
              disabled={busy}
              onClick={() => void run("sync")}
            >
              Sync now
            </button>
            <button
              type='button'
              className='ghana-button'
              disabled={busy}
              onClick={() => void run("disconnect")}
            >
              Disconnect phone
            </button>
          </div>
          {value.url && (
            <a
              className='text-[12px] underline underline-offset-4'
              href={value.url}
              target='_blank'
              rel='noopener noreferrer'
            >
              Open my phone dashboard ↗
            </a>
          )}
        </>
      ) : (
        <div className='ghana-actions'>
          <button
            type='button'
            className='ghana-button ghana-primary'
            disabled={busy || value === null}
            onClick={() => void run("create")}
          >
            {busy ? "Connecting…" : "Connect my phone"}
          </button>
          <a
            className='ghana-button'
            href='https://starlink-ghana.vercel.app/live/'
            target='_blank'
            rel='noopener noreferrer'
          >
            View phone site
          </a>
        </div>
      )}
      {message && (
        <p role='status' className='ghana-muted'>
          {message}
        </p>
      )}
      <p className='ghana-muted'>
        Treat the pairing link like a private key. Anyone with a copy can see your uploaded
        summaries until you disconnect the phone here. No device names, account information or
        Starlink sign-in credentials are uploaded.
      </p>
    </section>
  );
}
