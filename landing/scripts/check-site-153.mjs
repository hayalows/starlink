import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
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
console.log(
  "PASS: dark public site, PWA safe areas, real icons, preserved app behavior, private-data caching guards.",
);
