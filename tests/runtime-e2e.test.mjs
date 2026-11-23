// End-to-end "recipe to cart" without a browser. The vendored runtime
// (packages/runtime) loads the published network from the local site, validates it,
// runs assistant -> ingredient_finder -> match_ingredients (public MCP), and routes
// every model call through the site-funded proxy (/api/infer) to a fake provider.
// No visitor key is configured. It then runs the add_to_cart site action through
// the runtime's ActionRegistry, with the user declining and then confirming.
//
// Browser behaviour simulated here: `location` is the store's /agents/ page, the
// action module is imported over http (node --experimental-network-imports allows
// loopback), localStorage is in memory, and same-origin requests carry Origin and
// Sec-Fetch-Site headers as a browser would send them.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startDevServer } from "../scripts/dev-server.mjs";
import { AGENTS_DIR, SITE_ORIGIN, SITE_PORT, ensureAgentsBuilt, startFakeLlm } from "./support.mjs";

const RECIPE = ["400 g spaghetti", "150 g pancetta", "4 large eggs", "100 g pecorino romano", "black pepper", "Fresh basil leaves", "1 cup dry white wine"];

let site;
let llm;
let engine;
let mcpCalls = 0;
const realFetch = globalThis.fetch;

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() };
}

// The fake model: delegate the recipe to ingredient_finder, which calls
// match_ingredients; each agent then answers using the tool output it received.
function decide(body) {
  const names = (body.tools || []).map((t) => t.function.name);
  const last = body.messages[body.messages.length - 1];
  if (last.role === "tool") return { content: `Matched ingredients: ${String(last.content).slice(0, 6000)}` };
  const finder = names.find((n) => n.includes("ingredient_finder"));
  if (finder) return { toolCall: { name: finder, arguments: { ingredients: RECIPE } } };
  const matcher = names.find((n) => n.includes("match_ingredients"));
  if (matcher) return { toolCall: { name: matcher, arguments: { ingredients: RECIPE } } };
  return { content: `No tools available. Saw: ${names.join(",")}` };
}

before(async () => {
  ensureAgentsBuilt();
  llm = await startFakeLlm(decide);
  Object.assign(process.env, { INFERENCE_BASE_URL: llm.url, INFERENCE_API_KEY: "sk-test-server-side-key-000000", INFERENCE_MODEL: "server-chosen-model" });
  delete process.env.INFERENCE_DISABLED;
  site = await startDevServer({ port: SITE_PORT, agentsDir: AGENTS_DIR });

  globalThis.location = new URL(`${SITE_ORIGIN}/agents/`);
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
  globalThis.fetch = (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    if (url.pathname === "/api/mcp/public") mcpCalls += 1;
    if (url.origin === location.origin && init.method && init.method !== "GET") {
      const headers = new Headers(init.headers);
      headers.set("Origin", location.origin);
      headers.set("Sec-Fetch-Site", "same-origin");
      init = { ...init, headers };
    }
    return realFetch(url, init);
  };

  const { Engine } = await import("../packages/runtime/engine.js");
  engine = new Engine({ originUrl: `${SITE_ORIGIN}/agents` });
});

after(async () => {
  globalThis.fetch = realFetch;
  delete globalThis.location;
  await site?.close();
  await llm?.close();
});

test("recipe to ingredients: the store's agent answers from the MCP tool with the site-funded router and no visitor key", async () => {
  const { network, validation } = await engine.loadTop();
  assert.equal(network.findFrontMan(), "assistant");
  assert.deepEqual(validation.errors || [], []);
  assert.equal(engine.siteFunded, true, "site-funded router selected");
  assert.equal(engine.top.llm.baseUrl, `${SITE_ORIGIN}/api/infer/v1`);

  const text = await engine.run("Get me everything for spaghetti carbonara.");
  assert.match(text, /Matched ingredients/);
  assert.match(text, /p_spaghetti_500g/, "answer is grounded in match_ingredients output");
  assert.match(text, /substituted/, "out-of-stock basil reported as a substitution");
  assert.ok(mcpCalls >= 2, `MCP server was called (initialize + tools); saw ${mcpCalls}`);

  const toolNames = llm.requests.flatMap((r) => (r.body.tools || []).map((t) => t.function.name));
  assert.ok(toolNames.includes("ingredient_finder"));
  assert.ok(toolNames.some((n) => n.includes("match_ingredients")));
  for (const r of llm.requests) {
    assert.equal(r.headers.authorization, "Bearer sk-test-server-side-key-000000");
    assert.equal(r.body.model, "server-chosen-model");
  }
});

