// Public, read-only MCP server: POST /api/mcp/public
//
// The grounded capability for the market_assistant network (spec §3.1 "Use grounded
// capabilities"). It serves the public demo catalog only, needs no authentication and
// allows any origin (no credentials), so a peer caller's browser runtime can reach it
// after its user approves the contact (spec §3.4). It cannot change any cart.
//
// Transport: MCP Streamable HTTP in stateless mode with JSON responses, so each
// request is independent and fits a short-lived serverless function.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { CATEGORIES, CartError, MAX_INGREDIENTS, matchIngredients, publicProduct, quoteCart, searchProducts, STORE } from "../../lib/catalog.js";
import { itemsLink } from "../../public/shop-link.js";
import { PUBLIC_CORS, clientIp, createRateLimiter, json, withHeaders, readJsonBody } from "../../lib/http.js";

const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const result = (data) => ({ content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data });

function buildServer(origin) {
  const server = new McpServer({ name: "greenleaf-market-public", version: "0.2.0" });

  server.registerTool("match_ingredients", {
    title: "Match recipe ingredients to products",
    description: `Match up to ${MAX_INGREDIENTS} recipe ingredient lines (e.g. "400 g spaghetti", "2 cloves garlic") to ${STORE.name} products (demonstration data). Returns, per line, a product with pack count and price, a substitute when the best match is out of stock, or not_found. Read-only.`,
    inputSchema: {
      ingredients: z.array(z.string().min(1).max(200)).min(1).max(MAX_INGREDIENTS)
        .describe("One ingredient per item, with quantity and unit when known."),
    },
    annotations: READ_ONLY,
  }, async ({ ingredients }) => result(matchIngredients(ingredients)));

  server.registerTool("search_products", {
    title: "Search products",
    description: `Search the ${STORE.name} catalog (demonstration data) by product name. Read-only.`,
    inputSchema: {
      query: z.string().min(1).max(100).describe("Product name, e.g. \"olive oil\"."),
      category: z.enum(CATEGORIES).optional().describe("Optional category filter."),
      limit: z.number().int().min(1).max(20).optional().describe("Maximum results (default 8)."),
    },
    annotations: READ_ONLY,
  }, async ({ query, category, limit }) => {
    const products = searchProducts(query, { category, limit: limit ?? 8 }).map(publicProduct);
    return result({ store: STORE.name, demo_data: true, query, products });
  });

  server.registerTool("create_cart_link", {
    title: "Create a cart link for the shopper",
    description: "Check product ids and pack counts against the catalog and return a link to the store's review page. Opening the link adds nothing: the shopper reviews the items on the store's website and confirms there. This tool cannot add to a cart, order or pay.",
    inputSchema: {
      items: z.array(z.object({
        product_id: z.string().min(3).max(80),
        quantity: z.number().int().min(1).max(20),
      })).min(1).max(40).describe("Product ids from match_ingredients or search_products, with pack counts."),
    },
    annotations: READ_ONLY,
  }, async ({ items }) => {
    try {
      const q = quoteCart(items);
      const url = q.lines.length ? itemsLink(origin, q.lines.map((l) => ({ product_id: l.id, quantity: l.quantity }))) : null;
      return result({
        store: STORE.name, demo_data: true, url, lines: q.lines, rejected: q.rejected, subtotal: q.subtotal,
        note: "Give the url to the shopper. Nothing is in their cart until they confirm on the store's page.",
      });
    } catch (err) {
      if (err instanceof CartError) return { isError: true, content: [{ type: "text", text: err.message }] };
      throw err;
    }
  });

  return server;
}

export async function POST(request) {
  const rate = limiter(clientIp(request));
  if (!rate.ok) {
    return json({ error: "rate_limited" }, { status: 429, headers: { ...PUBLIC_CORS, "Retry-After": String(rate.retryAfterSec) } });
  }
  const body = await readJsonBody(request, { maxBytes: 32 * 1024 });
  if (!body.ok) return withHeaders(body.response, PUBLIC_CORS);

  const server = buildServer(new URL(request.url).origin);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request, { parsedBody: body.value });
    return withHeaders(response, { ...PUBLIC_CORS, "Cache-Control": "no-store" });
  } finally {
    await transport.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

// No server-initiated stream or sessions in stateless mode.
export function GET() {
  return json({ error: "method_not_allowed", hint: "POST JSON-RPC messages to this endpoint." },
    { status: 405, headers: { ...PUBLIC_CORS, Allow: "POST, OPTIONS" } });
}

export function DELETE() {
  return json({ error: "method_not_allowed" }, { status: 405, headers: { ...PUBLIC_CORS, Allow: "POST, OPTIONS" } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_CORS });
}
