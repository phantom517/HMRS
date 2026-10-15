const { neon } = require("@neondatabase/serverless");
const bcrypt = require("bcryptjs");

const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_ORx3TCZwi7DB@ep-bold-lab-b5shkqjr-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const sql = neon(connectionString);

async function init() {
    console.log("Starting Neon PostgreSQL database initialization...");

    // 3. Seed real users: 1 superuser who can do everything, 1 viewer who can only view
    console.log("Creating superuser and viewer accounts...");
    const passwordHash = await bcrypt.hash("Suraj@06270927", 10);

    // Superuser (Can do everything)
    await sql`
    INSERT INTO users (id, name, email, password_hash, role, title, active)
    VALUES (
      'usr_superuser_01',
      'Dr. Sarah Jenkins',
      'admin@patanacademy.edu.np',
      ${passwordHash},
      'superuser',
      'Clinical Director (Superuser)',
      TRUE
    );
  `;
    // Also add alias email for Sarah Jenkins if desired
    await sql`
    INSERT INTO users (id, name, email, password_hash, role, title, active)
    VALUES (
      'usr_superuser_02',
      'Dr. Sarah Jenkins',
      'sarah.jenkins@patanacademy.edu.np',
      ${passwordHash},
      'superuser',
      'Clinical Director (Superuser)',
      TRUE
    );
  `;

    await sql`
    INSERT INTO assistant_permissions (
      id, user_id,
      can_edit_employees, can_manage_shifts, can_assign_shifts,
      can_approve_leave, can_manage_policies, can_export_reports,
      can_view_audit_logs, can_delete_employees
    ) VALUES (
      'perm_superuser_01', 'usr_superuser_01',
      TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE
    ), (
      'perm_superuser_02', 'usr_superuser_02',
      TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE
    );
  `;

    // Viewer (Can only view)
    await sql`
    INSERT INTO users (id, name, email, password_hash, role, title, active)
    VALUES (
      'usr_viewer_01',
      'Clinical Observer (Viewer)',
      'viewer@patanacademy.edu.np',
      ${passwordHash},
      'viewer',
      'Clinical Auditor & Staffing Observer',
      TRUE
    );
  `;

    await sql`
    INSERT INTO assistant_permissions (
      id, user_id,
      can_edit_employees, can_manage_shifts, can_assign_shifts,
      can_approve_leave, can_manage_policies, can_export_reports,
      can_view_audit_logs, can_delete_employees
    ) VALUES (
      'perm_viewer_01', 'usr_viewer_01',
      FALSE, FALSE, FALSE, FALSE, FALSE, TRUE, TRUE, FALSE
    );
  `;

    // 6. Seed Real Leave Types
    console.log("Seeding real leave types...");
    const leaveTypesList = [
        {
            id: "lt_annual",
            name: "Annual Planned Vacation",
            code: "ANNUAL",
            desc: "Statutory accrued paid annual holiday entitlement",
            paid: true,
            approval: true,
            color: "#121718",
        },
        {
            id: "lt_sick",
            name: "Medical / Sick Leave",
            code: "SICK",
            desc: "Certified acute illness or scheduled surgical recovery",
            paid: true,
            approval: true,
            color: "#9b2c1f",
        },
        {
            id: "lt_cme",
            name: "CME & Clinical Seminar",
            code: "CME",
            desc: "Continuing Medical Education and Board Certification conferences",
            paid: true,
            approval: true,
            color: "#444444",
        },
        {
            id: "lt_casual",
            name: "Casual Personal Day",
            code: "CASUAL",
            desc: "Short-notice emergency family or personal rest day",
            paid: true,
            approval: false,
            color: "#706d69",
        },
        {
            id: "lt_unpaid",
            name: "Unpaid Sabbatical / Leave",
            code: "UNPAID",
            desc: "Extended authorized unpaid leave of absence",
            paid: false,
            approval: true,
            color: "#ffe2aa",
        },
    ];

    for (const lt of leaveTypesList) {
        await sql`
      INSERT INTO leave_types (id, name, code, description, paid, requires_approval, color, active)
      VALUES (${lt.id}, ${lt.name}, ${lt.code}, ${lt.desc}, ${lt.paid}, ${lt.approval}, ${lt.color}, TRUE);
    `;
    }

    // 7. Seed Real Leave Policies
    console.log("Seeding real leave policies...");
    const policiesList = [
        {
            id: "lp_phys_annual",
            name: "Attending Physician Annual Quota",
            desig: "Physician",
            ltId: "lt_annual",
            allow: "25.0",
            carry: "7.0",
            from: "2024-01-01",
        },
        {
            id: "lp_phys_sick",
            name: "Attending Physician Sick Leave",
            desig: "Physician",
            ltId: "lt_sick",
            allow: "12.0",
            carry: "5.0",
            from: "2024-01-01",
        },
        {
            id: "lp_rn_annual",
            name: "Critical Care RN Annual Quota",
            desig: "Nurse",
            ltId: "lt_annual",
            allow: "20.0",
            carry: "5.0",
            from: "2024-01-01",
        },
        {
            id: "lp_rn_sick",
            name: "Staff RN Medical / Sick Quota",
            desig: "Nurse",
            ltId: "lt_sick",
            allow: "14.0",
            carry: "5.0",
            from: "2024-01-01",
        },
        {
            id: "lp_cme_clinical",
            name: "Clinical Staff CME Allowance",
            desig: "All",
            ltId: "lt_cme",
            allow: "5.0",
            carry: "0.0",
            from: "2024-01-01",
        },
        {
            id: "lp_casual_all",
            name: "Statutory Casual Day Bank",
            desig: "All",
            ltId: "lt_casual",
            allow: "7.0",
            carry: "0.0",
            from: "2024-01-01",
        },
    ];

    for (const p of policiesList) {
        await sql`
      INSERT INTO leave_policies (id, name, designation, leave_type_id, allowance_days, policy_period, carry_forward_days, effective_from, active)
      VALUES (${p.id}, ${p.name}, ${p.desig}, ${p.ltId}, ${p.allow}, 'calendar_year', ${p.carry}, ${p.from}, TRUE);
    `;
    }
    console.log("Database initialization and seeding complete!");
}

init()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Initialization failed:", err);
        process.exit(1);
    });
