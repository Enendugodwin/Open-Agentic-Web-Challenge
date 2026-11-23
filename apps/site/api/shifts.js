// GET /api/shifts?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD[&role=...]
// Same data as the public MCP tool, as plain JSON for the site's own pages.
import { listShifts, ShiftQueryError, todayIn } from "../lib/shifts.js";
import { json } from "../lib/http.js";

export function GET(request) {
  const params = new URL(request.url).searchParams;
  const today = todayIn();
  const plus = (days) => new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  try {
    const result = listShifts({
      date_from: params.get("date_from") || today,
      date_to: params.get("date_to") || plus(13),
      role: params.get("role") || undefined,
    });
    return json(result, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (err) {
    if (err instanceof ShiftQueryError) return json({ error: "invalid_query", message: err.message }, { status: 400 });
    throw err;
  }
}
