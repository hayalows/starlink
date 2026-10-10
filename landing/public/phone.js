(() => {
  const API = "/api/monitor?action=read";
  const KEY = "starlink.ghana.phone.view.v1";
  const el = (id) => document.getElementById(id);
  const state = { token: "", payload: null, period: "today", view: "overview", timer: null };
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
      el("phone-bottom-nav").hidden = false;
      showView("overview");
      void refresh();
      void checkVault();
      if (!state.timer) state.timer = setInterval(() => void refresh(), 60_000);
    } catch (e) {
      note(e instanceof Error ? e.message : "Could not pair this phone.");
    }
  };

  const showView = (next) => {
    const allowed = ["overview", "costs", "devices", "connection"];
    state.view = allowed.includes(next) ? next : "overview";
    document.querySelectorAll("[data-screen]").forEach((section) => {
      section.hidden = section.getAttribute("data-screen") !== state.view;
    });
    document.querySelectorAll("[data-view]").forEach((button) => {
      const active = button.getAttribute("data-view") === state.view;
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const monthPlanEstimate = (snapshot, month) => {
    if (Number.isFinite(snapshot.planFee) && snapshot.planFee > 0) return snapshot.planFee;
    if (!month?.window || !Number.isFinite(month.planAllocation)) return null;
    const start = new Date(month.window.start * 1000);
    const days = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const elapsed = (month.window.end - month.window.start) / 86400;
    return elapsed > 0 ? (month.planAllocation / elapsed) * days : null;
  };
  const showLegacyWarning = (snapshot) => {
    const today = snapshot.periods?.today;
    const plan = monthPlanEstimate(snapshot, snapshot.periods?.month);
    const notice = el("legacy-notice");
    // Detect the real legacy bug using impossible single-day plan allocation.
    // Never block otherwise valid old snapshots just because metadata is missing.
    const impossible = plan > 0 && today?.planAllocation > (plan / 28) * 1.1;
    notice.hidden = !impossible;
    if (impossible)
      notice.textContent =
        "This uploaded snapshot appears to use the old daily plan formula. The laptop's numbers may be newer. Open your updated extension and choose Sync now; this screen will refresh.";
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
      return {
        t,
        gb: byTime.get(t)?.gb ?? null,
        downGB: byTime.get(t)?.downGB ?? null,
        upGB: byTime.get(t)?.upGB ?? null,
        kWh: byTime.get(t)?.kWh ?? null,
      };
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
      const label =
        period === "today"
          ? new Date(b.t * 1000).getUTCHours().toString().padStart(2, "0") +
            ":00–" +
            new Date((b.t + stride) * 1000).getUTCHours().toString().padStart(2, "0") +
            ":00"
          : displayDate(b.t, "long");
      detail.textContent =
        b.gb === null
          ? label + " · No recording in this interval. This is a gap, not zero usage."
          : label +
            " · " +
            amount(b.gb) +
            " GB total" +
            " · ↓ " +
            amount(b.downGB) +
            " GB" +
            " · ↑ " +
            amount(b.upGB) +
            " GB" +
            " · " +
            (Number.isFinite(b.kWh) ? amount(b.kWh, 3) + " kWh measured" : "Energy not recorded");
    };
    target.querySelectorAll("rect[data-index]").forEach((r) => {
      const index = Number(r.getAttribute("data-index"));
      r.addEventListener("click", () => select(index));
      r.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select(index);
        }
      });
    });
    detail.textContent = "Tap or press Enter on a bar to inspect its readings.";
    const ranked = observed.filter((b) => Number.isFinite(b.gb)).sort((a, b) => b.gb - a.gb);
    el("chart-insight").textContent =
      ranked.length < 2
        ? "More recorded intervals are needed to identify busy and quiet periods."
        : "Busiest recorded " +
          (period === "today" ? "hour" : "day") +
          ": " +
          (period === "today"
            ? new Date(ranked[0].t * 1000).getUTCHours().toString().padStart(2, "0") + ":00"
            : displayDate(ranked[0].t, "long")) +
          " (" +
          amount(ranked[0].gb) +
          " GB). This compares recorded intervals only; gaps are excluded.";
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
    el("hero-gb").textContent = amount(today?.gb);
    el("overview-today-cost").textContent = money(today?.cost);
    el("overview-month-gb").textContent = Number.isFinite(month?.gb)
      ? amount(month.gb) + " GB"
      : "—";
    el("hero-coverage").textContent =
      Math.round((today?.trafficCoverage || 0) * 100) + "% of today's elapsed time sampled";
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
    el("today-coverage").textContent =
      Math.round((today?.coverage || 0) * 100) + "% of elapsed day";
    el("recorder-icon").classList.toggle("is-stale", !fresh);
    el("recorder-icon").setAttribute(
      "aria-label",
      fresh ? "Recent recorder data" : "Saved recorder data",
    );
    el("recorder-description").textContent = fresh
      ? "The saved readings are recent. This does not guarantee that the laptop will remain online."
      : "These are saved readings, not a live network connection. Open Chrome on your laptop to resume collection.";
    el("cost-period-label").textContent = {
      today: "today so far",
      week: "the last 7 days",
      month: "this month so far",
      cycle: "this billing cycle so far",
    }[state.period];
    el("plan-full").textContent = money(monthPlanEstimate(current, month));
    showLegacyWarning(current);
    chart(period, state.period);
    // Always show an observed-rate estimate once there is a positive amount
    // of recorded traffic. Do not hide useful arithmetic behind a coverage gate.
    // Both screens use FULL monthly forecast divided by GB recorded to date.
    const rate =
      Number.isFinite(month?.projectedCost) && month?.gb > 0
        ? month.projectedCost / month.gb
        : null;
    el("starlink-per-gb").textContent = Number.isFinite(rate) ? money(rate) : "—";
    el("starlink-gb-per-cedi").textContent = rate > 0 ? amount(1 / rate, 3) + " GB" : "—";
    const completeness = Math.round((month?.trafficCoverage || 0) * 100);
    const forecastRate =
      Number.isFinite(month?.projectedCost) &&
      Number.isFinite(month?.forecastGb) &&
      month.forecastGb > 0
        ? month.projectedCost / month.forecastGb
        : null;
    const updateDate = new Date(state.payload.updatedAt);
    const daysInMonth = new Date(
      Date.UTC(updateDate.getUTCFullYear(), updateDate.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const forecastHours =
      Number.isFinite(month?.forecastGb) && month.forecastGb > 0 && month.gb > 0
        ? (month.gb / month.forecastGb) * daysInMonth * 24
        : 0;
    const forecastCaution =
      forecastHours < 72 || completeness < 50
        ? "Early estimate: limited recorded hours."
        : forecastHours < 168 || completeness < 80
          ? "Developing estimate: additional days will improve it."
          : "Better supported estimate, but still a projection.";
    el("starlink-rate-note").textContent = rate
      ? "Full-month estimate ÷ " + amount(month.gb) + " recorded GB; not an extra charge."
      : "Waiting for your first recorded GB";
    el("value-coverage-note").textContent = rate
      ? "The monitor sampled " +
        completeness +
        "% of time elapsed this month, not the entire calendar month. Full-month projected effective rate: " +
        (forecastRate === null ? "waiting for 24 hours of data" : money(forecastRate) + "/GB") +
        ". " +
        forecastCaution +
        " Missing time is not treated as zero."
      : "The rate appears as soon as your monitor records some usage.";
    const bundle = current.bundle ?? {};
    const bundleRate = bundle.price > 0 && bundle.gb > 0 ? bundle.price / bundle.gb : null;
    el("bundle-title").textContent = bundleRate
      ? money(bundle.price) + " / " + amount(bundle.gb) + " GB"
      : "Not configured";
    el("bundle-per-gb").textContent = bundleRate ? money(bundleRate) : "—";
    el("bundle-comparison").textContent =
      bundleRate && forecastRate
        ? "Your saved bundle costs " +
          amount(bundleRate / forecastRate, 2) +
          "× the projected full-month Starlink cost/GB. " +
          forecastCaution +
          " They have different coverage, portability and billing rules."
        : "A comparison needs your saved bundle and at least 24 hours of recorded data. Edit the bundle under Costs on your laptop.";

    const devices = Array.isArray(current.devices) ? current.devices : [];
    const holder = el("phone-device-list");
    holder.replaceChildren();
    const trackedGb = Number(current.deviceTotalGb) || 0;
    el("device-summary").textContent = devices.length
      ? amount(trackedGb) +
        " GB counted across " +
        devices.length +
        " device groups this month. Dish WAN readings show " +
        (Number.isFinite(month?.gb) ? amount(month.gb) + " GB" : "a separate total") +
        ". These meters can differ, so device shares are estimates."
      : "No synced router-device history yet. Check the Devices panel on your laptop.";
    for (const [i, device] of devices.entries()) {
      const row = document.createElement("div");
      row.className = "phone-device";
      const title = document.createElement("div");
      title.className = "phone-device-head";
      const label = document.createElement("span");
      label.textContent = i + 1 + ". " + (device.name || "Unnamed device");
      const value = document.createElement("strong");
      const share = Math.max(0, Math.min(1, Number(device.share) || 0));
      value.textContent = amount(device.gb) + " GB · " + Math.round(share * 100) + "%";
      title.append(label, value);
      const bar = document.createElement("div");
      bar.className = "phone-device-track";
      const fill = document.createElement("div");
      fill.className = "phone-device-fill";
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
  // Separate, opt-in, append-only minute archive. The private read capability
  // stays in the Authorization header and is NEVER put into a download.
  async function vaultRequest(action, before) {
    const params = new URLSearchParams({ action });
    if (before !== undefined) params.set("before", String(before));
    if (action === "read") params.set("limit", "150");
    const response = await fetch("/api/archive?" + params, {
      headers: { Authorization: "Bearer " + state.token },
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw Error("Archive request failed (" + response.status + ")");
    return response.json();
  }
  async function checkVault() {
    const label = el("phone-vault-status");
    if (!state.token || !label) return;
    try {
      const summary = await vaultRequest("summary");
      const count = summary.count;
      label.textContent = summary.downloadable
        ? (typeof count === "number" ? count.toLocaleString() : "Saved") +
          " minute records available. Save an independent copy before replacing Chrome or changing profiles."
        : "No archived minutes yet. Open Overview → History vault in the laptop extension to enable protection.";
      el("download-vault").disabled = !summary.downloadable;
    } catch {
      label.textContent = "Could not check your history archive. Your laptop's local records are unaffected.";
      el("download-vault").disabled = true;
    }
  }
  el("download-vault").addEventListener("click", async () => {
    const button = el("download-vault");
    const label = el("phone-vault-status");
    if (!state.token) return;
    button.disabled = true;
    try {
      const all = [];
      let before = 4102444800;
      let done = false;
      // Do not produce a seemingly complete backup if a page fails or if the
      // browser cannot hold the full archive. Each page is capped by the server.
      for (let page = 0; page < 2000; page++) {
        const next = await vaultRequest("read", before);
        if (!Array.isArray(next.minutes)) throw Error("Invalid archive response");
        all.push(...next.minutes);
        label.textContent = "Preparing recovery backup: " + all.length.toLocaleString() + " minutes read…";
        if (!next.hasMore || !next.minutes.length) {
          done = true;
          break;
        }
        const cursor = Number(next.nextBefore);
        if (!Number.isFinite(cursor) || cursor >= before) throw Error("Invalid archive cursor");
        before = cursor;
      }
      if (!done) throw Error("Archive exceeds phone download limit. Use the desktop recovery tool for very large histories.");
      if (!all.length) throw Error("No archived minutes found");
      const file = {
        kind: "starlink-ghana-backup",
        version: 1,
        createdAt: new Date().toISOString(),
        settings: {},
        profiles: {},
        history: { minutes: all.reverse(), months: [] },
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "starlink-ghana-vault-" + new Date().toISOString().slice(0, 10) + ".json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      label.textContent = "Backup prepared: " + all.length.toLocaleString() +
        " recorded minutes. Keep the file private and outside your browser profile.";
    } catch (error) {
      label.textContent = "Download not completed: " + (error instanceof Error ? error.message : "Try again.");
    } finally {
      button.disabled = false;
    }
  });
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
    el("phone-bottom-nav").hidden = true;
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
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.getAttribute("data-view")));
  });
  document.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => {
      showView("overview");
      el(button.getAttribute("data-open"))?.scrollIntoView({ behavior: "smooth" });
    });
  });
  let installationPrompt = null;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installationPrompt = event;
    const button = el("install-phone");
    if (button) {
      const label = button.querySelector(".install-label");
      if (label) label.textContent = "Install on this device";
    }
  });
  el("install-phone").addEventListener("click", async () => {
    if (installationPrompt) {
      await installationPrompt.prompt();
      installationPrompt = null;
    } else {
      el("install-instructions").textContent =
        "On iPhone open in Safari, tap Share, then Add to Home Screen. On Android use your browser's Install app or Add to Home Screen option.";
    }
  });
  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/live/sw.js", { scope: "/live/" }).catch(() => {});
    });
  }
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
