import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getSidebarCounts } from "@/lib/services/shiftStatistics";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ShiftTypesClient } from "@/components/shifts/ShiftTypesClient";

export default async function ShiftTypesPage() {
  const currentUser = await getCurrentUser();
  const sidebarCounts = await getSidebarCounts();

  const [shiftTypes, departmentSettings, employeesData, shiftRequirements] = await Promise.all([
    db.getShiftTypes(),
    db.getDepartmentSettings(),
    db.getEmployees({ status: "active", pageSize: 100 }),
    db.getShiftRequirements(),
  ]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--parchment)" }}>
      <Sidebar currentUser={currentUser} activeConflictsCount={sidebarCounts.activeConflictsCount} />
      <div className="app-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Header currentUser={currentUser} employees={employeesData.employees} shiftTypes={shiftTypes} />
        <main className="zpage-main">
          <ShiftTypesClient
            currentUser={currentUser}
            shiftTypes={shiftTypes}
            departmentSettings={departmentSettings}
            shiftRequirements={shiftRequirements || []}
          />
        </main>
      </div>
    </div>
  );
}
