# Starlink Ghana Monitor privacy policy

**Last updated: 8 October 2026**

Starlink Ghana Monitor is an independent, open-source browser extension and website for monitoring compatible Starlink equipment and estimating costs in Ghana. It builds on Dishylink under the MIT licence. It is **not affiliated with or endorsed by Starlink or SpaceX**.

This policy describes **Starlink Ghana Monitor**, not the original Dishylink product.

## What the extension reads

While Google Chrome is running on a network where your Starlink dish and compatible router can be reached, the extension may automatically read: connection status, bandwidth and latency, power consumption, outages, obstruction information, router status and connected-device information (including device names, identifiers and network traffic). The extension saves readings, device preferences, Ghana cedi cost assumptions and notifications in its **local browser storage** for charts, history, budgets and cost calculations. It does not inspect the contents of websites you browse.

You may optionally grant access to a custom local router address or use the device's location for satellite positioning. If you use location, your browser provides it to the extension for the feature you requested. The satellite view can obtain public orbital data from CelesTrak. Local dish and router communications take place on your own network, which may use HTTP because of the equipment interface.

## Optional Starlink account connection

You can use local monitoring **without connecting a Starlink account**. If you choose to connect, the extension reads the existing `starlink.com` sign-in cookies from your browser to request your plan, billing-cycle, data-usage and account/device details **directly from Starlink**, and to perform supported account-authorised device or router actions you initiate or configure. Some controls can alter your network connectivity.

The extension saves only a connection preference in Chrome extension storage, rather than a permanent copy of Starlink authentication cookies. Account cookies are held temporarily in the extension's service-worker memory and may be applied to its own Starlink requests by a browser session network rule. The authentication cookies still exist in your normal Starlink browser session. Signing out from inside the extension disconnects its access but does not sign you out of the regular Starlink website.

**Important:** Account data may contain your name, email, service address, account identifier and subscription information. These details are used for the account features you request and are not uploaded to a Starlink Ghana Monitor server.

## Data transfers and third parties

- **Your Starlink dish/router:** local network reads and, when requested, configuration operations. These interfaces may use local HTTP.
- **Starlink (SpaceX):** optional signed-in account information, billing data and authorised commands exchanged directly with Starlink over HTTPS.
- **CelesTrak:** optional public satellite/orbit information requested to support the satellite view.
- **Cloudflare:** an on-demand speed test may exchange network traffic with Cloudflare's speed-test servers, exposing ordinary request metadata such as an IP address to that provider.
- **Starlink Ghana Monitor website and hosting:** optional update checks request a public version file. As with ordinary web visits, the hosting provider can process IP address, user agent and standard access-log metadata. Update checks do **not** send recorded network readings, device identifiers, Starlink cookies or account details.
- **GitHub:** optional download/update helpers contact GitHub to fetch published release files.

By default there is no Starlink Ghana Monitor cloud account, advertising tracker or telemetry ingestion service. **Optional phone companion:** If you explicitly choose “Connect my phone” inside the Chrome extension and the sync service has been configured, the extension uploads limited aggregated network traffic, energy, estimated cost, recording coverage and freshness information to a Supabase PostgreSQL database through our HTTPS endpoint approximately every ten minutes while Chrome runs. The separate public mobile page requires a long private pairing link to view these readings. This link is not a username/password; anyone who obtains a copy can view the synced summary until you disconnect it. The site stores a read capability locally on your phone. The database stores hashed pairing credentials, not Starlink account cookies or connected-device MAC addresses. If you have enabled phone pairing, the uploaded snapshots now include up to 16 ranked device display labels, room/group names, current-month router-based GB usage and proportional shares. These labels can contain personal names; revoke the pairing to delete the cloud snapshot. Disconnect from the extension to revoke the cloud pairing and remove its stored snapshot. The laptop’s local history remains. Synchronization is opt-in and is never silently enabled. We do not sell monitoring or account data.

## Public website and optional collector

The public website at [starlink-ghana.vercel.app](https://starlink-ghana.vercel.app/) is primarily a cost calculator. Its values are stored in that browser's local storage and are not automatically linked to the extension's IndexedDB history. If you voluntarily configure a separate local collector, the website can request readings from the collector address you provide; credentials for that connection remain in your browser's local storage. Do not expose an unprotected collector to the public internet.

## Backups, retention and deletion

Recording history remains in Chrome's extension IndexedDB; settings and connection preference remain in extension storage. Some detailed history is retained for a limited period and aggregated for longer-term comparison. Chrome may remove extension data when you uninstall it, clear site/extension storage or reset its browser profile.

You can export an optional JSON backup of selected aggregated history and settings. The file stays wherever you save it and can contain personal usage patterns, so store and share it carefully. Existing backup exports omit account credentials and per-device traffic counters. Disconnect the Starlink account from the extension to remove its connection preference. To erase saved monitor data, use Chrome's controls for the extension and its storage; export anything you wish to keep before uninstalling.

## Your choices and security

Chrome asks for extension permissions at installation or when a specific optional network address is required. Account connection, location-based features, notifications, speed tests, backups and update checks have user-facing controls. The extension has no advertising purpose. Network readings remain local unless you deliberately export or separately connect them to a collector.

We use data available through Chrome extension permissions only to provide or improve the monitor's user-facing features. **Use of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including its Limited Use requirements.** We do not use this information for targeted advertising or data brokering.

## Open source and support

Source code, licence notices, questions and privacy reports: [github.com/hayalows/starlink](https://github.com/hayalows/starlink) and [GitHub Issues](https://github.com/hayalows/starlink/issues). The original Dishylink MIT copyright and licence notices are retained in the repository; they do not mean that the original author operates this Ghana-specific extension.

We will update this policy before introducing material changes to collection, sharing or data handling.
