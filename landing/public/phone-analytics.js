/* Private, read-only Starlink analytics. All source data comes from the user's
 * authenticated archive; nothing private is written to a public cache. */
(() => {
  const root = document.getElementById("analytics-graph");
  if (!root) return;
  const $ = (id) => document.getElementById(id);
  const DAY = 86400;
  const WEEK = 604800;
  const svgNS = "http://www.w3.org/2000/svg";
  const store = {
    token: "", range: "7d", metric: "total", zoomDay: null, selected: null,
    from: 0, to: 0, grain: "day", points: [], asOf: 0, bounds: null,
    lastFetch: 0, activeRequest: 0, loading: false, snapshot: null,
  };
  const today = () => Math.floor(Date.now() / (DAY * 1000)) * DAY;
  const dateKey = (unix) => new Date(unix * 1000).toISOString().slice(0, 10);
  const humanDate = (unix, full = false) => new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", day: "numeric", month: "short", ...(full ? { year: "numeric" } : {}),
  }).format(new Date(unix * 1000));
  const hourName = (unix) => new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(unix * 1000));
  const num = (value, digits = 2) => Number.isFinite(value)
    ? value.toLocaleString("en-GH", { maximumFractionDigits: digits, minimumFractionDigits: digits })
    : "—";
  const safeNumber = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
  const totalGB = (row) => row && safeNumber(row.downGB) !== null && safeNumber(row.upGB) !== null
    ? row.downGB + row.upGB : null;
  const valueFor = (row) => !row ? null : store.metric === "energy" ? safeNumber(row.kWh)
    : store.metric === "down" ? safeNumber(row.downGB)
      : store.metric === "up" ? safeNumber(row.upGB) : totalGB(row);
  const unit = () => store.metric === "energy" ? "kWh" : "GB";
  const metricName = () => ({ total: "Total data", down: "Downloaded", up: "Uploaded", energy: "Dish energy" })[store.metric];
  const labelFor = (unix) => store.grain === "hour" ? hourName(unix) : store.grain === "week"
    ? humanDate(unix) + " week" : humanDate(unix);
  const set = (id, value) => { const node = $(id); if (node) node.textContent = value; };
  function setMessage(message, error = false) {
    const node = $("analytics-message");
    node.textContent = message;
    node.dataset.error = String(error);
  }
  function rangeInfo() {
    const now = today();
    const to = now + DAY;
    if (store.zoomDay !== null) return {
      from: store.zoomDay, to: store.zoomDay + DAY, grain: "hour",
      title: "Hourly activity · " + humanDate(store.zoomDay, true),
    };
    if (store.range === "today") return { from: now, to, grain: "hour", title: "Today · hourly" };
    if (store.range === "7d") return { from: now - 6 * DAY, to, grain: "day", title: "Last 7 days" };
    if (store.range === "30d") return { from: now - 29 * DAY, to, grain: "day", title: "Last 30 days" };
    if (store.range === "month") return {
      from: Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1) / 1000,
      to, grain: "day", title: "This month",
    };
    if (store.range === "custom") {
      const from = Date.parse($("analytics-from").value + "T00:00:00Z") / 1000;
      const last = Date.parse($("analytics-to").value + "T00:00:00Z") / 1000;
      const span = last + DAY - from;
      return { from, to: last + DAY, grain: span > 366 * DAY ? "week" : "day",
        title: humanDate(from, true) + " – " + humanDate(last, true) };
    }
    const earliest = Number.isFinite(store.bounds?.oldest) ? store.bounds.oldest : now - 6 * DAY;
    const from = Math.max(0, Math.floor(earliest / DAY) * DAY);
    const span = to - from;
    return { from, to, grain: span > 366 * DAY ? "week" : "day",
      title: "All archived history" };
  }
  function renderPreset() {
    document.querySelectorAll("[data-analysis-range]").forEach((button) => {
      const active = button.dataset.analysisRange === store.range;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    $("analytics-custom").hidden = store.range !== "custom";
    $("analytics-back").hidden = store.zoomDay === null;
    document.querySelectorAll("[data-analysis-metric]").forEach((button) => {
      const active = button.dataset.analysisMetric === store.metric;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  async function ensureBounds(token) {
    if (store.bounds) return;
    const response = await fetch("/api/archive?action=summary", {
      headers: { Authorization: "Bearer " + token }, cache: "no-store",
      credentials: "omit", signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error("The private history archive could not be checked.");
    const data = await response.json();
    if (store.token !== token) return;
    store.bounds = data;
  }
  async function load(force = false) {
    const token = store.token;
    if (!token) return;
    if (!force && store.lastFetch && Date.now() - store.lastFetch < 45000) return;
    const requestId = ++store.activeRequest;
    store.loading = true;
    root.setAttribute("aria-busy", "true");
    setMessage("Loading saved minute history…");
    set("analytics-graph-summary", "Reading the private archive…");
    try {
      if (store.range === "all" && store.zoomDay === null) await ensureBounds(token);
      if (token !== store.token || requestId !== store.activeRequest) return;
      const info = rangeInfo();
      const span = info.to - info.from;
      if (!Number.isSafeInteger(info.from) || !Number.isSafeInteger(info.to) || span <= 0 ||
          span > 5 * 366 * DAY || (info.grain === "hour" && span > 45 * DAY) ||
          (info.grain === "day" && span > 366 * DAY))
        throw Error("Choose a valid date range of at most five years.");
      const params = new URLSearchParams({
        action: "analytics", from: String(info.from), to: String(info.to), grain: info.grain,
      });
      const response = await fetch("/api/archive?" + params, {
        headers: { Authorization: "Bearer " + token }, cache: "no-store", credentials: "omit",
        signal: AbortSignal.timeout(20000),
      });
      if (token !== store.token || requestId !== store.activeRequest) return;
      if (!response.ok) {
        if (response.status === 401 || response.status === 404)
          throw Error("The pairing is no longer authorized. Reconnect from the extension.");
        throw Error("Could not load the archive (" + response.status + "). Retry when connected.");
      }
      const report = await response.json();
      if (!Array.isArray(report.rows)) throw Error("The archive returned an incomplete report.");
      store.from = info.from;
      store.to = info.to;
      store.grain = info.grain;
      store.asOf = report.asOf || Date.now();
      store.points = fillBuckets(report.rows, info);
      store.lastFetch = Date.now();
      if (!store.points.some((p) => p.minutes > 0)) store.selected = null;
      else if (!store.points.some((p) => p.t === store.selected && p.minutes > 0))
        store.selected = [...store.points].reverse().find((p) => p.minutes > 0)?.t ?? null;
      render();
      setMessage("Showing privately archived measurements. Refresh the monitor for newly uploaded readings. No-reading periods are not zero usage.");
    } catch (error) {
      if (token !== store.token || requestId !== store.activeRequest) return;
      setMessage(error instanceof Error ? error.message : "Could not load your history.", true);
      set("analytics-graph-summary", "History unavailable. Your existing overview and computer recordings are unaffected.");
      root.replaceChildren();
      $("analytics-history").replaceChildren();
    } finally {
      if (requestId === store.activeRequest) {
        store.loading = false;
        root.removeAttribute("aria-busy");
      }
    }
  }
  function fillBuckets(raw, info) {
    const map = new Map(raw.filter((r) => Number.isSafeInteger(Number(r.t)))
      .map((r) => [Number(r.t), r]));
    const points = [];
    const nowSec = Date.now() / 1000;
    const step = info.grain === "hour" ? 3600 : info.grain === "week" ? WEEK : DAY;
    const beginning = info.grain === "week" ?
      Math.floor((info.from + 259200) / WEEK) * WEEK - 259200 :
      Math.floor(info.from / step) * step;
    for (let t = beginning; t < info.to && t <= nowSec; t += step) {
      const end = Math.min(info.to, t + step, nowSec);
      const expected = Math.max(0, end - Math.max(t, info.from));
      if (expected <= 0) continue;
      const row = map.get(t);
      points.push({
        t, minutes: Math.max(0, Number(row?.minutes) || 0),
        sampledSeconds: Math.max(0, Number(row?.sampledSeconds) || 0),
        downGB: row ? safeNumber(row.downGB) : null,
        upGB: row ? safeNumber(row.upGB) : null,
        kWh: row ? safeNumber(row.kWh) : null,
        peakMbps: row ? safeNumber(row.peakMbps) : null,
        expectedSeconds: expected,
      });
    }
    return points;
  }
  function coverage(point) {
    return point.expectedSeconds > 0
      ? Math.min(100, Math.round(100 * point.sampledSeconds / point.expectedSeconds)) : null;
  }
  const svg = (tag, attrs = {}) => {
    const node = document.createElementNS(svgNS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  };
  function draw() {
    root.replaceChildren();
    const points = store.points;
    if (!points.length) {
      const blank = document.createElement("p");
      blank.className = "analytics-no-data";
      blank.textContent = "No archived readings in this date range. Try a different range or enable the history vault on your computer.";
      root.append(blank);
      return;
    }
    const max = Math.max(0.00001, ...points.map((p) => valueFor(p) || 0));
    const n = points.length;
    const width = Math.max(340, n * (n > 120 ? 11 : n > 40 ? 17 : 30));
    const height = 254, left = 43, right = 12, top = 20, bottom = 38;
    const plotW = width - left - right, plotH = height - top - bottom;
    const x = (i) => left + (n === 1 ? plotW / 2 : i * plotW / (n - 1));
    const y = (v) => top + plotH - (v / max) * plotH;
    const graph = svg("svg", { viewBox: "0 0 " + width + " " + height,
      width, height, role: "img",
      "aria-label": metricName() + " by " + store.grain + ". Swipe sideways or select the rows below for exact values." });
    for (let i = 0; i <= 4; i++) {
      const lineY = top + plotH * i / 4;
      graph.append(svg("line", { x1: left, x2: width - right, y1: lineY, y2: lineY,
        stroke: "#35413f", "stroke-dasharray": "3 5", "stroke-width": 1 }));
      const label = svg("text", { x: left - 8, y: lineY + 4, "text-anchor": "end",
        fill: "#a9beb4", "font-size": 10 });
      label.textContent = num(max * (4 - i) / 4, max > 10 ? 0 : 1);
      graph.append(label);
    }
    let segment = [];
    function finishSegment() {
      if (!segment.length) return;
      const coords = segment.map(([i, v]) => [x(i), y(v)]);
      const firstX = coords[0][0], lastX = coords[coords.length - 1][0];
      const area = ["M", firstX, top + plotH, "L", ...coords[0]];
      for (const p of coords.slice(1)) area.push("L", ...p);
      area.push("L", lastX, top + plotH, "Z");
      graph.append(svg("path", { d: area.join(" "),
        fill: "#abcdbb", "fill-opacity": "0.10", stroke: "none" }));
      graph.append(svg("path", { d: coords.map((p, i) => (i ? "L " : "M ") + p[0] + " " + p[1]).join(" "),
        fill: "none", stroke: "#bce5c9", "stroke-width": 2.5,
        "stroke-linejoin": "round", "stroke-linecap": "round" }));
      segment = [];
    }
    points.forEach((point, i) => {
      const v = valueFor(point);
      if (v === null || point.minutes === 0) {
        finishSegment();
        graph.append(svg("line", { x1: x(i), x2: x(i), y1: top + 18, y2: top + plotH,
          stroke: "#66736e", "stroke-dasharray": "2 7", "stroke-width": 1, opacity: 0.45 }));
      } else segment.push([i, v]);
    });
    finishSegment();
    // Sparse labels prevent overlapping text when viewing several months.
    const every = Math.max(1, Math.ceil(n / Math.max(3, width / 80)));
    points.forEach((point, i) => {
      const v = valueFor(point), active = store.selected === point.t;
      if (i % every === 0 || i === n - 1) {
        const label = svg("text", { x: x(i), y: height - 11, fill: "#9aada4",
          "font-size": 10, "text-anchor": "middle" });
        label.textContent = store.grain === "hour" ? hourName(point.t).replace(":00", "") :
          store.grain === "week" ? humanDate(point.t) : (n > 35 ? dateKey(point.t).slice(5) : humanDate(point.t));
        graph.append(label);
      }
      if (v !== null && point.minutes > 0 && (n <= 36 || active)) {
        graph.append(svg("circle", { cx: x(i), cy: y(v), r: active ? 5 : 2.5,
          fill: active ? "#ffffff" : "#c3e7ce", stroke: "#1f392b", "stroke-width": 1 }));
      }
      if (active) graph.append(svg("line", {
        x1: x(i), x2: x(i), y1: top, y2: top + plotH,
        stroke: "#deebe0", "stroke-dasharray": "3 5", "stroke-width": 1.1,
      }));
      const slot = n === 1 ? plotW : plotW / (n - 1);
      const hit = svg("rect", { x: Math.max(left, x(i) - slot / 2), y: top,
        width: Math.min(slot, width - right - Math.max(left, x(i) - slot / 2)),
        height: plotH, fill: "transparent", tabindex: "0", role: "button",
        "aria-label": labelFor(point.t) + ": " + (v === null ? "no recorded " + metricName().toLowerCase() : num(v) + " " + unit()),
        "aria-pressed": String(active) });
      hit.addEventListener("click", () => select(point.t));
      hit.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(point.t); }
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          const next = points[Math.min(n - 1, Math.max(0, i + (event.key === "ArrowRight" ? 1 : -1)))];
          select(next.t, false);
          graph.querySelectorAll('rect[role="button"]')[points.indexOf(next)]?.focus();
        }
      });
      graph.append(hit);
    });
    root.append(graph);
    const selectedNode = graph.querySelector('rect[aria-pressed="true"]');
    if (selectedNode && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const scrollToX = points.findIndex((p) => p.t === store.selected) * (plotW / Math.max(1, n - 1));
      if (store.selected !== null && !store.zoomDay) root.scrollLeft = Math.max(0, scrollToX - root.clientWidth / 2);
    }
  }
  function select(t, scroll = false) {
    store.selected = t;
    draw();
    renderPoint();
    renderRows();
    if (scroll) $("analytics-point").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function renderPoint() {
    const point = store.points.find((p) => p.t === store.selected);
    if (!point) { set("analytics-point", "Choose a recorded point to see its details."); return; }
    const header = labelFor(point.t);
    const cov = coverage(point);
    if (!point.minutes) {
      set("analytics-point", header + " · No stored readings. This is a recording gap, not proof of zero traffic or an outage.");
      return;
    }
    set("analytics-point",
      header + " · " + num(totalGB(point)) + " GB recorded (" +
      num(point.downGB) + " down / " + num(point.upGB) + " up) · " +
      num(point.kWh, 3) + " kWh · " + point.minutes + " min measured · " +
      (cov === null ? "coverage unknown" : cov + "% observed") +
      (point.peakMbps === null ? "" : " · Peak minute " + num(point.peakMbps, 1) + " Mbps"));
  }
  function renderRows() {
    const holder = $("analytics-history");
    holder.replaceChildren();
    for (const point of [...store.points].reverse()) {
      const entry = document.createElement("div");
      entry.className = "analytics-history-row";
      entry.setAttribute("role", "listitem");
      const button = document.createElement("button");
      button.type = "button";
      if (store.selected === point.t) button.classList.add("is-active");
      const left = document.createElement("span");
      left.className = "analytics-row-title";
      const title = document.createElement("strong");
      title.textContent = labelFor(point.t);
      const detail = document.createElement("small");
      detail.textContent = point.minutes
        ? point.minutes + " measured min · " + coverage(point) + "% covered"
        : "No saved observation";
      left.append(title, detail);
      const right = document.createElement("span");
      right.className = "analytics-row-value";
      const v = document.createElement("strong");
      v.textContent = point.minutes ? num(totalGB(point)) + " GB" : "—";
      const e = document.createElement("small");
      e.textContent = point.minutes ? num(point.kWh, 3) + " kWh" : "Gap / not yet recorded";
      right.append(v, e);
      button.append(left, right);
      button.addEventListener("click", () => {
        if (store.grain === "day" && point.minutes > 0) {
          store.zoomDay = point.t;
          store.selected = null;
          renderPreset();
          void load(true);
        } else select(point.t, true);
      });
      entry.append(button);
      holder.append(entry);
    }
  }
  function render() {
    renderPreset();
    const points = store.points;
    const observed = points.filter((p) => p.minutes > 0);
    const sum = (field) => {
      const known = observed.filter((p) => Number.isFinite(p[field]));
      return known.length ? known.reduce((s, p) => s + p[field], 0) : null;
    };
    const down = sum("downGB"), up = sum("upGB"), energy = sum("kWh");
    const total = down === null || up === null ? null : down + up;
    set("analytics-total", total === null ? "—" : num(total) + " GB");
    set("analytics-down", down === null ? "—" : num(down) + " GB");
    set("analytics-up", up === null ? "—" : num(up) + " GB");
    set("analytics-energy", energy === null ? "—" : num(energy, 3) + " kWh");
    const covered = points.reduce((n, p) => n + Math.min(p.expectedSeconds, p.sampledSeconds), 0);
    const expected = points.reduce((n, p) => n + p.expectedSeconds, 0);
    const pct = expected > 0 ? Math.round(100 * covered / expected) : null;
    set("analytics-coverage", pct === null ? "—" : pct + "%");
    set("analytics-coverage-note", observed.length + " measured " + store.grain +
      (observed.length === 1 ? "" : " buckets") + " · " + Math.round(covered / 60).toLocaleString() +
      " saved minutes of " + Math.round(expected / 60).toLocaleString() +
      ". Missing minutes are excluded from totals.");
    const peak = observed.reduce((best, p) => p.peakMbps != null && (!best || p.peakMbps > best.peakMbps) ? p : best, null);
    set("analytics-peak", peak ? num(peak.peakMbps, 1) + " Mbps" : "—");
    set("analytics-peak-note", peak ? "Highest one-minute average · in " + labelFor(peak.t) : "Not enough recorded traffic.");
    const share = total > 0 && down !== null && up !== null ? Math.round(100 * down / total) : null;
    const barDown = $("analytics-mix").querySelector(".analytics-mix-down");
    const barUp = $("analytics-mix").querySelector(".analytics-mix-up");
    barDown.style.width = share == null ? "0%" : share + "%";
    barUp.style.width = share == null ? "0%" : 100 - share + "%";
    set("analytics-down-share", share === null ? "Download —" : "Download " + share + "%");
    set("analytics-up-share", share === null ? "Upload —" : "Upload " + (100 - share) + "%");
    const info = rangeInfo();
    set("analytics-scope", info.title + " · Ghana time (GMT) · Recorded measurements only");
    set("analytics-grain-label", store.grain.toUpperCase());
    set("analytics-trend-title", metricName() + " over time");
    set("analytics-graph-summary",
      observed.length ? num(sum(store.metric === "energy" ? "kWh" : store.metric === "down" ? "downGB" : store.metric === "up" ? "upGB" : "downGB") +
        (store.metric === "total" ? (up || 0) : 0), store.metric === "energy" ? 3 : 2) +
        " " + unit() + " recorded · " + (pct ?? 0) + "% time coverage" :
        "No stored readings within this range");
    set("analytics-chart-help", store.grain === "day" ? "Select a chart point for details, or tap a day below to inspect its hours." :
      store.grain === "hour" ? "Tap an hour to inspect its usage." :
      "Tap a week to inspect its readings.");
    set("analytics-history-title", store.grain === "hour" ? "Hourly record" :
      store.grain === "week" ? "Weekly record" : "Daily record");
    draw();
    renderPoint();
    renderRows();
  }
  function clear() {
    store.activeRequest++;
    store.token = "";
    store.points = [];
    store.bounds = null;
    store.selected = null;
    store.lastFetch = 0;
    store.snapshot = null;
    root.replaceChildren();
    $("analytics-history").replaceChildren();
    set("analytics-graph-summary", "Connect a recorder to view its private history.");
  }
  function open(token, snapshot) {
    if (!token) return;
    if (store.token !== token) {
      clear();
      store.token = token;
      store.zoomDay = null;
      store.selected = null;
    }
    store.snapshot = snapshot;
    renderPreset();
    void load();
  }
  function refresh(token, snapshot) {
    if (!token || store.token !== token) return;
    store.snapshot = snapshot;
    if (document.querySelector('[data-screen="analytics"]')?.hidden === false) void load(true);
  }
  document.querySelectorAll("[data-analysis-range]").forEach((button) => button.addEventListener("click", () => {
    const next = button.dataset.analysisRange;
    if (next === "custom") {
      store.range = "custom";
      store.zoomDay = null;
      renderPreset();
      $("analytics-from").focus();
      return;
    }
    store.range = next;
    store.zoomDay = null;
    store.selected = null;
    store.lastFetch = 0;
    renderPreset();
    void load(true);
  }));
  document.querySelectorAll("[data-analysis-metric]").forEach((button) => button.addEventListener("click", () => {
    store.metric = button.dataset.analysisMetric;
    render();
  }));
  $("analytics-custom").addEventListener("submit", (event) => {
    event.preventDefault();
    const start = $("analytics-from").value, end = $("analytics-to").value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
      start > end || end > dateKey(today())) {
      setMessage("Choose a valid start and end date. The end cannot be in the future.", true);
      return;
    }
    store.zoomDay = null;
    store.selected = null;
    void load(true);
  });
  $("analytics-back").addEventListener("click", () => {
    store.zoomDay = null;
    store.selected = null;
    renderPreset();
    void load(true);
  });
  const current = dateKey(today());
  $("analytics-from").max = current;
  $("analytics-to").max = current;
  $("analytics-from").value = dateKey(today() - 6 * DAY);
  $("analytics-to").value = current;
  renderPreset();
  window.StarlinkAnalytics = { open, refresh, clear };
})();
