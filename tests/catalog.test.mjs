import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CartError, getProduct, matchIngredients, parseIngredientLine, PRODUCTS, quoteCart, searchProducts,
} from "../apps/site/lib/catalog.js";

const byInput = (result) => Object.fromEntries(result.items.map((i) => [i.input, i]));

test("catalog ids are unique and well formed", () => {
  assert.ok(PRODUCTS.length >= 150);
  assert.equal(new Set(PRODUCTS.map((p) => p.id)).size, PRODUCTS.length);
  for (const p of PRODUCTS) {
    assert.match(p.id, /^p_[a-z0-9_]+_\d+(g|ml|ct)$/);
    assert.ok(Number.isInteger(p.price_cents) && p.price_cents > 0, p.id);
  }
});

test("ingredient line parsing", () => {
  assert.deepEqual(parseIngredientLine("400 g spaghetti"), { name: "spaghetti", quantity: 400, unit: "g" });
  assert.deepEqual(parseIngredientLine("150g pancetta"), { name: "pancetta", quantity: 150, unit: "g" });
  assert.deepEqual(parseIngredientLine("1 1/2 cups heavy cream"), { name: "heavy cream", quantity: 1.5, unit: "cups" });
  assert.deepEqual(parseIngredientLine("½ tsp ground cumin"), { name: "ground cumin", quantity: 0.5, unit: "tsp" });
  assert.deepEqual(parseIngredientLine("2 cloves garlic, peeled"), { name: "garlic", quantity: 2, unit: "cloves" });
  assert.deepEqual(parseIngredientLine("- 1 can (28 oz) crushed tomatoes"), { name: "crushed tomatoes", quantity: 1, unit: null });
  assert.deepEqual(parseIngredientLine("Salt, to taste"), { name: "Salt", quantity: null, unit: null });
});

test("carbonara: every ingredient matched with sensible pack counts", () => {
  const lines = ["400 g spaghetti", "150 g pancetta", "4 large eggs", "100 g Pecorino Romano, finely grated", "Freshly ground black pepper", "Salt"];
  const r = byInput(matchIngredients(lines));
  assert.equal(r["400 g spaghetti"].product.name, "Spaghetti");
  assert.equal(r["400 g spaghetti"].packs, 1);
  assert.equal(r["150 g pancetta"].packs, 2, "120 g packs");
  assert.equal(r["4 large eggs"].product.name, "Large eggs");
  assert.equal(r["4 large eggs"].packs, 1);
  assert.equal(r["100 g Pecorino Romano, finely grated"].product.name, "Pecorino Romano");
  assert.equal(r["Freshly ground black pepper"].product.name, "Ground black pepper");
  assert.equal(r.Salt.product.name, "Sea salt");
  for (const item of Object.values(r)) assert.equal(item.status, "matched", item.input);
});

test("ambiguous words resolve to the expected product", () => {
  const r = byInput(matchIngredients(["2 tomatoes", "500 g chicken", "olive oil", "2 green onions", "1 lb shrimp, peeled", "2 tbsp soy sauce", "chili flakes"]));
  assert.equal(r["2 tomatoes"].product.name, "Vine tomatoes");
  assert.equal(r["500 g chicken"].product.name, "Chicken breast fillets");
  assert.equal(r["olive oil"].product.name, "Extra virgin olive oil");
  assert.equal(r["2 green onions"].product.name, "Scallions");
  assert.equal(r["1 lb shrimp, peeled"].packs, 2, "454 g needs two 400 g bags");
  assert.equal(r["2 tbsp soy sauce"].product.name, "Soy sauce");
  assert.equal(r["chili flakes"].product.name, "Crushed red pepper flakes");
});

test("out-of-stock items get an in-stock substitute or are reported", () => {
  const r = byInput(matchIngredients(["Fresh basil leaves", "1/4 cup pine nuts", "1 cup dry white wine", "water"]));
  assert.equal(r["Fresh basil leaves"].status, "substituted");
  assert.equal(r["Fresh basil leaves"].product.name, "Dried basil");
  assert.match(r["Fresh basil leaves"].note, /out of stock/);
  assert.equal(r["1/4 cup pine nuts"].status, "out_of_stock");
  assert.equal(r["1/4 cup pine nuts"].packs, undefined, "nothing to buy");
  assert.equal(r["1 cup dry white wine"].status, "not_found");
  assert.equal(r.water.status, "not_found");
});

test("summary totals add up", () => {
  const result = matchIngredients(["400 g spaghetti", "2 lemons", "water"]);
  const sum = result.items.reduce((s, i) => s + (i.line_total_cents || 0), 0);
  assert.equal(result.summary.estimated_total_cents, sum);
  assert.equal(result.summary.unavailable, 1);
  assert.equal(result.demo_data, true);
});

test("search ranks the closest product first and respects category", () => {
  assert.equal(searchProducts("parmesan")[0].name, "Parmesan cheese");
  assert.equal(searchProducts("rice", { category: "Pasta, Rice & Grains" })[0].category, "Pasta, Rice & Grains");
  assert.deepEqual(searchProducts("unobtainium"), []);
});

test("quoteCart validates ids, quantities and stock, and uses server prices", () => {
  const spaghetti = PRODUCTS.find((p) => p.name === "Spaghetti");
  const basil = PRODUCTS.find((p) => p.name === "Fresh basil");
  const q = quoteCart([
    { product_id: spaghetti.id, quantity: 2 },
    { product_id: spaghetti.id, quantity: 1 },
    { product_id: "p_made_up_1g", quantity: 1 },
    { product_id: basil.id, quantity: 1 },
    { product_id: spaghetti.id, quantity: 0 },
    { product_id: spaghetti.id, quantity: 1.5 },
  ]);
  assert.equal(q.lines.length, 1);
  assert.equal(q.lines[0].quantity, 3, "duplicate lines merged");
  assert.equal(q.lines[0].line_total_cents, spaghetti.price_cents * 3);
  assert.equal(q.subtotal_cents, spaghetti.price_cents * 3);
  assert.deepEqual(q.rejected.map((r) => r.reason).sort(), [
    "out_of_stock", "quantity must be an integer from 1 to 20", "quantity must be an integer from 1 to 20", "unknown_product",
  ]);
  assert.throws(() => quoteCart([]), CartError);
  assert.throws(() => quoteCart("x"), CartError);
  assert.throws(() => quoteCart(Array.from({ length: 41 }, () => ({ product_id: spaghetti.id, quantity: 1 }))), CartError);
  assert.equal(getProduct("nope"), null);
});
