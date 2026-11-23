# Vendored nsDeploy browser runtime

Source: https://github.com/cognizant-ai-lab/nsdeploy, directory `nsdeploy/runtime/`,
commit `486ecf26aa8775963f9b765f894734bef1ac9817` (2026-11-19). License: Apache-2.0
(see `LICENSE.txt`). The same commit is pinned as the `vendor/nsdeploy` submodule,
which is used at build time to resolve HOCON and generate the static bundle.

Every modification is marked with `[shift-handoff patch]`.

## Patch 1: publisher-funded default router (`site_funded`)

Spec §4 allows a site to publish a default router and model that work without a
visitor-supplied key. The upstream runtime accepts a keyless router only when it is
the mock, so a real publisher-funded router needs this patch.

- `engine.js`: `isSiteFundedRouter()` returns true only when **all** of these hold:
  - the top site's manifest declares `llm_router.site_funded: true` and not `mock`;
  - the active router equals `llm_router.base_url`;
  - the router is on the page's own origin.
- `selectTopRouter()` reports `siteFunded`. The flag is dropped when a visitor BYOK
  key is active.
- `selectPeerRouter()` passes the **caller's** flag to peers. A peer manifest's
  `site_funded` is never read, because peers always use the caller's router (§3.2, §4).
- `llm.js`: `LlmClient` skips the "API key required" check and the placeholder-model
  check when `siteFunded`. It sends no `Authorization` header, because the key stays
  on the server.
- `ui.js`: the key and model setup prompts are skipped when `engine.siteFunded`.

To re-vendor a newer runtime, copy the upstream directory again and re-apply the
marked hunks (`git diff` against `vendor/nsdeploy/nsdeploy/runtime` shows them).
