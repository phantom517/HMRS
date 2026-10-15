// Idempotent migration for the Bikram Sambat calendar feature.
// Storage stays 100% Gregorian: the only new columns are display preferences,
// an engine period-basis knob, and the holidays table (Gregorian dates).
const { neon } = require("@neondatabase/serverless");

const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_ORx3TCZwi7DB@ep-bold-lab-b5shkqjr-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const sql = neon(connectionString);

async function main() {
    console.log("Running calendar feature migration (additive, idempotent)...");

    // 1. User display preferences (nullable = inherit department default)
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS calendar_system text`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_locale text`;

    // 2. Department defaults + engine month-period basis knob
    await sql`ALTER TABLE department_settings ADD COLUMN IF NOT EXISTS default_calendar_system text NOT NULL DEFAULT 'AD'`;
    await sql`ALTER TABLE department_settings ADD COLUMN IF NOT EXISTS default_locale text NOT NULL DEFAULT 'en'`;
    await sql`ALTER TABLE department_settings ADD COLUMN IF NOT EXISTS period_basis text NOT NULL DEFAULT 'AD_MONTH'`;

    // 3. Holidays table — Gregorian 'date' values ONLY (never BS strings)
    await sql`
      CREATE TABLE IF NOT EXISTS holidays (
        id text PRIMARY KEY,
        date text NOT NULL,
        name text NOT NULL,
        name_np text,
        category text NOT NULL DEFAULT 'public',
        observed boolean NOT NULL DEFAULT true,
        note text,
        created_by text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS holidays_date_idx ON holidays (date)`;

    // 4. Verify every required column actually exists before declaring success
    const checks = [
        ["users", "calendar_system"],
        ["users", "ui_locale"],
        ["department_settings", "default_calendar_system"],
        ["department_settings", "default_locale"],
        ["department_settings", "period_basis"],
        ["holidays", "date"],
        ["holidays", "name_np"],
    ];
    const missing = [];
    for (const [table, column] of checks) {
        const rows = await sql`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = ${table} AND column_name = ${column}
        `;
        if (rows.length === 0) missing.push(`${table}.${column}`);
    }
    if (missing.length > 0) {
        throw new Error("Migration incomplete, missing columns: " + missing.join(", "));
    }
    console.log("Verified columns:", checks.map(([t, c]) => t + "." + c).join(", "));
    console.log("Calendar migration complete.");
}

main().catch((err) => {
    console.error("MIGRATION FAILED:", err.message);
    process.exit(1);
});
