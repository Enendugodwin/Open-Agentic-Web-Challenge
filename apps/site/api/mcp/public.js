// Public, read-only MCP server: POST /api/mcp/public
//
// The grounded capability for the volunteer_desk network (spec §3.1 "Use grounded
// capabilities"). It serves synthetic public data only, needs no authentication and
// allows any origin (no credentials), so a peer caller's browser runtime can reach it
// after its user approves the contact (spec §3.4).
//
// Transport: MCP Streamable HTTP in stateless mode with JSON responses, so each
// request is independent and fits a short-lived serverless function.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { listShifts, ROLES, ShiftQueryError, MAX_RANGE_DAYS } from "../../lib/shifts.js";
import { PUBLIC_CORS, clientIp, createRateLimiter, json, withHeaders, readJsonBody } from "../../lib/http.js";

const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

function buildServer() {
  const server = new McpServer({ name: "northside-pantry-public", version: "0.1.0" });
  server.registerTool("list_shifts", {
    title: "List volunteer shifts",
    description: `List open volunteer shifts at Northside Pantry (demonstration data) between two dates, at most ${MAX_RANGE_DAYS} days apart. The result includes "today" in the pantry's time zone.`,
    inputSchema: {
      date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("First day to search, YYYY-MM-DD."),
      date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Last day to search, YYYY-MM-DD."),
      role: z.enum(ROLES).optional().describe("Optional role filter."),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (args) => {
    try {
      const result = listShifts(args);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    } catch (err) {
      if (err instanceof ShiftQueryError) {
        return { isError: true, content: [{ type: "text", text: err.message }] };
      }
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

  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request, { parsedBody: body.value });
    return withHeaders(response, { ...PUBLIC_CORS, "Cache-Control": "no-store" });
  } finally {
    // Stateless: nothing to keep between requests.
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
