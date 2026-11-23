// POST /api/cart/quote  { items: [{ product_id, quantity }] }
//
// Validates product ids, quantities and stock and returns server prices. Used by the
// store pages and the add_to_cart site action before anything is stored. Same-origin
// browser requests only, with no CORS: business endpoints stay on their own origin
// (spec §3.3).
import { CartError, quoteCart } from "../../lib/catalog.js";
import { isSameOriginBrowserRequest, json, readJsonBody } from "../../lib/http.js";

export async function POST(request) {
  if (!isSameOriginBrowserRequest(request)) {
    return json({ error: "forbidden_origin", message: "Cart requests must come from the store's own pages." }, { status: 403 });
  }
  const body = await readJsonBody(request, { maxBytes: 16 * 1024 });
  if (!body.ok) return body.response;
  try {
    return json(quoteCart(body.value?.items));
  } catch (err) {
    if (err instanceof CartError) return json({ error: "invalid_cart", message: err.message }, { status: 400 });
    throw err;
  }
}
