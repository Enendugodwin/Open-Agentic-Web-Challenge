// Synthetic, public volunteer-shift data for the fictional Northside Pantry.
//
// Shifts are generated deterministically from the calendar, so every deployment and
// test sees the same schedule for a given day without a database. Bookings (M2)
// will subtract from `capacity`; until then `spots_left` comes from a fixed seed.

export const TIME_ZONE = "America/Chicago";
export const ROLES = ["sorting", "packing", "distribution", "delivery_driver"];
export const MAX_RANGE_DAYS = 31;
export const HORIZON_DAYS = 60;
export const MAX_RESULTS = 50;

// Weekly template: weekday (0 = Sunday) -> shifts on that day.
const WEEKLY = {
  1: [{ role: "packing", start: "13:00", end: "16:00", capacity: 8 }],
  2: [
    { role: "packing", start: "13:00", end: "16:00", capacity: 8 },
    { role: "distribution", start: "16:00", end: "19:00", capacity: 10 },
  ],
  3: [{ role: "delivery_driver", start: "10:00", end: "13:00", capacity: 4 }],
  4: [
    { role: "sorting", start: "09:00", end: "12:00", capacity: 6 },
    { role: "distribution", start: "16:00", end: "19:00", capacity: 10 },
  ],
  5: [{ role: "delivery_driver", start: "10:00", end: "13:00", capacity: 4 }],
  6: [
    { role: "sorting", start: "09:00", end: "12:00", capacity: 12 },
    { role: "packing", start: "09:00", end: "12:00", capacity: 12 },
    { role: "distribution", start: "12:30", end: "15:30", capacity: 10 },
  ],
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date (YYYY-MM-DD) in the pantry's time zone. */
export function todayIn(now = new Date(), timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function parseDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

const addDays = (d, n) => new Date(d.getTime() + n * 86_400_000);
const iso = (d) => d.toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

// Small deterministic hash so "spots left" varies per shift but is stable.
function seeded(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

export class ShiftQueryError extends Error {
  constructor(message) {
    super(message);
    this.name = "ShiftQueryError";
  }
}

/**
 * List open shifts. Throws ShiftQueryError for invalid input (fail closed).
 * @param {{date_from: string, date_to: string, role?: string}} query
 */
export function listShifts({ date_from, date_to, role } = {}, { now = new Date() } = {}) {
  const today = todayIn(now);
  const from = parseDate(date_from);
  const to = parseDate(date_to);
  if (!from || !to) throw new ShiftQueryError("date_from and date_to must be real dates in YYYY-MM-DD format.");
  if (to < from) throw new ShiftQueryError("date_to must be on or after date_from.");
  if (dayDiff(from, to) > MAX_RANGE_DAYS - 1) throw new ShiftQueryError(`The date range can be at most ${MAX_RANGE_DAYS} days.`);
  if (role !== undefined && role !== null && !ROLES.includes(role)) {
    throw new ShiftQueryError(`role must be one of: ${ROLES.join(", ")}.`);
  }
  const todayDate = parseDate(today);
  const lastDay = addDays(todayDate, HORIZON_DAYS);
  const start = from < todayDate ? todayDate : from;
  const end = to > lastDay ? lastDay : to;

  const shifts = [];
  for (let d = start; d <= end && shifts.length < MAX_RESULTS; d = addDays(d, 1)) {
    const date = iso(d);
    for (const t of WEEKLY[d.getUTCDay()] || []) {
      if (role && t.role !== role) continue;
      const id = `shf_${date.replaceAll("-", "")}_${t.start.replace(":", "")}_${t.role}`;
      const taken = Math.floor(seeded(id) * (t.capacity + 1));
      shifts.push({
        id,
        date,
        weekday: d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
        start: t.start,
        end: t.end,
        role: t.role,
        capacity: t.capacity,
        spots_left: Math.max(0, t.capacity - taken),
      });
      if (shifts.length >= MAX_RESULTS) break;
    }
  }
  return {
    today,
    time_zone: TIME_ZONE,
    searched: { date_from: iso(start > end ? from : start), date_to: iso(end), role: role || null },
    note: from < todayDate || to > lastDay
      ? `Only dates from ${today} to ${iso(lastDay)} have a schedule.`
      : undefined,
    demo_data: true,
    shifts,
    truncated: shifts.length >= MAX_RESULTS,
  };
}
