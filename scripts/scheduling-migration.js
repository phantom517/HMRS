/**
 * Scheduling-engine migration (idempotent — safe to re-run).
 * Run with: node scripts/scheduling-migration.js
 * Requires DATABASE_URL in the environment (falls back to .env / .env.local).
 */
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
if (!connectionString) {
  console.error("DATABASE_URL not set — cannot migrate.");
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  console.log("Applying scheduling-engine migration…");

  // 1. btree_gist for the exclusion constraint
  await sql`CREATE EXTENSION IF NOT EXISTS btree_gist;`;

  // 2. Overlap is IMPOSSIBLE at the database level, even under a race:
  //    two non-cancelled shifts of the same employee may not intersect [start, end).
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'no_overlap'
      ) THEN
        ALTER TABLE shift_assignments ADD CONSTRAINT no_overlap
          EXCLUDE USING gist (
            employee_id WITH =,
            tsrange(start_at, end_at, '[)') WITH &&
          )
          WHERE (status <> 'cancelled');
      END IF;
    END $$;
  `;

  // 3. Per shift-type × designation staffing policy table
  await sql`
    CREATE TABLE IF NOT EXISTS shift_requirements (
      id text PRIMARY KEY,
      shift_type_id text NOT NULL REFERENCES shift_types(id) ON DELETE CASCADE,
      designation text NOT NULL DEFAULT 'any',
      min_staff integer NOT NULL DEFAULT 1,
      max_staff integer,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS shift_requirements_type_desig_idx
      ON shift_requirements (shift_type_id, designation);
  `;

  // 4. Per-employee exception columns
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS max_hours_per_week integer;`;
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS can_work_nights boolean NOT NULL DEFAULT true;`;

  // 5. Shift-type isNight flag (never inferred from the name)
  await sql`ALTER TABLE shift_types ADD COLUMN IF NOT EXISTS is_night boolean NOT NULL DEFAULT false;`;
  // Seed the flag from the existing overnight templates if not yet set
  await sql`
    UPDATE shift_types SET is_night = true
    WHERE crosses_midnight = true AND (category ILIKE '%+1 DAY%' OR start_time > end_time)
      AND is_night = false;
  `;

  // 6. Customizable engine knobs on department_settings (fixed SQL statements)
  await sql`ALTER TABLE department_settings ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Chicago';`;
  await sql`ALTER TABLE department_settings ADD COLUMN IF NOT EXISTS week_start_day integer NOT NULL DEFAULT 1;`;
  await sql`ALTER TABLE department_settings ADD COLUMN IF NOT EXISTS max_nights_per_month integer NOT NULL DEFAULT 7;`;
  await sql`ALTER TABLE department_settings ADD COLUMN IF NOT EXISTS minimum_staff_rn integer NOT NULL DEFAULT 0;`;
  await sql`ALTER TABLE department_settings ADD COLUMN IF NOT EXISTS max_weekly_hours_severity text NOT NULL DEFAULT 'warn';`;
  await sql`ALTER TABLE department_settings ADD COLUMN IF NOT EXISTS max_nights_severity text NOT NULL DEFAULT 'warn';`;
  await sql`ALTER TABLE department_settings ADD COLUMN IF NOT EXISTS pending_leave_action text NOT NULL DEFAULT 'warn';`;
  await sql`ALTER TABLE department_settings ADD COLUMN IF NOT EXISTS enforce_rest_interval boolean NOT NULL DEFAULT true;`;
  await sql`ALTER TABLE department_settings ADD COLUMN IF NOT EXISTS auto_assign_enabled boolean NOT NULL DEFAULT true;`;
  await sql`ALTER TABLE department_settings ADD COLUMN IF NOT EXISTS auto_assign_time_budget_ms integer NOT NULL DEFAULT 2000;`;

  // Populate shift_requirements from legacy per-type minimums, kept idempotent:
  // only insert rows for shift types that have NO requirement rows yet.
  await sql`
    INSERT INTO shift_requirements (id, shift_type_id, designation, min_staff, max_staff)
    SELECT 'sreq_' || s.id || '_rn', s.id, 'RN', s.minimum_staff_rn, s.maximum_staff
    FROM shift_types s
    WHERE s.minimum_staff_rn > 0
      AND NOT EXISTS (SELECT 1 FROM shift_requirements r WHERE r.shift_type_id = s.id);
  `;
  await sql`
    INSERT INTO shift_requirements (id, shift_type_id, designation, min_staff)
    SELECT 'sreq_' || s.id || '_md', s.id, 'MD', s.minimum_staff_md
    FROM shift_types s
    WHERE s.minimum_staff_md > 0
      AND NOT EXISTS (
        SELECT 1 FROM shift_requirements r
        WHERE r.shift_type_id = s.id AND r.designation = 'MD'
      );
  `;

  // 7. Scheduler indexes
  await sql`CREATE INDEX IF NOT EXISTS shift_assign_emp_start_idx ON shift_assignments (employee_id, start_at);`;
  await sql`CREATE INDEX IF NOT EXISTS shift_assign_start_idx ON shift_assignments (start_at);`;
  await sql`CREATE INDEX IF NOT EXISTS shift_assign_type_start_idx ON shift_assignments (shift_type_id, start_at);`;
  await sql`CREATE INDEX IF NOT EXISTS shift_req_type_idx ON shift_requirements (shift_type_id);`;

  // Verify the required columns exist — fail LOUDLY instead of printing success.
  const required = [
    "timezone", "week_start_day", "max_nights_per_month", "minimum_staff_rn",
    "max_weekly_hours_severity", "max_nights_severity", "pending_leave_action",
    "enforce_rest_interval", "auto_assign_enabled", "auto_assign_time_budget_ms",
  ];
  const check = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'department_settings'`;
  const present = new Set(check.map((c) => c.column_name));
  const missing = required.filter((c) => !present.has(c));
  if (missing.length > 0) {
    throw new Error(`department_settings is missing columns after migration: ${missing.join(", ")}`);
  }

  console.log("Migration complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
