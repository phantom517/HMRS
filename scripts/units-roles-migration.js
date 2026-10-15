// Idempotent migration for the admin-managed Units & Roles dictionaries.
// Employees keep referencing them BY NAME (employee.unit / employee.designation);
// renames propagate through the app layer; deletes are blocked while in use.
const { neon } = require("@neondatabase/serverless");

const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_ORx3TCZwi7DB@ep-bold-lab-b5shkqjr-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const sql = neon(connectionString);

async function main() {
    console.log("Running units & roles migration (additive, idempotent)...");

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
      )
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS units_name_idx ON units (name)`;

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
      )
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS roles_name_idx ON roles (name)`;

    // Seed: whatever value really exists on employees today, plus the standard
    // roster zones the duty roster uses. Skips names already present.
    const existingUnits = await sql`SELECT DISTINCT unit AS name FROM employees WHERE unit IS NOT NULL`;
    const seedUnits = [...new Set([
        "Red Zone (Resus 1-4 & Trauma Bays)",
        "Yellow Zone (Urgent Acute Assessment)",
        "Green Zone (Fast-Track Ambulatory)",
        "Zone 4: Pediatric ED Wing",
        ...existingUnits.map((r) => r.name),
        "ER",
    ])];

    const existingDesigs = await sql`SELECT DISTINCT designation AS name FROM employees`;
    const seedRoles = [...new Set([(existingDesigs[0] && existingDesigs[0].name) || "Staff Critical Care RN", ...existingDesigs.map((r) => r.name)])];

    let i = 0;
    for (const name of seedUnits) {
        i += 1;
        await sql`
            INSERT INTO units (id, name, sort_order)
            VALUES (${`unit_seed_${String(i).padStart(3, "0")}`}, ${name}, ${i * 10})
            ON CONFLICT (name) DO NOTHING
        `;
    }
    let j = 0;
    for (const name of seedRoles) {
        j += 1;
        const staffClass = /rn|nurse/i.test(name) ? "RN" : /md|physician|surgeon|doctor/i.test(name) ? "MD" : "Tech";
        await sql`
            INSERT INTO roles (id, name, staff_class, sort_order)
            VALUES (${`role_seed_${String(j).padStart(3, "0")}`}, ${name}, ${staffClass}, ${j * 10})
            ON CONFLICT (name) DO NOTHING
        `;
    }

    // Verify
    const cols = [
        ["units", "name"], ["units", "sort_order"], ["roles", "staff_class"], ["roles", "sort_order"],
    ];
    for (const [table, column] of cols) {
        const rows = await sql`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = ${table} AND column_name = ${column}
        `;
        if (rows.length === 0) throw new Error(`Missing ${table}.${column}`);
    }
    const nUnits = await sql`SELECT count(*)::int AS n FROM units`;
    const nRoles = await sql`SELECT count(*)::int AS n FROM roles`;
    console.log(`Verified. units=${nUnits[0].n}, roles=${nRoles[0].n}. Migration complete.`);
}

main().catch((err) => {
    console.error("MIGRATION FAILED:", err.message);
    process.exit(1);
});
