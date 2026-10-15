// One-off (idempotent) maintenance script: the seeded demo roster week sits in
// 2024-10-21..30 while "today" in the app is now the REAL current date in
// Asia/Kathmandu. This shifts the demo business data by whole weeks so the
// week containing real today is populated, preserving weekday/shift shape.
// Only rows still anchored to the original 2024 window are touched, so it can
// run again without moving already-shifted rows.
const { neon } = require("@neondatabase/serverless");

const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_ORx3TCZwi7DB@ep-bold-lab-b5shkqjr-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const sql = neon(connectionString);

const ORIGIN_ANCHOR = "2024-10-21"; // Monday of the original seeded week

/** Monday of the week containing today, Asia/Kathmandu (UTC+05:45, no DST). */
function currentMondayKathmandu() {
    const now = new Date(Date.now() + 345 * 60_000); // local wall-clock in NPT
    const dow = now.getUTCDay(); // 0=Sun..6=Sat (UTC-based weekday is fine at +5:45? use UTC date of shifted clock)
    const back = dow === 0 ? 6 : dow - 1;
    const mondayUtc = new Date(now.getTime() - back * 86_400_000);
    return mondayUtc.toISOString().slice(0, 10);
}

async function main() {
    const today = new Date(Date.now() + 345 * 60_000).toISOString().slice(0, 10);
    const targetMonday = currentMondayKathmandu();
    const deltaDays = Math.round(
        (Date.parse(`${targetMonday}T00:00:00Z`) - Date.parse(`${ORIGIN_ANCHOR}T00:00:00Z`)) / 86_400_000
    );
    console.log(`today(NPT)=${today}; target week Monday=${targetMonday}; shift=${deltaDays} days (weeks=${deltaDays / 7})`);

    if (deltaDays === 0) {
        console.log("Already aligned; nothing to do.");
        return;
    }

    // Guard: only shift rows still inside the original demo window (+/- 7 days),
    // so re-running after a later re-seed does not move current-week data.
    const matches = await sql`
        SELECT count(*)::int AS n FROM shift_assignments
        WHERE date >= ${ORIGIN_ANCHOR} AND date <= ${shiftIso(ORIGIN_ANCHOR, 14)}
    `;
    const nAssignments = matches[0].n;
    console.log(`assignments still in the 2024 window: ${nAssignments}`);
    if (nAssignments === 0) {
        console.log("No rows left to shift.");
    } else {
        // The WHERE window makes this idempotent: already-shifted rows no longer match.
        await sql`
            UPDATE shift_assignments SET
                date = to_char(to_date(date, 'YYYY-MM-DD') + ${deltaDays}::int, 'YYYY-MM-DD'),
                start_at = start_at + (${deltaDays}::int * interval '1 day'),
                end_at = end_at + (${deltaDays}::int * interval '1 day'),
                actual_start_at = actual_start_at + (${deltaDays}::int * interval '1 day'),
                actual_end_at = actual_end_at + (${deltaDays}::int * interval '1 day'),
                updated_at = now()
            WHERE date >= ${ORIGIN_ANCHOR} AND date <= ${shiftIso(ORIGIN_ANCHOR, 14)}
        `;
    }

    // Leave records and off days anchored to the same demo window.
    await sql`
        UPDATE leave_records SET
            start_date = to_char(to_date(start_date, 'YYYY-MM-DD') + ${deltaDays}::int, 'YYYY-MM-DD'),
            end_date = to_char(to_date(end_date, 'YYYY-MM-DD') + ${deltaDays}::int, 'YYYY-MM-DD'),
            updated_at = now()
        WHERE start_date >= ${ORIGIN_ANCHOR} AND start_date <= ${shiftIso(ORIGIN_ANCHOR, 14)}
    `;
    await sql`
        UPDATE off_days SET
            date = to_char(to_date(date, 'YYYY-MM-DD') + ${deltaDays}::int, 'YYYY-MM-DD'),
            created_at = now()
        WHERE date >= ${ORIGIN_ANCHOR} AND date <= ${shiftIso(ORIGIN_ANCHOR, 14)}
    `;

    // Report final ranges
    const a = await sql`SELECT min(date) AS min, max(date) AS max, count(*)::int AS n FROM shift_assignments`;
    const l = await sql`SELECT min(start_date) AS min, max(end_date) AS max, count(*)::int AS n FROM leave_records`;
    const o = await sql`SELECT min(date) AS min, max(date) AS max, count(*)::int AS n FROM off_days`;
    console.log("shift_assignments:", JSON.stringify(a[0]));
    console.log("leave_records:", JSON.stringify(l[0]));
    console.log("off_days:", JSON.stringify(o[0]));
    console.log("Demo week shifted to align with real today. Done.");
}

function shiftIso(iso, days) {
    return new Date(Date.parse(iso + "T00:00:00Z") + days * 86_400_000).toISOString().slice(0, 10);
}

main().catch((err) => {
    console.error("SHIFT FAILED:", err.message);
    process.exit(1);
});
