import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { isMonitorReleaseAtLeast, parseMonitorReleaseTag } from "../src/lib/releaseTags.mjs";
const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const phone = read("dist/live/index.html");
const publicHome = read("dist/index.html");
const mobileCss = read("public/phone-refine.css");
const sw = read("public/live/sw.js");
const iconCss = read("public/ui-icons.css");
assert.match(phone, /\/phone-refine\.css\?v=153/, "Missing updated PWA styling");
assert.match(phone, /\/ui-icons\.css\?v=153/, "Missing shared Untitled UI icon styles");
assert.match(phone, /\/live\/manifest\.webmanifest/, "Monitor manifest missing");
assert.equal((phone.match(/rel="manifest"/g) || []).length, 1, "PWA manifest duplicated");
assert.match(
  mobileCss,
  /@media\s*\(display-mode:\s*standalone\)/,
  "Standalone iOS layout not defined",
);
assert.match(mobileCss, /safe-area-inset-top/, "Dynamic Island / clock safe area not handled");
assert.match(mobileCss, /safe-area-inset-bottom/, "Home indicator safe area not handled");
assert.match(phone, /ui-icon--home-02/, "Phone navigation missing named Untitled UI icons");
assert.match(phone, /ui-icon--refresh-cw-01/, "Refresh button missing a real SVG icon");
for (const view of ["overview", "costs", "devices", "connection"]) {
  assert.ok(phone.includes('data-screen="' + view + '"'), "Missing " + view + " phone view");
}
assert.match(publicHome, /\/public-dark\.css\?v=153/, "Main website missing dark theme");
assert.match(
  publicHome,
  /\/public-dark-details\.css\?v=153/,
  "Main website missing companion panel styling",
);
assert.match(
  publicHome,
  /\/public-dark-contrast\.css\?v=153/,
  "Calculator dark contrast layer missing",
);
assert.match(
  read("public/public-dark-contrast.css"),
  /\.ghana-app h1/,
  "Calculator heading contrast missing",
);
assert.match(publicHome, /id="phone-companion"/, "Public phone companion entry is missing");
assert.match(publicHome, /data-release-download/, "Main extension download was removed");
assert.match(publicHome, /data-sample-tab/, "Interactive extension preview was removed");
assert.match(
  sw,
  /url\.pathname\.startsWith\("\/api\/"\)/,
  "SW may intercept private sync requests",
);
assert.ok(!sw.includes('"/api/monitor"'), "SW must never cache paired readings");
assert.ok(sw.includes("shell-153"), "Stale service worker cache");
for (const icon of [
  "home-02",
  "coins-01",
  "wifi",
  "layers-three-01",
  "refresh-cw-01",
  "download-01",
  "shield-01",
]) {
  assert.ok(
    existsSync(resolve(root, "dist/ui-icons/" + icon + ".svg")),
    "Missing icon asset " + icon,
  );
  assert.ok(iconCss.includes(icon), "Missing icon mapping " + icon);
}
// Both historically published release tag formats must work, and a stale
// GitHub API result must not downgrade the confirmed static download.
assert.equal(parseMonitorReleaseTag("monitor-v1.5.2-ecdc4d3")?.version, "v1.5.2");
assert.equal(parseMonitorReleaseTag("monitor-v1.5.3")?.version, "v1.5.3");
assert.equal(parseMonitorReleaseTag("monitor-v1.5.4-a1b2c3d")?.version, "v1.5.4");
assert.equal(parseMonitorReleaseTag("monitor-v1.5.3-invalid-tag"), null);
assert.equal(parseMonitorReleaseTag("v1.5.3"), null);
assert.ok(isMonitorReleaseAtLeast("monitor-v1.5.3", "monitor-v1.5.3"));
assert.ok(isMonitorReleaseAtLeast("monitor-v1.6.0-ab12cd3", "monitor-v1.5.3"));
assert.ok(!isMonitorReleaseAtLeast("monitor-v1.5.2-ecdc4d3", "monitor-v1.5.3"));
assert.ok(!isMonitorReleaseAtLeast("monitor-v1.5.3-unsafe/path", "monitor-v1.5.3"));

const bundledTags = [
  ...publicHome.matchAll(
    /https:\/\/github\.com\/hayalows\/starlink\/releases\/download\/(monitor-v[^/" ]+)\/starlink-ghana-monitor-chrome\.zip/g,
  ),
].map((match) => match[1]);
assert.ok(bundledTags.length >= 4, "Some static ZIP download links are missing");
assert.ok(
  bundledTags.every((tag) => tag === "monitor-v1.5.3"),
  "A ZIP points to an old release",
);
assert.match(publicHome, /data-release-version>v1\.5\.3/, "Release badge shows an old version");
assert.ok(!publicHome.includes("v1.5.2-ecdc4d3"), "Old release notes/download fallback found");
console.log(
  "PASS: dark site, PWA privacy, validated v1.5.3 download links and both release tag formats.",
);
