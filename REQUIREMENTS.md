# Requirements

This file covers two things:
1. what you need to run, build and deploy Bring Your Own Agent (BYOA);
2. which specification and challenge requirements the project meets.

Live demo: <https://greenleaf-market.vercel.app>
Source: <https://github.com/Enendugodwin/Open-Agentic-Web-Challenge>

---

## 1. Software you need

| Software | Version | Used for |
| --- | --- | --- |
| Node.js | 20.x. Tested with 20.18.1. Node 22 removed the network-imports flag the tests use. | Site functions, local dev server, tests, build scripts |
| npm | 10.x (comes with Node 20) | Installing the site's dependencies |
| Python | 3.10 or newer. Tested with 3.12.10. | Building the published agent artifacts with nsDeploy, at build time only |
| git | Any recent version | Cloning the repo and its submodule; not needed when you use the zip |
| A modern browser | Edge, Chrome, Firefox or Safari | Using the store; the tests also drive Edge |

You don't need Python or nsDeploy to **deploy**. The generated agent files are
committed in `apps/site/public/agents/`, so Vercel only needs Node.

### Node packages (`apps/site/package.json`, exact versions in `package-lock.json`)

| Package | Version | Purpose |
| --- | --- | --- |
| `@modelcontextprotocol/sdk` | 1.32.2 | Public MCP server (`/api/mcp/public`) |
| `zod` | 4.6.7 | MCP tool input schemas |

Install with `npm ci --prefix apps/site`. The root `package.json` has no dependencies.
It only defines the scripts.

### Python packages (only to rebuild the agent artifacts)

- `requirements.txt` lists nsDeploy's own requirements (`vendor/nsdeploy/requirements.txt`).
- `requirements-lock.txt` pins the exact versions this project was built and tested
  with. The main ones are pyhocon 0.3.63, mcp 1.30.0, neuro-san 0.7.27, langchain
  1.5.2, fastapi 0.165.0 and pydantic 2.14.4.

Install with `python -m venv .venv` and then
`.venv/bin/pip install -r requirements-lock.txt`. On Windows, use `.venv\Scripts\pip`.

### Vendored code

| Component | Version | Where |
| --- | --- | --- |
| nsDeploy (spec reference runtime and builder) | commit `486ecf2` (2026-11-19), Apache-2.0 | `vendor/nsdeploy/` (a git submodule; its full source is included in the zip) |
| nsDeploy browser runtime, with patches | same commit, plus the patches in `packages/runtime/PATCHES.md` | `packages/runtime/` |

---

## 2. Accounts and environment variables

| Item | Required? | Notes |
| --- | --- | --- |
| Vercel account | To deploy | A Hobby (free) plan works. Project Root Directory: `apps/site`. Framework preset: "Other". |
| GitHub account | Optional | CI (`.github/workflows/ci.yml`) and post-deploy smoke checks (`smoke.yml`) |
| AI model provider key (any OpenAI-compatible provider) | Only for the store's **built-in** assistant at `/agents/` | Set it as `INFERENCE_API_KEY`. The live demo uses OpenRouter with `INFERENCE_BASE_URL=https://openrouter.ai/api/v1`, `INFERENCE_MODEL=nvidia/nemotron-3.5-lightning:free`, `INFERENCE_MAX_TOKENS=4096` and `INFERENCE_EXTRA_BODY={"reasoning":{"effort":"low","exclude":true}}`. "Shop from your own AI agent" needs no key. |

Environment variables (Vercel → Project → Settings → Environment Variables; see `.env.example`):

| Variable | Default | Meaning |
| --- | --- | --- |
| `INFERENCE_API_KEY` | (none) | The site's model key. Keep it server-side only and mark it Sensitive. |
| `INFERENCE_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible provider URL |
| `INFERENCE_MODEL` | `gpt-4o-mini` | The model the server uses |
| `INFERENCE_MAX_TOKENS` | `1024` | Output cap per call (maximum 4096) |
| `INFERENCE_TIMEOUT_MS` | `55000` | How long to wait for the provider |
| `INFERENCE_DISABLED` | `0` | Set to `1` to switch off site-paid model calls |
| `INFERENCE_EXTRA_BODY` | (none) | Optional JSON of provider options, for example `{"reasoning":{"effort":"low","exclude":true}}` for OpenRouter reasoning models. It cannot override the model, messages, tools or token cap. |

Never commit real keys. `.env`, `.env.*` and `.vercel/` are git-ignored.

---

## 3. Setup

```bash
# From the zip: unzip, then open the folder. From git:
git clone --recurse-submodules https://github.com/Enendugodwin/Open-Agentic-Web-Challenge.git
cd Open-Agentic-Web-Challenge

npm ci --prefix apps/site                       # Node dependencies
python -m venv .venv
.venv/bin/pip install -r requirements-lock.txt  # Windows: .venv\Scripts\pip

