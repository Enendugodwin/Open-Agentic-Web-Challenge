# ADR 0005: Shopping from the user's own agent with a prompt and a cart link

Status: accepted. An interim step before the M4–M5 handoff (OAuth, server-side cart).

## Context

Users want to paste a prompt into the AI agent they already use (ChatGPT, Claude,
Gemini, Copilot and others) and shop from there. Agents differ in what they can do:
- some can connect to MCP servers;
- some can only open web pages;
- some have no tools at all.

The cart currently lives in the shopper's browser, and no external agent has an
authorized way to write to it yet.

## Decision

- Publish a copy-paste prompt (`/agent-prompt.txt`, with a copy button on the home
  page). It tells the agent to use one of three paths, whichever it can:
  1. MCP at `/api/mcp/public`: `match_ingredients`, `search_products`, `create_cart_link`.
  2. HTTP GET `/api/match?i=...`, which returns the same JSON plus a ready `cart_link`.
  3. No tools: a recipe link, `/shop.html#recipe=<lines>`, that the store matches itself.
- The agent's output is one **cart link**: `/shop.html#items=ID:PACKS,...` or
  `#recipe=...`. The link only proposes items. It carries no secrets, prices or user
  data, and it sits in the URL fragment, which is not sent to servers or logs.
- `/shop.html` re-checks every id or line with the store, marks substitutes, lists
  what can't be added, lets the shopper untick items or change quantities, and adds
  nothing until the shopper clicks "Add to cart" (a user-owned write, spec §5).
- Opening the same link with the same selection again is idempotent: the request ID
  is a hash of the link plus the selection.

## Consequences

- This works with any agent and needs no account or OAuth, because the agent never
  holds write access.
- The agent can't see the result or the cart. The M4–M5 handoff adds that, with
  scoped, revocable grants.
- Prompt injection can at most change which items are *proposed*. The shopper
  reviews each line on the store's own origin.
