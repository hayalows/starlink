// v1.6.0: separate archive service. It never replaces the phone's live snapshot.
// The existing 256-bit capability authenticates every read and write; the DB
// table has RLS enabled and no browser-accessible grants or policies.
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization,content-type",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const respond = (data: unknown, status = 200) => Response.json(data, { status, headers: HEADERS });
const validToken = (s: string) => /^[A-Za-z0-9_-]{43}$/.test(s);
const tokenFrom = (request: Request) => {
  const h = request.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") && validToken(h.slice(7)) ? h.slice(7) : "";
};
const digest = async (value: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
const endpoint = Deno.env.get("SUPABASE_URL") ?? "";
function serverKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const data = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    return typeof data.default === "string" ? data.default : "";
  } catch {
    return "";
  }
}
function headers(extra: Record<string, string> = {}) {
  const key = serverKey();
  return {
    apikey: key,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(key.split(".").length === 3 ? { Authorization: "Bearer " + key } : {}),
    ...extra,
  };
}
async function rest(
  path: string,
  method = "GET",
  body?: unknown,
  extra: Record<string, string> = {},
) {
  if (!endpoint || !serverKey()) throw Error("vault_database_unavailable");
  const response = await fetch(endpoint + "/rest/v1/" + path, {
    method,
    headers: headers(extra),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    // Never echo internal PostgREST error messages or credentials to clients.
    throw Error("vault_database_error_" + response.status);
  }
  return response;
}
async function monitorFor(token: string, write: boolean): Promise<string | null> {
  if (!token) return null;
  const key = write ? "write_digest" : "view_digest";
  const hashed = await digest(token);
  const response = await rest(
    "starlink_phone_pairs?select=monitor_id&" + key + "=eq." + hashed + "&limit=1",
  );
  const rows = (await response.json()) as Array<{ monitor_id: string }>;
  return rows[0]?.monitor_id ?? null;
}
async function authorizedMonitor(token: string, write: boolean) {
  const monitor = await monitorFor(token, write);
  return monitor ?? (!write ? await monitorFor(token, true) : null);
}
function normalizedRow(value: unknown, nowSec: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  const valid = (n: unknown, max: number) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max;
  if (
    !valid(r.minute, nowSec + 60) ||
    (r.minute as number) % 60 !== 0 ||
    !valid(r.samples, 120) ||
    !Number.isInteger(r.samples) ||
    !valid(r.wattSeconds, 600000) ||
    (r.downlinkBits != null && !valid(r.downlinkBits, 1e16)) ||
    (r.uplinkBits != null && !valid(r.uplinkBits, 1e16))
  )
    return null;
  return {
    minute: r.minute,
    samples: r.samples,
    watt_seconds: r.wattSeconds,
    downlink_bits: r.downlinkBits ?? null,
    uplink_bits: r.uplinkBits ?? null,
  };
}
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  if (request.method === "GET" && action === "health")
    return respond({ configured: Boolean(endpoint && serverKey()), version: 1 });
  const token = tokenFrom(request);
  if (!token) return respond({ error: "pairing_required" }, 401);
  if (!["summary", "read", "push"].includes(action ?? ""))
    return respond({ error: "not_found" }, 404);
  if (
    (action === "push" && request.method !== "POST") ||
    (action !== "push" && request.method !== "GET")
  )
    return respond({ error: "method_not_allowed" }, 405);
  try {
    const monitor = await authorizedMonitor(token, action === "push");
    if (!monitor) return respond({ error: "pairing_not_found" }, 404);
    const base = "starlink_archive_minutes?monitor_id=eq." + monitor;
    if (action === "push") {
      if (Number(request.headers.get("content-length") ?? 0) > 90000)
        return respond({ error: "payload_too_large" }, 413);
      const raw = await request.text();
      if (raw.length > 90000) return respond({ error: "payload_too_large" }, 413);
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        return respond({ error: "invalid_json" }, 400);
      }
      const input =
        data && typeof data === "object" ? (data as { minutes?: unknown }).minutes : null;
      if (!Array.isArray(input) || input.length === 0 || input.length > 160)
        return respond({ error: "invalid_batch_size" }, 400);
      const nowSec = Date.now() / 1000;
      const records = input.map((value) => normalizedRow(value, nowSec));
      if (records.some((row) => !row)) return respond({ error: "invalid_minute" }, 400);
      const times = records.map((row) => row!.minute as number);
      if (new Set(times).size !== times.length)
        return respond({ error: "duplicate_batch_minute" }, 400);
      const rows = records.map((r) => ({ monitor_id: monitor, ...r }));
      // Append-only: retries, clock jumps and a later empty database must never
      // overwrite a successfully archived historical minute.
      await rest("starlink_archive_minutes?on_conflict=monitor_id,minute", "POST", rows, {
        Prefer: "resolution=ignore-duplicates,return=minimal",
      });
      return respond({ ok: true, received: rows.length });
    }
    if (action === "summary") {
      const [first, last] = await Promise.all([
        rest(base + "&select=minute&order=minute.asc&limit=1", "GET", undefined, {
          Prefer: "count=exact",
        }),
        rest(base + "&select=minute&order=minute.desc&limit=1"),
      ]);
      const oldest = ((await first.json()) as Array<{ minute: number }>)[0]?.minute ?? null;
      const newest = ((await last.json()) as Array<{ minute: number }>)[0]?.minute ?? null;
      const match = (first.headers.get("content-range") ?? "").match(/\/(\d+)$/);
      return respond({
        enabled: true,
        count: match ? Number(match[1]) : null,
        oldest,
        newest,
        downloadable: newest !== null,
      });
    }
    const limit = Math.max(1, Math.min(160, Number(url.searchParams.get("limit")) || 160));
    const before = Number(url.searchParams.get("before") ?? "4102444800");
    if (!Number.isSafeInteger(before) || before <= 0 || before > 4102444800)
      return respond({ error: "invalid_cursor" }, 400);
    const response = await rest(
      base +
        "&select=minute,samples,watt_seconds,downlink_bits,uplink_bits" +
        "&minute=lt." +
        before +
        "&order=minute.desc&limit=" +
        limit,
    );
    const rows = (await response.json()) as Array<{
      minute: number;
      samples: number;
      watt_seconds: number;
      downlink_bits: number | null;
      uplink_bits: number | null;
    }>;
    return respond({
      minutes: rows.map((r) => ({
        minute: r.minute,
        samples: r.samples,
        wattSeconds: r.watt_seconds,
        ...(r.downlink_bits !== null ? { downlinkBits: r.downlink_bits } : {}),
        ...(r.uplink_bits !== null ? { uplinkBits: r.uplink_bits } : {}),
      })),
      nextBefore: rows.length ? rows[rows.length - 1].minute : null,
      hasMore: rows.length === limit,
    });
  } catch (error) {
    console.error("Starlink vault:", error instanceof Error ? error.message : "unknown");
    return respond({ error: "vault_unavailable" }, 503);
  }
});
