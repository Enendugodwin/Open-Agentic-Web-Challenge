// HTTP-level checks against the local Vercel stand-in: public artifacts and CORS
// (smoke checks T-SMK-01..07 from PROJECT_PLAN.md §10.1, local edition), the public
// MCP server, and the site-funded inference proxy.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startDevServer } from "../scripts/dev-server.mjs";
import { AGENTS_DIR, SITE_ORIGIN, SITE_PORT, ensureAgentsBuilt, mcpPost, rpc, startFakeLlm } from "./support.mjs";

const OTHER = "https://other-origin.example";
let site;
let llm;

before(async () => {
  ensureAgentsBuilt();
  llm = await startFakeLlm(() => ({ content: "hello from fake" }));
  Object.assign(process.env, {
    INFERENCE_BASE_URL: llm.url,
    INFERENCE_API_KEY: "sk-test-server-side-key-000000",
    INFERENCE_MODEL: "server-chosen-model",
    INFERENCE_MAX_TOKENS: "300",
  });
  delete process.env.INFERENCE_DISABLED;
  site = await startDevServer({ port: SITE_PORT, agentsDir: AGENTS_DIR });
});

after(async () => {
  await site?.close();
  await llm?.close();
});

const get = (p, headers = {}) => fetch(`${SITE_ORIGIN}${p}`, { headers: { Origin: OTHER, ...headers } });

test("T-SMK-01 manifest: public, CORS *, no credentials, exact network entry", async () => {
  const r = await get("/agents/agent-manifest.json");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  assert.equal(r.headers.get("access-control-allow-credentials"), null);
  const m = await r.json();
  const entry = m.networks.find((n) => n.name === "market_assistant");
  assert.ok(entry, "market_assistant listed");
  assert.equal(entry.front_man, "assistant");
  assert.ok(entry.hocon);
  assert.equal(m.llm_router.site_funded, true);
  assert.equal(m.llm_router.base_url, `${SITE_ORIGIN}/api/infer/v1`);
  assert.equal(m.llm_router.byok_router, "");
  assert.ok(m.peer_policy, "peer policy published");
});

test("T-SMK-02 network JSON: CORS, resolved, two agents, grounded MCP tool", async () => {
  const m = await (await get("/agents/agent-manifest.json")).json();
  const r = await get(`/agents/${m.networks[0].hocon.replace(/^\.\//, "")}`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  const text = await r.text();
  assert.ok(!text.includes("${") && !text.includes("__SITE_ORIGIN__"), "no substitutions left");
  const net = JSON.parse(text);
  const names = net.tools.map((t) => t.name);
  assert.deepEqual(names, ["assistant", "ingredient_finder"]);
  assert.deepEqual(net.tools[0].tools, ["ingredient_finder"]);
  assert.deepEqual(net.tools[1].tools, [`${SITE_ORIGIN}/api/mcp/public`]);
  assert.deepEqual(net.tools[0].allow.to_downstream.sly_data, ["locale"]);
  assert.deepEqual(net.tools[1].function.parameters.required, ["ingredients"]);
});

test("T-SMK-03 links.json: CORS and valid", async () => {
  const r = await get("/agents/links.json");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  const links = await r.json();
  assert.equal(links.version, 1);
  assert.ok("market_assistant" in links.networks);
});

test("security headers on pages; inline scripts not needed", async () => {
  const r = await get("/agents/");
  assert.equal(r.status, 200);
  const csp = r.headers.get("content-security-policy");
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(r.headers.get("access-control-allow-origin"), null, "pages are not CORS-enabled");
  const html = await r.text();
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
  const redirect = await fetch(`${SITE_ORIGIN}/agents`, { redirect: "manual" });
  assert.equal(redirect.status, 307);
  assert.equal(redirect.headers.get("location"), "/agents/");
});

test("T-SMK-05 public MCP preflight allows the MCP headers from any origin", async () => {
  const r = await fetch(`${SITE_ORIGIN}/api/mcp/public`, {
    method: "OPTIONS",
    headers: { Origin: OTHER, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,mcp-protocol-version" },
  });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  assert.match(r.headers.get("access-control-allow-headers"), /MCP-Protocol-Version/i);
  assert.match(r.headers.get("access-control-allow-methods"), /POST/);
});

test("T-SMK-06 private endpoints send no CORS headers", async () => {
  for (const p of ["/api/infer/v1/chat/completions", "/api/cart/quote", "/api/products"]) {
    const r = await fetch(`${SITE_ORIGIN}${p}`, { method: p === "/api/products" ? "GET" : "POST", headers: { Origin: OTHER, "Content-Type": "application/json" }, body: p === "/api/products" ? undefined : "{}" });
    assert.equal(r.headers.get("access-control-allow-origin"), null, p);
  }
});

test("public MCP: initialize, tools/list, match_ingredients, search_products", async () => {
  const url = `${SITE_ORIGIN}/api/mcp/public`;
  const init = await mcpPost(url, rpc(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } }), { Origin: OTHER });
  assert.equal(init.resp.status, 200);
  assert.equal(init.resp.headers.get("access-control-allow-origin"), "*");
  assert.equal(init.json.result.serverInfo.name, "greenleaf-market-public");

  const list = await mcpPost(url, rpc(2, "tools/list"));
  const tools = list.json.result.tools;
  assert.deepEqual(tools.map((t) => t.name).sort(), ["match_ingredients", "search_products"]);
  for (const t of tools) assert.equal(t.annotations.readOnlyHint, true, t.name);

  const call = await mcpPost(url, rpc(3, "tools/call", { name: "match_ingredients", arguments: { ingredients: ["400 g spaghetti", "4 large eggs", "water"] } }));
  const result = call.json.result;
  assert.notEqual(result.isError, true);
  const data = JSON.parse(result.content[0].text);
  assert.equal(data.demo_data, true);
  assert.deepEqual(data.items.map((i) => i.status), ["matched", "matched", "not_found"]);
  assert.match(data.items[0].product.id, /^p_spaghetti_500g$/);
  assert.deepEqual(result.structuredContent, data);

  const search = await mcpPost(url, rpc(4, "tools/call", { name: "search_products", arguments: { query: "olive oil", limit: 3 } }));
  const found = JSON.parse(search.json.result.content[0].text);
  assert.equal(found.products[0].name, "Extra virgin olive oil");
});

