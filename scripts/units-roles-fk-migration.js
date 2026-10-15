// FK migration for Employees -> Units/Roles dictionaries.
//
// Moves employees.unit / employees.designation (free text) onto foreign keys
// employees.unitId -> units.id and employees.roleId -> roles.id
// (ON DELETE RESTRICT), backfilling by case-insensitive match on the current
// text and creating dictionary rows for any unmatched strings so no data is
// lost. Keeps a read-compatible view `employees_compat` that re-exposes the
// unit/designation text via joins so existing readers don't break.
//
// Idempotent and additive: safe to run repeatedly. Text columns are NOT
// dropped by default — pass --drop-text-columns once the application has
// been converted to write/read through the FK columns.
const { neon } = require("@neondatabase/serverless");

const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_ORx3TCZwi7DB@ep-bold-lab-b5shkqjr-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const DROP_TEXT_COLUMNS = process.argv.includes("--drop-text-columns");

const sql = neon(connectionString);

async function columnExists(table, column) {
    const rows = await sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = ${table} AND column_name = ${column}
    `;
    return rows.length > 0;
}

async function ensureColumn(table, column) {
    if (!(await columnExists(table, column))) {
        if (table === "employees" && column === "unit_id") {
            await sql`ALTER TABLE employees ADD COLUMN unit_id text UNIQUE`;
        } else {
            await sql`ALTER TABLE employees ADD COLUMN role_id text UNIQUE`;
        }
        console.log(`  added employees.${column}`);
    }
}

async function main() {
    console.log(`Running employees.unitId/roleId FK migration${DROP_TEXT_COLUMNS ? " (with text column drop)" : ""}...`);
    // The dictionary tables must exist (units-roles-migration.js runs first).
    await sql`
      CREATE TABLE IF NOT EXISTS units (
        id text PRIMARY KEY,
        name text NOT NULL UNIQUE,
        description text,
        color text,
        sort_order integer NOT NULL DEFAULT 100,
        active boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS roles (
        id text PRIMARY KEY,
        name text NOT NULL UNIQUE,
        staff_class text NOT NULL DEFAULT 'RN',
        description text,
        sort_order integer NOT NULL DEFAULT 100,
        active boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )`;

    await ensureColumn("employees", "unit_id");
    await ensureColumn("employees", "role_id");

    // Re-run the dictionary seeding from the previous migration so any unit /
    // role text that appeared after it gets a dictionary row.
    await sql`
        INSERT INTO units (id, name, sort_order)
        SELECT 'unit_' || to_char(now(), 'US') || row_number() OVER (), name, 100
        FROM (SELECT DISTINCT unit AS name FROM employees WHERE unit IS NOT NULL) s
        WHERE NOT EXISTS (SELECT 1 FROM units u WHERE lower(u.name) = lower(s.name))`;

    await sql`
        INSERT INTO roles (id, name, staff_class, sort_order)
        SELECT 'role_' || to_char(now(), 'US') || row_number() OVER (), name,
               CASE
                   WHEN name ILIKE '%rn%' OR name ILIKE '%nurse%' THEN 'RN'
                   WHEN name ILIKE '%md%' OR name ILIKE '%physician%' OR name ILIKE '%surgeon%' OR name ILIKE '%doctor%' THEN 'MD'
                   ELSE 'Tech'
               END, 100
        FROM (SELECT DISTINCT designation AS name FROM employees WHERE designation IS NOT NULL) s
        WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE lower(r.name) = lower(s.name))`;

    // Backfill the FK columns by case-insensitive text match.
    await sql`
        UPDATE employees e
        SET unit_id = u.id
        FROM units u
        WHERE e.unit IS NOT NULL AND lower(e.unit) = lower(u.name) AND e.unit_id IS NULL`;
    const nUnitsBackfilled = await sql`
        SELECT count(*)::int AS n FROM employees WHERE unit_id IS NOT NULL`;

    await sql`
        UPDATE employees e
        SET role_id = r.id
        FROM roles r
        WHERE e.designation IS NOT NULL AND lower(e.designation) = lower(r.name) AND e.role_id IS NULL`;
    const nRolesBackfilled = await sql`
        SELECT count(*)::int AS n FROM employees WHERE role_id IS NOT NULL`;

    // Report any strings that still have no FK (should be zero now).
    const unmatchedUnits = await sql`
        SELECT DISTINCT unit AS name FROM employees
        WHERE unit IS NOT NULL AND unit_id IS NULL`;
    const unmatchedRoles = await sql`
        SELECT DISTINCT designation AS name FROM employees
        WHERE designation IS NOT NULL AND role_id IS NULL`;

    // FK constraints: RESTRICT — a unit/role in use cannot be deleted.
    await sql`
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'employees_unit_id_fk'
            ) THEN
                ALTER TABLE employees
                    ADD CONSTRAINT employees_unit_id_fk
                    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT;
            END IF;
        END $$`;
    await sql`
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'employees_role_id_fk'
            ) THEN
                ALTER TABLE employees
                    ADD CONSTRAINT employees_role_id_fk
                    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT;
            END IF;
        END $$`;

    // Read-compatible view: exposes the text again via joins for code that
    // still selects employees.unit / employees.designation.
    await sql`DROP VIEW IF EXISTS employees_compat`;
    await sql`
        CREATE VIEW employees_compat AS
        SELECT e.*, u.name AS unit, r.name AS designation
        FROM employees e
        LEFT JOIN units u ON u.id = e.unit_id
        LEFT JOIN roles r ON r.id = e.role_id`;

    if (DROP_TEXT_COLUMNS) {
        await sql`ALTER TABLE employees DROP COLUMN IF EXISTS unit`;
        await sql`ALTER TABLE employees DROP COLUMN IF EXISTS designation`;
        console.log("  dropped employees.unit / employees.designation text columns");
    }

    console.log(`  backfilled unit_id on ${nUnitsBackfilled[0].n} employees, role_id on ${nRolesBackfilled[0].n}`);
    console.log(`  unmatched unit strings: ${unmatchedUnits.length}`);
    console.log(`  unmatched role strings: ${unmatchedRoles.length}`);
    if (unmatchedUnits.length > 0) console.log("   ↳ units:", unmatchedUnits.map((r) => r.name).join(" | "));
    if (unmatchedRoles.length > 0) console.log("   ↳ roles:", unmatchedRoles.map((r) => r.name).join(" | "));

    console.log("Migration complete. employees_compat view provides the old text columns.");
}

main().catch((err) => {
    console.error("MIGRATION FAILED:", err.message);
    process.exit(1);
});
