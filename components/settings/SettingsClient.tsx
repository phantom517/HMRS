"use client";

// components/settings/SettingsClient.tsx — slim orchestrator. Tabs are
// URL-driven (?tab=), each tab component owns its own state and busy flags,
// and rows are memoized inside each tab, so interactive churn in one tab no
// longer re-renders the whole Settings tree (this was the old monolith's
// re-render storm).
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { AuthenticatedUser } from "@/lib/auth/session";
import { SettingsTabs, type TabDef } from "@/components/settings/SettingsTabs";
import { AssistantsTab } from "@/components/settings/AssistantsTab";
import { RulesTab } from "@/components/settings/RulesTab";
import { UnitsRolesTab, type DictTab } from "@/components/settings/UnitsRolesTab";
import { AuditTab } from "@/components/settings/AuditTab";

type TabId = "assistants" | "rules" | "units" | "roles" | "audit";

interface SettingsClientProps {
  currentUser: AuthenticatedUser;
  allowedTabs: TabId[];
  activeTab: TabId | null;
  users: Array<any>;
  permissions: Array<any>;
  departmentSettings: any;
  auditPage: Array<any>;
  auditTotal: number;
  auditPageNum: number;
  auditPageSize: number;
  includeSignIns: boolean;
  calendarSystem: "AD" | "BS";
  calendarLocale: "en" | "ne";
  units: Array<any>;
  roles: Array<any>;
  unitStaffCounts: Record<string, number>;
  roleStaffCounts: Record<string, number>;
}

export function SettingsClient(props: SettingsClientProps) {
  const {
    currentUser,
    allowedTabs,
    activeTab,
    users,
    permissions,
    departmentSettings,
    auditPage,
    auditTotal,
    auditPageNum,
    auditPageSize,
    includeSignIns,
    calendarSystem,
    calendarLocale,
    units,
    roles,
    unitStaffCounts,
    roleStaffCounts,
  } = props;
  const router = useRouter();
  const isSuperuser = currentUser.role === "superuser";
  const assistantUsers = users.filter((u) => u.role === "assistant");

  // URL-driven tabs. The single "Units & roles" trigger opens whichever of
  // units/roles is allowed (roles-only sessions land on roles).
  const tabs: TabDef[] = [];
  if (allowedTabs.includes("assistants")) {
    tabs.push({
      id: "assistants",
      label: "Assistants",
      count: isSuperuser ? assistantUsers.length : undefined,
    });
  }
  if (allowedTabs.includes("rules")) tabs.push({ id: "rules", label: "Rules" });
  if (allowedTabs.includes("units") || allowedTabs.includes("roles")) {
    // One combined trigger; no count on this tab (B1).
    tabs.push({ id: allowedTabs.includes("units") ? "units" : "roles", label: "Units & roles" });
  }
  if (allowedTabs.includes("audit")) tabs.push({ id: "audit", label: "Audit log" });

  const goTab = useCallback(
    (id: string) => router.push(`/settings?tab=${id}`),
    [router]
  );

  const dictTab = (activeTab === "roles" ? "roles" : "units") as DictTab;

  return (
    <div className="flex w-full flex-col gap-6 pb-8">
      {tabs.length > 0 && (
        <SettingsTabs tabs={tabs} activeId={tabs.some((t) => t.id === activeTab) ? activeTab! : tabs[0].id} onTabChange={goTab} />
      )}

      {activeTab === "assistants" && (
        <AssistantsTab users={assistantUsers} permissions={permissions} canManage={isSuperuser} />
      )}
      {activeTab === "rules" && departmentSettings && (
        <RulesTab settings={departmentSettings} isSuperuser={isSuperuser} />
      )}
      {(activeTab === "units" || activeTab === "roles") && (
        <UnitsRolesTab
          tab={dictTab}
          units={units}
          roles={roles}
          unitStaffCounts={unitStaffCounts}
          roleStaffCounts={roleStaffCounts}
          canEdit={isSuperuser}
        />
      )}
      {activeTab === "audit" && (
        <AuditTab
          rows={auditPage}
          total={auditTotal}
          page={auditPageNum}
          pageSize={auditPageSize}
          system={calendarSystem}
          locale={calendarLocale}
          includeSignIns={includeSignIns}
        />
      )}
    </div>
  );
}
