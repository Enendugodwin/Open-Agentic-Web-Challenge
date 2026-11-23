// Small helpers shared by the Web-standard (Request -> Response) API handlers.

/** CORS headers for public, credential-free resources (public MCP). Never used on
 * cookie-authenticated routes. */
export const PUBLIC_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

export function json(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

export function withHeaders(response, headers) {
  const out = new Response(response.body, response);
  for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
  return out;
}

/** Read a JSON body with a hard size limit. Returns { ok, value } or { ok:false, response }. */
export async function readJsonBody(request, { maxBytes = 64 * 1024 } = {}) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) return { ok: false, response: json({ error: "payload_too_large" }, { status: 413 }) };
  const reader = request.body?.getReader();
  if (!reader) return { ok: false, response: json({ error: "empty_body" }, { status: 400 }) };
  const chunks = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return { ok: false, response: json({ error: "payload_too_large" }, { status: 413 }) };
    }
    chunks.push(value);
  }
  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { ok: false, response: json({ error: "invalid_json" }, { status: 400 }) };
  }
}

/** Client IP for rate limiting (Vercel sets x-forwarded-for / x-real-ip). */
export function clientIp(request) {
  return request.headers.get("x-real-ip")
    || (request.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || "unknown";
}

/**
 * True when the request comes from a page on this site's own origin. Browsers send
 * Sec-Fetch-Site and Origin on POST; a request without them is a non-browser client.
 */
export function isSameOriginBrowserRequest(request) {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || !host) return false;
  let originHost;
  try { originHost = new URL(origin).host; } catch { return false; }
  if (originHost !== host) return false;
  return site === null || site === "same-origin";
}

/** Fixed-window in-memory limiter. Per function instance only: a first line of
 * defence until a shared store is added (see docs/adr/0003). */
export function createRateLimiter({ limit, windowMs }) {
  const hits = new Map();
  return function take(key, now = Date.now()) {
    const entry = hits.get(key);
    if (!entry || now - entry.start >= windowMs) {
      hits.set(key, { start: now, count: 1 });
      if (hits.size > 10_000) hits.clear();
      return { ok: true, remaining: limit - 1 };
    }
    entry.count += 1;
    return entry.count <= limit
      ? { ok: true, remaining: limit - entry.count }
      : { ok: false, retryAfterSec: Math.ceil((entry.start + windowMs - now) / 1000) };
  };
}
