// Synthetic product catalog for the fictional Greenleaf Market, plus search and
// recipe-ingredient matching. Public demo data only; prices are in US cents.
//
// Row format: [name, category, aisle, size_value, size_unit, price_cents, tags, stock]
// size_unit is one of "g", "ml" or "count". stock 0 means out of stock.

const ROWS = [
  // Produce
  ["Yellow onions", "Produce", "1", 1000, "g", 249, ["onion", "brown onion", "white onion"], 80],
  ["Red onion", "Produce", "1", 1, "count", 99, ["red onion", "purple onion"], 60],
  ["Garlic bulb", "Produce", "1", 1, "count", 69, ["garlic", "garlic clove", "clove garlic"], 120],
  ["Shallots", "Produce", "1", 250, "g", 299, ["shallot"], 30],
  ["Carrots", "Produce", "1", 1000, "g", 189, ["carrot"], 70],
  ["Celery", "Produce", "1", 1, "count", 199, ["celery stalk", "celery rib"], 40],
  ["Russet potatoes", "Produce", "1", 2000, "g", 449, ["potato", "baking potato"], 50],
  ["Sweet potatoes", "Produce", "1", 1000, "g", 329, ["sweet potato", "yam"], 40],
  ["Vine tomatoes", "Produce", "1", 500, "g", 299, ["tomato", "fresh tomato"], 60],
  ["Cherry tomatoes", "Produce", "1", 250, "g", 279, ["cherry tomato", "grape tomato"], 40],
  ["Lemons", "Produce", "1", 1, "count", 69, ["lemon", "lemon juice", "lemon zest"], 150],
  ["Limes", "Produce", "1", 1, "count", 49, ["lime", "lime juice", "lime zest"], 150],
  ["Hass avocado", "Produce", "1", 1, "count", 149, ["avocado"], 45],
  ["Red bell pepper", "Produce", "1", 1, "count", 129, ["bell pepper", "red pepper", "capsicum"], 60],
  ["Green bell pepper", "Produce", "1", 1, "count", 99, ["green pepper", "bell pepper"], 50],
  ["Jalapeño peppers", "Produce", "1", 100, "g", 119, ["jalapeno", "chili pepper", "green chili", "chile"], 30],
  ["Zucchini", "Produce", "1", 1, "count", 109, ["courgette"], 40],
  ["Eggplant", "Produce", "1", 1, "count", 179, ["aubergine"], 25],
  ["White mushrooms", "Produce", "1", 250, "g", 249, ["mushroom", "button mushroom"], 40],
  ["Baby spinach", "Produce", "1", 150, "g", 349, ["spinach"], 35],
  ["Romaine lettuce", "Produce", "1", 1, "count", 229, ["lettuce", "romaine"], 30],
  ["Cucumber", "Produce", "1", 1, "count", 89, ["cucumber"], 50],
  ["Broccoli crown", "Produce", "1", 1, "count", 199, ["broccoli"], 40],
  ["Cauliflower", "Produce", "1", 1, "count", 299, ["cauliflower"], 25],
  ["Green beans", "Produce", "1", 300, "g", 279, ["string bean", "green bean"], 30],
  ["Fresh ginger", "Produce", "1", 100, "g", 129, ["ginger", "ginger root"], 40],
  ["Scallions", "Produce", "1", 1, "count", 99, ["green onion", "spring onion", "scallion"], 50],
  ["Cilantro", "Produce", "1", 1, "count", 99, ["coriander", "fresh coriander", "cilantro leaves"], 40],
  ["Flat-leaf parsley", "Produce", "1", 1, "count", 99, ["parsley", "italian parsley"], 40],
  ["Fresh basil", "Produce", "1", 30, "g", 249, ["basil", "basil leaves"], 0],
  ["Fresh thyme", "Produce", "1", 20, "g", 229, ["thyme"], 20],
  ["Fresh rosemary", "Produce", "1", 20, "g", 229, ["rosemary"], 20],
  ["Fresh mint", "Produce", "1", 30, "g", 229, ["mint", "mint leaves"], 20],
  ["Gala apples", "Produce", "1", 1000, "g", 349, ["apple"], 60],
  ["Bananas", "Produce", "1", 1000, "g", 159, ["banana"], 80],
  ["Strawberries", "Produce", "1", 450, "g", 449, ["strawberry", "berry"], 30],
  ["Blueberries", "Produce", "1", 170, "g", 399, ["blueberry", "berry"], 30],
  ["Navel oranges", "Produce", "1", 1000, "g", 399, ["orange", "orange zest"], 40],
  ["Sweet corn", "Produce", "1", 1, "count", 79, ["corn on the cob", "corn ear"], 40],
  ["Green cabbage", "Produce", "1", 1, "count", 249, ["cabbage"], 20],
  ["Kale", "Produce", "1", 1, "count", 249, ["kale", "curly kale"], 25],
  ["Butternut squash", "Produce", "1", 1, "count", 349, ["squash", "butternut"], 20],

  // Meat, seafood and plant protein
  ["Chicken breast fillets", "Meat & Seafood", "8", 500, "g", 749, ["chicken", "chicken breast", "boneless chicken"], 40],
  ["Chicken thighs", "Meat & Seafood", "8", 1000, "g", 899, ["chicken thigh", "boneless chicken thigh"], 30],
  ["Whole chicken", "Meat & Seafood", "8", 1500, "g", 1099, ["roast chicken", "whole chicken"], 15],
  ["Lean ground beef", "Meat & Seafood", "8", 500, "g", 699, ["ground beef", "minced beef", "beef mince", "hamburger meat"], 40],
  ["Beef stew meat", "Meat & Seafood", "8", 500, "g", 899, ["stewing beef", "beef chuck", "beef cube"], 20],
  ["Pork shoulder", "Meat & Seafood", "8", 1000, "g", 899, ["pork butt", "pork"], 15],
  ["Smoked bacon", "Meat & Seafood", "8", 250, "g", 549, ["bacon", "streaky bacon"], 40],
  ["Diced pancetta", "Meat & Seafood", "8", 120, "g", 499, ["pancetta", "guanciale"], 25],
  ["Italian sausage", "Meat & Seafood", "8", 400, "g", 649, ["sausage"], 25],
  ["Atlantic salmon fillet", "Meat & Seafood", "8", 400, "g", 1199, ["salmon", "salmon fillet"], 20],
  ["Raw shrimp", "Meat & Seafood", "8", 400, "g", 1099, ["shrimp", "prawn"], 20],
  ["Ground turkey", "Meat & Seafood", "8", 500, "g", 649, ["turkey mince", "minced turkey"], 25],
  ["Firm tofu", "Meat & Seafood", "8", 400, "g", 249, ["tofu", "bean curd"], 30],

  // Dairy and eggs
  ["Large eggs", "Dairy & Eggs", "9", 12, "count", 399, ["egg"], 60],
  ["Whole milk", "Dairy & Eggs", "9", 1000, "ml", 189, ["milk"], 60],
  ["Unsalted butter", "Dairy & Eggs", "9", 250, "g", 449, ["butter"], 50],
  ["Heavy cream", "Dairy & Eggs", "9", 473, "ml", 399, ["cream", "double cream", "whipping cream", "heavy whipping cream"], 30],
  ["Sour cream", "Dairy & Eggs", "9", 450, "g", 279, ["soured cream"], 25],
  ["Greek yogurt", "Dairy & Eggs", "9", 500, "g", 449, ["yogurt", "plain yogurt", "yoghurt"], 30],
  ["Parmesan cheese", "Dairy & Eggs", "9", 150, "g", 599, ["parmesan", "parmigiano reggiano", "parmigiano"], 30],
  ["Pecorino Romano", "Dairy & Eggs", "9", 150, "g", 649, ["pecorino"], 20],
  ["Fresh mozzarella", "Dairy & Eggs", "9", 250, "g", 449, ["mozzarella", "mozzarella cheese"], 30],
  ["Sharp cheddar", "Dairy & Eggs", "9", 200, "g", 399, ["cheddar", "cheddar cheese", "shredded cheese"], 40],
  ["Feta cheese", "Dairy & Eggs", "9", 200, "g", 429, ["feta"], 25],
  ["Ricotta cheese", "Dairy & Eggs", "9", 425, "g", 449, ["ricotta"], 20],
  ["Cream cheese", "Dairy & Eggs", "9", 226, "g", 299, ["cream cheese"], 25],

  // Bakery
  ["Sandwich bread", "Bakery", "2", 1, "count", 329, ["bread", "white bread", "bread slice"], 30],
  ["French baguette", "Bakery", "2", 1, "count", 299, ["baguette", "french bread", "crusty bread"], 20],
  ["Flour tortillas (8 in)", "Bakery", "2", 10, "count", 349, ["tortilla", "flour tortilla", "wrap"], 30],
  ["Corn tortillas", "Bakery", "2", 30, "count", 299, ["corn tortilla", "taco shell"], 25],
  ["Burger buns", "Bakery", "2", 8, "count", 329, ["hamburger bun", "bun"], 25],
  ["Pita bread", "Bakery", "2", 6, "count", 279, ["pita", "flatbread"], 20],

  // Pasta, rice and grains
  ["Spaghetti", "Pasta, Rice & Grains", "3", 500, "g", 189, ["spaghetti", "pasta"], 60],
  ["Penne rigate", "Pasta, Rice & Grains", "3", 500, "g", 189, ["penne", "pasta"], 50],
  ["Lasagna sheets", "Pasta, Rice & Grains", "3", 500, "g", 299, ["lasagna noodle", "lasagne"], 25],
  ["Fettuccine", "Pasta, Rice & Grains", "3", 500, "g", 219, ["fettuccine", "pasta"], 30],
  ["Wide egg noodles", "Pasta, Rice & Grains", "3", 340, "g", 249, ["egg noodle", "noodle"], 25],
  ["Rice noodles", "Pasta, Rice & Grains", "3", 400, "g", 299, ["rice noodle", "pad thai noodle", "rice stick"], 25],
  ["Long-grain white rice", "Pasta, Rice & Grains", "3", 2000, "g", 499, ["rice", "white rice", "long grain rice"], 40],
  ["Basmati rice", "Pasta, Rice & Grains", "3", 1000, "g", 449, ["basmati"], 30],
  ["Arborio rice", "Pasta, Rice & Grains", "3", 1000, "g", 549, ["arborio", "risotto rice"], 20],
  ["Jasmine rice", "Pasta, Rice & Grains", "3", 2000, "g", 599, ["jasmine", "thai rice"], 25],
  ["Quinoa", "Pasta, Rice & Grains", "3", 500, "g", 499, ["quinoa"], 20],
  ["Rolled oats", "Pasta, Rice & Grains", "3", 1000, "g", 399, ["oat", "oatmeal", "old fashioned oat"], 30],
  ["Couscous", "Pasta, Rice & Grains", "3", 500, "g", 329, ["couscous"], 20],
  ["Plain breadcrumbs", "Pasta, Rice & Grains", "3", 425, "g", 249, ["breadcrumb", "bread crumb"], 25],
  ["Panko breadcrumbs", "Pasta, Rice & Grains", "3", 227, "g", 279, ["panko"], 25],

  // Canned and jarred
  ["Crushed tomatoes", "Canned & Jarred", "4", 794, "g", 249, ["crushed tomato", "canned tomato", "tinned tomato"], 50],
  ["Diced tomatoes", "Canned & Jarred", "4", 411, "g", 149, ["diced tomato", "canned tomato", "chopped tomato"], 50],
  ["Tomato paste", "Canned & Jarred", "4", 170, "g", 119, ["tomato puree", "tomato concentrate"], 50],
  ["Tomato passata", "Canned & Jarred", "4", 680, "g", 299, ["passata", "strained tomato", "tomato sauce"], 30],
  ["Black beans", "Canned & Jarred", "4", 425, "g", 129, ["black bean"], 40],
  ["Red kidney beans", "Canned & Jarred", "4", 425, "g", 129, ["kidney bean", "red bean"], 40],
  ["Chickpeas", "Canned & Jarred", "4", 425, "g", 129, ["chickpea", "garbanzo", "garbanzo bean"], 40],
  ["Coconut milk", "Canned & Jarred", "4", 400, "ml", 229, ["coconut cream", "coconut milk"], 40],
  ["Chicken stock", "Canned & Jarred", "4", 1000, "ml", 299, ["chicken broth", "chicken stock"], 40],
  ["Vegetable stock", "Canned & Jarred", "4", 1000, "ml", 299, ["vegetable broth", "veggie stock", "stock", "broth"], 40],
  ["Beef stock", "Canned & Jarred", "4", 1000, "ml", 299, ["beef broth"], 30],
  ["Tuna in water", "Canned & Jarred", "4", 142, "g", 169, ["tuna", "canned tuna"], 40],

  // Baking
  ["All-purpose flour", "Baking", "5", 2000, "g", 349, ["flour", "plain flour", "ap flour"], 40],
  ["Granulated sugar", "Baking", "5", 2000, "g", 329, ["sugar", "white sugar", "caster sugar"], 40],
  ["Light brown sugar", "Baking", "5", 1000, "g", 299, ["brown sugar"], 30],
  ["Powdered sugar", "Baking", "5", 1000, "g", 279, ["icing sugar", "confectioners sugar"], 25],
  ["Baking powder", "Baking", "5", 230, "g", 269, ["baking powder"], 30],
  ["Baking soda", "Baking", "5", 454, "g", 129, ["bicarbonate of soda", "bicarb"], 30],
  ["Pure vanilla extract", "Baking", "5", 59, "ml", 799, ["vanilla", "vanilla essence"], 25],
  ["Cocoa powder", "Baking", "5", 227, "g", 399, ["cocoa", "unsweetened cocoa"], 20],
  ["Semi-sweet chocolate chips", "Baking", "5", 340, "g", 399, ["chocolate chip", "chocolate"], 30],
  ["Instant yeast", "Baking", "5", 21, "g", 199, ["yeast", "dry yeast", "active dry yeast"], 30],
  ["Clover honey", "Baking", "5", 340, "g", 549, ["honey"], 25],
  ["Pure maple syrup", "Baking", "5", 250, "ml", 899, ["maple syrup", "syrup"], 20],
  ["Cornstarch", "Baking", "5", 454, "g", 199, ["corn starch", "cornflour"], 25],

  // Spices and seasonings
  ["Sea salt", "Spices", "6", 737, "g", 199, ["salt", "kosher salt", "table salt"], 60],
  ["Ground black pepper", "Spices", "6", 50, "g", 349, ["black pepper", "pepper", "peppercorn"], 50],
  ["Ground cumin", "Spices", "6", 45, "g", 329, ["cumin"], 30],
  ["Sweet paprika", "Spices", "6", 60, "g", 299, ["paprika"], 30],
  ["Smoked paprika", "Spices", "6", 60, "g", 349, ["pimenton", "smoked paprika"], 25],
  ["Chili powder", "Spices", "6", 70, "g", 299, ["chile powder", "chilli powder"], 30],
  ["Crushed red pepper flakes", "Spices", "6", 40, "g", 279, ["red pepper flake", "chili flake", "chilli flake"], 25],
  ["Dried oregano", "Spices", "6", 20, "g", 279, ["oregano"], 30],
  ["Dried basil", "Spices", "6", 20, "g", 279, ["basil", "dried basil"], 30],
  ["Ground cinnamon", "Spices", "6", 50, "g", 299, ["cinnamon"], 30],
  ["Ground turmeric", "Spices", "6", 40, "g", 329, ["turmeric"], 25],
  ["Garam masala", "Spices", "6", 50, "g", 399, ["garam masala"], 20],
  ["Curry powder", "Spices", "6", 50, "g", 329, ["curry powder"], 25],
  ["Bay leaves", "Spices", "6", 5, "g", 299, ["bay leaf"], 25],
  ["Ground nutmeg", "Spices", "6", 40, "g", 399, ["nutmeg"], 20],
  ["Italian seasoning", "Spices", "6", 25, "g", 299, ["italian herb", "mixed herb"], 25],
  ["Garlic powder", "Spices", "6", 70, "g", 299, ["garlic powder", "granulated garlic"], 30],
  ["Onion powder", "Spices", "6", 60, "g", 299, ["onion powder"], 25],
  ["Dried thyme", "Spices", "6", 20, "g", 279, ["thyme", "dried thyme"], 25],

  // Oils and vinegars
  ["Extra virgin olive oil", "Oils & Vinegars", "4", 500, "ml", 899, ["olive oil", "evoo", "oil"], 40],
  ["Vegetable oil", "Oils & Vinegars", "4", 1000, "ml", 399, ["cooking oil", "canola oil", "neutral oil", "oil"], 40],
  ["Toasted sesame oil", "Oils & Vinegars", "4", 250, "ml", 449, ["sesame oil"], 25],
  ["Balsamic vinegar", "Oils & Vinegars", "4", 250, "ml", 499, ["balsamic"], 25],
  ["Red wine vinegar", "Oils & Vinegars", "4", 500, "ml", 299, ["red wine vinegar"], 20],
  ["Rice vinegar", "Oils & Vinegars", "4", 355, "ml", 279, ["rice wine vinegar"], 20],
  ["Apple cider vinegar", "Oils & Vinegars", "4", 500, "ml", 299, ["cider vinegar", "vinegar"], 25],

  // Sauces and condiments
  ["Soy sauce", "Sauces & Condiments", "7", 500, "ml", 349, ["soy sauce", "shoyu", "tamari"], 40],
  ["Fish sauce", "Sauces & Condiments", "7", 200, "ml", 329, ["nam pla"], 20],
  ["Oyster sauce", "Sauces & Condiments", "7", 255, "g", 349, ["oyster sauce"], 20],
  ["Sriracha", "Sauces & Condiments", "7", 482, "g", 449, ["hot sauce", "chili sauce"], 25],
  ["Dijon mustard", "Sauces & Condiments", "7", 215, "g", 299, ["mustard", "dijon"], 30],
  ["Mayonnaise", "Sauces & Condiments", "7", 400, "g", 399, ["mayo"], 30],
  ["Tomato ketchup", "Sauces & Condiments", "7", 500, "g", 249, ["ketchup", "catsup"], 30],
  ["Medium salsa", "Sauces & Condiments", "7", 454, "g", 349, ["salsa"], 25],
  ["Basil pesto", "Sauces & Condiments", "7", 190, "g", 449, ["pesto"], 20],
  ["Marinara sauce", "Sauces & Condiments", "7", 680, "g", 399, ["pasta sauce", "tomato sauce", "spaghetti sauce"], 30],
  ["Worcestershire sauce", "Sauces & Condiments", "7", 296, "ml", 349, ["worcestershire"], 20],
  ["Hoisin sauce", "Sauces & Condiments", "7", 250, "g", 329, ["hoisin"], 20],
  ["Thai red curry paste", "Sauces & Condiments", "7", 114, "g", 299, ["red curry paste", "curry paste"], 20],
  ["Creamy peanut butter", "Sauces & Condiments", "7", 454, "g", 349, ["peanut butter"], 25],

  // Nuts, seeds and dried fruit
  ["Walnut halves", "Nuts & Dried Fruit", "5", 200, "g", 549, ["walnut"], 20],
  ["Whole almonds", "Nuts & Dried Fruit", "5", 200, "g", 499, ["almond"], 20],
  ["Pine nuts", "Nuts & Dried Fruit", "5", 100, "g", 799, ["pine nut", "pignoli"], 0],
  ["Roasted peanuts", "Nuts & Dried Fruit", "5", 300, "g", 349, ["peanut"], 20],
  ["Raisins", "Nuts & Dried Fruit", "5", 250, "g", 299, ["raisin", "sultana"], 20],
  ["Sesame seeds", "Nuts & Dried Fruit", "5", 100, "g", 249, ["sesame seed"], 20],

  // Frozen
  ["Frozen peas", "Frozen", "10", 500, "g", 229, ["pea", "green pea"], 40],
  ["Frozen sweet corn", "Frozen", "10", 500, "g", 229, ["corn", "corn kernel"], 40],
  ["Frozen chopped spinach", "Frozen", "10", 300, "g", 199, ["frozen spinach"], 30],
  ["Vanilla ice cream", "Frozen", "10", 1500, "ml", 549, ["ice cream"], 20],
];

