import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getSidebarCounts } from "@/lib/services/shiftStatistics";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { LeaveOffDaysClient } from "@/components/leave/LeaveOffDaysClient";

export default async function LeaveOffDaysPage() {
  const currentUser = await getCurrentUser();
  const sidebarCounts = await getSidebarCounts();

  const [
    employeesData,
    leaveTypes,
    leavePolicies,
    leaveRecords,
    offDays,
    leaveAdjustments,
    shiftTypes,
  ] = await Promise.all([
    db.getEmployees({ status: "active", pageSize: 100 }),
    db.getLeaveTypes(),
    db.getLeavePolicies(),
    db.getLeaveRecords(),
    db.getOffDays(),
    db.getLeaveBalanceAdjustments(),
    db.getShiftTypes(),
  ]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--parchment)" }}>
      <Sidebar currentUser={currentUser} activeConflictsCount={sidebarCounts.activeConflictsCount} />
      <div className="app-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Header currentUser={currentUser} employees={employeesData.employees} shiftTypes={shiftTypes} />
        <main className="zpage-main" style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "36px 36px 96px", flex: 1 }}>
          <LeaveOffDaysClient
            currentUser={currentUser}
            employees={employeesData.employees}
            leaveTypes={leaveTypes}
            leavePolicies={leavePolicies}
            leaveRecords={leaveRecords}
            offDays={offDays}
            leaveAdjustments={leaveAdjustments}
          />
        </main>
      </div>
    </div>
  );
}
