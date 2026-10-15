import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getSidebarCounts } from "@/lib/services/shiftStatistics";
import { getRosterWeek } from "@/lib/schedule-cycle";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { DutyRosterClient } from "@/components/roster/DutyRosterClient";

// One date source for the whole page: the department's roster week.
const week = getRosterWeek(0);

export default async function DutyRosterPage() {
  const currentUser = await getCurrentUser();
  const sidebarCounts = await getSidebarCounts();

  const [
    employeesData,
    shiftTypes,
    assignments,
    leaveRecords,
    offDays,
    settings,
    shiftRequirements,
  ] = await Promise.all([
    db.getEmployees({ status: "active", pageSize: 100 }),
    db.getShiftTypes(),
    db.getShiftAssignments({ startDate: week.startDate, endDate: week.endDate }),
    db.getLeaveRecords({ startDate: week.startDate, endDate: week.endDate }),
    db.getOffDays({ startDate: week.startDate, endDate: week.endDate }),
    db.getDepartmentSettings(),
    db.getShiftRequirements ? db.getShiftRequirements() : Promise.resolve([]),
  ]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--parchment)" }}>
      <Sidebar currentUser={currentUser} activeConflictsCount={sidebarCounts.activeConflictsCount} />
      <div className="app-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Header currentUser={currentUser} employees={employeesData.employees} shiftTypes={shiftTypes} />
        {/* 96px bottom padding keeps the floating AI assistant from ever overlapping table content */}
        <main style={{ maxWidth: 1320, width: "100%", margin: "0 auto", padding: "32px 36px 96px", flex: 1 }}>
          <DutyRosterClient
            currentUser={currentUser}
            employees={employeesData.employees}
            shiftTypes={shiftTypes}
            assignments={assignments}
            leaveRecords={leaveRecords}
            offDays={offDays}
            settings={settings}
            week={week}
            shiftRequirements={shiftRequirements}
          />
        </main>
      </div>
    </div>
  );
}
