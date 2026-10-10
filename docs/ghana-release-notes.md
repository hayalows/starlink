Starlink Ghana Monitor 1.6.0 — history vault and recovery protection

- Add a private, separately enabled minute-by-minute history vault independent of Chrome IndexedDB. Reads and writes require the existing 256-bit phone pairing capability; uploads contain traffic/energy measurements only, never account credentials, MACs, device labels or browser history.
- Back up finalized minute records every ten minutes while Chrome is running. Send recent settled minutes even during initial history backfill; archive writes are append-only and cannot erase earlier remote history if local Chrome storage resets.
- Add Overview → History vault showing local/remote minute counts, latest archived timestamp, successful upload time, explicit opt-in, manual backup continuation, and a merge-only restore for missing minutes.
- Add an independent phone companion download of the private cloud archive as a validated Starlink backup JSON. Keep that file outside Chrome to recover after a profile or extension-ID loss.
- Restore by adding only missing verified timestamps; preserve new recordings, current collector cursor, settings and phone pairing. Never invent a minute from an old summary or screenshot.
- Accept observed 61–62 sample minute records during backup validation without truncating energy or traffic, and reject abnormal larger sample counts. Add regression tests for this behavior and settled-minute batching.
- Keep the current Chrome extension ID unchanged. Update in place by replacing files in the same installation folder and reloading the existing card. Never uninstall or clear browser data to update.
- Add a separate RLS-protected Supabase archive table and Edge Function. Cloud archival is optional and uses the existing free Supabase project; large histories consume quota and are not end-to-end encrypted.
- Do not claim full recovery of the October 1–9 readings. The October 8 CSV preserves real aggregates but cannot recreate absent minute measurements. The archive begins protecting minute records after it is enabled.

---

Starlink Ghana Monitor 1.5.3 — trustworthy cost and coverage explanations

- Fix monthly GH₵ per observed GB changing when Today, Week or Billing cycle is selected: all views now use the same month-wide forecast and measured monthly GB.
- Add a separate projected full-month GH₵/GB metric, clearly distinguishing a forecast-to-forecast comparison from partial recording. Neither is a metered Starlink charge.
- Explain daily coverage as a percentage of time elapsed today, and monthly coverage as a percentage of time elapsed this month. Show sampled hours instead of implying full-period measurements.
- Distinguish predicted spending against a budget from actual recorded GB against a personal target. Clarify the remaining daily data target and differing router/WAN counters.
- Label power/data predictions with evidence-based recording confidence, and explain how a GH₵500 subscription plus estimated dish electricity becomes the changing monthly total.
- Update the paired phone PWA's coverage, per-GB explanation and mobile bundle comparison to match the desktop's monthly mathematics.
- Add a compact estimate explainer, detailed early-month comparison and a small hidden Ground Control Easter egg in Overview.
- Keep personal data, pairing tokens, existing monitor history and the same extension ID unchanged. Existing installations should be updated in place, never removed.

---

Starlink Ghana Monitor 1.5.2 — mobile app and desktop-parity navigation

- Mobile companion is now an installable dark-theme PWA with Overview, Costs, Devices and Connection views. Adds a dedicated home screen manifest and network-first service worker caching only the public app shell, never account tokens, readings or API responses.
- Overview shows today's recorded GB, estimated cost today, month-end forecast, monthly traffic and measured monthly energy, matching desktop semantics.
- Effective Starlink cost per recorded GB and GB per cedi now appear with any positive observed monthly data rather than waiting for an arbitrary coverage percentage. Clear disclosure of partial-month observations remains.
- Phone detects obviously out-of-date daily fee allocations and directs owners to sync an updated extension instead of silently displaying inconsistent cost numbers.
- Adds discreet creator credit on desktop and phone. Existing pairing keys, history and Starlink login stay intact. Installation is an in-place extension update.

---

Starlink Ghana Monitor 1.5.1 — accurate phone costs and interactive usage insights.

