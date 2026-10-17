import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getSidebarCounts } from "@/lib/services/shiftStatistics";
import { shiftDate } from "@/lib/schedule-cycle";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ReportsStatisticsClient } from "@/components/reports/ReportsStatisticsClient";

// Wide window around the roster cycle so the client-side week selector has data
// for every week it can navigate to (hours/shifts/conflicts then always match
// the Roster page, which uses the same week slice).
const weekWindowStart = shiftDate("2024-10-01", -7);
const weekWindowEnd = "2024-11-15";

export default async function ReportsStatisticsPage() {
  const currentUser = await getCurrentUser();
  const sidebarCounts = await getSidebarCounts();

  const [
    employeesData,
    shiftTypes,
    assignments,
    leaveRecords,
    departmentSettings,
  ] = await Promise.all([
    db.getEmployees({ status: "active", pageSize: 100 }),
    db.getShiftTypes(),
    db.getShiftAssignments({ startDate: weekWindowStart, endDate: weekWindowEnd }),
    db.getLeaveRecords(),
    db.getDepartmentSettings(),
  ]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--parchment)" }}>
      <Sidebar currentUser={currentUser} activeConflictsCount={sidebarCounts.activeConflictsCount} />
      <div className="app-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Header currentUser={currentUser} employees={employeesData.employees} shiftTypes={shiftTypes} />
        <main className="zpage-main">
          <ReportsStatisticsClient
            currentUser={currentUser}
            employees={employeesData.employees}
            shiftTypes={shiftTypes}
            assignments={assignments}
            leaveRecords={leaveRecords}
            departmentSettings={departmentSettings}
          />
        </main>
      </div>
    </div>
  );
}
