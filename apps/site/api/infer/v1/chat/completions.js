// Site-funded default inference: POST /api/infer/v1/chat/completions
//
// Spec §4 "Default inference": the site publishes a default router so visitors can
// use the agent without any LLM setup. This endpoint forwards OpenAI-compatible chat
// requests from this site's own runtime to the publisher's provider.
//
// Controls:
// - Same-origin browser requests only (Origin/Sec-Fetch-Site checks); no CORS
//   headers, so other origins' pages cannot read responses. Peer callers use their
//   own router (spec §3.2) and never reach this endpoint.
// - The provider key lives only in INFERENCE_API_KEY on the server. Any
//   Authorization header from the client is ignored and never forwarded.
// - The server chooses the model and caps output tokens, messages and body size.
// - INFERENCE_DISABLED=1 is a kill switch. Per-instance rate limits (see ADR 0003).
// - Nothing from the request or the key is logged.

import { clientIp, createRateLimiter, isSameOriginBrowserRequest, json, readJsonBody } from "../../../../lib/http.js";

// One assistant question can take ~10 model calls (agent delegation + tools).
const perIp = createRateLimiter({ limit: 200, windowMs: 10 * 60_000 });
const MAX_MESSAGES = 80;
const ALLOWED_FIELDS = ["messages", "tools", "tool_choice", "stream", "temperature"];

function config() {
  const env = process.env;
  return {
    disabled: env.INFERENCE_DISABLED === "1" || env.INFERENCE_DISABLED === "true",
    baseUrl: (env.INFERENCE_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    apiKey: env.INFERENCE_API_KEY || "",
    model: env.INFERENCE_MODEL || "gpt-4o-mini",
    maxTokens: Math.min(Number(env.INFERENCE_MAX_TOKENS || 1024) || 1024, 4096),
    timeoutMs: Number(env.INFERENCE_TIMEOUT_MS || 55_000),
    extraBody: parseExtraBody(env.INFERENCE_EXTRA_BODY),
  };
}

// Optional provider-specific request options set by the site owner, for example
// OpenRouter's {"reasoning":{"effort":"low","exclude":true}}. They can never
// override the model, messages, tools or token cap.
const PROTECTED = new Set(["model", "messages", "tools", "tool_choice", "stream", "max_tokens", "max_completion_tokens"]);
function parseExtraBody(raw) {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([k]) => !PROTECTED.has(k)));
  } catch {
    return {};
  }
}

function errorBody(code, message) {
  // OpenAI-style error envelope, which the runtime shows to the user.
  return { error: { type: code, code, message } };
}

export async function POST(request) {
  const cfg = config();
  if (!isSameOriginBrowserRequest(request)) {
    return json(errorBody("forbidden_origin", "This inference endpoint serves only this site's own pages."), { status: 403 });
  }
  if (cfg.disabled) {
    return json(errorBody("inference_disabled", "The site's demo AI model is switched off right now. Please try again later."), { status: 503 });
  }
  if (!cfg.apiKey) {
    return json(errorBody("inference_not_configured", "The site's demo AI model is not configured (INFERENCE_API_KEY is missing)."), { status: 503 });
  }
  const rate = perIp(clientIp(request));
  if (!rate.ok) {
    return json(errorBody("rate_limited", `Too many requests. Try again in ${rate.retryAfterSec} s.`),
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } });
  }

  const body = await readJsonBody(request, { maxBytes: 256 * 1024 });
  if (!body.ok) return body.response;
  const input = body.value;
  if (!input || !Array.isArray(input.messages) || input.messages.length === 0 || input.messages.length > MAX_MESSAGES) {
    return json(errorBody("invalid_request", `messages must be a non-empty array of at most ${MAX_MESSAGES} items.`), { status: 400 });
  }

  const upstreamBody = { ...cfg.extraBody, model: cfg.model, max_tokens: cfg.maxTokens };
  for (const k of ALLOWED_FIELDS) if (input[k] !== undefined) upstreamBody[k] = input[k];
  if (upstreamBody.stream) upstreamBody.stream_options = { include_usage: true };

  let upstream;
  try {
    upstream = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(upstreamBody),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(cfg.timeoutMs)].filter(Boolean)),
    });
  } catch {
    return json(errorBody("upstream_unreachable", "The site's AI provider could not be reached."), { status: 502 });
  }

  if (!upstream.ok) {
    // Do not pass provider error bodies through: they can echo request details.
    const status = upstream.status === 429 ? 429 : 502;
    await upstream.body?.cancel().catch(() => {});
    return json(errorBody("upstream_error", `The site's AI provider returned HTTP ${upstream.status}.`), { status });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "text/event-stream",
      "Cache-Control": "no-store",
      "X-Nsdeploy-LLM-Route": "site-funded",
    },
  });
}

export function GET() {
  return json(errorBody("method_not_allowed", "POST only."), { status: 405, headers: { Allow: "POST" } });
}
