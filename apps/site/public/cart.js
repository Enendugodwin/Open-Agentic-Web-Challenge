// Cart page: show the stored cart, refresh prices from the server, edit quantities.
import { CART_EVENT, clearCart, quote, readCart, refreshPrices, setQuantity, summarize } from "/cart-store.js";

const $ = (sel) => document.querySelector(sel);
const money = (cents) => `$${(cents / 100).toFixed(2)}`;

function render() {
  const cart = readCart();
  const sum = summarize(cart);
  for (const el of document.querySelectorAll("[data-cart-count]")) el.textContent = String(sum.item_count);
  const table = $("#cart");
  const tbody = table.querySelector("tbody");
  tbody.replaceChildren();
  if (!cart.lines.length) {
    table.hidden = true;
    $("#status").textContent = "Your cart is empty. Ask the shopping assistant for a recipe, or add products from the store.";
    return;
  }
  for (const line of cart.lines) {
    const tr = document.createElement("tr");
    const qty = Object.assign(document.createElement("input"), { type: "number", min: "0", max: "20", value: String(line.quantity) });
    qty.setAttribute("aria-label", `Quantity of ${line.name}`);
    qty.addEventListener("change", () => { setQuantity(line.id, Number(qty.value) || 0); render(); });
    const remove = Object.assign(document.createElement("button"), { type: "button", className: "ghost", textContent: "Remove" });
    remove.addEventListener("click", () => { setQuantity(line.id, 0); render(); });
    for (const content of [line.name, line.size, money(line.price_cents), qty, money(line.price_cents * line.quantity), remove]) {
      const td = document.createElement("td");
      td.append(content);
      tr.append(td);
    }
    tbody.append(tr);
  }
  $("#subtotal").textContent = sum.subtotal;
  $("#status").textContent = `${sum.item_count} item(s). Prices are demo data.`;
  table.hidden = false;
}

async function refresh() {
  const cart = readCart();
  if (!cart.lines.length) return;
  try {
    const fresh = await quote(cart.lines.map((l) => ({ product_id: l.id, quantity: l.quantity })));
    refreshPrices(fresh);
    if (fresh.rejected.length) $("#status").textContent = `${fresh.rejected.length} item(s) are no longer available and were removed.`;
  } catch { /* keep stored prices if the server is unreachable */ }
  render();
}

$("#clear").addEventListener("click", () => { clearCart(); render(); });
addEventListener(CART_EVENT, render);
addEventListener("storage", render);
render();
refresh();