export const STORE = { name: "Greenleaf Market", currency: "USD" };

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const sizeLabel = (v, u) => (u === "count" ? (v === 1 ? "each" : `${v} ct`) : u === "g" ? (v >= 1000 ? `${v / 1000} kg` : `${v} g`) : v >= 1000 ? `${v / 1000} L` : `${v} ml`);

export const PRODUCTS = ROWS.map(([name, category, aisle, size_value, size_unit, price_cents, tags, stock]) => ({
  id: `p_${slug(name)}_${size_value}${size_unit === "count" ? "ct" : size_unit}`,
  name, category, aisle, size_value, size_unit, size: sizeLabel(size_value, size_unit),
  price_cents, tags, stock,
}));
const BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));
export const CATEGORIES = [...new Set(PRODUCTS.map((p) => p.category))];

export const getProduct = (id) => BY_ID.get(id) || null;

export const LOW_STOCK = 5;
const UNIT_NAMES = { g: "g", ml: "ml", count: "items" };

/** How the product is sold: one item ("each") or a pack with fixed contents. */
export function unitInfo(p) {
  const each = p.size_unit === "count" && p.size_value === 1;
  let unitPrice;
  if (p.size_unit === "count") {
    unitPrice = each ? `${formatPrice(p.price_cents)} each` : `${formatPrice(Math.round(p.price_cents / p.size_value))} per item`;
  } else {
    const per = p.size_unit === "g" ? "100 g" : "100 ml";
    unitPrice = `${formatPrice(Math.round((p.price_cents * 100) / p.size_value))} per ${per}`;
  }
  return {
    sold_as: each ? "each" : "pack",
    contents: { amount: p.size_value, unit: UNIT_NAMES[p.size_unit] },
    label: each ? "each (1 item)" : `pack of ${p.size}`,
    unit_price: unitPrice,
  };
}

