// Stable same-origin proxy for the account-free Starlink Ghana phone companion.
// The backing Postgres database is hosted in an isolated, RLS-protected table
// in the owner's existing Supabase project. No service credentials leave Supabase.
const REMOTE = "https://hdvkmpotagbigcmyozaf.supabase.co/functions/v1/starlink-ghana-monitor";
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
function fail(error: string, status = 503) {
  return Response.json({ error }, { status, headers: HEADERS });
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: HEADERS });
}
async function forward(request: Request) {
  const uri = new URL(request.url);
  const action = uri.searchParams.get("action");
  if (!action || !["health", "read", "create", "push", "revoke"].includes(action))
    return fail("not_found", 404);
  if (request.method === "GET" && !["health", "read"].includes(action))
    return fail("not_found", 404);
  if (request.method === "POST" && !["create", "push", "revoke"].includes(action))
    return fail("not_found", 404);
  if (request.method === "POST" && Number(request.headers.get("content-length") ?? 0) > 90000)
    return fail("too_large", 413);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const result = await fetch(`${REMOTE}?action=${action}`, {
        method: request.method,
        headers: {
          ...(request.headers.get("authorization")
            ? { Authorization: request.headers.get("authorization")! }
            : {}),
          ...(request.method === "POST" ? { "Content-Type": "application/json" } : {}),
        },
        body: request.method === "POST" ? await request.text() : undefined,
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
      });
      return new Response(result.body, {
        status: result.status,
        headers: { ...HEADERS, "Content-Type": "application/json" },
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return fail("sync_unavailable");
  }
}
export const GET = forward;
export const POST = forward;
