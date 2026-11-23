// GET /api/products?q=olive+oil[&category=Baking][&limit=24]
// Catalog JSON for the store's own pages (same data as the public MCP tools).
import { CATEGORIES, PRODUCTS, publicProduct, searchProducts } from "../lib/catalog.js";
import { json } from "../lib/http.js";

export function GET(request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") || "").trim().slice(0, 100);
  const category = params.get("category") || undefined;
  if (category && !CATEGORIES.includes(category)) {
    return json({ error: "invalid_category", categories: CATEGORIES }, { status: 400 });
  }
  const limit = Math.min(Math.max(Number(params.get("limit")) || 24, 1), 60);
  const products = q
    ? searchProducts(q, { category, limit })
    : PRODUCTS.filter((p) => !category || p.category === category).slice(0, limit);
  return json({ categories: CATEGORIES, products: products.map(publicProduct) }, { headers: { "Cache-Control": "public, max-age=60" } });
}
