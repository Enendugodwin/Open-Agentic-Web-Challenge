#!/usr/bin/env node
// Post-deploy smoke checks (PROJECT_PLAN.md §10.1), run from a different origin
// than the deployment (e.g. a CI runner).
//
//   node scripts/smoke.mjs --url https://shift-handoff.vercel.app
//
// Vercel preview deployments behind Deployment Protection: set
// VERCEL_AUTOMATION_BYPASS_SECRET and the bypass header is added to every request.

const args = process.argv.slice(2);
const urlArg = args[args.indexOf("--url") + 1];
if (!args.includes("--url") || !urlArg) {
  console.error("usage: node scripts/smoke.mjs --url https://<deployment>");
  process.exit(2);
}
const base = new URL(urlArg).origin;
const FOREIGN = "https://smoke-check.example";
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const extra = bypass ? { "x-vercel-protection-bypass": bypass } : {};

const results = [];
async function check(id, name, fn) {
  try {
    await fn();
    results.push({ id, name, ok: true });
  } catch (err) {
    results.push({ id, name, ok: false, error: err.message });
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const get = (p, headers = {}) => fetch(`${base}${p}`, { headers: { Origin: FOREIGN, ...extra, ...headers }, redirect: "manual" });

let manifest;
await check("T-SMK-01", "agent-manifest.json is public with CORS", async () => {
  const r = await get("/agents/agent-manifest.json");
  expect(r.status === 200, `status ${r.status}`);
  expect(r.headers.get("access-control-allow-origin") === "*", "missing Access-Control-Allow-Origin: *");
  expect(!r.headers.get("access-control-allow-credentials"), "must not allow credentials");
  manifest = await r.json();
  const entry = manifest.networks?.find((n) => n.name === "volunteer_desk");
  expect(entry?.front_man && entry?.hocon, "volunteer_desk entry with front_man and hocon");
  expect(manifest.llm_router?.base_url?.startsWith(base), "llm_router.base_url points at this deployment");
});

await check("T-SMK-02", "network JSON is public, CORS, resolved", async () => {
  const entry = manifest?.networks?.find((n) => n.name === "volunteer_desk");
  expect(entry, "needs manifest");
  const r = await fetch(new URL(entry.hocon, `${base}/agents/`), { headers: { Origin: FOREIGN, ...extra } });
  expect(r.status === 200, `status ${r.status}`);
  expect(r.headers.get("access-control-allow-origin") === "*", "missing CORS");
  const text = await r.text();
  expect(!text.includes("${") && !text.includes("__SITE_ORIGIN__"), "unresolved substitution");
  const net = JSON.parse(text);
  expect(net.tools?.length >= 2, "at least two agents");
  expect(text.includes(`${base}/api/mcp/public`), "MCP URL matches this deployment (rebuild artifacts with the right --site-url)");
});

await check("T-SMK-03", "links.json is public with CORS", async () => {
  const r = await get("/agents/links.json");
  expect(r.status === 200, `status ${r.status}`);
  expect(r.headers.get("access-control-allow-origin") === "*", "missing CORS");
  const links = await r.json();
  expect(links.version === 1, "version 1");
  for (const targets of Object.values(links.networks || {})) {
    for (const t of Object.values(targets)) expect(String(t).startsWith("https://"), `non-https link ${t}`);
  }
});

await check("T-SMK-04", "HTTPS enforced with HSTS", async () => {
  expect(base.startsWith("https://"), "deployment URL must be https");
  const r = await get("/");
  expect(r.status === 200, `status ${r.status}`);
  expect(/max-age=\d+/.test(r.headers.get("strict-transport-security") || ""), "missing HSTS");
  const plain = await fetch(base.replace("https://", "http://") + "/", { redirect: "manual", headers: extra });
  expect([301, 307, 308].includes(plain.status), `http:// returned ${plain.status}, expected a redirect`);
});

await check("T-SMK-05", "public MCP: preflight and tools/list from another origin", async () => {
  const pre = await fetch(`${base}/api/mcp/public`, {
    method: "OPTIONS",
    headers: { Origin: FOREIGN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,mcp-protocol-version", ...extra },
  });
  expect(pre.status === 204 || pre.status === 200, `preflight status ${pre.status}`);
  expect(pre.headers.get("access-control-allow-origin") === "*", "preflight CORS");
  const r = await fetch(`${base}/api/mcp/public`, {
    method: "POST",
    headers: { Origin: FOREIGN, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18", ...extra },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
  expect(r.status === 200, `status ${r.status}`);
  const body = await r.json();
  expect(body.result?.tools?.some((t) => t.name === "list_shifts"), "list_shifts listed");
});

await check("T-SMK-06", "private endpoints send no CORS headers", async () => {
  const r = await fetch(`${base}/api/infer/v1/chat/completions`, {
    method: "POST", headers: { Origin: FOREIGN, "Content-Type": "application/json", ...extra }, body: "{}",
  });
  expect(r.status === 403, `cross-origin inference returned ${r.status}, expected 403`);
  expect(!r.headers.get("access-control-allow-origin"), "inference must not be CORS-enabled");
});

await check("T-SMK-CSP", "pages send a CSP without inline scripts", async () => {
  const r = await get("/agents/");
  expect(r.status === 200, `status ${r.status}`);
  const csp = r.headers.get("content-security-policy") || "";
  expect(/script-src 'self'(;|$)/.test(csp) && /frame-ancestors 'none'/.test(csp), `unexpected CSP: ${csp}`);
});

for (const r of results) console.log(`${r.ok ? "✔" : "✖"} ${r.id} ${r.name}${r.ok ? "" : ` — ${r.error}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed for ${base}` : `\nall ${results.length} checks passed for ${base}`);
process.exit(failed ? 1 : 0);
