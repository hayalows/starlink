# Starlink Ghana v1.5.3 — PWA & public product design

## What changed

**Problem:** On iPhone home-screen launch, a viewport that extends into the iOS status bar could place the app icon and refresh action under the clock or Dynamic Island. The old public site also mixed bright warm surfaces and dark monitoring surfaces, with inconsistent symbolic navigation glyphs.

**Primary tasks:** See trusted household readings quickly; inspect more details under Overview, Costs, Devices and Connection; install or update the extension from the public site.

- The PWA reserves its **real device safe-area inset** with a 44px fallback only in standalone display mode, plus bottom-inset protection around the thumb navigation. It retains edge-to-edge dark status-bar styling.
- Uses actual SVGs from **Untitled UI Icons FREE**, https://www.untitledui.com/resources/icons, as local assets / CSS masks. Application use is permitted by https://www.untitledui.com/license. The SVGs are used only in this app, not redistributed as an icon library.
- Color semantics align the public product with the paired phone: deep near-black page, charcoal surfaces, subdued mint for the primary action and positive status, restrained borders, no bright gold.
- Reuses the existing four-tab navigation, paired read token and data flows. The cost, energy, recording and device metrics have **not** been rewritten.
- Retains the laptop Chrome extension ZIP as the public page's primary action, with a dedicated phone-companion entry second.
- Adds a versioned PWA offline _shell_ only. /api requests and household data cannot be cached by the service worker.
- Uses patterns informed by useLayouts (segmented navigation, clear task regions) and Rare UI (small tactile interactions) rather than importing heavy animation libraries.
- Keeps keyboard focus, minimum comfortable tap targets, aria-hidden decorative icons and reduced-motion support.

## Verification / release gate

1. `npm ci && npm run build` inside `landing/`
2. `node scripts/check-site-153.mjs` to verify navigation, icons, manifest, status-bar padding, fixed download flow and SW privacy.
3. Full root CI (format, lint, TypeScript, extension build, test suite).
4. Confirm production commit + hostname in Vercel; check /, /live/, /live/manifest.webmanifest, /live/sw.js and the pairing API health.
5. On iPhone home screen, check the header **below** the Dynamic Island in portrait and landscape; check bottom nav above Home indicator; refresh, launch offline and restore online. Confirm existing paired data remains accessible. This physical-iPhone test requires the device owner and cannot be asserted from CI alone.

## Not changed

Pairing code, cloud backend, monthly plan/energy formulas, local IndexedDB/history, extension ID, Starlink account access or browser permissions.
