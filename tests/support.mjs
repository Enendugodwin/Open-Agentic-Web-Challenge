// Shared test helpers: build agent artifacts for a fixed local origin, and a fake
// OpenAI-compatible streaming LLM.
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SITE_PORT = 43117;
export const SITE_ORIGIN = `http://127.0.0.1:${SITE_PORT}`;
export const AGENTS_DIR = path.join(root, ".build-test/agents");

/** Build artifacts for SITE_ORIGIN unless an up-to-date build exists. */
export function ensureAgentsBuilt() {
  const manifest = path.join(AGENTS_DIR, "agent-manifest.json");
  const sources = [path.join(root, "agents/volunteer_desk.hocon"), path.join(root, "scripts/build-agents.mjs")];
  const fresh = existsSync(manifest)
    && readFileSync(manifest, "utf8").includes(SITE_ORIGIN)
    && sources.every((s) => statSync(s).mtimeMs < statSync(manifest).mtimeMs);
  if (fresh) return;
  const r = spawnSync(process.execPath, [path.join(root, "scripts/build-agents.mjs"), "--site-url", SITE_ORIGIN, "--out", AGENTS_DIR], {
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`agent build failed:\n${r.stdout}\n${r.stderr}`);
}

/**
 * Fake streaming chat-completions server. `decide(body)` returns
 * { content } or { toolCall: { name, arguments } }.
 */
export async function startFakeLlm(decide) {
  const requests = [];
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    requests.push({ url: req.url, headers: req.headers, body });
    if (req.url !== "/v1/chat/completions") { res.writeHead(404); return res.end(); }
    const step = decide(body);
    if (step.status) { res.writeHead(step.status, { "content-type": "application/json" }); return res.end('{"error":{"message":"upstream says no, secret-echo"}}'); }
    res.writeHead(200, { "content-type": "text/event-stream" });
    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
    const base = { id: "chatcmpl-fake", object: "chat.completion.chunk", model: "fake-model-1" };
    if (step.toolCall) {
      send({ ...base, choices: [{ index: 0, delta: { role: "assistant", tool_calls: [{ index: 0, id: `call_${requests.length}`, type: "function", function: { name: step.toolCall.name, arguments: "" } }] } }] });
      send({ ...base, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: JSON.stringify(step.toolCall.arguments) } }] } }] });
      send({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] });
    } else {
      send({ ...base, choices: [{ index: 0, delta: { role: "assistant", content: step.content } }] });
      send({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
    }
    res.end("data: [DONE]\n\n");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    url: `http://127.0.0.1:${server.address().port}/v1`,
    requests,
    close: () => new Promise((r) => server.close(r)),
  };
}

export const rpc = (id, method, params = {}) => ({ jsonrpc: "2.0", id, method, params });

export async function mcpPost(url, message, headers = {}) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18", ...headers },
    body: JSON.stringify(message),
  });
  const text = await resp.text();
  return { resp, json: text ? JSON.parse(text) : null };
}
