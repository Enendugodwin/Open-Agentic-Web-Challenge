// Review page for cart links from an AI agent. The link only proposes items; this
// page re-checks them with the store and the shopper confirms (user-owned write).
import { applyQuote, quote, summarize, CART_EVENT } from "/cart-store.js";
import { parseShopHash } from "/shop-link.js";

const $ = (sel) => document.querySelector(sel);
const money = (cents) => `$${(cents / 100).toFixed(2)}`;
const rows = []; // { product, quantity, checked, forLine, note }

function updateCount() {
  for (const el of document.querySelectorAll("[data-cart-count]")) el.textContent = String(summarize().item_count);
}
addEventListener(CART_EVENT, updateCount);
updateCount();

function unavailable(items) {
  const box = $("#unavailable");
  const ul = box.querySelector("ul");
  ul.replaceChildren(...items.map((text) => Object.assign(document.createElement("li"), { textContent: text })));
  box.hidden = items.length === 0;
}

function render() {
  const tbody = $("#review tbody");
  tbody.replaceChildren();
  for (const row of rows) {
    const tr = document.createElement("tr");
    const check = Object.assign(document.createElement("input"), { type: "checkbox", checked: row.checked });
    check.setAttribute("aria-label", `Add ${row.product.name}`);
    check.addEventListener("change", () => { row.checked = check.checked; renderTotal(); });
    const qty = Object.assign(document.createElement("input"), { type: "number", min: "1", max: "20", value: String(row.quantity) });
    qty.setAttribute("aria-label", `Packs of ${row.product.name}`);
    const lineTotal = document.createElement("span");
    const sync = () => { lineTotal.textContent = money(row.product.price_cents * row.quantity); };
    qty.addEventListener("change", () => { row.quantity = Math.max(1, Math.min(20, Math.floor(Number(qty.value) || 1))); qty.value = String(row.quantity); sync(); renderTotal(); });
    sync();
    const forCell = document.createElement("span");
    forCell.textContent = row.forLine || "";
    if (row.note) forCell.title = row.note;
    const name = document.createElement("span");
    name.textContent = row.product.name;
    if (row.substituted) name.append(Object.assign(document.createElement("small"), { className: "sub", textContent: " substitute" }));
    const labels = ["Add", "Product", "Size", "Price", "Qty", "Total", "For"];
    [check, name, row.product.size, row.product.price, qty, lineTotal, forCell].forEach((content, i) => {
      const td = document.createElement("td");
      td.dataset.label = labels[i]; // shown on small screens, where rows become cards
      if (i === 1) td.className = "cell-name";
      if (i === 6 && !row.forLine) td.className = "cell-empty";
      td.append(content);
      tr.append(td);
    });
    tbody.append(tr);
  }
  $("#review").hidden = rows.length === 0;
  renderTotal();
}

function renderTotal() {
  const selected = rows.filter((r) => r.checked);
  $("#total").textContent = money(selected.reduce((s, r) => s + r.product.price_cents * r.quantity, 0));
  const button = $("#add");
  button.disabled = selected.length === 0;
  button.textContent = selected.length ? `Add ${selected.length} item${selected.length === 1 ? "" : "s"} to cart` : "Add to cart";
}

async function sha256(text) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function load() {
  const parsed = parseShopHash(location.hash);
  const status = $("#status");
  const missing = [...parsed.errors];
  try {
    if (parsed.kind === "recipe" && parsed.lines.length) {
      const params = new URLSearchParams();
      for (const line of parsed.lines) params.append("i", line);
      const resp = await fetch(`/api/match?${params}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      for (const item of data.items) {
        if (item.status === "matched" || item.status === "substituted") {
          rows.push({ product: item.product, quantity: item.packs, checked: true, forLine: item.input, note: item.note, substituted: item.status === "substituted" });
        } else {
          missing.push(`${item.input}: ${item.note || "not available"}`);
        }
      }
    } else if (parsed.kind === "items" && parsed.items.length) {
      const q = await quote(parsed.items);
      for (const line of q.lines) rows.push({ product: line, quantity: line.quantity, checked: true });
      for (const r of q.rejected) missing.push(`${r.product_id}: ${r.reason.replaceAll("_", " ")}`);
    } else if (!missing.length) {
      status.textContent = "This link has no items. Ask your AI agent for a new cart link, or browse the store.";
      return;
    }
    render();
    unavailable(missing);
    status.textContent = rows.length
      ? `${rows.length} product${rows.length === 1 ? "" : "s"} found. Prices are demo data.`
      : "None of the suggested items are available.";
  } catch (err) {
    status.textContent = `Could not check the items with the store (${err.message}). Nothing was added.`;
  }
}

$("#add").addEventListener("click", async () => {
  const button = $("#add");
  const selected = rows.filter((r) => r.checked).map((r) => ({ product_id: r.product.id, quantity: r.quantity }));
  if (!selected.length) return;
  button.disabled = true;
  try {
    // Same link + same selection = same request id, so a second click or a reload
    // cannot add the items twice.
    const requestId = `link:${await sha256(location.hash + JSON.stringify(selected))}`;
    const priced = await quote(selected);
    const { duplicate } = applyQuote(priced, requestId);
    const done = $("#done");
    done.replaceChildren(
      document.createTextNode(duplicate ? "These items were already added from this link. " : `Added ${priced.lines.length} item${priced.lines.length === 1 ? "" : "s"} to your cart. `),
      Object.assign(document.createElement("a"), { href: "/cart.html", textContent: "View cart" }),
    );
    done.hidden = false;
  } catch (err) {
    $("#status").textContent = `${err.message} Nothing was added.`;
    button.disabled = false;
  }
});

load();
