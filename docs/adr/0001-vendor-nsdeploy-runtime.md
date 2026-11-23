# ADR 0001: Vendor the nsDeploy runtime and use nsDeploy to build artifacts

Status: accepted (M0). Resolves plan decision D1 and assumption A2.

## Context

The MVP spec needs a browser runtime that validates networks, runs the agent loop,
asks for consent before contacting other origins, filters `sly_data`, enforces limits
and confirms site actions. nsDeploy is the spec's reference implementation (spec §3,
§8).

## Findings

- License: Apache-2.0, which is compatible with this repository's Apache-2.0 license.
- Pinned commit: `486ecf26aa8775963f9b765f894734bef1ac9817` (2026-11-19).
- `--static-bundle` produces `agent-manifest.json`, `<network>.network.json` and
  `links.json`, plus the runtime, from a HOCON file. No server is needed.
- Manifest fields: `networks[] {name, front_man, hocon}`, `llm_router`,
  `allowed_peers`, `peer_policy`, `linking` and `deployment`.
- The runtime accepts a keyless router only when it is the mock. Without a patch, a
  site-funded router therefore can't run (see ADR 0002).
- The resolver at this commit fails on the object form of an MCP reference
  (`{url, tools}`), with `TypeError: unhashable type` in `resolve.py` `build_plan`.
  We use the string form. Our public MCP server exposes only read-only tools, so this
  loses nothing. This is worth reporting upstream.
- The runtime's own limits cover composition depth (5), cycles, agent invocations,
  remote calls and tool concurrency (4).

## Decision

- Keep `vendor/nsdeploy` as a git submodule pinned to the commit above. It is used
  only at build time (Python), by `scripts/build-agents.mjs`.
- Copy `nsdeploy/runtime/` into `packages/runtime/` and apply small marked patches,
  listed in `packages/runtime/PATCHES.md`. The build passes `--runtime-dir`.
- Commit the generated artifacts in `apps/site/public/agents/`, so Vercel needs no
  Python at build time. CI rebuilds them and fails if they differ.
