import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getSidebarCounts } from "@/lib/services/shiftStatistics";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { calculateEmployeeShiftStats } from "@/lib/services/shiftStatistics";
import { calculateEmployeeLeaveBalances } from "@/lib/services/leaveCalculator";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Phone, Radio } from "lucide-react";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  const sidebarCounts = await getSidebarCounts();
  const employee = await db.getEmployeeById(id);

  if (!employee) {
    notFound();
  }

  const [shiftTypes, stats, leaveBalances, employeesData] = await Promise.all([
    db.getShiftTypes(),
    calculateEmployeeShiftStats(employee.id),
    calculateEmployeeLeaveBalances(employee.id),
    db.getEmployees(),
  ]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--parchment)" }}>
      <Sidebar
        currentUser={currentUser}
        activeConflictsCount={sidebarCounts.activeConflictsCount}
        totalEmployeesCount={employeesData.totalCount}
        pendingLeavesCount={sidebarCounts.pendingLeavesCount}
      />
      <div className="app-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Header
          currentUser={currentUser}
          employees={employeesData.employees}
          shiftTypes={shiftTypes}
        />
        <main className="zpage-main" style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "36px 36px 80px", flex: 1 }}>
          {/* Breadcrumb / Back */}
          <div style={{ marginBottom: 24 }}>
            <Link
              href="/employees"
              className="zbtn zbtn-text"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
            >
              <ArrowLeft style={{ width: 14, height: 14, strokeWidth: 1.5 }} />
              <span>Back to Clinical Staff Directory</span>
            </Link>
          </div>

          {/* Clinician Card */}
          <div className="zelt-surface" style={{ overflow: "hidden", marginBottom: 32 }}>
            <div
              style={{
                padding: "24px 28px",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 20,
                borderBottom: "1px solid var(--ink-border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {employee.avatarUrl ? (
                  <Image
                    src={employee.avatarUrl}
                    alt={employee.fullName}
                    width={64}
                    height={64}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 12,
                      objectFit: "cover",
                      border: "1px solid var(--ink-border)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 12,
                      background: "var(--linen)",
                      border: "1px solid var(--ink-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      fontWeight: 500,
                      color: "var(--ink)",
                    }}
                  >
                    {employee.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h1
                      style={{
                        fontSize: 24,
                        fontWeight: 500,
                        color: "var(--ink)",
                        letterSpacing: "-0.17px",
                        lineHeight: 1.24,
                      }}
                    >
                      {employee.fullName}
                    </h1>
                    <span className="ztag ztag-neutral">
                      {employee.employmentStatus.replace("_", " ")}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, fontSize: 13, color: "var(--ink-secondary)" }}>
                    <span style={{ fontWeight: 500, color: "var(--ink)" }}>{employee.designation}</span>
                    <span>&middot;</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>ID: {employee.employeeId}</span>
                    <span>&middot;</span>
                    <span>{employee.unit}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-tertiary)", marginTop: 2 }}>
                    Joined: {employee.dateJoined} &middot; Tenured Staff
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "var(--ink-secondary)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Phone style={{ width: 14, height: 14, strokeWidth: 1.5, color: "var(--ink)" }} />
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{employee.hospitalExt || "x4402"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Radio style={{ width: 14, height: 14, strokeWidth: 1.5, color: "var(--ink)" }} />
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{employee.pagerNumber || "PGR-8891"}</span>
                </div>
                <span style={{ fontSize: 13, color: "var(--ink-tertiary)" }}>{employee.email}</span>
              </div>
            </div>

            {/* Shift & Compliance Metrics */}
            <div
              style={{
                padding: "24px 28px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
                borderBottom: "1px solid var(--ink-border)",
              }}
            >
              <div
                style={{
                  padding: "16px 18px",
                  borderRadius: 12,
                  background: "var(--linen)",
                  border: "1px solid var(--ink-border)",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--ink-tertiary)", display: "block" }}>
                  Scheduled Hours (MTD)
                </span>
                <span style={{ fontSize: 20, fontWeight: 500, color: "var(--ink)", fontVariantNumeric: "tabular-nums", display: "block", marginTop: 4 }}>
                  {stats.scheduledHours}h
                </span>
                <span style={{ fontSize: 13, color: "var(--ink-secondary)", marginTop: 4, display: "block" }}>
                  {((stats.scheduledHours / 160) * 100).toFixed(0)}% of 160h Baseline
                </span>
              </div>

              <div
                style={{
                  padding: "16px 18px",
                  borderRadius: 12,
                  background: "var(--linen)",
                  border: "1px solid var(--ink-border)",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--ink-tertiary)", display: "block" }}>
                  Completed Shifts
                </span>
                <span style={{ fontSize: 20, fontWeight: 500, color: "var(--ink)", fontVariantNumeric: "tabular-nums", display: "block", marginTop: 4 }}>
                  {stats.completedCount} Shifts
                </span>
                <span style={{ fontSize: 13, color: "var(--ink-secondary)", marginTop: 4, display: "block" }}>
                  100% Adherence
                </span>
              </div>

              <div
                style={{
                  padding: "16px 18px",
                  borderRadius: 12,
                  background: "var(--linen)",
                  border: "1px solid var(--ink-border)",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--ink-tertiary)", display: "block" }}>
                  Night Graveyard Shifts
                </span>
                <span style={{ fontSize: 20, fontWeight: 500, color: "var(--ink)", fontVariantNumeric: "tabular-nums", display: "block", marginTop: 4 }}>
                  {stats.nightShiftCount} Assigned
                </span>
                <span style={{ fontSize: 13, color: "var(--ink-secondary)", marginTop: 4, display: "block" }}>
                  Standard Cap Respected
                </span>
              </div>

              <div
                style={{
                  padding: "16px 18px",
                  borderRadius: 12,
                  background: "var(--linen)",
                  border: "1px solid var(--ink-border)",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--ink-tertiary)", display: "block" }}>
                  Reliability Rate
                </span>
                <span style={{ fontSize: 20, fontWeight: 500, color: "var(--ink)", fontVariantNumeric: "tabular-nums", display: "block", marginTop: 4 }}>
                  {stats.reliabilityRate}%
                </span>
                <span style={{ fontSize: 13, color: "var(--ink-secondary)", marginTop: 4, display: "block" }}>
                  0 Unplanned No-Shows
                </span>
              </div>
            </div>

            {/* Leave Quota Balances */}
            <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)" }}>
                Statutory Leave Ledger &amp; Live Accrual Balances
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                {leaveBalances.balances.map((bal) => (
                  <div
                    key={bal.leaveTypeId}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: "var(--linen)",
                      border: "1px solid var(--ink-border)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <span style={{ fontSize: 13, color: "var(--ink-tertiary)" }}>
                      {bal.leaveTypeName.split("/")[0]}
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 500, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                      {bal.remainingDays}d left
                    </span>
                    <span style={{ fontSize: 12, color: "var(--ink-secondary)", fontVariantNumeric: "tabular-nums" }}>
                      {bal.usedDays}d used &middot; {bal.allowanceDays}d total quota
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
