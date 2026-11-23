// GET /api/lookup?id=p_spaghetti_500g&name=olive%20oil
//
// Store lookup for AI agents that can open web pages: for each product id (id=) or
// product name (name=), how the item is sold (each or pack, contents and unit), the
// unit price, and the stock on hand. Public demo data, read-only, CORS open.
import { lookupProducts, MAX_LOOKUPS } from "../lib/catalog.js";
import { PUBLIC_CORS, clientIp, createRateLimiter, json } from "../lib/http.js";

const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

export function GET(request) {
  const rate = limiter(clientIp(request));
  if (!rate.ok) return json({ error: "rate_limited" }, { status: 429, headers: { ...PUBLIC_CORS, "Retry-After": String(rate.retryAfterSec) } });
  const params = new URL(request.url).searchParams;
  const clean = (values, max) => values.map((v) => v.trim()).filter(Boolean).filter((v) => v.length <= max);
  const product_ids = clean(params.getAll("id"), 80);
  const names = clean(params.getAll("name"), 100);
  if (!product_ids.length && !names.length) {
    return json({
      error: "nothing_to_look_up",
      usage: "GET /api/lookup?id=p_spaghetti_500g&name=olive%20oil (repeat id= or name= for more items)",
    }, { status: 400, headers: PUBLIC_CORS });
  }
  if (product_ids.length + names.length > MAX_LOOKUPS) {
    return json({ error: "too_many", limit: MAX_LOOKUPS }, { status: 400, headers: PUBLIC_CORS });
  }
  // Stock changes, so keep caching short.
  return json(lookupProducts({ product_ids, names }), { headers: { ...PUBLIC_CORS, "Cache-Control": "public, max-age=30" } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_CORS });
}
