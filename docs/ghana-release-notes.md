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
