// Store front: search, categories, product grid and "Add" buttons.
import { CART_EVENT, applyQuote, quote, summarize } from "/cart-store.js";

const $ = (sel) => document.querySelector(sel);
const statusEl = $("#status");
const grid = $("#products");
let activeCategory = "";

$("#peer-url").textContent = `${location.origin}/agents/market_assistant`;
$("#mcp-url").textContent = `${location.origin}/api/mcp/public`;

function updateCartCount() {
  for (const el of document.querySelectorAll("[data-cart-count]")) el.textContent = String(summarize().item_count);
}
addEventListener(CART_EVENT, updateCartCount);
addEventListener("storage", updateCartCount); // another tab (e.g. the assistant) changed the cart
updateCartCount();

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function renderCategories(categories) {
  const box = $("#categories");
  box.replaceChildren();
  for (const name of ["", ...categories]) {
    const b = el("button", { type: "button", className: `chip${name === activeCategory ? " active" : ""}`, textContent: name || "All" });
    b.setAttribute("aria-pressed", String(name === activeCategory));
    b.addEventListener("click", () => { activeCategory = name; load(); });
    box.append(b);
  }
}

async function add(product, button) {
  button.disabled = true;
  try {
    const priced = await quote([{ product_id: product.id, quantity: 1 }]);
    applyQuote(priced, crypto.randomUUID());
    button.textContent = "Added ✓";
    setTimeout(() => { button.textContent = "Add"; button.disabled = false; }, 1200);
  } catch (err) {
    statusEl.textContent = err.message;
    button.disabled = false;
  }
}

function renderProducts(products) {
  grid.replaceChildren();
  for (const p of products) {
    const button = el("button", { type: "button", textContent: p.in_stock ? "Add" : "Out of stock", disabled: !p.in_stock });
    button.addEventListener("click", () => add(p, button));
    grid.append(el("li", { className: `card${p.in_stock ? "" : " oos"}` },
      el("span", { className: "cat", textContent: `${p.category} · aisle ${p.aisle}` }),
      el("strong", { textContent: p.name }),
      el("span", { className: "muted", textContent: p.size }),
      el("span", { className: "price", textContent: p.price }),
      button));
  }
}

async function load() {
  const q = $("#q").value.trim();
  const params = new URLSearchParams({ limit: "48" });
  if (q) params.set("q", q);
  if (activeCategory) params.set("category", activeCategory);
  statusEl.textContent = "Loading products…";
  try {
    const resp = await fetch(`/api/products?${params}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    renderCategories(data.categories);
    renderProducts(data.products);
    statusEl.textContent = data.products.length ? `${data.products.length} products` : "No products found.";
  } catch (err) {
    statusEl.textContent = `Could not load products (${err.message}).`;
  }
}

$("#search").addEventListener("submit", (e) => { e.preventDefault(); load(); });
load();
