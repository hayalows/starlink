import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

// A publicly accessible endpoint, but never a publicly readable household.
// 256-bit capabilities are issued on the owner's computer; only their SHA-256
// digests are stored in Postgres. No Starlink account cookies are uploaded.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
function respond(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: cors });
}
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const validToken = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{43}$/.test(value);
const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9-]{27,36}$/i.test(value);
const tokenFrom = (request: Request): string =>
  /^Bearer [a-zA-Z0-9_-]{43}$/.test(request.headers.get("authorization") ?? "")
    ? (request.headers.get("authorization") ?? "").slice(7)
    : "";
const configured = () => Boolean(process.env.DATABASE_URL);
const MAX_BODY = 90_000;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}
export async function GET(request: Request) {
  const action = new URL(request.url).searchParams.get("action");
  if (action === "health") return respond({ configured: configured(), version: 1 });
  if (action !== "read") return respond({ error: "not_found" }, 404);
  const token = tokenFrom(request);
  if (!validToken(token)) return respond({ error: "pairing_required" }, 401);
  if (!configured()) return respond({ error: "sync_not_configured" }, 503);
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`SELECT payload, updated_at FROM monitor_pairs WHERE view_digest = ${digest(token)} LIMIT 1`;
    if (!rows.length) return respond({ error: "pairing_not_found" }, 404);
    return respond({ snapshot: rows[0].payload, updatedAt: rows[0].updated_at });
  } catch {
    return respond({ error: "sync_unavailable" }, 503);
  }
}
export async function POST(request: Request) {
  const action = new URL(request.url).searchParams.get("action");
  if (!["create", "push", "revoke"].includes(action ?? "")) return respond({ error: "not_found" }, 404);
  if (!configured()) return respond({ error: "sync_not_configured" }, 503);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY)
    return respond({ error: "too_large" }, 413);
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return respond({ error: "too_large" }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return respond({ error: "invalid_json" }, 400);
  }
  try {
    const sql = neon(process.env.DATABASE_URL!);
    if (action === "create") {
      const { monitorId, viewToken, writeToken } = body;
      if (!validId(monitorId) || !validToken(viewToken) || !validToken(writeToken) || viewToken === writeToken)
        return respond({ error: "invalid_pairing" }, 400);
      await sql`INSERT INTO monitor_pairs (monitor_id, view_digest, write_digest, payload)
      VALUES (${monitorId}, ${digest(viewToken)}, ${digest(writeToken)}, '{}'::jsonb)`;
      return respond({ ok: true }, 201);
    }
    const token = tokenFrom(request);
    if (!validToken(token)) return respond({ error: "pairing_required" }, 401);
    if (action === "revoke") {
      const removed = await sql`DELETE FROM monitor_pairs WHERE write_digest = ${digest(token)} RETURNING monitor_id`;
      return respond({ ok: Boolean(removed.length) }, removed.length ? 200 : 404);
    }
    const snapshot = body.snapshot;
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot))
      return respond({ error: "invalid_snapshot" }, 400);
    const record = snapshot as Record<string, unknown>;
    if (record.version !== 1 || typeof record.recordedAt !== "number" ||
        !Number.isFinite(record.recordedAt) || !record.periods || typeof record.periods !== "object")
      return respond({ error: "invalid_snapshot" }, 400);
    // Disallow uploaded credential containers and excessively large telemetry.
    const serialized = JSON.stringify(record);
    if (serialized.length > 75_000 || /cloudSession|Starlink\\.Com\\.Sso|access_token|refresh_token|cookie/i.test(serialized))
      return respond({ error: "unsafe_snapshot" }, 400);
    const changed = await sql`UPDATE monitor_pairs SET payload = ${serialized}::jsonb,
      updated_at = NOW() WHERE write_digest = ${digest(token)} RETURNING monitor_id`;
    if (!changed.length) return respond({ error: "pairing_not_found" }, 404);
    return respond({ ok: true });
  } catch {
    return respond({ error: "sync_unavailable" }, 503);
  }
}
