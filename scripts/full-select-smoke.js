// Smoke test: the exact SELECT DrizzleDatabase.getDepartmentSettings issues.
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
  const rows = await sql`
    select
      "id", "department_code", "department_name",
      "weekly_hours_cap", "warning_hours_cap", "consecutive_shifts_cap",
      "min_rest_hours_between_shifts", "roster_lock_hours_ahead",
      "nurse_to_bed_ratio_target", "timezone", "week_start_day",
      "max_nights_per_month", "minimum_staff_rn",
      "max_weekly_hours_severity", "max_nights_severity",
      "pending_leave_action", "enforce_rest_interval",
      "auto_assign_enabled", "auto_assign_time_budget_ms",
      "updated_by", "created_at", "updated_at"
    from "department_settings" limit 1
  `;
  const s = rows[0];
  console.log("department_settings SELECT OK");
  console.log(
    `min rest = ${s.min_rest_hours_between_shifts} h · max days = ${s.consecutive_shifts_cap} · weekly cap = ${s.weekly_hours_cap} h · nights cap = ${s.max_nights_per_month} · tz = ${s.timezone}`
  );
})().catch((e) => {
  console.error("SMOKE FAILED:", e.message);
  process.exit(1);
});