/** Stock on hand. Quantities are in units of sale (items or packs). */
export function stockInfo(p) {
  return {
    in_stock: p.stock > 0,
    available: p.stock,
    status: p.stock <= 0 ? "out_of_stock" : p.stock <= LOW_STOCK ? "low_stock" : "in_stock",
    max_per_order: Math.min(MAX_QTY, Math.max(0, p.stock)),
  };
}

export function publicProduct(p) {
  return {
    id: p.id, name: p.name, size: p.size, price: formatPrice(p.price_cents), price_cents: p.price_cents,
    category: p.category, aisle: p.aisle, in_stock: p.stock > 0,
    unit: unitInfo(p),
    stock: stockInfo(p),
  };
}

export const MAX_LOOKUPS = 40;

/**
 * Store lookup: exact product ids and/or product names (best match). Tells an
 * agent what unit each item is sold in and how many are in stock.
 */
export function lookupProducts({ product_ids = [], names = [] } = {}) {
  const ids = product_ids.slice(0, MAX_LOOKUPS);
  const results = ids.map((id) => {
    const p = getProduct(id);
    return p ? { query: id, by: "id", found: true, product: publicProduct(p) } : { query: id, by: "id", found: false, note: "Unknown product id." };
  });
  for (const name of names.slice(0, Math.max(0, MAX_LOOKUPS - ids.length))) {
    const [best, ...rest] = searchProducts(name, { limit: 4 });
    results.push(best
      ? { query: name, by: "name", found: true, product: publicProduct(best), alternatives: rest.map(publicProduct) }
      : { query: name, by: "name", found: false, note: "No matching product." });
  }
  return { store: STORE.name, demo_data: true, results, truncated: product_ids.length + names.length > MAX_LOOKUPS };
}

