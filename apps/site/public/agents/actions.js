// Greenleaf Market site actions, registered with the nsDeploy runtime.
//
// add_to_cart is a local-only write: it runs only on the store's own origin. The
// runtime validates the arguments against inputSchema and shows the shopper the
// destination, action and items before execute() runs (spec §3.1). Peer sites that
// load our network cannot call it (callerOrigins is empty).
import { applyQuote, quote, summarize } from "/cart-store.js";

export function registerActions(actions) {
  actions.register({
    name: "add_to_cart",
    description: "Add products to the shopper's Greenleaf Market cart. Use exact product ids and pack counts from ingredient_finder. The website shows the items and asks the shopper to confirm before anything is added.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          minItems: 1,
          maxItems: 40,
          title: "Items",
          items: {
            type: "object",
            properties: {
              product_id: { type: "string", minLength: 3, maxLength: 80, title: "Product id" },
              quantity: { type: "integer", minimum: 1, maximum: 20, title: "Packs" },
            },
            required: ["product_id", "quantity"],
          },
        },
      },
      required: ["items"],
    },
    effect: "write",
    availability: "local-only",
    callerOrigins: [],
    timeoutMs: 20000,
    async execute(values, { requestId, signal }) {
      // Prices, stock and ids are checked on the server before anything is stored.
      const priced = await quote(values.items, { signal, requestId });
      const { duplicate } = applyQuote(priced, requestId);
      const cart = summarize();
      return {
        status: duplicate ? "already_added" : priced.lines.length ? "added" : "nothing_added",
        receipt_id: requestId,
        added: priced.lines.map((l) => ({ product_id: l.id, name: l.name, size: l.size, quantity: l.quantity, line_total: l.line_total })),
        rejected: priced.rejected,
        cart: { items: cart.item_count, subtotal: cart.subtotal, url: "/cart.html" },
      };
    },
  });
}
