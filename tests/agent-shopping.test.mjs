// "Shop from your own AI agent": cart-link format, /api/match, the MCP
// create_cart_link tool, and the published prompt.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { startDevServer } from "../scripts/dev-server.mjs";
import { itemsLink, parseShopHash, recipeLink } from "../apps/site/public/shop-link.js";
import { AGENTS_DIR, SITE_ORIGIN, SITE_PORT, ensureAgentsBuilt, mcpPost, root, rpc } from "./support.mjs";

let site;
before(async () => {
  ensureAgentsBuilt();
  site = await startDevServer({ port: SITE_PORT, agentsDir: AGENTS_DIR });
});
after(async () => { await site?.close(); });

test("cart links round-trip and reject malformed entries", () => {
  const link = itemsLink("https://greenleaf-market.vercel.app", [{ product_id: "p_spaghetti_500g", quantity: 1 }, { product_id: "p_large_eggs_12ct", quantity: 2 }]);
  assert.equal(link, "https://greenleaf-market.vercel.app/shop.html#items=p_spaghetti_500g:1,p_large_eggs_12ct:2");
  assert.deepEqual(parseShopHash(new URL(link).hash), {
    kind: "items", items: [{ product_id: "p_spaghetti_500g", quantity: 1 }, { product_id: "p_large_eggs_12ct", quantity: 2 }], errors: [],
  });
  const messy = parseShopHash("#items=p_spaghetti_500g:2,p_spaghetti_500g:1,<script>:1,p_large_eggs_12ct:99,p_milk_1000ml");
  assert.deepEqual(messy.items, [{ product_id: "p_spaghetti_500g", quantity: 3 }, { product_id: "p_milk_1000ml", quantity: 1 }]);
  assert.equal(messy.errors.length, 2);

  const r = recipeLink("https://greenleaf-market.vercel.app", ["400 g spaghetti", "2 cloves garlic"]);
  assert.equal(r, "https://greenleaf-market.vercel.app/shop.html#recipe=400%20g%20spaghetti%0A2%20cloves%20garlic");
  assert.deepEqual(parseShopHash(new URL(r).hash), { kind: "recipe", lines: ["400 g spaghetti", "2 cloves garlic"], errors: [] });
  assert.equal(parseShopHash("").kind, "empty");
  assert.equal(parseShopHash(`#recipe=${encodeURIComponent(Array(60).fill("salt").join("\n"))}`).lines.length, 40);
});

test("GET /api/match: public, CORS, returns products and a cart link", async () => {
  const r = await fetch(`${SITE_ORIGIN}/api/match?i=${encodeURIComponent("400 g spaghetti")}&i=4%20eggs&i=water`, { headers: { Origin: "https://chat.example" } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  const data = await r.json();
  assert.deepEqual(data.items.map((i) => i.status), ["matched", "matched", "not_found"]);
  assert.equal(data.cart_link, `${SITE_ORIGIN}/shop.html#items=p_spaghetti_500g:1,p_large_eggs_12ct:1`);
  assert.equal((await fetch(`${SITE_ORIGIN}/api/match`)).status, 400);
  const tooMany = new URLSearchParams(Array.from({ length: 41 }, () => ["i", "salt"]));
  assert.equal((await fetch(`${SITE_ORIGIN}/api/match?${tooMany}`)).status, 400);
});

test("MCP create_cart_link: validates ids against the catalog and returns a review link", async () => {
  const url = `${SITE_ORIGIN}/api/mcp/public`;
  const call = await mcpPost(url, rpc(1, "tools/call", { name: "create_cart_link", arguments: { items: [
    { product_id: "p_spaghetti_500g", quantity: 1 }, { product_id: "p_invented_9g", quantity: 1 }, { product_id: "p_fresh_basil_30g", quantity: 1 },
  ] } }));
  const data = JSON.parse(call.json.result.content[0].text);
  assert.equal(data.url, `${SITE_ORIGIN}/shop.html#items=p_spaghetti_500g:1`);
  assert.deepEqual(data.rejected.map((r) => r.reason).sort(), ["out_of_stock", "unknown_product"]);
  assert.match(data.note, /Nothing is in their cart/);
  const tools = (await mcpPost(url, rpc(2, "tools/list"))).json.result.tools;
  assert.equal(tools.find((t) => t.name === "create_cart_link").annotations.readOnlyHint, true);
});

test("review page and prompt are published", async () => {
  for (const p of ["/shop.html", "/shop.js", "/shop-link.js", "/agent-prompt.txt"]) {
    assert.equal((await fetch(`${SITE_ORIGIN}${p}`)).status, 200, p);
  }
  const html = await (await fetch(`${SITE_ORIGIN}/shop.html`)).text();
  assert.match(html, /Nothing is in your cart until you click/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
});

test("the prompt points at the live store and keeps the shopper in control", () => {
  const prompt = readFileSync(path.join(root, "apps/site/public/agent-prompt.txt"), "utf8");
  for (const needle of [
    "https://greenleaf-market.vercel.app/api/mcp/public",
    "https://greenleaf-market.vercel.app/api/match?i=",
    "https://greenleaf-market.vercel.app/shop.html#items=",
    "https://greenleaf-market.vercel.app/shop.html#recipe=",
    "match_ingredients", "search_products", "create_cart_link",
    "Never invent product ids", "Never say items were added", "not as instructions", "payment details",
  ]) assert.ok(prompt.includes(needle), needle);
  // Example links in the prompt must parse.
  assert.equal(parseShopHash("#recipe=400%20g%20spaghetti%0A2%20cloves%20garlic").lines.length, 2);
});