export const formatPrice = (cents) => `$${(cents / 100).toFixed(2)}`;

// ---- text normalisation -----------------------------------------------------

// Descriptive words that do not change which product to buy.
const STOP = new Set([
  "a", "an", "the", "of", "and", "or", "for", "to", "taste", "optional", "freshly", "large", "small", "medium",
  "chopped", "finely", "roughly", "diced", "minced", "sliced", "thinly", "grated", "shredded", "peeled", "cubed",
  "boneless", "skinless", "ripe", "about", "plus", "more", "extra", "good", "quality", "organic", "whole", "halved",
  "softened", "melted", "room", "temperature", "cold", "warm", "hot", "packed", "lightly", "beaten", "divided",
  "juiced", "zested", "rinsed", "drained", "trimmed", "cut", "into", "piece", "pieces", "inch", "can", "cans", "jar",
  "package", "pkg", "bag", "bunch", "handful", "pinch", "dash", "sprig", "sprigs", "stalk", "stalks", "head", "heads", "leaf", "leaves",
]);

function singular(w) {
  if (w.length <= 3 || w.endsWith("ss")) return w;
  if (w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.endsWith("oes")) return w.slice(0, -2);
  if (w.endsWith("ves")) return `${w.slice(0, -3)}f`;
  if (w.endsWith("ches") || w.endsWith("shes")) return w.slice(0, -2);
  if (w.endsWith("s")) return w.slice(0, -1);
  return w;
}

