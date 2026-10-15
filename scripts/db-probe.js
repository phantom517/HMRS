// One-off probe: confirm the app-visible DB has every scheduling column + data.
const { neon } = require("@neondatabase/serverless");
const fs = require("fs");
const path = require("path");

let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(__dirname, "..", f);
    if (fs.existsSync(p)) {
      const line = fs
        .readFileSync(p, "utf8")
        .split("\n")
        .find((l) => l.startsWith("DATABASE_URL="));
      if (line) {
        connectionString = line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
        break;
      }
    }
  }
}

const sql = neon(connectionString);

(async () => {
  const required = [
    "timezone", "week_start_day", "max_nights_per_month", "minimum_staff_rn",
    "max_weekly_hours_severity", "max_nights_severity", "pending_leave_action",
    "enforce_rest_interval", "auto_assign_enabled", "auto_assign_time_budget_ms",
  ];
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'department_settings'`;
  const present = new Set(cols.map((c) => c.column_name));
  const missing = required.filter((c) => !present.has(c));
  console.log("Missing scheduling columns:", missing.length === 0 ? "NONE — all present" : missing.join(", "));

  const counts = await sql`
    SELECT
      (SELECT count(*)::int FROM shift_assignments) AS assignments,
      (SELECT count(*)::int FROM shift_types) AS shift_types,
      (SELECT count(*)::int FROM shift_requirements) AS requirements,
      (SELECT count(*)::int FROM employees) AS employees
  `;
  const c = counts[0];
  console.log(`Data: ${c.assignments} assignments, ${c.shift_types} shift types, ${c.requirements} requirement rows, ${c.employees} employees`);
})().catch((e) => {
  console.error("PROBE ERROR:", e.message);
  process.exit(1);
});
