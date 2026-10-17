import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getSidebarCounts } from "@/lib/services/shiftStatistics";
import { getRosterWeek } from "@/lib/schedule-cycle";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { EmployeeDirectoryClient } from "@/components/employees/EmployeeDirectoryClient";

// Same single date source as the Roster: hours shown are THIS week's hours.
const week = getRosterWeek(0);

export default async function EmployeesPage() {
  const currentUser = await getCurrentUser();
  const sidebarCounts = await getSidebarCounts();

  const [
    employeesData,
    shiftTypes,
    assignments,
    leaveRecords,
    offDays,
    settings,
    units,
    roles,
  ] = await Promise.all([
    db.getEmployees({ pageSize: 100 }),
    db.getShiftTypes(),
    db.getShiftAssignments({ startDate: week.startDate, endDate: week.endDate }),
    db.getLeaveRecords(),
    db.getOffDays(),
    db.getDepartmentSettings(),
    db.getUnits(),
    db.getRoles(),
  ]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--parchment)" }}>
      <Sidebar currentUser={currentUser} activeConflictsCount={sidebarCounts.activeConflictsCount} />
      <div className="app-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Header currentUser={currentUser} employees={employeesData.employees} shiftTypes={shiftTypes} />
        <main className="zpage-main">
          <EmployeeDirectoryClient
            currentUser={currentUser}
            initialEmployees={employeesData.employees}
            shiftTypes={shiftTypes}
            assignments={assignments}
            leaveRecords={leaveRecords}
            offDays={offDays}
            settings={settings}
            units={units}
            roles={roles}
          />
        </main>
      </div>
    </div>
  );
}
