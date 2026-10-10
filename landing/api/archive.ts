// Isolated same-origin proxy for the optional private minute-history vault.
// Never cache private payloads, and never expose the Supabase service key.
const REMOTE = "https://hdvkmpotagbigcmyozaf.supabase.co/functions/v1/starlink-history-vault";
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
export const OPTIONS = () => new Response(null, { status: 204, headers: HEADERS });
async function forward(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  if (!["health", "summary", "read", "push"].includes(action ?? ""))
    return Response.json({ error: "not_found" }, { status: 404, headers: HEADERS });
  if ((request.method === "GET" && action === "push") ||
      (request.method === "POST" && action !== "push"))
    return Response.json({ error: "method_not_allowed" }, { status: 405, headers: HEADERS });
  if (request.method === "POST" && Number(request.headers.get("content-length") ?? 0) > 90000)
    return Response.json({ error: "payload_too_large" }, { status: 413, headers: HEADERS });
  const params = new URLSearchParams({ action: action! });
  if (action === "read") {
    for (const key of ["before", "limit"]) {
      const v = url.searchParams.get(key);
      if (v) params.set(key, v);
    }
  }
  try {
    const response = await fetch(REMOTE + "?" + params, {
      method: request.method,
      headers: {
        ...(request.headers.get("authorization")
          ? { Authorization: request.headers.get("authorization")! } : {}),
        ...(request.method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: request.method === "POST" ? await request.text() : undefined,
      cache: "no-store",
      credentials: "omit",
      signal: AbortSignal.timeout(15000),
    });
    return new Response(response.body, {
      status: response.status,
      headers: { ...HEADERS, "Content-Type": "application/json" },
    });
  } catch {
    return Response.json({ error: "vault_unavailable" }, { status: 503, headers: HEADERS });
  }
}
export const GET = forward;
export const POST = forward;
