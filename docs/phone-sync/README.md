# Phone companion · Phases 1–2

No sign-in, account or subscription. The public site at **/live/** is open, but private household measurements are **not** public. Only someone who possesses the 256-bit read pairing token can read the monitor. A second distinct write token is held only by the laptop extension.

## Actual data flow

1. Chrome extension → Overview → **Phone companion** → **Connect my phone**.
2. Extension generates two random 256-bit tokens locally. The server stores their SHA-256 digests; it never receives Starlink account cookies or MAC addresses.
3. Extension sends compact energy, usage and plan-cost summaries roughly every 10 minutes while Chrome runs.
4. Copy the pairing link to an iPhone and open **/live/#pair=TOKEN**. Its fragment is immediately removed from the address bar and the reader token is saved in that phone browser's local storage.
5. The browser reads through the `GET /api/monitor?action=read` endpoint with an Authorization bearer token. The dashboard refreshes when opened and every minute, but **freshness is limited by the laptop's last upload**.
6. Disconnect on the laptop revokes both permissions by deleting that pairing record. Forget on the phone erases only its local read token.

The API should never be configured to return readings without verifying the read capability. The public page has **no login**; that does **not** mean it can reveal any household.

## How to activate the database

The existing Vercel project does not yet have `DATABASE_URL` set. To activate sync, connect a free Neon PostgreSQL project to **the existing Vercel starlink-ghana project** or set a server-only environment variable `DATABASE_URL` to Neon's pooled Postgres connection string (never put this value in GitHub or client code).

Run [001_phone_monitor.sql](001_phone_monitor.sql) in that Neon database's SQL editor, then redeploy the Vercel project.

No other paid service is needed, but free-tier capacity is limited. Avoid shortening the ten-minute upload interval without checking usage.

### Verify after provisioning

- Open `https://starlink-ghana.vercel.app/api/monitor?action=health` and confirm `configured:true`.
- From laptop: press Connect my phone, then Sync now. Creation and push must both succeed.
- Open the copied private link on iPhone; verify that it displays real totals with a last-synced timestamp.
- With Chrome closed, refresh the phone: it should display saved readings and stale status, **not** claim to be measuring live traffic.
- Try the read endpoint without a bearer token; expect 401.
- Disconnect the phone in the extension, refresh iPhone; expect pairing expiry.
- Restore local history from a backup if switching Chrome extension IDs. Pairing tokens are device-local and not in the existing backup.

## Security and privacy review

This is a **capability link**, not public anonymous access to household data. If the link is leaked, revoke it on the laptop. Do not paste the link into public chats, issue trackers or analytics. It is not transmitted as a URL query string or HTTP Referer by our UI. Upload only aggregated measurements; no device identifiers, locations, account data, login cookies or browsing history.

The create endpoint is intentionally unauthenticated for a zero-sign-in setup. Before wide distribution, enforce abuse protection or require a private server-side enrollment secret to avoid anonymous database exhaustion. For this personal setup, set a conservative maximum number of paired monitors and monitor free-tier consumption. Keep Neon credentials solely in Vercel's server environment.

## Product Design OS and component research

Sources reviewed: [Rare UI](https://rareui.com/components) (the correct site; **not** ReUI) and [useLayouts](https://uselayouts.com/).

Rare UI is a free React component collection, normally installed through shadcn. The phone companion is a statically rendered **Astro** site with lightweight JavaScript, so React components cannot simply be pasted directly without adding Astro's React integration, Motion and the individual dependencies. We audited ten actual Rare UI components and ten useLayouts patterns, and built lightweight task-focused equivalents where appropriate. **The twenty original React components have NOT been installed or copied as-is.** A follow-up React integration can faithfully reuse their source if that visual direction is essential, after functionality is verified.

| Rare UI component examined | Assessment for phone companion |
| --- | --- |
| Step player | Pairing steps; a static three-step instruction is clearer |
| OTP Input | Would fit a shorter one-time pairing code; unnecessary for current private URL |
| Animated counter | Use restrained value transitions when readings update; avoid fabricated increments |
| Task list | Useful for a setup checklist, not the normal dashboard |
| Notification bell | Could show genuinely delivered alerts; not implemented for cloud yet |
| Scroll Progress | Little value on a short mobile monitoring screen |
| Rail TOC | Better for long settings/help pages than three primary screens |
| Proximity Sidebar | Reference for desktop dashboard's navigation hierarchy |
| Hook Sidebar | Reference for desktop menu readability, not needed on phone |
| Delete button | Pattern for explicit disconnect/revoke with clear confirmation |

| useLayouts pattern examined | Assessment |
| --- | --- |
| Status Button | Clear and truthful last-sync status |
| AccordionOS | Advanced help/settings revealed on demand |
| Accessible Action | Explicit refresh and pairing actions |
| Theme Toggle | Not needed yet: this experience intentionally uses a dark theme |
| Confidential Folder | Reference for privacy-sensitive sections, not a real folder interface |
| Bucket | Could group collected summary items; unnecessary decoration avoided |
| 3D Book | Not appropriate for a data-monitoring screen |
| Polaroid Stack | Not appropriate for usage history |
| Photo Albums | Not appropriate for telemetry data |
| Get In Touch | Not appropriate to core monitoring tasks |

Actual implemented UI uses a dark editorial metrics grid, accessible tabs, status pills, gap-aware charts and plain pairing steps inspired by the **functional patterns**; never claim that original third-party component source was integrated. Product Design OS principles: brief time to first reading, understandable data freshness, accurate missing-data labels, responsive hierarchy, keyboard focus, and reduced motion.

## Known limitations

- Sync is not active until a Neon database is attached to Vercel and the SQL schema is installed.
- A phone cannot collect new LAN measurements when the laptop is off. It reads the latest uploaded snapshot.
- This version syncs summary history and estimates, not individual device names or account information.
- Do not mistake a 60-second phone refresh for a 60-second laptop recording or 10-minute upload schedule.
- If browser localStorage is cleared on the phone, the private link must be copied again from the extension.
