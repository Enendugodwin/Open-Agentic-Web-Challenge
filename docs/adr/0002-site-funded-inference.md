# ADR 0002: Site-funded default inference, no BYOK in the MVP

Status: accepted (M1). Refines plan decision D8.

## Context

The product rule is that visitors never configure an LLM. Spec §4 lets a site publish
a default router that works without a visitor key, and a runtime conforms without
BYOK when that default path runs the network. A peer that loads our network always
uses the caller's router (spec §3.2), so our default router serves only our own
pages.

## Decision

- `POST /api/infer/v1/chat/completions` is an OpenAI-compatible forwarding endpoint.
  It uses `INFERENCE_API_KEY`, which exists only as a Vercel environment variable.
- The manifest declares
  `llm_router: { base_url: <origin>/api/infer/v1, site_funded: true, byok_router: "" }`.
- Runtime patch: `site_funded` is honoured only when all of these hold:
  - it appears in the top site's own manifest;
  - the router equals `base_url`;
  - the router is on the page's origin;
  - no visitor key is active.
  Peers inherit the caller's flag and never use their own (`packages/runtime/PATCHES.md`).
- The endpoint applies these controls:
  - rejects requests without a same-origin `Origin` and `Sec-Fetch-Site`, and sends
    no CORS headers;
  - drops any client `Authorization` header;
  - chooses the model and caps output tokens, message count (80) and body size (256 KB);
  - never passes provider error bodies through;
  - has a kill switch (`INFERENCE_DISABLED=1`).
- The BYOK settings panel is hidden with theme CSS. BYOK stays deferred, so the spec
  §6 "user key never reaches the peer" check is N/A. The "peer cannot change the
  router" check still applies.

## Consequences

- Our pages cost the publisher money. Abuse limits are needed (ADR 0003).
- A non-browser client can forge `Origin`. Rate limits and the per-call token cap
  bound the cost of that, and the kill switch stops it.
