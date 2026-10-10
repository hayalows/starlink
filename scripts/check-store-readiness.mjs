// Run after build:extension. Google still controls approval and final review.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const build = join(root, ".output/chrome-mv3");
const manifest = JSON.parse(readFileSync(join(build, "manifest.json"), "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const privacy = readFileSync("PRIVACY.md", "utf8");
const cloud = readFileSync("extension/lib/cloudHandler.ts", "utf8");

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, pkg.version);
assert.equal(manifest.minimum_chrome_version, "144");
assert.ok(manifest.background?.service_worker, "Missing recorder service worker");
assert.ok(existsSync(join(build, "dashboard.html")), "Dashboard not packaged");
assert.ok(existsSync(join(build, "icon/128.png")), "128px icon missing");
const allowed = new Set([
  "alarms",
  "storage",
  "unlimitedStorage", // Reviewed: keep independent 14-day recovery mirror from hitting 10 MB limit.
  "cookies",
  "notifications",
  "declarativeNetRequestWithHostAccess",
  "geolocation",
]);
for (const p of manifest.permissions ?? []) {
  assert.ok(allowed.has(p), `Review new permission: ${p}`);
}
const hosts = new Set([
  "http://192.168.100.1/*",
  "http://192.168.1.1/*",
  "https://*.starlink.com/*",
  "https://celestrak.org/*",
  "https://starlink-ghana.vercel.app/*",
]);
for (const h of manifest.host_permissions ?? []) {
  assert.ok(hosts.has(h), `Review new required host: ${h}`);
}
assert.ok(
  (manifest.optional_host_permissions ?? []).every((h) => h === "http://*/*"),
  "Review optional network scope",
);
assert.ok(
  !/\[SESSION_KEY\]:\s*(?:cookie|captured|ourCookie)\b/.test(cloud),
  "Cookie values must never be stored as connection preference",
);
assert.ok(privacy.includes("Chrome Web Store User Data Policy"), "Limited Use disclosure missing");
assert.ok(existsSync("landing/src/pages/privacy.astro"), "Public privacy route missing");
console.log(
  "Chrome package preflight passed; real hardware and Store listing still require manual checks.",
);
