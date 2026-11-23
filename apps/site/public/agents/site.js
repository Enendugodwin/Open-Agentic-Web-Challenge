// Greenleaf Market: add store navigation to the generated assistant page.
import { CART_EVENT, summarize } from "/cart-store.js";

export function customize({ root }) {
  const nav = document.createElement("nav");
  nav.className = "gm-nav";
  nav.setAttribute("aria-label", "Store");
  const store = Object.assign(document.createElement("a"), { href: "/", textContent: "← Store" });
  const cart = Object.assign(document.createElement("a"), { href: "/cart.html" });
  const update = () => { cart.textContent = `Cart (${summarize().item_count})`; };
  update();
  addEventListener(CART_EVENT, update);
  addEventListener("storage", update);
  nav.append(store, cart);
  root.prepend(nav);
}
