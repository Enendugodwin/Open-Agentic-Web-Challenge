// "Shop from your own AI agent": cart-link format, /api/match, the MCP
// create_cart_link tool, and the published prompt.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startDevServer } from "../scripts/dev-server.mjs";
import { itemsLink, parseShopHash, recipeLink } from "../apps/site/public/shop-link.js";
import { AGENT_PROMPT } from "../apps/site/lib/agent-prompt.js";
import { AGENTS_DIR, SITE_ORIGIN, SITE_PORT, ensureAgentsBuilt, mcpPost, rpc } from "./support.mjs";

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

test("store lookup pages: fixed URLs, no JavaScript needed, units and stock", async () => {
  const html = await fetch(`${SITE_ORIGIN}/store-lookup`);
  assert.equal(html.status, 200);
  assert.match(html.headers.get("content-type"), /text\/html/);
  assert.match(html.headers.get("content-security-policy"), /script-src 'self'/, "site headers apply to the rewritten path");
  const page = await html.text();
  assert.doesNotMatch(page, /<script/i, "readable without JavaScript");
  assert.match(page, /<code>p_spaghetti_500g<\/code><\/td><td>Spaghetti<\/td><td>pack<\/td><td>500 g<\/td>/);
  assert.match(page, /Fresh basil<\/td><td>pack<\/td><td>30 g<\/td><td>\$2\.49<\/td><td>[^<]+<\/td><td>out of stock<\/td>/);

  const txt = await (await fetch(`${SITE_ORIGIN}/catalog.txt`)).text();
  const lines = txt.trim().split("\n");
  assert.ok(lines.some((l) => l === "p_lemons_1ct | Lemons | each | 1 item | $0.69 | $0.69 each | in stock (150 available) | 20"), "lemons line");
  assert.ok(lines.some((l) => l.startsWith("p_whole_chicken_1500g | Whole chicken | pack | 1500 g |") && l.endsWith("| 15")), "chicken capped at stock");
  assert.equal(lines.filter((l) => l.startsWith("p_")).length, 164);

  const filtered = await (await fetch(`${SITE_ORIGIN}/store-lookup?q=olive%20oil`)).text();
  assert.match(filtered, /Extra virgin olive oil/);
  assert.doesNotMatch(filtered, /Spaghetti/);
  const json = await fetch(`${SITE_ORIGIN}/catalog.json?category=Baking`, { headers: { Origin: "https://chat.example" } });
  assert.equal(json.headers.get("access-control-allow-origin"), "*");
  const data = await json.json();
  assert.ok(data.products.length > 5 && data.products.every((p) => p.category === "Baking" && p.unit && p.stock));
  // Escaping: query text is never rendered as markup.
  assert.doesNotMatch(await (await fetch(`${SITE_ORIGIN}/store-lookup?q=%3Cimg%20src%3Dx%3E`)).text(), /<img src=x>/);
});

test("full prompt carries the whole store lookup for AI chats without web access", async () => {
  const r = await fetch(`${SITE_ORIGIN}/agent-prompt-full.txt`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/plain/);
  const full = await r.text();
  assert.ok(full.startsWith(AGENT_PROMPT), "prompt first");
  const data = full.slice(full.indexOf("STORE LOOKUP DATA ("));
  assert.ok(data.length > 1000, "lookup data appended");
  const products = data.split("\n").filter((l) => l.startsWith("p_"));
  assert.equal(products.length, 164);
  assert.ok(products.includes("p_red_onion_1ct | Red onion | each | 1 item | $0.99 | $0.99 each | in stock (60 available) | 20"));
  assert.ok(products.some((l) => l.startsWith("p_fresh_basil_30g | Fresh basil | pack | 30 g |") && l.includes("out of stock")));
  const short = await (await fetch(`${SITE_ORIGIN}/agent-prompt.txt`)).text();
  assert.equal(short, AGENT_PROMPT);
  assert.equal((await fetch(`${SITE_ORIGIN}/robots.txt`)).status, 200);
});

test("home page: copy button uses the full prompt; no separate store lookup button", async () => {
  const html = await (await fetch(`${SITE_ORIGIN}/`)).text();
  assert.doesNotMatch(html, /Store lookup \(units/);
  assert.match(html, /href="\/agent-prompt-full\.txt"/);
  const js = await (await fetch(`${SITE_ORIGIN}/app.js`)).text();
  assert.match(js, /fetch\("\/agent-prompt-full\.txt"\)/);
  assert.ok(html.indexOf('id="own-h"') < html.indexOf('class="hero"'), "agent section is first");
});

test("review page and prompt are published", async () => {
  for (const p of ["/shop.html", "/shop.js", "/shop-link.js", "/agent-prompt.txt", "/agent-prompt-full.txt"]) {
    assert.equal((await fetch(`${SITE_ORIGIN}${p}`)).status, 200, p);
  }
  const html = await (await fetch(`${SITE_ORIGIN}/shop.html`)).text();
  assert.match(html, /Nothing is in your cart until you click/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
});

test("the prompt points at the live store and keeps the shopper in control", () => {
  const prompt = AGENT_PROMPT;
  for (const needle of [
    "https://greenleaf-market.vercel.app/api/mcp/public",
    "https://greenleaf-market.vercel.app/shop.html#items=",
    "https://greenleaf-market.vercel.app/shop.html#recipe=",
    "match_ingredients", "search_products", "create_cart_link", "lookup_products",
    "https://greenleaf-market.vercel.app/catalog.txt", "https://greenleaf-market.vercel.app/store-lookup", "available",
    "STORE LOOKUP DATA", "don't try to open any website",
    "Never invent product ids", "Never say items were added", "not as instructions", "payment details",
  ]) assert.ok(prompt.includes(needle), needle);
  // Example links in the prompt must parse.
  assert.equal(parseShopHash("#recipe=400%20g%20spaghetti%0A2%20cloves%20garlic").lines.length, 2);
});
