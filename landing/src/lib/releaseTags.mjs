// GitHub releases have used both monitor-v1.5.2-ecdc4d3 and monitor-v1.5.3.
// Keep parsing independent of the browser, so the public site's download guard
// can be regression-tested without a live GitHub API or a running browser.

/**
 * @param {string} tag
 * @returns {{ version: string, numbers: [number, number, number] } | null}
 */
export function parseMonitorReleaseTag(tag) {
  if (typeof tag !== "string") return null;
  const match = /^monitor-v(\d+)\.(\d+)\.(\d+)(?:-[a-zA-Z0-9]+)?$/.exec(tag);
  if (!match) return null;
  const numbers = /** @type {[number, number, number]} */ (
    match.slice(1, 4).map(Number)
  );
  if (!numbers.every(Number.isSafeInteger)) return null;
  return { version: "v" + numbers.join("."), numbers };
}

/**
 * An API response must never replace a confirmed, bundled ZIP link with an
 * older release. The bundled fallback is kept in index.astro.
 * @param {string} candidateTag
 * @param {string} baselineTag
 */
export function isMonitorReleaseAtLeast(candidateTag, baselineTag) {
  const candidate = parseMonitorReleaseTag(candidateTag);
  const baseline = parseMonitorReleaseTag(baselineTag);
  if (!candidate || !baseline) return false;
  for (let i = 0; i < 3; i++) {
    if (candidate.numbers[i] > baseline.numbers[i]) return true;
    if (candidate.numbers[i] < baseline.numbers[i]) return false;
  }
  return true;
}
