# Starlink Ghana 1.6.1 verification

Base: 4fe01a3. Patch: the 1.6.1 release commit containing this record. Node 24.19.0. Reviewed 11 October 2026.

- Existing full suite: 123 files, 1,280 tests passed. Command: `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/headless_shell npm test`.
- Chromium 134.0.6998.35 used locally because the pinned Chromium 149 download returned corrupt archives. CI uses the pinned browser independently.
- Cloud service v5 deployed in the existing project. `node scripts/test-phone-sync-backend.mjs` passed the real API/database round trip, metadata preservation, delayed-write rejection, capability separation, unknown key and revocation checks. Disposable pair removed in finally; household records untouched. Before the fix the metadata assertion failed as expected.
- Phone browser scenarios: `npm run build --prefix landing`, then `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/headless_shell node scripts/test-phone-ui.mjs`. Synthetic API fixtures; no private data. Verified old snapshot date, fragment removal, two recorder selection without adding totals, equal-cost GB comparison, synchronized period tabs, failed-refresh retention. Mobile screenshot inspected at 390×844.
- Lint, TypeScript and extension TypeScript checks passed. Chrome package build and store-readiness preflight passed.
- Independent read-only review found no release blocker in the main sync/cost changes. Minor first-pair/offline empty state remains navigable through the top status and nav controls.

## Limits

No direct LAN/hardware access. Cloud uploads show recent recording, not physical Windows uptime. Existing recorder snapshots lack computer labels until the extension is updated. Each paired computer has separate history; this release deliberately does not sum overlapping dish measurements. No historical data is reconstructed. Old zero-filled missing measurements cannot be distinguished from real zero use. Electricity estimates exclude router power, fixed ECG charges and levies; forecasts are not invoices. Local browser tests use a mocked API; backend tests use real persistence with disposable data. Physical extension upgrades and continued recording on the two computers require checking after in-place update.
