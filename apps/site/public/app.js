// Landing page: render the next two weeks of shifts and absolute developer URLs.
const ROLE_LABELS = {
  sorting: "Sorting",
  packing: "Packing",
  distribution: "Distribution",
  delivery_driver: "Delivery driver",
};

document.getElementById("peer-url").textContent = `${location.origin}/agents/volunteer_desk`;
document.getElementById("mcp-url").textContent = `${location.origin}/api/mcp/public`;

async function loadShifts() {
  const status = document.getElementById("shifts-status");
  const table = document.getElementById("shifts");
  try {
    const resp = await fetch("/api/shifts");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const tbody = table.querySelector("tbody");
    tbody.replaceChildren();
    for (const s of data.shifts) {
      const tr = document.createElement("tr");
      const cells = [
        `${s.weekday}, ${s.date}`,
        `${s.start}–${s.end}`,
        ROLE_LABELS[s.role] || s.role,
        s.spots_left === 0 ? "Full" : String(s.spots_left),
      ];
      for (const text of cells) {
        const td = document.createElement("td");
        td.textContent = text;
        tr.append(td);
      }
      if (s.spots_left === 0) tr.className = "full";
      tbody.append(tr);
    }
    status.textContent = `Times are in ${data.time_zone}. Booking opens in the next release.`;
    table.hidden = false;
  } catch (err) {
    status.textContent = `Could not load shifts (${err.message}).`;
  }
}

loadShifts();
