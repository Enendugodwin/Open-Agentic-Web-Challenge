# ADR 0004: Test scenario is a supermarket, recipe to cart

Status: accepted. Replaces the volunteer-shift scenario in the first plan draft.

## Decision

The test site is Greenleaf Market, a fictional supermarket. In the test, the user
has a recipe and an AI agent goes into the store and gets every ingredient.

| Plan concept | Supermarket version |
| --- | --- |
| Task | A recipe (pasted text or a dish name) to shop for |
| Read-only grounded capability | MCP `match_ingredients` (recipe lines → products, packs, prices, substitutes, not found) and `search_products` |
| One user-confirmed write | `add_to_cart` (site action now; agent proposal in the M4 extension) |
| Irreversible action (out of MVP) | Checkout and payment: not built |
| Peer site for interoperability (M3) | A recipe website whose agent loads `market_assistant` from the store's origin |
| Extension handoff (M4–M5) | The user's own agent sends the recipe and proposes a cart; the user confirms on the store's site |

Assumption: "get all the ingredients" means putting them in the cart for the user to
review. It does not mean checkout. Ordering and payment stay out of the MVP because
they are irreversible and handle payment data.

## Details

- The catalog is synthetic: 164 products in fixed rows (`apps/site/lib/catalog.js`).
  A few items are deliberately out of stock (fresh basil, pine nuts) to exercise
  substitution and the "not available" path.
- Matching works in three steps:
  - Recipe lines are parsed for quantity and unit (fractions; g/kg/oz/lb/ml/L/cup/
    tbsp/tsp/cloves).
  - Descriptive words are removed from the query only.
  - Products are ranked by IDF-weighted word coverage plus exact-phrase bonuses.
- The best match is chosen on relevance alone. If it is out of stock, the best
  in-stock alternative is offered and marked `substituted`.
- Pack counts come from unit conversion when the units are compatible. Otherwise the
  result is one pack, with a note.
- Prices and ids are always re-validated on the server (`/api/cart/quote`) before
  anything is stored. A model-invented product id is rejected.
- In this slice the cart lives in the store origin's `localStorage`, and writes are
  idempotent per runtime request ID.
