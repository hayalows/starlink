(() => {
  const API = "/api/monitor?action=read";
  const KEY = "starlink.ghana.phone.view.v1";
  const el = (id) => document.getElementById(id);
  const state = { token: "", payload: null, period: "today", timer: null };
  const money = (n) =>
    Number.isFinite(n)
      ? "GH₵ " + n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "—";
  const amount = (n, decimals = 2) =>
    Number.isFinite(n)
      ? n.toLocaleString("en-GH", {
          maximumFractionDigits: decimals,
          minimumFractionDigits: decimals,
        })
      : "—";
  const ago = (t) => {
    if (!t || !Number.isFinite(Number(t))) return "No reading";
    const seconds = Math.max(0, Math.floor((Date.now() - Number(t)) / 1000));
    if (seconds < 90) return "just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + " min ago";
    if (seconds < 86400) return Math.floor(seconds / 3600) + " h ago";
    return Math.floor(seconds / 86400) + " d ago";
  };
  const valid = (s) => /^[a-zA-Z0-9_-]{43}$/.test(s);
  const note = (text) => {
    el("pair-feedback").textContent = text;
  };
  const setStatus = (text, type = "") => {
    const badge = el("sync-badge");
    badge.textContent = text;
    badge.className = "phone-sync-badge" + (type ? " is-" + type : "");
  };
  const connect = (candidate) => {
    try {
      let token = candidate.trim();
      if (token.includes("#pair="))
        token = new URL(token).hash.split("pair=")[1]?.split("&")[0] ?? "";
      token = decodeURIComponent(token);
      if (!valid(token))
        throw Error(
          "That doesn't look like a valid pairing link. Copy the complete link from your laptop.",
        );
      state.token = token;
      localStorage.setItem(KEY, token);
      history.replaceState(null, "", location.pathname + location.search);
      el("pair-section").hidden = true;
      el("monitor-section").hidden = false;
      void refresh();
      if (!state.timer) state.timer = setInterval(() => void refresh(), 60_000);
    } catch (e) {
      note(e instanceof Error ? e.message : "Could not pair this phone.");
    }
  };

  const displayDate = (unix, format = "short") => {
    const date = new Date(unix * 1000);
    return date.toLocaleDateString("en-GH", {
      timeZone: "UTC",
      ...(format === "short" ? { weekday: "short" } : { month: "short", day: "numeric" }),
    });
  };
  const chart = (entry, period) => {
    const target = el("phone-chart");
    if (!entry?.window) {
      target.textContent = "No recorded history yet.";
      return;
    }
    const stride = period === "today" ? 3600 : 86400;
    const start = Math.floor(entry.window.start / stride) * stride;
    const end = Math.ceil(entry.window.end / stride) * stride;
    const count = Math.max(1, Math.min(40, Math.round((end - start) / stride)));
    const byTime = new Map((entry.buckets ?? []).map((b) => [b.t, b]));
    const bars = Array.from({ length: count }, (_, i) => {
      const t = start + i * stride;
      return { t, gb: byTime.get(t)?.gb ?? null,
        downGB: byTime.get(t)?.downGB ?? null,
        upGB: byTime.get(t)?.upGB ?? null,
        kWh: byTime.get(t)?.kWh ?? null };
    });
    const observed = bars.filter((b) => b.gb !== null);
    const max = Math.max(0.2, ...observed.map((b) => b.gb));
    const width = Math.max(332, count * (period === "today" ? 22 : 30));
    const height = 204;
    const margin = { top: 15, right: 10, bottom: 32, left: 38 };
    const drawable = height - margin.top - margin.bottom;
    const plotWidth = width - margin.left - margin.right;
    const slot = plotWidth / count;
    let parts = "";
    for (let i = 0; i < 4; i++) {
      const y = margin.top + (drawable * i) / 3;
      parts += `<line class="gridline" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"/>`;
      parts += `<text x="0" y="${y + 4}">${(max * (1 - i / 3)).toFixed(1)}</text>`;
    }
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const x = margin.left + i * slot + slot * 0.16;
      const w = Math.max(4, slot * 0.68);
      const val = b.gb;
      const barHeight = val === null ? 10 : Math.max(2, (drawable * val) / max);
      const y = margin.top + drawable - barHeight;
      const label =
        period === "today"
          ? new Date(b.t * 1000).getUTCHours().toString().padStart(2, "0") + ":00"
          : displayDate(b.t, period === "week" ? "short" : "long");
      const accessible =
        label + ": " + (val === null ? "no recording" : amount(val) + " GB recorded");
      parts += `<rect class="${val === null ? "gap" : "recorded"}" data-index="${i}" tabindex="0" role="button" aria-pressed="false" aria-label="${accessible}" x="${x}" y="${y}" rx="3" width="${w}" height="${barHeight}"><title>${accessible}</title></rect>`;
      if (i % Math.max(1, Math.ceil(count / 7)) === 0)
        parts += `<text x="${x}" y="${height - 10}">${label}</text>`;
    }
    target.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Usage over time. Blank outlined bars mean no recorded data.">${parts}</svg>`;
    target.style.minWidth = width + "px";
    const detail = el("chart-point-detail");
    const select = (i) => {
      const b = bars[i];
      if (!b) return;
      target.querySelectorAll("rect[data-index]").forEach((r) => {
        r.setAttribute("aria-pressed", String(Number(r.getAttribute("data-index")) === i));
      });
      const label = period === "today"
        ? new Date(b.t * 1000).getUTCHours().toString().padStart(2, "0") + ":00–" +
          (new Date((b.t + stride) * 1000).getUTCHours().toString().padStart(2, "0") + ":00"
        : displayDate(b.t, "long");
      detail.textContent = b.gb === null
        ? label + " · No recording in this interval. This is a gap, not zero usage."
        : label + " · " + amount(b.gb) + " GB total" +
          " · ↓ " + amount(b.downGB) + " GB" +
          " · ↑ " + amount(b.upGB) + " GB" +
          " · " + (Number.isFinite(b.kWh) ? amount(b.kWh, 3) + " kWh measured" : "Energy not recorded");
    };
    target.querySelectorAll("rect[data-index]").forEach((r) => {
      const index = Number(r.getAttribute("data-index"));
      r.addEventListener("click", () => select(index));
      r.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault(); select(index);
        }
      });
    });
    detail.textContent = "Tap or press Enter on a bar to inspect its readings.";
    const ranked = observed.filter((b) => Number.isFinite(b.gb)).sort((a, b) => b.gb - a.gb);
    el("chart-insight").textContent = ranked.length < 2
      ? "More recorded intervals are needed to identify busy and quiet periods."
      : "Busiest recorded " + (period === "today" ? "hour" : "day") + ": " +
        (period === "today" ? new Date(ranked[0].t * 1000).getUTCHours().toString().padStart(2, "0") + ":00"
          : displayDate(ranked[0].t, "long")) +
        " (" + amount(ranked[0].gb) + " GB). This compares recorded intervals only; gaps are excluded.";
    el("chart-summary").textContent = observed.length
      ? amount(entry.gb) +
        " GB recorded · " +
        Math.round((entry.trafficCoverage || 0) * 100) +
        "% of the period sampled"
      : "No usable traffic readings for this period";
  };
  const render = () => {
    const current = state.payload?.snapshot;
    if (!current?.periods) return;
    const month = current.periods.month;
    const today = current.periods.today;
    const period = current.periods[state.period];
    const latest = Number(current.latestSampleAt || 0) * 1000;
    const updated = Number(new Date(state.payload.updatedAt));
    const age = Date.now() - updated;
    const fresh =
      Number.isFinite(age) &&
      age >= 0 &&
      age < 20 * 60_000 &&
      latest > 0 &&
      Date.now() - latest < 20 * 60_000;
    setStatus(fresh ? "Recent readings" : "Saved history", fresh ? "" : "stale");
    el("sync-copy").textContent =
      "Last synced " +
      ago(updated) +
      " · Laptop uploads approximately every 10 minutes while Chrome is running.";
    el("hero-gb").textContent = amount(month?.gb);
    el("hero-coverage").textContent =
      Math.round((month?.trafficCoverage || 0) * 100) + "% of the month measured";
    el("metric-cost").textContent = money(month?.projectedCost);
    el("metric-energy").textContent = Number.isFinite(month?.kWh)
      ? amount(month.kWh, 2) + " kWh"
      : "—";
    el("metric-energy-note").textContent = "Measured during recorded time · gaps excluded";
    el("metric-cost-note").textContent = "Full-month projection · plan + energy";
    el("cost-plan").textContent = money(period?.planAllocation);
    el("cost-electricity").textContent = money(period?.electricityCost);
    el("cost-total").textContent = money(period?.cost);
    el("last-reading").textContent = ago(latest);
    el("last-upload").textContent = ago(updated);
    el("today-coverage").textContent = Math.round((today?.coverage || 0) * 100) + "%";
    el("recorder-icon").textContent = fresh ? "●" : "◷";
    el("recorder-description").textContent = fresh
      ? "The saved readings are recent. This does not guarantee that the laptop will remain online."
      : "These are saved readings, not a live network connection. Open Chrome on your laptop to resume collection.";
    el("cost-period-label").textContent = ({today:"today so far",week:"the last 7 days",month:"this month so far",cycle:"this billing cycle so far"})[state.period];
    el("plan-full").textContent = money(current.planFee);
    chart(period, state.period);
    // A monthly fixed-fee contract has an effective cost/GB, not a price charged
    // per transferred gigabyte. Hide unreliable ratios when WAN coverage is low.
    const enoughTraffic = month?.gb > 0 && month?.trafficCoverage >= .8;
    const monthlyRate = enoughTraffic && Number.isFinite(month?.cost)
      ? month.cost / month.gb : null;
    const forecastRate = !monthlyRate && month?.forecastGb > 0 &&
      Number.isFinite(month?.projectedCost) && month?.forecastCoverageEligible === true
      ? month.projectedCost / month.forecastGb : null;
    const rate = monthlyRate || forecastRate;
    el("starlink-per-gb").textContent = Number.isFinite(rate) ? money(rate) : "—";
    el("starlink-gb-per-cedi").textContent = rate > 0 ? amount(1 / rate, 3) + " GB" : "—";
    el("starlink-rate-note").textContent = monthlyRate
      ? "Recorded month so far · ≥80% traffic coverage"
      : forecastRate
        ? "Extrapolated month · ≥24 hours recorded; treat as a forecast"
        : "Requires good recording coverage or a longer sample";
    const bundle = current.bundle ?? {};
    const bundleRate = bundle.price > 0 && bundle.gb > 0 ? bundle.price / bundle.gb : null;
    el("bundle-title").textContent = bundleRate
      ? money(bundle.price) + " / " + amount(bundle.gb) + " GB" : "Not configured";
    el("bundle-per-gb").textContent = bundleRate ? money(bundleRate) : "—";
    el("bundle-comparison").textContent = bundleRate && rate
      ? "At these estimated rates, your saved mobile bundle costs " +
        amount(bundleRate / rate, 2) + "× the Starlink effective GH₵/GB rate. They have different coverage, portability and billing rules."
      : "Set a mobile bundle price and GB in the extension's Costs screen. Example only: GH₵399 / 240 GB = GH₵1.66 per GB; it is not a live MTN quote.";

    const devices = Array.isArray(current.devices) ? current.devices : [];
    const holder = el("phone-device-list");
    holder.replaceChildren();
    const trackedGb = Number(current.deviceTotalGb) || 0;
    el("device-summary").textContent = devices.length
      ? amount(trackedGb) + " GB counted across " + devices.length +
        " device groups this month. Shares are based on router counters."
      : "No synced router-device history yet. Check the Devices panel on your laptop.";
    for (const [i, device] of devices.entries()) {
      const row = document.createElement("div"); row.className = "phone-device";
      const title = document.createElement("div"); title.className = "phone-device-head";
      const label = document.createElement("span");
      label.textContent = (i + 1) + ". " + (device.name || "Unnamed device");
      const value = document.createElement("strong");
      const share = Math.max(0, Math.min(1, Number(device.share) || 0));
      value.textContent = amount(device.gb) + " GB · " + Math.round(share * 100) + "%";
      title.append(label, value);
      const bar = document.createElement("div"); bar.className = "phone-device-track";
      const fill = document.createElement("div"); fill.className = "phone-device-fill";
      fill.style.width = (share * 100).toFixed(2) + "%";
      bar.append(fill);
      row.append(title, bar);
      if (device.group) {
        const group = document.createElement("small");
        group.textContent = device.group;
        row.append(group);
      }
      holder.append(row);
    }
    const days = [...(month?.buckets ?? [])].reverse().slice(0, 7);
    const list = el("phone-day-list");
    list.replaceChildren();
    if (!days.length) {
      list.textContent = "No completed daily readings yet. Your recorder will fill this over time.";
    } else {
      for (const day of days) {
        const row = document.createElement("div");
        row.className = "phone-day";
        const left = document.createElement("span");
        left.textContent = displayDate(day.t, "long");
        const right = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = Number.isFinite(day.gb)
          ? amount(day.gb) + " GB"
          : "No traffic reading";
        const small = document.createElement("small");
        small.textContent = Number.isFinite(day.kWh)
          ? amount(day.kWh, 2) + " kWh"
          : "No energy reading";
        right.append(strong, small);
        row.append(left, right);
        list.append(row);
      }
    }
  };
  async function refresh() {
    if (!state.token) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(API, {
        headers: { Authorization: "Bearer " + state.token },
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 503) setStatus("Sync not configured", "error");
        else if (response.status === 401 || response.status === 404)
          setStatus("Pairing expired", "error");
        else setStatus("Could not refresh", "error");
        el("sync-copy").textContent =
          data.error === "sync_not_configured"
            ? "The cloud database has not been connected to this site yet. Your extension will continue recording locally."
            : "Could not retrieve readings. Reconnect from the laptop extension or try again.";
        return;
      }
      state.payload = data;
      if (!data.snapshot?.periods) {
        setStatus("Waiting for first upload", "stale");
        el("sync-copy").textContent =
          "Paired. Open the extension and select Sync now to send the first readings.";
        return;
      }
      render();
    } catch {
      setStatus("Offline", "error");
      el("sync-copy").textContent =
        "Cannot reach the sync service. Existing data remains on the laptop.";
    } finally {
      clearTimeout(timeout);
    }
  }
  el("pair-form").addEventListener("submit", (event) => {
    event.preventDefault();
    connect(el("pair-code").value);
  });
  el("phone-refresh").addEventListener("click", () => void refresh());
  el("forget-monitor").addEventListener("click", () => {
    if (
      !window.confirm(
        "Forget the private pairing code on this phone? Your laptop recorder and cloud history will not be deleted.",
      )
    )
      return;
    localStorage.removeItem(KEY);
    state.token = "";
    state.payload = null;
    clearInterval(state.timer);
    state.timer = null;
    el("pair-section").hidden = false;
    el("monitor-section").hidden = true;
    note("Phone access forgotten. Pair again using your extension if needed.");
  });
  document.querySelectorAll("[data-period]").forEach((tab) =>
    tab.addEventListener("click", () => {
      state.period = tab.getAttribute("data-period");
      document.querySelectorAll("[data-period]").forEach((b) => {
        const selected = b === tab;
        b.classList.toggle("selected", selected);
        b.setAttribute("aria-selected", String(selected));
      });
      render();
    }),
  );
  // The fragment is never transmitted in a request. Clear it before fetching.
  const initialFragment = location.hash.startsWith("#pair=") ? location.hash.slice(6) : "";
  if (initialFragment) connect(initialFragment);
  else {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) connect(saved);
    } catch {
      // Private browsing can deny persistent storage; pairing from the URL still works.
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.token) void refresh();
  });
})();