const rawTokens = (text) => String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z\s-]/g, " ").replace(/-/g, " ").split(/\s+/).filter(Boolean).map(singular);

/** Query tokens: descriptive words removed. Product names keep every word, so
 * "Diced tomatoes" stays distinct from "Vine tomatoes". */
export function tokens(text) {
  return rawTokens(text).filter((w) => !STOP.has(w));
}

const phrase = (text) => rawTokens(text).join(" ");

const INDEX = PRODUCTS.map((p) => ({
  p,
  nameTokens: rawTokens(p.name),
  tagPhrases: p.tags.map(phrase),
  allTokens: new Set([...rawTokens(p.name), ...p.tags.flatMap(rawTokens)]),
}));

// Rare words decide the product ("basil" in "basil leaves"), so weight query words by
// inverse document frequency over the catalog.
const DF = new Map();
for (const e of INDEX) for (const t of e.allTokens) DF.set(t, (DF.get(t) || 0) + 1);
const weight = (t) => 1 + Math.log(INDEX.length / (DF.get(t) || 1));

// Recipe items a supermarket does not sell.
const NOT_SOLD = new Set(["water", "ice", "boiling water", "ice water", "cold water", "warm water"]);

function score(entry, q, rawPhrase = "") {
  if (!q.length) return 0;
  const total = q.reduce((sum, t) => sum + weight(t), 0);
  const hit = q.filter((t) => entry.allTokens.has(t)).reduce((sum, t) => sum + weight(t), 0);
  if (hit === 0) return 0;
  const coverage = hit / total;
  const qp = q.join(" ");
  let s = coverage * 10;
  if (entry.tagPhrases.includes(qp) || entry.nameTokens.join(" ") === qp) s += 6;
  else if (entry.tagPhrases.some((t) => t.endsWith(qp) || qp.endsWith(t))) s += 2;
  // The full wording, before descriptive words were removed, names this product
  // exactly ("whole chicken", "whole milk").
  if (rawPhrase && rawPhrase !== qp && (entry.tagPhrases.includes(rawPhrase) || entry.nameTokens.join(" ") === rawPhrase)) s += 8;
  const extraName = entry.nameTokens.filter((t) => !q.includes(t) && !rawPhrase.split(" ").includes(t)).length;
  s -= extraName * 0.4;
  return s; // relevance only; stock is handled by the caller
}

