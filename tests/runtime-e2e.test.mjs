// End-to-end J1 without a browser: the vendored runtime (packages/runtime) loads the
// published network from the local site, validates it, and runs desk -> shift_finder
// -> list_shifts (public MCP), with every model call going through the site-funded
// proxy (/api/infer) to a fake provider. No visitor key is configured.
//
// Browser behaviour simulated here: `location` is the site's /agents/ page, and
// same-origin fetches carry Origin + Sec-Fetch-Site like a browser would.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startDevServer } from "../scripts/dev-server.mjs";
import { AGENTS_DIR, SITE_ORIGIN, SITE_PORT, ensureAgentsBuilt, startFakeLlm } from "./support.mjs";

let site;
let llm;
let mcpCalls = 0;
const realFetch = globalThis.fetch;

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() };
}

// The fake model: delegate to shift_finder, then call list_shifts, then answer
// using the tool output it received.
function decide(body) {
  const names = (body.tools || []).map((t) => t.function.name);
  const last = body.messages[body.messages.length - 1];
  if (last.role === "tool") return { content: `Here is what I found: ${String(last.content).slice(0, 4000)}` };
  const finder = names.find((n) => n.includes("shift_finder"));
  if (finder) return { toolCall: { name: finder, arguments: { inquiry: "Saturday morning shifts", date_from: "2026-12-05", date_to: "2026-12-05" } } };
  const lister = names.find((n) => n.includes("list_shifts"));
  const today = new Date().toISOString().slice(0, 10);
  const later = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  if (lister) return { toolCall: { name: lister, arguments: { date_from: today, date_to: later, role: "sorting" } } };
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
});

after(async () => {
  globalThis.fetch = realFetch;
  delete globalThis.location;
  await site?.close();
  await llm?.close();
});

test("J1: the site's agent answers from the MCP tool using the site-funded router, with no visitor key", async () => {
  const { Engine } = await import("../packages/runtime/engine.js");
  const engine = new Engine({ originUrl: `${SITE_ORIGIN}/agents` });
  const events = [];
  engine.trace.subscribe?.((ev) => events.push(ev));

  const { network, validation } = await engine.loadTop();
  assert.equal(network.findFrontMan(), "desk");
  assert.deepEqual(validation.errors || [], []);
  assert.equal(engine.siteFunded, true, "site-funded router selected");
  assert.equal(engine.top.llm.baseUrl, `${SITE_ORIGIN}/api/infer/v1`);

  const text = await engine.run("Which sorting shifts are open this week?");
  assert.match(text, /Here is what I found/);
  assert.match(text, /shf_\d{8}_0900_sorting|demo_data/, "answer is grounded in list_shifts output");
  assert.ok(mcpCalls >= 2, `MCP server was called (initialize + tools); saw ${mcpCalls}`);

  // Every model request went through our proxy: server key and model, never a client key.
  assert.ok(llm.requests.length >= 3, `expected >= 3 model calls, saw ${llm.requests.length}`);
  for (const r of llm.requests) {
    assert.equal(r.headers.authorization, "Bearer sk-test-server-side-key-000000");
    assert.equal(r.body.model, "server-chosen-model");
  }
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
    { name: "desk", instructions: "x", function: { description: "x" }, tools: ["missing_agent"] },
    { name: "desk", instructions: "dup", function: { description: "dup" }, tools: [] },
  ] }, "bad");
  const v = validateNetwork(bad);
  assert.ok(v.errors.length > 0, "validation errors reported");
  assert.equal(llm.requests.length, before);
});