test("add_to_cart: registered as a local-only write; nothing happens until the user confirms", async () => {
  const scope = { base: engine.top.base, network: engine.top.network.name };
  const catalog = engine.actions.catalog(scope);
  const entry = catalog.find((a) => a.name === "add_to_cart");
  assert.ok(entry, `add_to_cart registered (catalog: ${catalog.map((a) => a.name).join(",")})`);
  assert.equal(entry.effect, "write");
  assert.equal(entry.availability, "local-only");

  const { readCart } = await import(`${SITE_ORIGIN}/cart-store.js`);
  const component = { kind: "action", id: "fill", action: entry.ref, arguments: { items: [
    { product_id: "p_spaghetti_500g", quantity: 1 },
    { product_id: "p_diced_pancetta_120g", quantity: 2 },
    { product_id: "p_large_eggs_12ct", quantity: 1 },
  ] } };
  const plan = engine.actions.prepare(component);

  let shown;
  const declined = await engine.actions.execute(plan, async (items) => { shown = items; return false; }, "turn-1");
  assert.equal(declined, null, "declined: nothing executed");
  assert.equal(readCart().lines.length, 0, "cart unchanged");
  assert.equal(shown[0].action, "add_to_cart");
  assert.equal(shown[0].origin, SITE_ORIGIN, "user sees the destination origin");
  assert.equal(shown[0].effect, "write");
  assert.equal(shown[0].arguments.items.length, 3, "user sees the exact items");

  const receipts = await engine.actions.execute(plan, async () => true, "turn-2");
  assert.equal(receipts[0].status, "succeeded");
  assert.equal(receipts[0].result.status, "added");
  assert.equal(receipts[0].result.cart.items, 4);
  const cart = readCart();
  assert.deepEqual(cart.lines.map((l) => [l.id, l.quantity]), [["p_spaghetti_500g", 1], ["p_diced_pancetta_120g", 2], ["p_large_eggs_12ct", 1]]);

  // Same request id again (e.g. a replayed submission): no double add.
  const replay = await engine.actions.execute(plan, async () => true, "turn-2");
  assert.equal(replay[0].result.status, "already_added");
  assert.equal(readCart().lines.find((l) => l.id === "p_diced_pancetta_120g").quantity, 2);
});

test("add_to_cart: invalid arguments are rejected before confirmation", async () => {
  const entry = engine.actions.catalog({ base: engine.top.base, network: engine.top.network.name }).find((a) => a.name === "add_to_cart");
  const bad = [
    { items: [] },
    { items: [{ product_id: "p_spaghetti_500g", quantity: 0 }] },
    { items: [{ product_id: "p_spaghetti_500g", quantity: 1, price_cents: 1 }] },
    { items: [{ product_id: "p_spaghetti_500g", quantity: 1 }], coupon: "FREE" },
  ];
  for (const args of bad) {
    assert.throws(() => engine.actions.prepare({ kind: "action", id: "x", action: entry.ref, arguments: args }), undefined, JSON.stringify(args));
  }
});

test("add_to_cart: unknown products are not stored; server failure reports unknown, never success", async () => {
  const entry = engine.actions.catalog({ base: engine.top.base, network: engine.top.network.name }).find((a) => a.name === "add_to_cart");
  const { readCart } = await import(`${SITE_ORIGIN}/cart-store.js`);
  const before = JSON.stringify(readCart().lines);

  const plan = engine.actions.prepare({ kind: "action", id: "x", action: entry.ref, arguments: { items: [{ product_id: "p_invented_by_model_1g", quantity: 1 }] } });
  const [receipt] = await engine.actions.execute(plan, async () => true, "turn-3");
  assert.equal(receipt.result.status, "nothing_added");
  assert.equal(receipt.result.rejected[0].reason, "unknown_product");
  assert.equal(JSON.stringify(readCart().lines), before);

  const saved = globalThis.fetch;
  globalThis.fetch = async (input, init) => (String(input).includes("/api/cart/quote") ? new Response("{}", { status: 500 }) : saved(input, init));
  try {
    const plan2 = engine.actions.prepare({ kind: "action", id: "y", action: entry.ref, arguments: { items: [{ product_id: "p_spaghetti_500g", quantity: 1 }] } });
    const [r2] = await engine.actions.execute(plan2, async () => true, "turn-4");
    assert.equal(r2.status, "unknown", "failure is never reported as success");
  } finally {
    globalThis.fetch = saved;
  }
  assert.equal(JSON.stringify(readCart().lines), before);
});

test("site_funded is ignored when the router is on another origin", async () => {
  const { isSiteFundedRouter } = await import("../packages/runtime/engine.js");
  const declared = { site_funded: true, base_url: "https://peer.example/api/infer/v1" };
  assert.equal(isSiteFundedRouter(declared, "https://peer.example/api/infer/v1"), false);
  assert.equal(isSiteFundedRouter({ ...declared, base_url: `${SITE_ORIGIN}/api/infer/v1` }, `${SITE_ORIGIN}/api/infer/v1`), true);
  assert.equal(isSiteFundedRouter({ base_url: `${SITE_ORIGIN}/api/infer/v1` }, `${SITE_ORIGIN}/api/infer/v1`), false, "needs the explicit flag");
  assert.equal(isSiteFundedRouter({ site_funded: true, mock: true, base_url: `${SITE_ORIGIN}/api/infer/v1` }, `${SITE_ORIGIN}/api/infer/v1`), false);
});

test("invalid network is rejected before any model call", async () => {
  const { AgentNetwork, validateNetwork } = await import("../packages/runtime/kernel.js");
  const before = llm.requests.length;
  const bad = new AgentNetwork({ tools: [
    { name: "assistant", instructions: "x", function: { description: "x" }, tools: ["missing_agent"] },
    { name: "assistant", instructions: "dup", function: { description: "dup" }, tools: [] },
  ] }, "bad");
  assert.ok(validateNetwork(bad).errors.length > 0, "validation errors reported");
  assert.equal(llm.requests.length, before);
});
