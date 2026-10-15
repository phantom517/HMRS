import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getSidebarCounts } from "@/lib/services/shiftStatistics";
import { getCalendarPrefs } from "@/lib/calendar/prefs";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { SettingsClient } from "@/components/settings/SettingsClient";
import { SIGN_IN_ACTIONS } from "@/lib/audit/catalog";

const TAB_IDS = ["assistants", "rules", "units", "roles", "audit"] as const;
type TabId = (typeof TAB_IDS)[number];

/**
 * Server-side tab permissions: superuser sees everything; assistants only the
 * tabs their granted permissions correspond to. Unknown tabs fall back to the
 * first allowed one — the URL can never grant a tab the session lacks.
 */
function allowedTabsFor(user: Awaited<ReturnType<typeof getCurrentUser>>): TabId[] {
  if (user.role === "superuser") return [...TAB_IDS];
  if (user.role === "viewer") return [];
  const allowed: TabId[] = [];
  const p = user.permissions;
  if (p.canEditEmployees) allowed.push("units", "roles");
  if (p.canManagePolicies) allowed.push("rules");
  if (p.canViewAuditLogs) allowed.push("audit");
  return allowed.length > 0 ? allowed : [];
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await getCurrentUser();
  const [sidebarCounts, calendarPrefs] = await Promise.all([
    getSidebarCounts(),
    getCalendarPrefs(currentUser.id),
  ]);
  const params = await searchParams;
  const requested = typeof params.tab === "string" ? params.tab : undefined;
  const includeSignIns = params.include === "signins";
  const auditPage = Math.max(1, Number(params.page) || 1);

  const allowedTabs = allowedTabsFor(currentUser);
  const activeTab: TabId | null =
    requested && (allowedTabs as string[]).includes(requested)
      ? (requested as TabId)
      : (allowedTabs[0] ?? null);

  // Load only what the allowed tabs need.
  const wants = (id: TabId) => allowedTabs.includes(id);
  const [employeesData, users, permissions, departmentSettings, audit, units, roles] =
    await Promise.all([
      wants("units") || wants("roles")
        ? db.getEmployees({ status: "all", pageSize: 1000 })
        : Promise.resolve({ employees: [] as any[] }),
      wants("assistants") ? db.getUsers() : Promise.resolve([] as any[]),
      wants("assistants")
        ? Promise.all(
            (await db.getUsers()).filter((u) => u.role === "assistant").map((u) => db.getAssistantPermissions(u.id))
          ).then((list) => list.filter(Boolean))
        : Promise.resolve([] as any[]),
      wants("rules") ? db.getDepartmentSettings() : Promise.resolve(null),
      wants("audit")
        ? (db as any).getAuditLogsPage({
            page: auditPage,
            pageSize: 50,
            includeSignIns,
            hiddenActions: [...SIGN_IN_ACTIONS],
          })
        : Promise.resolve({ rows: [], total: 0, page: 1, pageSize: 50 }),
      wants("units") || wants("roles") ? db.getUnits() : Promise.resolve([] as any[]),
      wants("units") || wants("roles") ? db.getRoles() : Promise.resolve([] as any[]),
    ]);

  // Staff counts per dictionary name so tables never need the full employee rows.
  const unitStaffCounts: Record<string, number> = {};
  const roleStaffCounts: Record<string, number> = {};
  for (const e of employeesData.employees) {
    if (e.employmentStatus === "active") {
      if (e.unit) unitStaffCounts[e.unit] = (unitStaffCounts[e.unit] || 0) + 1;
      if (e.designation) roleStaffCounts[e.designation] = (roleStaffCounts[e.designation] || 0) + 1;
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--parchment)" }}>
      <Sidebar currentUser={currentUser} activeConflictsCount={sidebarCounts.activeConflictsCount} />
      <div className="app-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Header currentUser={currentUser} employees={employeesData.employees} shiftTypes={[]} />
        <main
          className="zpage-main"
          style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "36px 36px 96px", flex: 1 }}
        >
          <SettingsClient
            currentUser={currentUser}
            allowedTabs={allowedTabs as Array<TabId>}
            activeTab={activeTab}
            users={users}
            permissions={permissions as Array<any>}
            departmentSettings={departmentSettings}
            auditPage={audit.rows as Array<any>}
            auditTotal={audit.total}
            auditPageNum={audit.page}
            auditPageSize={audit.pageSize}
            includeSignIns={includeSignIns}
            calendarSystem={calendarPrefs.system}
            calendarLocale={calendarPrefs.locale}
            units={units as Array<any>}
            roles={roles as Array<any>}
            unitStaffCounts={unitStaffCounts}
            roleStaffCounts={roleStaffCounts}
          />
        </main>
      </div>
    </div>
  );
}
