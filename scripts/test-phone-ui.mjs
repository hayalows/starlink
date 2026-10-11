// Real browser/UI, synthetic API fixtures; no hardware or household data.
// npm run dev --prefix landing -- --host 127.0.0.1
// PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome node scripts/test-phone-ui.mjs
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const name = url.pathname.endsWith("/") ? url.pathname + "index.html" : url.pathname;
  const path = resolve("landing/dist", "." + name);
  if (!path.startsWith(resolve("landing/dist") + "/")) {
    res.writeHead(403).end();
    return;
  }
  try {
    const content = await readFile(path);
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
      }[extname(path)] || "application/octet-stream",
    );
    res.end(content);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = process.env.PHONE_UI_URL || "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const tokenA = "a".repeat(43),
  tokenB = "b".repeat(43);
const now = Date.now();
const day = Math.floor(now / 86400000) * 86400;
const period = (gb, start = day) => ({
  gb,
  kWh: 0.1,
  coverage: 0.8,
  trafficCoverage: 0.8,
  sampledSeconds: 90000,
  trafficSeconds: 90000,
  cost: 5,
  electricityCost: 1,
  planAllocation: 4,
  projectedCost: 550,
  forecastGb: 1000,
  window: { start, end: start + 3600 },
  buckets: [{ t: start, gb, downGB: gb, upGB: 0, kWh: 0.1 }],
});
const payload = (b) => ({
  updatedAt: new Date(now).toISOString(),
  snapshot: {
    version: 1,
    calculationVersion: 3,
    recorderLabel: b ? "Windows recorder" : "Mac recorder",
    recordedAt: now,
    latestSampleAt: now / 1000,
    collectorOk: true,
    planFee: 500,
    bundle: { price: 399, gb: 240 },
    periods: Object.fromEntries(
      ["today", "week", "month", "cycle"].map((id) => [
        id,
        period(b ? 20 : 10, b ? day : day - 86400),
      ]),
    ),
  },
});
let fail = false;
await page.route("**/api/monitor?*", async (route) => {
  if (fail) return route.fulfill({ status: 503, json: { error: "sync_unavailable" } });
  await route.fulfill({ json: payload(route.request().headers().authorization?.endsWith(tokenB)) });
});
await page.route("**/api/archive?*", (route) =>
  route.fulfill({ json: { count: 0, downloadable: false } }),
);
try {
  await page.goto(base + "/live/#pair=" + tokenA, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.getElementById("hero-gb").textContent === "10.00");
  assert.ok(!(await page.locator("#hero-period-label").innerText()).includes("today"));
  assert.equal(await page.evaluate(() => location.hash), "");
  await page.locator('[data-view="connection"]').last().click();
  await page.locator("#add-monitor").click();
  await page.locator("#pair-code").fill(tokenB);
  await page.locator("#pair-form button").click();
  await page.waitForFunction(() => document.getElementById("hero-gb").textContent === "20.00");
  assert.equal(await page.locator("#recorder-select option").count(), 2);
  assert.equal(await page.locator("#hero-period-label").innerText(), "Data recorded today");
  await page.locator('[data-view="costs"]').last().click();
  assert.ok((await page.locator("#break-even-note").innerText()).includes("330.8 GB"));
  await page.locator('[data-screen="costs"] [data-period="month"]').click();
  assert.equal(await page.locator('[data-period="month"][aria-selected="true"]').count(), 2);
  await page.locator("#recorder-select").selectOption("0");
  await page.waitForFunction(() => document.getElementById("hero-gb").textContent === "10.00");
  fail = true;
  await page.locator("#phone-refresh").click();
  await page.waitForFunction(
    () => document.getElementById("sync-badge").textContent === "Sync temporarily unavailable",
  );
  assert.equal(await page.locator("#hero-gb").innerText(), "10.00");
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "/tmp/starlink-phone-mobile.png", fullPage: true });
  console.log(
    "PASS: dated snapshots, private fragment cleared, two recorder selection, no combined totals, break-even calculation, synchronized tabs, failed refresh retains evidence; Chromium " +
      browser.version(),
  );
} catch (error) {
  console.error("Browser errors", errors);
  throw error;
} finally {
  await browser.close();
  server.closeAllConnections();
  server.close();
}
