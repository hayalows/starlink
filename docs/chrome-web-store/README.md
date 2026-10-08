# Chrome Web Store release preparation

Prepared 8 October 2026. This is a publication brief, not Store approval.

## Listing copy

**Name:** Starlink Ghana Monitor

**Short description:** Independent tool for Starlink connection monitoring, Ghana electricity estimates and device usage.

**Suggested category:** Tools or Productivity.

**Long description:**

Starlink Ghana Monitor is an independent utility for people who use compatible Starlink equipment in Ghana. When Chrome is running on a computer connected to a reachable Starlink local network, it records available network performance, energy usage, interruptions and router traffic. Use Overview, Costs, Devices and Connection to understand recorded history and estimated Ghana cedi costs.

You can monitor local data without signing into a Starlink account. Connecting your account is optional and makes supported Starlink subscription, billing and router functions available. Costs are estimates, not electricity or internet invoices. There can be gaps when Chrome is closed or your computer is off. Hardware and firmware support vary.

Built using the open-source Dishylink project under its MIT licence. **Independent and not affiliated with, authorised by or endorsed by Starlink or SpaceX.** Requires desktop Chrome 144 or newer for live local readings.

**Website:** https://starlink-ghana.vercel.app/

**Privacy:** https://starlink-ghana.vercel.app/privacy/

**Support:** https://github.com/hayalows/starlink/issues

## Permissions justification

| Permission                            | Necessary functionality                                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `alarms`                              | Record local dish samples and check alert state while dashboard is closed.                            |
| `storage`                             | Persist settings, user opt-ins and alert state. History is in local IndexedDB.                        |
| `cookies`                             | Read an existing Starlink login only after an opt-in account connection.                              |
| `declarativeNetRequestWithHostAccess` | Attach that session to the extension's own authenticated Starlink requests; clear on disconnect.      |
| `notifications`                       | User-enabled outage and budget notifications.                                                         |
| `geolocation`                         | Optional satellite sky positioning when the user asks for it.                                         |
| `http://192.168.100.1/*`              | Local Starlink dish monitoring API.                                                                   |
| `http://192.168.1.1/*`                | Default Starlink router monitoring API.                                                               |
| `https://*.starlink.com/*`            | Optional login, subscription and supported account/device operations.                                 |
| `https://celestrak.org/*`             | Satellite orbit/positioning data.                                                                     |
| `https://starlink-ghana.vercel.app/*` | Public version check; it sends no recording history.                                                  |
| Optional `http://*/*`                 | User explicitly enters a nonstandard router IPv4 address; Chrome asks for that single origin on save. |

**Data practices:** Network/device identifiers and usage are processed locally. Optional Starlink account access processes authentication cookies, identity, service, plan and billing data and communicates directly with Starlink. User-requested satellite view, Cloudflare speed test, update check or GitHub release download may contact those providers and expose normal IP/request metadata. No advertising, data sale, browsing-history collection or automatic telemetry upload. Validate the final release ZIP before signing the Store declaration.

## Still required before submitting

- [x] Ghana-specific privacy policy in source and public website route.
- [x] Explanation of account cookies, local storage and third parties.
- [x] Save connection preference as boolean instead of an authentication cookie.
- [x] Migrate old saved cookies as soon as background worker starts.
- [x] Package permission and integrity preflight in automated CI/release workflow.
- [ ] Confirm the live privacy URL is deployed and matches the current release.
- [ ] Test real Chrome 144+ against Starlink equipment, including startup/background collection, account sign-in/out, fresh install and v1.4.0 migration.
- [ ] Review existing visual assets for third-party logos/trademarks and licence rights.
- [ ] Capture actual extension UI screenshots (1280x800 or 640x400) without exposing real MACs, account IDs or personal data.
- [ ] Produce independent 128x128 logo and 440x280 promo tile; do not present a mockup as a genuine screenshot.
- [ ] Register and verify publisher account; add real contact/support and complete Google Privacy tab.
- [ ] Submit Store ZIP for review, initially via private testing if useful.
- [ ] Back up and restore local history when moving from unpacked to Chrome Web Store installation.

Run `npm ci && npm run build:extension && node scripts/check-store-readiness.mjs && npm run zip:extension`. The produced ZIP must be uploaded via the publisher's Chrome Web Store account; pushing to GitHub alone does not publish the Store item.