/** Ranked product search. */
export function searchProducts(query, { category, limit = 10 } = {}) {
  const q = tokens(query);
  const rawPhrase = rawTokens(query).join(" ");
  return INDEX
    .filter((e) => !category || e.p.category === category)
    .map((e) => ({ e, s: score(e, q, rawPhrase) }))
    .filter((x) => x.s >= 5) // at least half of the meaningful words match
    .sort((a, b) => b.s - a.s || a.e.p.price_cents - b.e.p.price_cents)
    .slice(0, Math.max(1, Math.min(limit, 25)))
    .map((x) => x.e.p);
}

// ---- recipe ingredient lines ----------------------------------------------------

const FRACTIONS = { "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅛": 0.125 };
// unit -> [base unit, factor]
const UNITS = {
  g: ["g", 1], gram: ["g", 1], grams: ["g", 1], kg: ["g", 1000], kilogram: ["g", 1000], kilograms: ["g", 1000],
  oz: ["g", 28.35], ounce: ["g", 28.35], ounces: ["g", 28.35], lb: ["g", 453.6], lbs: ["g", 453.6], pound: ["g", 453.6], pounds: ["g", 453.6],
  ml: ["ml", 1], milliliter: ["ml", 1], milliliters: ["ml", 1], l: ["ml", 1000], liter: ["ml", 1000], liters: ["ml", 1000], litre: ["ml", 1000], litres: ["ml", 1000],
  cup: ["ml", 240], cups: ["ml", 240], tbsp: ["ml", 15], tablespoon: ["ml", 15], tablespoons: ["ml", 15],
  tsp: ["ml", 5], teaspoon: ["ml", 5], teaspoons: ["ml", 5], "fl oz": ["ml", 29.6],
  clove: ["clove", 1], cloves: ["clove", 1],
};

