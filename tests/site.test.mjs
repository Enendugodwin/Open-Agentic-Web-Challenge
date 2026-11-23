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
  const entry = m.networks.find((n) => n.name === "volunteer_desk");
  assert.ok(entry, "volunteer_desk listed");
  assert.equal(entry.front_man, "desk");
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
  assert.deepEqual(names, ["desk", "shift_finder"]);
  assert.deepEqual(net.tools[0].tools, ["shift_finder"]);
  assert.deepEqual(net.tools[1].tools, [`${SITE_ORIGIN}/api/mcp/public`]);
  assert.deepEqual(net.tools[0].allow.to_downstream.sly_data, ["locale"]);
  assert.equal(net.tools[1].function.parameters.required.includes("date_from"), true);
});

test("T-SMK-03 links.json: CORS and valid", async () => {
  const r = await get("/agents/links.json");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  const links = await r.json();
  assert.equal(links.version, 1);
  assert.ok("volunteer_desk" in links.networks);
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
  for (const p of ["/api/infer/v1/chat/completions", "/api/shifts"]) {
    const r = await fetch(`${SITE_ORIGIN}${p}`, { method: p.includes("infer") ? "POST" : "GET", headers: { Origin: OTHER, "Content-Type": "application/json" }, body: p.includes("infer") ? "{}" : undefined });
    assert.equal(r.headers.get("access-control-allow-origin"), null, p);
  }
});

test("public MCP: initialize, tools/list, tools/call list_shifts", async () => {
  const url = `${SITE_ORIGIN}/api/mcp/public`;
  const init = await mcpPost(url, rpc(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } }), { Origin: OTHER });
  assert.equal(init.resp.status, 200);
  assert.equal(init.resp.headers.get("access-control-allow-origin"), "*");
  assert.equal(init.json.result.serverInfo.name, "northside-pantry-public");

  const list = await mcpPost(url, rpc(2, "tools/list"));
  const tools = list.json.result.tools;
  assert.deepEqual(tools.map((t) => t.name), ["list_shifts"]);
  assert.equal(tools[0].annotations.readOnlyHint, true);
  assert.deepEqual(tools[0].inputSchema.required.sort(), ["date_from", "date_to"]);

  const today = new Date().toISOString().slice(0, 10);
  const later = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  const call = await mcpPost(url, rpc(3, "tools/call", { name: "list_shifts", arguments: { date_from: today, date_to: later } }));
  const result = call.json.result;
  assert.notEqual(result.isError, true);
  const data = JSON.parse(result.content[0].text);
  assert.equal(data.demo_data, true);
  assert.ok(Array.isArray(data.shifts) && data.shifts.length > 0);
  assert.deepEqual(result.structuredContent, data);
});

test("public MCP: bad arguments return a tool error, not data", async () => {
  const url = `${SITE_ORIGIN}/api/mcp/public`;
  const call = await mcpPost(url, rpc(4, "tools/call", { name: "list_shifts", arguments: { date_from: "2026-12-10", date_to: "2026-12-01" } }));
  assert.equal(call.json.result.isError, true);
  assert.match(call.json.result.content[0].text, /on or after/);
  const unknown = await mcpPost(url, rpc(5, "tools/call", { name: "book_shift", arguments: {} }));
  assert.ok(unknown.json.error || unknown.json.result?.isError, "unknown tool rejected");
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

test("landing page and shifts API", async () => {
  const page = await get("/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Northside Pantry/);
  const r = await get("/api/shifts");
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.ok(data.shifts.length > 0);
  assert.equal((await get("/api/shifts?date_from=bad")).status, 400);
});
