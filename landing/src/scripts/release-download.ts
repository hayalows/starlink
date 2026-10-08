// The release label and ZIP link always come from the same GitHub release.
// A pinned, verified package in HTML remains available if the GitHub API is offline.
type GithubRelease = {
  tag_name?: string;
  published_at?: string;
  html_url?: string;
  assets?: Array<{ name?: string; size?: number; browser_download_url?: string }>;
};

const ZIP_NAME = "starlink-ghana-monitor-chrome.zip";
const KNOWN_BASE = "https://github.com/hayalows/starlink/releases/download/";
const RELEASES_URL = "https://github.com/hayalows/starlink/releases";
const releaseLabels = document.querySelectorAll<HTMLElement>("[data-release-version]");
const releaseDownloads = document.querySelectorAll<HTMLAnchorElement>("[data-release-download]");
const releaseNotes = document.querySelectorAll<HTMLAnchorElement>("[data-release-notes]");
const releaseFeedback = document.querySelector<HTMLElement>("[data-release-feedback]");

async function syncRelease() {
  try {
    const response = await fetch("https://api.github.com/repos/hayalows/starlink/releases/latest", {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error("Release check unavailable");
    const release = (await response.json()) as GithubRelease;
    const tag = release.tag_name ?? "";
    const match = /^monitor-v(\d+\.\d+\.\d+)-[a-zA-Z0-9]+$/.exec(tag);
    const asset = release.assets?.find((entry) => entry.name === ZIP_NAME);
    const packageUrl = asset?.browser_download_url ?? "";
    const expectedUrl = KNOWN_BASE + encodeURIComponent(tag) + "/" + ZIP_NAME;
    if (!match || packageUrl !== expectedUrl || !asset?.size || asset.size <= 0) {
      throw new Error("Release has no verified Chrome package");
    }

    const version = "v" + match[1];
    releaseLabels.forEach((label) => { label.textContent = version; });
    releaseDownloads.forEach((link) => {
      link.href = packageUrl;
      link.setAttribute("aria-label", "Download Starlink Ghana Monitor " + version + " for Chrome (ZIP)");
    });
    releaseNotes.forEach((link) => { link.href = release.html_url?.startsWith(RELEASES_URL + "/tag/") ? release.html_url : RELEASES_URL; });
    document.querySelectorAll<HTMLElement>("[data-release-size]").forEach((label) => {
      label.textContent = (asset.size! / 1_000_000).toFixed(1) + " MB ZIP";
    });
    if (release.published_at && Number.isFinite(Date.parse(release.published_at))) {
      document.querySelectorAll<HTMLElement>("[data-release-date]").forEach((label) => {
        label.textContent = new Date(release.published_at!).toLocaleDateString("en-GH", {
          day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Accra",
        });
      });
    }
    if (releaseFeedback) releaseFeedback.textContent = "Latest published Chrome ZIP verified against the GitHub release.";
  } catch {
    // Keep the specific release linked and named in static HTML, not a
    // vague "latest" URL whose contents could differ from the displayed version.
    if (releaseFeedback) releaseFeedback.textContent =
      "Showing the verified v1.4.0 package. Check GitHub releases for newer versions.";
    const link = document.createElement("a");
    link.href = RELEASES_URL;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "All releases ↗";
    releaseFeedback?.append(" ", link);
  }
}
void syncRelease();

// Demo-only preview: no Starlink telemetry or invented live connection.
const sampleTabs = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-sample-tab]"));
const samplePanels = Array.from(document.querySelectorAll<HTMLElement>("[data-sample-panel]"));
function activateSample(tab: HTMLButtonElement) {
  const selected = tab.dataset.sampleTab;
  sampleTabs.forEach((item) => {
    const active = item === tab;
    item.setAttribute("aria-selected", String(active));
    item.tabIndex = active ? 0 : -1;
  });
  samplePanels.forEach((panel) => {
    const active = panel.dataset.samplePanel === selected;
    panel.hidden = !active;
    panel.classList.remove("sample-enter");
    if (active && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Restart the short transition when a visitor chooses another panel.
      void panel.offsetWidth;
      panel.classList.add("sample-enter");
    }
  });
}
sampleTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => activateSample(tab));
  tab.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const destination = event.key === "Home" ? 0 : event.key === "End" ? sampleTabs.length - 1 :
      (index + (event.key === "ArrowRight" ? 1 : -1) + sampleTabs.length) % sampleTabs.length;
    const next = sampleTabs[destination];
    activateSample(next);
    next.focus();
  });
});