/** Parse "1 1/2 cups heavy cream" -> { name, quantity, unit }. */
export function parseIngredientLine(line) {
  let s = String(line || "").trim().replace(/\s+/g, " ");
  s = s.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, ""); // list markers
  let quantity = null;
  const m = s.match(/^((?:\d+\s+)?\d+\/\d+|\d+(?:\.\d+)?|[½⅓⅔¼¾⅛])(?:\s*([½⅓⅔¼¾⅛]))?(?:\s*(?:-|to)\s*\d+(?:\.\d+)?)?\s*/);
  if (m) {
    const parts = m[1].split(" ");
    quantity = parts.reduce((sum, part) => {
      if (FRACTIONS[part] !== undefined) return sum + FRACTIONS[part];
      if (part.includes("/")) { const [a, b] = part.split("/").map(Number); return sum + (b ? a / b : 0); }
      return sum + Number(part);
    }, 0) + (m[2] ? FRACTIONS[m[2]] : 0);
    s = s.slice(m[0].length);
  }
  let unit = null;
  const um = s.match(/^(fl oz|[a-z]+)\.?\s+/i);
  if (um && UNITS[um[1].toLowerCase()]) {
    unit = um[1].toLowerCase();
    s = s.slice(um[0].length);
  }
  // Preparation notes usually follow a comma or sit in parentheses.
  const name = s.replace(/\([^)]*\)/g, " ").split(",")[0].replace(/\s+/g, " ").trim()
    .replace(/^(?:cans?|tins?|jars?|packages?|packs?|bags?|box(?:es)?|bunch(?:es)?|handfuls?|pinch(?:es)?|sprigs?|stalks?|heads?)\s+(?:of\s+)?/i, "")
    .replace(/^of\s+/i, "");
  return { name, quantity, unit };
}

function packsFor(product, quantity, unit) {
  if (quantity == null || quantity <= 0) return { packs: 1, note: null };
  if (!unit) {
    if (product.size_unit === "count") return { packs: Math.min(20, Math.max(1, Math.ceil(quantity / product.size_value))), note: null };
    return { packs: 1, note: "Recipe gives a count; check the pack size." };
  }
  const [base, factor] = UNITS[unit] || [];
  if (base === "clove") return { packs: Math.max(1, Math.ceil(quantity / 10)), note: "About 10 cloves per bulb." };
  if (base && base === product.size_unit) {
    return { packs: Math.min(20, Math.max(1, Math.ceil((quantity * factor) / product.size_value))), note: null };
  }
  return { packs: 1, note: "Recipe and pack use different units; one pack is usually enough." };
}