test("public MCP: bad arguments return a tool error, not data; no write tools exist", async () => {
  const url = `${SITE_ORIGIN}/api/mcp/public`;
  const call = await mcpPost(url, rpc(5, "tools/call", { name: "match_ingredients", arguments: { ingredients: [] } }));
  assert.equal(call.json.result.isError, true);
  const unknown = await mcpPost(url, rpc(6, "tools/call", { name: "add_to_cart", arguments: {} }));
  assert.ok(unknown.json.error || unknown.json.result?.isError, "add_to_cart is not an MCP tool");
});
test("public MCP: oversized body rejected", async () => {
  const r = await fetch(`${SITE_ORIGIN}/api/mcp/public`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify(rpc(6, "tools/list", { pad: "x".repeat(40_000) })),
  });
  assert.equal(r.status, 413);
});

const sameOrigin = { Origin: SITE_ORIGIN, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" };

test("inference proxy: forwards same-origin requests with the server key and model", async () => {
  llm.requests.length = 0;
  const r = await fetch(`${SITE_ORIGIN}/api/infer/v1/chat/completions`, {
    method: "POST",
    headers: { ...sameOrigin, Authorization: "Bearer client-supplied-should-be-dropped" },
    body: JSON.stringify({ model: "client-model", max_tokens: 99999, stream: true, messages: [{ role: "user", content: "hi" }], user: "drop-me" }),
  });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /hello from fake/);
  assert.equal(llm.requests.length, 1);
  const up = llm.requests[0];
  assert.equal(up.headers.authorization, "Bearer sk-test-server-side-key-000000");
  assert.equal(up.body.model, "server-chosen-model");
  assert.equal(up.body.max_tokens, 300);
  assert.equal(up.body.user, undefined, "unknown fields are not forwarded");
});

test("inference proxy: rejects other origins and non-browser callers", async () => {
  llm.requests.length = 0;
  const body = JSON.stringify({ messages: [{ role: "user", content: "hi" }] });
  const cross = await fetch(`${SITE_ORIGIN}/api/infer/v1/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Origin: OTHER, "Sec-Fetch-Site": "cross-site" }, body });
  assert.equal(cross.status, 403);
  const noOrigin = await fetch(`${SITE_ORIGIN}/api/infer/v1/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  assert.equal(noOrigin.status, 403);
  assert.equal(llm.requests.length, 0, "nothing reached the provider");
});

test("inference proxy: kill switch, missing key, bad body, hidden upstream errors", async () => {
  const call = (body) => fetch(`${SITE_ORIGIN}/api/infer/v1/chat/completions`, { method: "POST", headers: sameOrigin, body });
  process.env.INFERENCE_DISABLED = "1";
  assert.equal((await call('{"messages":[{"role":"user","content":"x"}]}')).status, 503);
  delete process.env.INFERENCE_DISABLED;

  const key = process.env.INFERENCE_API_KEY;
  delete process.env.INFERENCE_API_KEY;
  const missing = await call('{"messages":[{"role":"user","content":"x"}]}');
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).error.code, "inference_not_configured");
  process.env.INFERENCE_API_KEY = key;

  assert.equal((await call('{"messages":[]}')).status, 400);
  assert.equal((await call("not json")).status, 400);

  const failing = await startFakeLlm(() => ({ status: 401 }));
  process.env.INFERENCE_BASE_URL = failing.url;
  const r = await call('{"messages":[{"role":"user","content":"x"}]}');
  assert.equal(r.status, 502);
  assert.doesNotMatch(await r.text(), /secret-echo/, "provider error body is not passed through");
  process.env.INFERENCE_BASE_URL = llm.url;
  await failing.close();
});

test("store pages and products API", async () => {
  for (const p of ["/", "/cart.html", "/cart-store.js"]) assert.equal((await get(p)).status, 200, p);
  const r = await get("/api/products?q=spaghetti");
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.products[0].name, "Spaghetti");
  assert.ok(data.categories.includes("Produce"));
  assert.equal((await get("/api/products?category=Nope")).status, 400);
});

test("cart quote: same-origin only, server prices, rejects bad lines", async () => {
  const body = JSON.stringify({ items: [{ product_id: "p_spaghetti_500g", quantity: 2 }, { product_id: "p_fake_1g", quantity: 1 }] });
  const cross = await fetch(`${SITE_ORIGIN}/api/cart/quote`, { method: "POST", headers: { "Content-Type": "application/json", Origin: OTHER, "Sec-Fetch-Site": "cross-site" }, body });
  assert.equal(cross.status, 403);
  const ok = await fetch(`${SITE_ORIGIN}/api/cart/quote`, { method: "POST", headers: sameOrigin, body });
  assert.equal(ok.status, 200);
  const q = await ok.json();
  assert.equal(q.lines.length, 1);
  assert.equal(q.lines[0].quantity, 2);
  assert.equal(q.rejected[0].reason, "unknown_product");
  const bad = await fetch(`${SITE_ORIGIN}/api/cart/quote`, { method: "POST", headers: sameOrigin, body: '{"items":[]}' });
  assert.equal(bad.status, 400);
});