// Store lookup: units of sale and stock, via the catalog, MCP and HTTP.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startDevServer } from "../scripts/dev-server.mjs";
import { lookupProducts, matchIngredients, PRODUCTS, publicProduct, quoteCart } from "../apps/site/lib/catalog.js";
import { AGENTS_DIR, SITE_ORIGIN, SITE_PORT, ensureAgentsBuilt, mcpPost, rpc } from "./support.mjs";

const byName = (n) => PRODUCTS.find((p) => p.name === n);

let site;
before(async () => {
  ensureAgentsBuilt();
  site = await startDevServer({ port: SITE_PORT, agentsDir: AGENTS_DIR });
});
after(async () => { await site?.close(); });

test("every product says how it is sold and how many are in stock", () => {
  for (const p of PRODUCTS) {
    const pub = publicProduct(p);
    assert.ok(["each", "pack"].includes(pub.unit.sold_as), p.id);
    assert.ok(["g", "ml", "items"].includes(pub.unit.contents.unit), p.id);
    assert.equal(pub.stock.available, p.stock);
    assert.ok(pub.stock.max_per_order <= 20 && pub.stock.max_per_order <= p.stock, p.id);
  }
  assert.deepEqual(publicProduct(byName("Lemons")).unit, { sold_as: "each", contents: { amount: 1, unit: "items" }, label: "each (1 item)", unit_price: "$0.69 each" });
  assert.deepEqual(publicProduct(byName("Spaghetti")).unit, { sold_as: "pack", contents: { amount: 500, unit: "g" }, label: "pack of 500 g", unit_price: "$0.38 per 100 g" });
  assert.equal(publicProduct(byName("Large eggs")).unit.unit_price, "$0.33 per item");
  assert.equal(publicProduct(byName("Whole milk")).unit.unit_price, "$0.19 per 100 ml");
  assert.deepEqual(publicProduct(byName("Fresh basil")).stock, { in_stock: false, available: 0, status: "out_of_stock", max_per_order: 0 });
  assert.equal(publicProduct(byName("Whole chicken")).stock.max_per_order, 15);
});

test("lookup by id and by name", () => {
  const r = lookupProducts({ product_ids: ["p_spaghetti_500g", "p_nope_1g"], names: ["olive oil", "unobtainium"] });
  assert.deepEqual(r.results.map((x) => [x.by, x.found]), [["id", true], ["id", false], ["name", true], ["name", false]]);
  assert.equal(r.results[0].product.unit.contents.amount, 500);
  assert.equal(r.results[2].product.name, "Extra virgin olive oil");
  assert.ok(Array.isArray(r.results[2].alternatives));
});

test("orders and pack suggestions never exceed stock", () => {
  const chicken = byName("Whole chicken"); // 15 in stock
  const q = quoteCart([{ product_id: chicken.id, quantity: 16 }]);
  assert.equal(q.lines.length, 0);
  assert.deepEqual(q.rejected, [{ product_id: chicken.id, reason: "only 15 in stock", available: 15 }]);
  assert.equal(quoteCart([{ product_id: chicken.id, quantity: 15 }]).lines[0].quantity, 15);
  const m = matchIngredients(["30 kg whole chicken"]).items[0];
  assert.equal(m.packs, 15);
  assert.match(m.note, /Only 15 in stock/);
});

test("MCP lookup_products returns units and stock", async () => {
  const url = `${SITE_ORIGIN}/api/mcp/public`;
  const call = await mcpPost(url, rpc(1, "tools/call", { name: "lookup_products", arguments: { product_ids: ["p_fresh_basil_30g"], names: ["eggs"] } }));
  const data = JSON.parse(call.json.result.content[0].text);
  assert.equal(data.results[0].product.stock.status, "out_of_stock");
  assert.equal(data.results[1].product.unit.contents.amount, 12);
  assert.equal(data.results[1].product.unit.contents.unit, "items");
  const empty = await mcpPost(url, rpc(2, "tools/call", { name: "lookup_products", arguments: {} }));
  assert.equal(empty.json.result.isError, true);
});

test("GET /api/lookup: public, CORS, validated", async () => {
  const r = await fetch(`${SITE_ORIGIN}/api/lookup?id=p_large_eggs_12ct&name=${encodeURIComponent("heavy cream")}`, { headers: { Origin: "https://chat.example" } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  const data = await r.json();
  assert.equal(data.results[0].product.unit.label, "pack of 12 ct");
  assert.equal(data.results[1].product.unit.contents.unit, "ml");
  assert.equal((await fetch(`${SITE_ORIGIN}/api/lookup`)).status, 400);
  const many = new URLSearchParams(Array.from({ length: 41 }, () => ["name", "salt"]));
  assert.equal((await fetch(`${SITE_ORIGIN}/api/lookup?${many}`)).status, 400);
});