npm test                                        # 41 tests: catalog, HTTP, headless runtime end to end
npm run dev                                     # local site at http://127.0.0.1:3000
```

To deploy:

```bash
npm run build:agents -- --site-url https://<your-domain>   # rebuild agent files for your domain, then commit them
npx vercel deploy --prod                                   # from apps/site, or connect the repo in Vercel
npm run smoke -- --url https://<your-domain>               # 9 checks from a separate origin
```

---

## 4. Worldwide Agentic Web MVP spec: compliance

Specification: <https://github.com/cognizant-ai-labs/agentic-web/blob/main/docs/worldwide_agentic_web_mvp_spec.md>
(Profile 0.3, rechecked on 2026-11-23).

Status key: ✅ met and evidenced · ⚠️ built, not yet shown live · ❌ not yet demonstrated · ➖ not applicable.

### §6 MVP interoperability checks

| # | Check | Status | Evidence / gap |
| --- | --- | --- | --- |
| 1 | Publish a two-agent HOCON network and a manifest from an ordinary HTTPS host | ✅ | `assistant` → `ingredient_finder`, published at `/agents/agent-manifest.json`, `market_assistant.network.json` and `links.json` on Vercel over HTTPS. Covered by smoke checks T-SMK-01 to 04. |
| 2 | Load and run it in a browser with the site's published default router and model | ✅ | Live in Edge on 2026-11-23: `/agents/` runs the network with the site-paid router `/api/infer/v1` (OpenRouter `nvidia/nemotron-3.5-lightning:free`), and the badge shows a verified real model. |
| 3 | Call an internal agent and a grounded capability (MCP or local site action) | ✅ | Live: `assistant` → `ingredient_finder` → MCP `match_ingredients`, then the `add_to_cart` site action with the runtime's confirmation dialog. The receipt said `added` and the cart showed 6 items. |
| 4 | After user approval, load an exact named network from a second origin and run it locally | ❌ | The artifacts allow cross-origin access, but there is no second-origin caller site yet (planned recipe site, M3). |
| 5 | With a user key active, the second site never receives it and can't change the caller's router | ➖ / ❌ | The site doesn't offer "bring your own key", so the key part doesn't apply. The router part is enforced by the runtime but not yet shown across two sites. |
| 6 | Private context is absent at the peer unless a field is explicitly allowed | ❌ | The network allows only `locale` downstream (`allow.to_downstream.sly_data`), but this isn't yet shown across sites. |
| 7 | Stop an invalid network, a cycle, an over-budget request and a denied origin with visible errors | ⚠️ | Rejecting an invalid network is unit-tested. The runtime enforces the other three, but none has been shown visibly yet. |

### Other MUST requirements

| Requirement (spec §) | Status | How |
| --- | --- | --- |
| Neuro SAN HOCON data model; resolved, data-only published form (§2, §2.2) | ✅ | `agents/market_assistant.hocon` is built into JSON. The build lint rejects includes and substitutions. |
| Private context denied by default; only named fields pass (§2.1, §5) | ✅ (configured) | `allow` rules in the network; enforced by the runtime |
| Manifest with name, `front_man`, `hocon`, router metadata and peer policy (§3.3) | ✅ | `agent-manifest.json` |
| `links.json` (§3.3) | ✅ | Published with CORS |
| CORS on public artifacts; no private credentials (§3.3, §3.4) | ✅ | `vercel.json` headers; smoke checks T-SMK-01, 02, 03, 05 and 06 |
| HTTPS in production (§3.3) | ✅ | Vercel TLS, HSTS; smoke check T-SMK-04 |
| Runtime: validate before any model call, bounded execution, fail closed (§3.1, §5) | ✅ (reference runtime) | nsDeploy runtime; invalid-network test |
| Local site actions with schema and confirmation before writes (§3.1) | ✅ | `add_to_cart` (local-only, effect `write`); tests decline, then confirm |
| Unknown outcome on write timeout; no automatic retry (§3.1, §5) | ✅ | Test: server failure is reported as `unknown`, never as success |
| Peer uses the caller's router; a peer can't replace it (§3.2, §4) | ✅ (runtime) | `selectPeerRouter`; `site_funded` honoured only on the top site's own origin |
| User-owned writes (§5) | ✅ | The runtime confirms local actions; cart links need an "Add to cart" click on the store |
| Consent before third-party contact (§3.2, §5) | ✅ (runtime) | Provided by nsDeploy; the store's MCP server is same-origin |

What's needed for full compliance:
1. ~~a model key in Vercel~~ (done: checks 2 and 3 are now shown live);
2. the second-origin recipe site (checks 4, 5 and 6, and the rest of 7);
3. a recorded demo of these checks.

See PROJECT_PLAN.md §5 and §6.

---

## 5. Challenge submission requirements

The Devpost page (<https://cognizant-agenticweb.devpost.com/>) couldn't be fetched
automatically (HTTP 403), so recheck the official list by hand. These are the items the
project brief asked for:

| Deliverable | Status | Where |
| --- | --- | --- |
| Public website URL on Vercel | ✅ | <https://greenleaf-market.vercel.app> |
| Open-source repository with a license | ✅ | GitHub repo, Apache-2.0 (`LICENSE`, `NOTICE`) |
| README explaining how it works, with screenshots | ✅ | `README.md`, `docs/screenshots/` |
| Demo video | ✅ (draft) | `demo/BYOA-demo-voiceover.mp4` in the zip, with captions (`.srt`) |
| Project plan, spec mapping, security design | ✅ | `PROJECT_PLAN.md`, `docs/adr/` |
| Spec §6 interoperability shown live | ❌ partial | See section 4 |