export const MAX_INGREDIENTS = 40;

/**
 * Match recipe ingredient lines to products. Out-of-stock products are swapped for
 * the best in-stock alternative and flagged; unmatched lines are reported.
 */
export function matchIngredients(lines) {
  const items = lines.slice(0, MAX_INGREDIENTS).map((input) => {
    const parsed = parseIngredientLine(input);
    if (NOT_SOLD.has(tokens(parsed.name).join(" ")) || NOT_SOLD.has(parsed.name.toLowerCase())) {
      return { input, parsed, status: "not_found", note: "Not sold in stores; most kitchens already have it." };
    }
    const candidates = searchProducts(parsed.name, { limit: 6 });
    if (!candidates.length) {
      return { input, parsed, status: "not_found", note: "No matching product at Greenleaf Market." };
    }
    const best = candidates[0];
    const inStock = candidates.filter((p) => p.stock > 0);
    const chosen = best.stock > 0 ? best : inStock[0];
    if (!chosen) {
      return { input, parsed, status: "out_of_stock", product: publicProduct(best), note: `${best.name} is out of stock and there is no in-stock alternative.` };
    }
    const wanted = packsFor(chosen, parsed.quantity, parsed.unit);
    const packs = Math.min(wanted.packs, chosen.stock);
    const note = packs < wanted.packs
      ? `Only ${chosen.stock} in stock; the recipe needs ${wanted.packs}.${wanted.note ? ` ${wanted.note}` : ""}`
      : wanted.note;
    return {
      input,
      parsed,
      status: chosen === best ? "matched" : "substituted",
      product: publicProduct(chosen),
      packs,
      line_total: formatPrice(chosen.price_cents * packs),
      line_total_cents: chosen.price_cents * packs,
      note: chosen === best ? note : `${best.name} is out of stock; suggested ${chosen.name} instead.${note ? ` ${note}` : ""}`,
      alternatives: candidates.filter((p) => p !== chosen && p.stock > 0).slice(0, 3).map(publicProduct),
    };
  });
  const totalCents = items.reduce((sum, i) => sum + (i.line_total_cents || 0), 0);
  return {
    store: STORE.name,
    demo_data: true,
    items,
    summary: {
      matched: items.filter((i) => i.status === "matched").length,
      substituted: items.filter((i) => i.status === "substituted").length,
      unavailable: items.filter((i) => i.status === "not_found" || i.status === "out_of_stock").length,
      estimated_total: formatPrice(totalCents),
      estimated_total_cents: totalCents,
    },
    truncated: lines.length > MAX_INGREDIENTS,
  };
}

export const MAX_CART_LINES = 40;
export const MAX_QTY = 20;

export class CartError extends Error {}

/** Validate and price cart lines (server-side source of truth for prices). */
export function quoteCart(items) {
  if (!Array.isArray(items) || items.length === 0) throw new CartError("items must be a non-empty array.");
  if (items.length > MAX_CART_LINES) throw new CartError(`At most ${MAX_CART_LINES} lines per request.`);
  const merged = new Map();
  const rejected = [];
  for (const item of items) {
    const id = item?.product_id;
    const qty = item?.quantity;
    const product = typeof id === "string" ? getProduct(id) : null;
    if (!product) { rejected.push({ product_id: id ?? null, reason: "unknown_product" }); continue; }
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) { rejected.push({ product_id: id, reason: `quantity must be an integer from 1 to ${MAX_QTY}` }); continue; }
    if (product.stock <= 0) { rejected.push({ product_id: id, reason: "out_of_stock" }); continue; }
    const total = (merged.get(id) || 0) + qty;
    if (total > product.stock) { rejected.push({ product_id: id, reason: `only ${product.stock} in stock`, available: product.stock }); continue; }
    merged.set(id, Math.min(MAX_QTY, total));
  }
  const lines = [...merged].map(([id, quantity]) => {
    const p = getProduct(id);
    return { ...publicProduct(p), quantity, line_total_cents: p.price_cents * quantity, line_total: formatPrice(p.price_cents * quantity) };
  });
  const subtotal = lines.reduce((s, l) => s + l.line_total_cents, 0);
  return { lines, rejected, subtotal_cents: subtotal, subtotal: formatPrice(subtotal) };
}
