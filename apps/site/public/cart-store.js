// Browser cart for Greenleaf Market, kept in this origin's localStorage.
//
// The server (/api/cart/quote) is the source of truth for product ids, stock and
// prices; this module only stores quoted lines. Used by the store pages and by the
// add_to_cart site action (agents/sites/market_assistant/actions.js).

const KEY = "greenleaf-cart-v1";
const MAX_QTY = 20;
const MAX_APPLIED = 50;
export const CART_EVENT = "greenleaf-cart-change";

const empty = () => ({ version: 1, lines: [], applied: [], updated_at: null });

export function readCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw || raw.version !== 1 || !Array.isArray(raw.lines)) return empty();
    return { ...empty(), ...raw };
  } catch {
    return empty();
  }
}

function save(cart) {
  cart.updated_at = new Date().toISOString();
  localStorage.setItem(KEY, JSON.stringify(cart));
  try { globalThis.dispatchEvent?.(new CustomEvent(CART_EVENT, { detail: summarize(cart) })); } catch { /* non-browser */ }
  return cart;
}

export function summarize(cart = readCart()) {
  const subtotal = cart.lines.reduce((s, l) => s + l.price_cents * l.quantity, 0);
  return {
    item_count: cart.lines.reduce((s, l) => s + l.quantity, 0),
    line_count: cart.lines.length,
    subtotal_cents: subtotal,
    subtotal: `$${(subtotal / 100).toFixed(2)}`,
  };
}

/**
 * Add server-quoted lines. Idempotent per requestId: re-applying the same request
 * (for example after a reload) changes nothing.
 */
export function applyQuote(quote, requestId) {
  const cart = readCart();
  if (requestId && cart.applied.includes(requestId)) return { cart, duplicate: true };
  for (const line of quote.lines || []) {
    const existing = cart.lines.find((l) => l.id === line.id);
    if (existing) {
      existing.quantity = Math.min(MAX_QTY, existing.quantity + line.quantity);
      existing.price_cents = line.price_cents;
    } else {
      cart.lines.push({ id: line.id, name: line.name, size: line.size, price_cents: line.price_cents, quantity: Math.min(MAX_QTY, line.quantity) });
    }
  }
  if (requestId) cart.applied = [...cart.applied, requestId].slice(-MAX_APPLIED);
  return { cart: save(cart), duplicate: false };
}

export function setQuantity(id, quantity) {
  const cart = readCart();
  const q = Math.max(0, Math.min(MAX_QTY, Math.floor(quantity)));
  cart.lines = q === 0 ? cart.lines.filter((l) => l.id !== id) : cart.lines.map((l) => (l.id === id ? { ...l, quantity: q } : l));
  return save(cart);
}

/** Replace stored prices with a fresh server quote (drops lines no longer sold). */
export function refreshPrices(quote) {
  const cart = readCart();
  const byId = new Map((quote.lines || []).map((l) => [l.id, l]));
  cart.lines = cart.lines.filter((l) => byId.has(l.id)).map((l) => ({ ...l, price_cents: byId.get(l.id).price_cents }));
  return save(cart);
}

export function clearCart() {
  return save(empty());
}

/** Ask the server to validate and price lines. */
export async function quote(items, { signal, requestId } = {}) {
  const resp = await fetch("/api/cart/quote", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(requestId ? { "Idempotency-Key": requestId } : {}) },
    body: JSON.stringify({ items }),
    signal,
  });
  if (!resp.ok) {
    let detail = "";
    try { detail = (await resp.json()).message || ""; } catch { /* ignore */ }
    throw new Error(`The store could not price these items (HTTP ${resp.status}). ${detail}`.trim());
  }
  return resp.json();
}
