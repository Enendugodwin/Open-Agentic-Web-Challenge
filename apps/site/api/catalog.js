// Store lookup pages for AI agents and people, at fixed URLs (see vercel.json rewrites):
//
//   /store-lookup   server-rendered HTML table, no JavaScript needed
//   /catalog.txt    plain text, one product per line
//   /catalog.json   JSON
//
// Each lists every product with how it is sold (each or pack), the pack contents,
// price, unit price and stock on hand. Optional ?q=olive+oil or ?category=Baking
// narrows the list. Many agent browsers cannot open URLs they construct and do not
// run JavaScript, so these are plain documents at stable addresses.
import { CATEGORIES, PRODUCTS, publicProduct, searchProducts, STORE } from "../lib/catalog.js";
import { PUBLIC_CORS, json } from "../lib/http.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const contents = (u) => (u.contents.unit === "items" && u.contents.amount === 1 ? "1 item" : `${u.contents.amount} ${u.contents.unit}`);
const stockText = (s) => (s.status === "out_of_stock" ? "out of stock" : `${s.status === "low_stock" ? "low stock" : "in stock"} (${s.available} available)`);

function select(params) {
  const q = (params.get("q") || "").trim().slice(0, 100);
  const category = CATEGORIES.includes(params.get("category")) ? params.get("category") : undefined;
  const list = q ? searchProducts(q, { category, limit: 25 }) : PRODUCTS.filter((p) => !category || p.category === category);
  return { q, category, products: list.map(publicProduct) };
}

export function catalogText(origin, { q, category, products }) {
  const head = [
    `${STORE.name} store lookup (demonstration data: no real orders or payments)`,
    `${products.length} products${q ? ` matching "${q}"` : ""}${category ? ` in ${category}` : ""}.`,
    "Columns: product id | name | sold as | contents | price | unit price | stock | max per order",
    `Cart link format: ${origin}/shop.html#items=PRODUCT_ID:PACKS,PRODUCT_ID:PACKS (the shopper reviews and confirms on the store's page).`,
    "",
  ];
  const rows = products.map((p) => [p.id, p.name, p.unit.sold_as, contents(p.unit), p.price, p.unit.unit_price, stockText(p.stock), p.stock.max_per_order].join(" | "));
  return `${head.concat(rows).join("\n")}\n`;
}

function html(origin, { q, category, products }) {
  const rows = products.map((p) => `<tr><td><code>${esc(p.id)}</code></td><td>${esc(p.name)}</td><td>${esc(p.unit.sold_as)}</td><td>${esc(contents(p.unit))}</td><td>${esc(p.price)}</td><td>${esc(p.unit.unit_price)}</td><td>${esc(stockText(p.stock))}</td><td>${p.stock.max_per_order}</td><td>${esc(p.category)}</td></tr>`).join("\n");
  const cats = CATEGORIES.map((c) => `<a href="/store-lookup?category=${encodeURIComponent(c)}">${esc(c)}</a>`).join(" · ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Store lookup: units and stock · ${esc(STORE.name)} (demo store)</title>
<meta name="description" content="Every ${esc(STORE.name)} product with how it is sold, pack contents, price, unit price and stock. For people and AI agents." />
<link rel="stylesheet" href="/styles.css" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="alternate" type="text/plain" href="/catalog.txt" title="Store lookup as text" />
<link rel="alternate" type="application/json" href="/catalog.json" title="Store lookup as JSON" />
</head>
<body>
<header class="top"><div class="wrap bar"><a class="brand" href="/">${esc(STORE.name)}</a><span class="tag">Demo store · synthetic data</span><a class="cart-link" href="/cart.html">Cart</a></div></header>
<main class="wrap">
<h1>Store lookup: units and stock</h1>
<p>${products.length} products${q ? ` matching “${esc(q)}”` : ""}${category ? ` in ${esc(category)}` : ""}. Prices and stock are demonstration data. “Sold as” is <strong>each</strong> (one item) or <strong>pack</strong> (fixed contents). Quantities you order are in units of sale and cannot exceed “available”.</p>
<form class="search" action="/store-lookup" method="get" role="search"><label class="sr-only" for="q">Look up a product</label><input id="q" name="q" type="search" value="${esc(q)}" placeholder="Look up a product, e.g. olive oil" maxlength="100" /><button type="submit">Look up</button></form>
<p class="muted">Categories: <a href="/store-lookup">All</a> · ${cats}</p>
<p class="muted">Also as <a href="/catalog.txt">plain text</a> and <a href="/catalog.json">JSON</a>. To build a cart, give the shopper a link like <code>${esc(origin)}/shop.html#items=PRODUCT_ID:PACKS</code>; they review and confirm on the store's page.</p>
<table class="cart lookup">
<thead><tr><th>Product id</th><th>Name</th><th>Sold as</th><th>Contents</th><th>Price</th><th>Unit price</th><th>Stock</th><th>Max per order</th><th>Category</th></tr></thead>
<tbody>
${rows || '<tr><td colspan="9">No matching products.</td></tr>'}
</tbody>
</table>
</main>
</body>
</html>
`;
}

export function GET(request) {
  const url = new URL(request.url);
  const data = select(url.searchParams);
  const format = url.searchParams.get("format") || "html";
  const headers = { ...PUBLIC_CORS, "Cache-Control": "public, max-age=60" };
  if (format === "json") return json({ store: STORE.name, demo_data: true, ...data }, { headers });
  if (format === "text") return new Response(catalogText(url.origin, data), { headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(html(url.origin, data), { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
}
