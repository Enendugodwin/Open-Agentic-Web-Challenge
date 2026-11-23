// GET /agent-prompt.txt       -> the copy-paste prompt
// GET /agent-prompt-full.txt  -> the prompt plus the complete store lookup, so an AI
//                                chat without web access still knows every product's
//                                sale unit, pack contents, price and stock.
// (Both are vercel.json rewrites to this function.)
import { AGENT_PROMPT } from "../lib/agent-prompt.js";
import { PRODUCTS, publicProduct } from "../lib/catalog.js";
import { catalogText } from "./catalog.js";

export function GET(request) {
  const url = new URL(request.url);
  let body = AGENT_PROMPT;
  if (url.searchParams.get("full") === "1") {
    const lookup = catalogText(url.origin, { products: PRODUCTS.map(publicProduct) });
    body += `\n----------\nSTORE LOOKUP DATA (Greenleaf Market, demonstration data, ${new Date().toISOString().slice(0, 10)})\n${lookup}`;
  }
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=60", "Access-Control-Allow-Origin": "*" },
  });
}
