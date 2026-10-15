import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getSidebarCounts } from "@/lib/services/shiftStatistics";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();
  const sidebarCounts = await getSidebarCounts();

  const now = new Date();
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

  const [
    employeesData,
    shiftTypes,
    shiftAssignments,
    leaveRecords,
    offDays,
    departmentSettings,
    auditLogs,
    leaveTypes,
  ] = await Promise.all([
    db.getEmployees({ status: "active", pageSize: 100 }),
    db.getShiftTypes(),
    db.getShiftAssignments({ startDate, endDate }),
    db.getLeaveRecords(),
    db.getOffDays(),
    db.getDepartmentSettings(),
    db.getAuditLogs(10),
    db.getLeaveTypes(),
  ]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--parchment)" }}>
      <Sidebar
        currentUser={currentUser}
        activeConflictsCount={sidebarCounts.activeConflictsCount}
      />
      <div className="app-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        <Header
          currentUser={currentUser}
          employees={employeesData.employees}
          shiftTypes={shiftTypes}
        />
        <main style={{ flex: 1 }}>
          <DashboardClient
            currentUser={currentUser}
            employees={employeesData.employees}
            shiftTypes={shiftTypes}
            assignments={shiftAssignments}
            leaveRecords={leaveRecords}
            offDays={offDays}
            settings={departmentSettings}
            auditLogs={auditLogs}
            leaveTypes={leaveTypes}
          />
        </main>
      </div>
    </div>
  );
}