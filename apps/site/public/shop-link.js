// Cart links that an AI agent hands to the shopper. A link carries only product ids
// and pack counts, or plain recipe lines: no secrets, no prices, no account data.
// Opening it never changes the cart; /shop.html shows the items and the shopper
// confirms there.
//
//   /shop.html#items=p_spaghetti_500g:1,p_large_eggs_12ct:1
//   /shop.html#recipe=400%20g%20spaghetti%0A4%20eggs

export const MAX_LINES = 40;
export const MAX_QTY = 20;
const ID_RE = /^p_[a-z0-9_]{1,76}$/;

/** Parse the URL fragment of /shop.html. */
export function parseShopHash(hash) {
  const params = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  if (params.has("items")) {
    const items = [];
    const errors = [];
    for (const raw of params.get("items").split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_LINES)) {
      const [id, q = "1"] = raw.split(":");
      const quantity = Number(q);
      if (!ID_RE.test(id)) { errors.push(`"${raw.slice(0, 40)}" is not a product id`); continue; }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) { errors.push(`${id}: quantity must be 1 to ${MAX_QTY}`); continue; }
      const existing = items.find((i) => i.product_id === id);
      if (existing) existing.quantity = Math.min(MAX_QTY, existing.quantity + quantity);
      else items.push({ product_id: id, quantity });
    }
    return { kind: "items", items, errors };
  }
  if (params.has("recipe")) {
    const lines = params.get("recipe").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      .map((l) => l.slice(0, 200)).slice(0, MAX_LINES);
    return { kind: "recipe", lines, errors: [] };
  }
  return { kind: "empty", errors: [] };
}

/** Build a cart link for product ids and pack counts. */
export function itemsLink(origin, items) {
  const list = items.map((i) => `${i.product_id}:${i.quantity}`).join(",");
  return `${origin.replace(/\/$/, "")}/shop.html#items=${list}`;
}

/** Build a cart link from recipe lines (for agents without tools). */
export function recipeLink(origin, lines) {
  return `${origin.replace(/\/$/, "")}/shop.html#recipe=${encodeURIComponent(lines.join("\n"))}`;
}
