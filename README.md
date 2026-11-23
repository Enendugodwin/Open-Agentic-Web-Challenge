# Shift Handoff: Northside Pantry open agentic web demo

A small website that publishes an open, portable agent network following the
[Worldwide Agentic Web MVP profile](https://github.com/cognizant-ai-labs/agentic-web/blob/main/docs/worldwide_agentic_web_mvp_spec.md).
It is built to run on Vercel. The product goal is to let a person start a task on the
site and hand it to the AI agent they already use (see [PROJECT_PLAN.md](PROJECT_PLAN.md)).

Status: **M1 vertical slice, built and tested locally, not yet deployed.**

| Works now (spec MVP path) | Planned |
| --- | --- |
| `/agents/agent-manifest.json`, `volunteer_desk.network.json`, `links.json` with CORS | Booking as a confirmed local site action (M2) |
| Two-agent network `desk` → `shift_finder`, run by the vendored nsDeploy browser runtime | `peer-caller` site on a second origin (M3) |
| Grounded capability: public read-only MCP server `/api/mcp/public` (`list_shifts`) | "Hand off to my agent": OAuth, authenticated MCP, grants, revocation (M4–M5, extension) |
| Site-funded default model: visitors need no AI key | |

## Layout

```
agents/volunteer_desk.hocon     network source (HOCON); __SITE_ORIGIN__ is filled in at build time
agents/sites/volunteer_desk/    theme for the generated agent page
apps/site/                      Vercel project (Root Directory)
  public/                       landing page; public/agents/ is generated (committed)
  api/mcp/public.js             public MCP server (stateless Streamable HTTP)
  api/infer/v1/chat/completions.js  site-funded inference proxy
  api/shifts.js                 JSON for the landing page
  lib/                          shift data, HTTP helpers
  vercel.json                   headers (CORS, CSP, HSTS), redirect, function limits
packages/runtime/               vendored nsDeploy browser runtime + PATCHES.md
vendor/nsdeploy/                pinned nsDeploy (submodule), used at build time
scripts/                        build-agents, dev-server, smoke
tests/                          node:test suites
docs/adr/                       decisions
```

## Develop

Requirements: Node 20.3+, Python 3.10+, git.

```bash
git submodule update --init
python -m venv .venv && .venv/bin/pip install -r vendor/nsdeploy/requirements.txt   # Windows: .venv\Scripts\pip
npm ci --prefix apps/site
npm test                      # builds artifacts for a local origin, then HTTP + headless runtime tests
cp .env.example .env          # optional, for real model calls in local dev
npm run dev                   # http://127.0.0.1:3000 (export the INFERENCE_* variables first)
```

## Deploy to Vercel

1. Pick the production domain, for example `https://shift-handoff.vercel.app`.
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

## License

Apache-2.0. Includes the nsDeploy runtime (Apache-2.0). See [NOTICE](NOTICE).
