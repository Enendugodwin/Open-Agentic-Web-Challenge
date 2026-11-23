# Greenleaf Market: recipe-to-cart open agentic web demo

A demo supermarket website. Give an AI agent a recipe and it goes into the store,
finds every ingredient and fills your cart after you confirm. The store publishes an
open, portable agent network following the
[Worldwide Agentic Web MVP profile](https://github.com/cognizant-ai-labs/agentic-web/blob/main/docs/worldwide_agentic_web_mvp_spec.md)
and is built to run on Vercel. The plan is in [PROJECT_PLAN.md](PROJECT_PLAN.md).

Status: **M1 + M2 slice, built and tested locally, not yet deployed.**

| Works now (spec MVP path) | Planned |
| --- | --- |
| `/agents/agent-manifest.json`, `market_assistant.network.json`, `links.json` with CORS | `peer-caller`: a recipe site on a second origin that loads the store's network (M3) |
| Two-agent network `assistant` → `ingredient_finder`, run by the vendored nsDeploy browser runtime | "Send my recipe from my own agent": OAuth, authenticated MCP, cart proposals, revocation (M4–M5, extension) |
| Grounded capability: public read-only MCP server `/api/mcp/public` (`match_ingredients`, `search_products`) | Server-side cart and checkout (later) |
| `add_to_cart` local site action: the runtime shows the items and asks the shopper to confirm | |
| Site-funded default model: shoppers need no AI key | |
| Store front (search, categories, add to cart) and cart page | |

The test scenario:
1. Open `/agents/` and paste a recipe, or name a dish.
2. The assistant sends the ingredient list to `ingredient_finder`, which calls
   `match_ingredients`.
3. You get a table of products, pack counts and prices, with substitutions for
   out-of-stock items and a list of what the store doesn't sell.
4. The assistant proposes `add_to_cart`. You review the exact items and confirm.
5. The cart page shows the result.

## Shop from your own AI agent

Copy the prompt from the home page (**Shop from your own AI agent**) or from
<https://greenleaf-market.vercel.app/agent-prompt.txt> into ChatGPT, Claude, Gemini,
Copilot or any other assistant, then say what you'd like to cook.

1. The agent finds the ingredients in one of three ways, depending on what it supports:
   - the MCP server `/api/mcp/public`;
   - `GET /api/match?i=...` for agents that can open web pages;
   - a recipe link, for agents with no tools.
2. It gives you a cart link (`/shop.html#items=...` or `#recipe=...`).
3. You open the link, review the items on the store's page and click **Add to cart**.

The agent can't add items, order or pay by itself. See `docs/adr/0005`.

## Layout

```
agents/market_assistant.hocon       network source (HOCON); __SITE_ORIGIN__ is filled in at build time
agents/sites/market_assistant/      agent page theme, store navigation, add_to_cart action (actions.js)
apps/site/                          Vercel project (Root Directory)
  public/                           store front, cart page, cart-store.js; public/agents/ is generated (committed)
  api/mcp/public.js                 public MCP server (stateless Streamable HTTP, read-only)
  api/infer/v1/chat/completions.js  site-funded inference proxy
  api/products.js                   catalog JSON for the store pages
  api/cart/quote.js                 validates and prices cart lines (same-origin only)
  lib/catalog.js                    synthetic catalog, ingredient parsing and matching
  vercel.json                       headers (CORS, CSP, HSTS), redirect, function limits
packages/runtime/                   vendored nsDeploy browser runtime + PATCHES.md
vendor/nsdeploy/                    pinned nsDeploy (submodule), used at build time
scripts/                            build-agents, dev-server, smoke
tests/                              node:test suites
docs/adr/                           decisions
```

## Develop

Requirements: Node 20.3+, Python 3.10+, git.

```bash
git submodule update --init
python -m venv .venv && .venv/bin/pip install -r vendor/nsdeploy/requirements.txt   # Windows: .venv\Scripts\pip
npm ci --prefix apps/site
npm test                      # builds artifacts for a local origin, then catalog, HTTP and headless runtime tests
npm run dev                   # http://127.0.0.1:3000 (export INFERENCE_API_KEY etc. first for real model calls)
```

## Deploy to Vercel

1. Pick the production domain, for example `https://greenleaf-market.vercel.app`.
2. Rebuild the published artifacts for that origin and commit them:
   `npm run build:agents -- --site-url https://<your-domain>`
3. Create a Vercel project from this repo with these settings:
   - Root Directory `apps/site`
   - Framework preset "Other"
   - Output Directory `public` (already set in `vercel.json`)
4. Add environment variables (Production, marked Sensitive) using the names in
   `.env.example`. At minimum set `INFERENCE_API_KEY`.
5. After the deploy, run the smoke checks from a different origin:
   `npm run smoke -- --url https://<your-domain>`
   They also run automatically from GitHub Actions on each production deployment.

## Limits of this slice

- The cart lives in the browser (`localStorage` on the store's origin), and the server
  validates every line. The user's own external agent (M4) will need a server-side
  cart.
- The rate limiters are in-memory and per function instance (ADR 0003).

## License

Apache-2.0. Includes the nsDeploy runtime (Apache-2.0). See [NOTICE](NOTICE).
