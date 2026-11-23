# ADR 0003: Vercel layout (static output and Web-signature functions)

Status: accepted (M1). Replaces plan decision D2, which proposed Next.js.

## Context

nsDeploy already generates the agent UI and artifacts as a static bundle. The
remaining server needs are small API routes: public MCP and inference now, then
actions, OAuth and authenticated MCP.

## Decision

- `apps/site` is a Vercel project with framework preset "Other":
  - `public/` holds the static output: the landing page, plus `public/agents/` from
    the build;
  - `api/**.js` holds Vercel Functions in the Node.js runtime, using the Web
    signature (`export async function POST(request) { return Response }`);
  - `vercel.json` holds headers (CORS only on public agent artifacts, CSP, HSTS),
    the `/agents` → `/agents/` redirect and function durations.
- The agent bundle lives under `/agents/`, so the peer URL is
  `https://<host>/agents/market_assistant`, and the runtime fetches
  `https://<host>/agents/agent-manifest.json` (spec §3.2 step 1).
- The MCP server uses the official SDK's Web-standard Streamable HTTP transport in
  stateless mode with JSON responses. It keeps no session state between function
  invocations.
- `scripts/dev-server.mjs` copies this behaviour locally (static files, `vercel.json`
  headers and redirects, Web-signature handlers), for tests and development.
- Next.js remains an option if the authenticated pages in M4 and M5 need it.

## Known limits

- Artifacts are built for a single origin, the production one. Preview deployments
  serve the production MCP URL inside the network JSON, so smoke checks run on
  production only. Building per preview would need Python in the Vercel build, or a
  Node port of the resolver. That is deferred.
- The rate limiters are in-memory and per function instance. A shared store (for
  example Upstash Redis or Postgres from the Vercel Marketplace) arrives with the
  database in M2 and M4.
