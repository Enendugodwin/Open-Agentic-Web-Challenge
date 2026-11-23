// GET /api/match?i=400%20g%20spaghetti&i=4%20eggs
//
// The same read-only ingredient matching as the MCP tool match_ingredients, for AI
// agents that can open web pages but cannot use MCP. Public demo data, no
// credentials, CORS open. It never changes a cart.
import { MAX_INGREDIENTS, matchIngredients } from "../lib/catalog.js";
import { itemsLink } from "../public/shop-link.js";
import { PUBLIC_CORS, clientIp, createRateLimiter, json } from "../lib/http.js";

const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

export function GET(request) {
  const rate = limiter(clientIp(request));
  if (!rate.ok) return json({ error: "rate_limited" }, { status: 429, headers: { ...PUBLIC_CORS, "Retry-After": String(rate.retryAfterSec) } });
  const url = new URL(request.url);
  const lines = [...url.searchParams.getAll("i"), ...(url.searchParams.get("ingredients") || "").split(/\r?\n/)]
    .map((l) => l.trim()).filter(Boolean);
  if (!lines.length) {
    return json({
      error: "no_ingredients",
      usage: "GET /api/match?i=400%20g%20spaghetti&i=2%20cloves%20garlic (one i= per ingredient, URL-encoded)",
    }, { status: 400, headers: PUBLIC_CORS });
  }
  if (lines.length > MAX_INGREDIENTS || lines.some((l) => l.length > 200)) {
    return json({ error: "too_many_or_too_long", limits: { ingredients: MAX_INGREDIENTS, chars_per_line: 200 } }, { status: 400, headers: PUBLIC_CORS });
  }
  const result = matchIngredients(lines);
  const buyable = result.items.filter((i) => i.status === "matched" || i.status === "substituted");
  result.cart_link = buyable.length ? itemsLink(url.origin, buyable.map((i) => ({ product_id: i.product.id, quantity: i.packs }))) : null;
  result.cart_link_note = "Give this link to the shopper. Opening it adds nothing; the shopper reviews the items on the store's site and confirms.";
  return json(result, { headers: { ...PUBLIC_CORS, "Cache-Control": "public, max-age=300" } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_CORS });
}
