import { test } from "node:test";
import assert from "node:assert/strict";
import { listShifts, todayIn, ShiftQueryError, MAX_RESULTS } from "../apps/site/lib/shifts.js";

// Wednesday 2026-12-02, 15:00 UTC (09:00 in Chicago).
const now = new Date("2026-12-02T15:00:00Z");

test("today is computed in the pantry's time zone", () => {
  assert.equal(todayIn(new Date("2026-12-03T03:00:00Z")), "2026-12-02"); // 21:00 Chicago
  assert.equal(todayIn(now), "2026-12-02");
});

test("Saturday has morning sorting and packing shifts", () => {
  const r = listShifts({ date_from: "2026-12-05", date_to: "2026-12-05" }, { now });
  assert.equal(r.today, "2026-12-02");
  assert.equal(r.demo_data, true);
  const roles = r.shifts.filter((s) => s.start === "09:00").map((s) => s.role).sort();
  assert.deepEqual(roles, ["packing", "sorting"]);
  for (const s of r.shifts) {
    assert.equal(s.weekday, "Saturday");
    assert.ok(s.spots_left >= 0 && s.spots_left <= s.capacity);
    assert.match(s.id, /^shf_20261205_\d{4}_[a-z_]+$/);
  }
});

test("results are deterministic", () => {
  const a = listShifts({ date_from: "2026-12-02", date_to: "2026-12-20" }, { now });
  const b = listShifts({ date_from: "2026-12-02", date_to: "2026-12-20" }, { now });
  assert.deepEqual(a, b);
});

test("role filter", () => {
  const r = listShifts({ date_from: "2026-12-02", date_to: "2026-12-15", role: "delivery_driver" }, { now });
  assert.ok(r.shifts.length > 0);
  assert.ok(r.shifts.every((s) => s.role === "delivery_driver"));
});

test("past dates are clipped to today and flagged", () => {
  const r = listShifts({ date_from: "2026-11-20", date_to: "2026-12-03" }, { now });
  assert.ok(r.shifts.every((s) => s.date >= "2026-12-02"));
  assert.match(r.note, /Only dates from 2026-12-02/);
});

test("invalid input fails closed", () => {
  const bad = [
    { date_from: "2026-12-05" },
    { date_from: "2026-13-01", date_to: "2026-13-02" },
    { date_from: "2026-02-30", date_to: "2026-03-01" },
    { date_from: "2026-12-10", date_to: "2026-12-05" },
    { date_from: "2026-12-02", date_to: "2027-01-15" }, // > 31 days
    { date_from: "2026-12-02", date_to: "2026-12-03", role: "chef" },
  ];
  for (const q of bad) assert.throws(() => listShifts(q, { now }), ShiftQueryError, JSON.stringify(q));
});

test("result count is capped", () => {
  const r = listShifts({ date_from: "2026-12-02", date_to: "2027-01-01" }, { now });
  assert.ok(r.shifts.length <= MAX_RESULTS);
});