- Phone and desktop extension now share the same subscription allocation and electricity forecast logic; auto-detected Mini defaults to 32.5 W rather than 50 W.
- Daily and seven-day plan cost is prorated over actual calendar months, including month-crossing periods. Historical meter gaps remain missing, not zero.
- Mobile phone chart bars show download, upload and kWh on tap or keyboard activation, plus observed busy periods.
- Phone now shows private top-device router usage shares, and a cost/GB vs a saved mobile-data bundle comparison.
- Extension Overview surfaces phone connection, monthly recorded energy and GH₵-per-GB value more prominently.
- Data-label privacy disclosures updated; pairings and existing history are preserved. Updating the unpacked extension in place is required; never uninstall the existing extension.

---

Starlink Ghana Monitor 1.5.0 — optional mobile companion and privately paired cloud sync.

- Pair a phone with a private capability link from the extension Overview; no traditional sign-in.
- New dark, responsive mobile dashboard at /live/ with recent network usage, energy, Ghana costs, and gap-aware charts.
- Optional ten-minute background sync while Chrome is running. It does not collect new readings when Chrome is stopped.
- The sync service uses an isolated table and Edge Function in the owner's existing free Supabase project. Pairing is protected by private capability links; see docs/phone-sync/README.md.
- Your previously working 1.4.1 local recording and backup functions are retained.

---

Starlink Ghana Monitor 1.4.1 — Chrome Web Store readiness and account privacy.

- Browser extension now persists only a connection preference, not a copy of your Starlink login cookies. Existing saved cookie strings are migrated when Chrome starts the updated extension.
- Clearer account sign-in wording and public privacy documentation specific to this Ghana project.
- Dedicated Store preflight for the built Chrome extension, permission explanations and publication checklist.
- Independent, unofficial project disclaimer on the website. The Chrome Web Store listing is not yet published.

---

Starlink Ghana Monitor 1.4 — clearer daily checks and safer updates.

- Four everyday screens: Overview, Costs, Devices and Connection. Technical tools remain under Advanced.
- Resumable three-step setup, Ghana dates/currency, readable controls and explicit loading, missing-history and stale-reading states.
- Your billing start day, including 29th–31st handling for short months. Import the start day from an already-connected Starlink account.
- Equal-elapsed-period comparisons with coverage safeguards, hourly today charts and an explanation of plan allocation versus electricity cost.
- Local device names and household groups, search, stable ordering and estimated group shares. No router configuration is changed by naming devices here.
- Optional 80%/100% calendar-month budget notifications, Ghana quiet hours and persistent repeat suppression. Uses saved recorder data; no new router polling.
- Downloadable history/settings backups, validation and a restore preview. Restore merges missing readings, preserves existing data and excludes the most recent 30 minutes. Credentials, controls and per-device traffic counters are not backed up.
- Optional daily update checks while Overview is open, release notes and one-click reload/reopen after files have been replaced.
- Windows PowerShell and macOS Terminal update helpers verify the published SHA-256 checksum, back up old extension files and replace files in the same installation folder.

## Update your existing unpacked extension

Export a backup in Overview. Download the ZIP, close the dashboard and replace files in the same folder you originally loaded. Reload the existing card at `chrome://extensions`, or reopen the dashboard and use “Reload monitor & reopen”. Keep the same folder and extension ID; do not remove the extension.

After this release is installed, future updates can use the helper in that folder: `Update-Starlink.ps1` in PowerShell on Windows, or `bash Update-Starlink.command` in Terminal on macOS. The helper keeps the old extension files in a sibling backup folder. Browser history remains in Chrome, so export a history backup separately.

The website updates on refresh. Chrome Web Store publication is still required for fully automatic installed extension updates. Cost shares and forecasts are estimates, not Starlink invoices or per-GB charges. Device totals and budget targets remain calendar-month based; Costs also supports your billing cycle. Comparisons may be unavailable across archived years or recording gaps.
