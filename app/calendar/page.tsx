import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getSidebarCounts } from "@/lib/services/shiftStatistics";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { CalendarViewClient } from "@/components/calendar/CalendarViewClient";

export default async function CalendarPage() {
  const currentUser = await getCurrentUser();
  const sidebarCounts = await getSidebarCounts();

  const [
    employeesData,
    shiftTypes,
    assignments,
    leaveRecords,
    offDays,
    settings,
  ] = await Promise.all([
    db.getEmployees({ status: "active", pageSize: 100 }),
    db.getShiftTypes(),
    db.getShiftAssignments({ startDate: "2024-10-01", endDate: "2024-11-05" }),
    db.getLeaveRecords(),
    db.getOffDays(),
    db.getDepartmentSettings(),
  ]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--parchment)" }}>
      <Sidebar currentUser={currentUser} activeConflictsCount={sidebarCounts.activeConflictsCount} />
      <div className="app-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Header currentUser={currentUser} employees={employeesData.employees} shiftTypes={shiftTypes} />
        <main className="zpage-main" style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "36px 36px 80px", flex: 1 }}>
          <CalendarViewClient
            currentUser={currentUser}
            employees={employeesData.employees}
            shiftTypes={shiftTypes}
            assignments={assignments}
            leaveRecords={leaveRecords}
            offDays={offDays}
            settings={settings}
          />
        </main>
      </div>
    </div>
  );
}
