import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

// See vite.config.ts's own copy of this read for why it's done per-config
// rather than imported as a module.
const appVersion: string = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
).version;

// srcDir is the shared app tree so WXT's built-in `@`/`~` aliases point at ./src,
// exactly as the web build's do â€” the extension mounts the same src/App and its
// files import `@/â€¦`. The entrypoints live outside it, under ./extension, kept
// clear of the web/electron build in vite.config.ts; entrypointsDir points back
// there. publicDir stays WXT's default ./public (root-relative regardless of
// srcDir), so dish.protoset and oui.json still ship. core/ and cloud/ resolve
// through the @core/@cloud aliases below.
const entrypointsDir = fileURLToPath(new URL("./extension/entrypoints", import.meta.url));

// The extension collects only while the browser runs â€” chrome.alarms plus the
// dish's ~15-minute ring buffer â€” and shows honest coverage gaps for any closed
// stretch. Always-on collection is the Electron app's job, a separate product.
export default defineConfig({
  srcDir: "src",
  entrypointsDir,
  modules: ["@wxt-dev/module-react"],
  // The extension's own auto-imports scan srcDir; the shared app tree imports
  // everything explicitly, so leave WXT's magic auto-imp¶»§q«^