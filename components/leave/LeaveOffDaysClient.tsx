"use client";

import { useState, useMemo } from "react";
import { AuthenticatedUser } from "@/lib/auth/session";
import {
  X,
  Search,
  Edit2,
  Check,
} from "lucide-react";
import {
  updateLeaveStatusAction,
  createOffDayAction,
  deleteOffDayAction,
  adjustLeaveBalanceAction,
  updateLeavePolicyAction,
} from "@/lib/actions/leave";
import { RecordLeaveModal } from "@/components/modals/RecordLeaveModal";
import {
  PageHeader,
  SummaryLine,
  SegmentedTabs,
  EmptyState,
  zSelectStyle,
  zFieldStyle,
  initialsOf,
} from "@/components/layout/PageHeader";

interface LeaveOffDaysClientProps {
  currentUser: AuthenticatedUser;
  employees: Array<any>;
  leaveTypes: Array<any>;
  leavePolicies: Array<any>;
  leaveRecords: Array<any>;
  offDays: Array<any>;
  leaveAdjustments: Array<any>;
}

function dateRangeLabel(startDate: string, endDate: string): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return startDate === endDate ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`;
}

export function LeaveOffDaysClient({
  currentUser,
  employees,
  leaveTypes,
  leavePolicies: initialPolicies,
  leaveRecords: initialRecords,
  offDays: initialOffDays,
  leaveAdjustments: initialAdjustments,
}: LeaveOffDaysClientProps) {
  const [activeTab, setActiveTab] = useState<"requests" | "offdays" | "balances" | "policies">("requests");
  const [records, setRecords] = useState(initialRecords);
  const [offDays, setOffDays] = useState(initialOffDays);
  const [policies, setPolicies] = useState(initialPolicies);
  const [adjustments] = useState(initialAdjustments);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>("ALL");

  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showOffDayModal, setShowOffDayModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<any | null>(null);

  const [offDayEmpId, setOffDayEmpId] = useState("");
  const [offDayDate, setOffDayDate] = useState("2024-10-28");
  const [offDayReason, setOffDayReason] = useState("Scheduled day off");

  const [adjEmpId, setAdjEmpId] = useState("");
  const [adjLeaveTypeId, setAdjLeaveTypeId] = useState(leaveTypes[0]?.id || "");
  const [adjAmount, setAdjAmount] = useState(1);
  const [adjReason, setAdjReason] = useState("Overtime conversion approved by director");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const canApproveLeave = currentUser.permissions?.canApproveLeave;
  const canAssignShifts = currentUser.permissions?.canAssignShifts;
  const isSuperuser = currentUser.role === "superuser";

  const empMap = useMemo(() => {
    const map = new Map<string, any>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const leaveTypeMap = useMemo(() => {
    const map = new Map<string, any>();
    leaveTypes.forEach((lt) => map.set(lt.id, lt));
    return map;
  }, [leaveTypes]);

  const pendingCount = useMemo(() => records.filter((r) => r.status === "pending").length, [records]);
  const offDaysThisMonth = useMemo(
    () => offDays.filter((od) => od.date.startsWith("2024-10")).length,
    [offDays]
  );

  // Pending first, then most recent
  const sortedRecords = useMemo(() => {
    const rank = (r: any) => (r.status === "pending" ? 0 : r.status === "approved" ? 1 : 2);
    return [...records].sort((a, b) => rank(a) - rank(b) || b.startDate.localeCompare(a.startDate));
  }, [records]);

  const filteredRecords = useMemo(() => {
    return sortedRecords.filter((r) => {
      const emp = empMap.get(r.employeeId);
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchEmp =
          emp?.fullName.toLowerCase().includes(q) || emp?.employeeId.toLowerCase().includes(q);
        const matchReason = r.reason.toLowerCase().includes(q);
        if (!matchEmp && !matchReason) return false;
      }
      if (statusFilter !== "ALL" && r.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (leaveTypeFilter !== "ALL" && r.leaveTypeId !== leaveTypeFilter) return false;
      return true;
    });
  }, [sortedRecords, searchQuery, statusFilter, leaveTypeFilter, empMap]);

  /** Coverage note from real data: a replacement counts as covered; otherwise check
   *  whether the same-date approved leave + off-days leave at least one colleague. */
  function coverageNote(rec: any): { label: string; critical: boolean } {
    if (rec.replacementEmployeeId) return { label: "Coverage assigned", critical: false };
    const emp = empMap.get(rec.employeeId);
    const sameWindowBlocked = new Set<string>();
    for (const r2 of records) {
      if (r2.status === "approved" && r2.startDate <= rec.endDate && r2.endDate >= rec.startDate)
        sameWindowBlocked.add(r2.employeeId);
    }
    for (const od of offDays) {
      if (od.date >= rec.startDate && od.date <= rec.endDate) sameWindowBlocked.add(od.employeeId);
    }
    const freeColleagues = employees.filter(
      (e) => e.id !== rec.employeeId && !sameWindowBlocked.has(e.id) && e.designation === emp?.designation
    ).length;
    if (freeColleagues > 0) return { label: "Coverage available", critical: false };
    if (emp) return { label: `Short 1 ${emp.designation.includes("MD") ? "MD" : "RN"}`, critical: true };
    return { label: "Coverage unclear", critical: false };
  }

  async function handleUpdateStatus(id: string, newStatus: "approved" | "rejected" | "cancelled") {
    setIsSubmitting(true);
    try {
      const res = await updateLeaveStatusAction(id, newStatus);
      if (res.success) {
        setRecords((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: newStatus, reviewedBy: currentUser.name } : r))
        );
        setNotification({ type: "success", message: `Leave request marked as ${newStatus}.` });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to update status." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateOffDay(e: React.FormEvent) {
    e.preventDefault();
    if (!offDayEmpId || !offDayDate) return;
    setIsSubmitting(true);
    try {
      const res = await createOffDayAction({ employeeId: offDayEmpId, date: offDayDate, reason: offDayReason });
      if (res.success) {
        setOffDays((prev) => [res.offDay, ...prev]);
        setShowOffDayModal(false);
        setNotification({ type: "success", message: "Day off scheduled." });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to schedule day off." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteOffDay(id: string) {
    setIsSubmitting(true);
    try {
      const res = await deleteOffDayAction(id);
      if (res.success) {
        setOffDays((prev) => prev.filter((od) => od.id !== id));
        setNotification({ type: "success", message: "Day off removed from calendar." });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to remove day off." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAdjustBalance(e: React.FormEvent) {
    e.preventDefault();
    if (!adjEmpId || !adjLeaveTypeId) return;
    setIsSubmitting(true);
    try {
      const res = await adjustLeaveBalanceAction({
        employeeId: adjEmpId,
        leaveTypeId: adjLeaveTypeId,
        amount: Number(adjAmount),
        reason: adjReason,
      });
      if (res.success) {
        setShowAdjustmentModal(false);
        setNotification({ type: "success", message: "Leave balance adjusted and logged." });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to adjust balance." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdatePolicy(policyId: string, allowanceDays: string) {
    setIsSubmitting(true);
    try {
      const res = await updateLeavePolicyAction(policyId, { allowanceDays });
      if (res.success) {
        setPolicies((prev) => prev.map((p) => (p.id === policyId ? { ...p, allowanceDays } : p)));
        setEditingPolicy(null);
        setNotification({ type: "success", message: "Leave policy quota updated." });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to update policy." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      {notification && (
        <div
          style={{
            background: notification.type === "success" ? "var(--linen)" : "var(--critical-bg)",
            color: notification.type === "success" ? "var(--ink)" : "var(--critical-text)",
            border: "1px solid var(--ink-border)",
            borderRadius: 12,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", display: "flex" }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
      )}

      <PageHeader
        title="Leave"
        subtitle="Requests, days off, and balances."
        actions={
          <>
            {canAssignShifts && (
              <button onClick={() => setShowOffDayModal(true)} className="zbtn zbtn-secondary">
                <span>Schedule day off</span>
              </button>
            )}
            {canApproveLeave && (
              <button onClick={() => setShowRecordModal(true)} className="zbtn zbtn-primary">
                <span>Record leave</span>
              </button>
            )}
          </>
        }
        summary={
          <SummaryLine
            parts={[
              { label: "pending", value: pendingCount, critical: pendingCount > 0 },
              { label: "days off this month", value: offDaysThisMonth },
            ]}
          />
        }
      />

      {/* Tabs row */}
      <div style={{ marginBottom: 16 }}>
        <SegmentedTabs
          active={activeTab}
          onChange={(id) => setActiveTab(id as any)}
          tabs={[
            { id: "requests", label: "Requests", count: pendingCount },
            { id: "offdays", label: "Days off", count: offDays.length },
            { id: "balances", label: "Balances" },
            { id: "policies", label: "Policies" },
          ]}
        />
      </div>

      {/* ── TAB 1: Requests ── */}
      {activeTab === "requests" && (
        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--ink-border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {/* Toolbar inside panel: search + filters, one row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "14px 16px", background: "var(--paper)" }}>
            <div style={{ position: "relative", width: 240 }}>
              <Search
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 14,
                  height: 14,
                  color: "var(--ink-tertiary)",
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff or reason…"
                style={{ ...zFieldStyle, width: "100%", padding: "0 12px 0 34px" }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              style={{ ...zSelectStyle, marginLeft: "auto" }}
            >
              <option value="ALL">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Denied</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={leaveTypeFilter}
              onChange={(e) => setLeaveTypeFilter(e.target.value)}
              aria-label="Filter by leave type"
              style={{ ...zSelectStyle }}
            >
              <option value="ALL">All types</option>
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="ztable">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Staff</th>
                  <th style={{ textAlign: "left", width: 120 }}>Type</th>
                  <th style={{ textAlign: "left", width: 170 }}>Dates</th>
                  <th className="num" style={{ width: 70 }}>Days</th>
                  <th style={{ textAlign: "left", width: 150 }}>Coverage</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ textAlign: "right", width: 150 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        title="No leave requests"
                        hint={
                          searchQuery || statusFilter !== "ALL" || leaveTypeFilter !== "ALL"
                            ? "Nothing matches these filters."
                            : "Requests from staff will show up here."
                        }
                        action={
                          canApproveLeave ? (
                            <button onClick={() => setShowRecordModal(true)} className="zbtn zbtn-secondary" style={{ fontSize: 13, padding: "8px 14px" }}>
                              Record leave
                            </button>
                          ) : undefined
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec) => {
                    const emp = empMap.get(rec.employeeId);
                    const leaveType = leaveTypeMap.get(rec.leaveTypeId);
                    const cov = coverageNote(rec);
                    const isPending = rec.status === "pending";
                    return (
                      <tr key={rec.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap" }}>
                            <span className="zavatar">{emp ? initialsOf(emp.fullName) : "?"}</span>
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)", lineHeight: 1.25 }}>
                                {emp?.fullName || "Unknown staff"}
                              </div>
                              <div style={{ fontSize: 13, color: "var(--ink-tertiary)", lineHeight: 1.3 }}>
                                {emp?.employeeId}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 14, color: "var(--ink)", whiteSpace: "nowrap" }}>
                          {leaveType?.name || "Leave"}
                        </td>
                        <td>
                          <div style={{ fontSize: 14, color: "var(--ink)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                            {dateRangeLabel(rec.startDate, rec.endDate)}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--ink-secondary)", whiteSpace: "nowrap" }}>
                            {rec.reason}
                          </div>
                        </td>
                        <td className="num" style={{ fontSize: 15, fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                          {Number(rec.durationDays) || 1}
                        </td>
                        <td
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: cov.critical ? "var(--critical-text)" : "var(--ink-secondary)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {cov.label}
                        </td>
                        <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              borderRadius: 12,
                              padding: "3px 10px",
                              background: rec.status === "pending" ? "var(--apricot)" : "var(--linen)",
                              color: "var(--ink)",
                              textTransform: "capitalize",
                            }}
                          >
                            {rec.status === "rejected" ? "Denied" : rec.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          {isPending && canApproveLeave ? (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                              <button
                                onClick={() => handleUpdateStatus(rec.id, "approved")}
                                disabled={isSubmitting}
                                className="zbtn zbtn-secondary"
                                style={{ padding: "5px 12px", fontSize: 13 }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(rec.id, "rejected")}
                                disabled={isSubmitting}
                                className="zbtn zbtn-text"
                                style={{ fontSize: 13, color: "var(--critical-text)" }}
                              >
                                Deny
                              </button>
                            </div>
                          ) : rec.status === "approved" && canApproveLeave ? (
                            <button
                              onClick={() => handleUpdateStatus(rec.id, "cancelled")}
                              disabled={isSubmitting}
                              className="zbtn zbtn-text"
                              style={{ fontSize: 13, color: "var(--ink-secondary)" }}
                            >
                              Revoke
                            </button>
                          ) : (
                            <span style={{ fontSize: 13, color: "var(--ink-tertiary)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: Days off ── */}
      {activeTab === "offdays" && (
        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--ink-border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div className="overflow-x-auto">
            <table className="ztable">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Staff</th>
                  <th style={{ textAlign: "left", width: 140 }}>Date</th>
                  <th style={{ textAlign: "left" }}>Reason</th>
                  <th style={{ textAlign: "left", width: 160 }}>Scheduled by</th>
                  <th style={{ textAlign: "right", width: 90 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {offDays.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState
                        title="No days off scheduled"
                        hint="Rotational days off appear here once scheduled."
                        action={
                          canAssignShifts ? (
                            <button onClick={() => setShowOffDayModal(true)} className="zbtn zbtn-secondary" style={{ fontSize: 13, padding: "8px 14px" }}>
                              Schedule day off
                            </button>
                          ) : undefined
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  offDays.map((od) => {
                    const emp = empMap.get(od.employeeId);
                    return (
                      <tr key={od.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap" }}>
                            <span className="zavatar">{emp ? initialsOf(emp.fullName) : "?"}</span>
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)", whiteSpace: "nowrap" }}>
                                {emp?.fullName || "Unknown staff"}
                              </div>
                              <div style={{ fontSize: 13, color: "var(--ink-tertiary)" }}>{emp?.employeeId}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                          {od.date}
                        </td>
                        <td style={{ fontSize: 14, color: "var(--ink-secondary)", whiteSpace: "nowrap" }}>
                          {od.reason || "Day off"}
                        </td>
                        <td style={{ fontSize: 13, color: "var(--ink-secondary)", whiteSpace: "nowrap" }}>
                          {od.recordedBy || "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {canAssignShifts && (
                            <button
                              onClick={() => handleDeleteOffDay(od.id)}
                              disabled={isSubmitting}
                              className="zbtn zbtn-text"
                              style={{ fontSize: 13, color: "var(--critical-text)" }}
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: Balances ── */}
      {activeTab === "balances" && (
        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--ink-border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div className="overflow-x-auto">
            <table className="ztable">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Staff</th>
                  <th style={{ textAlign: "left" }}>Role</th>
                  <th className="num">Sick</th>
                  <th className="num">Annual</th>
                  <th className="num">Casual</th>
                </tr>
              </thead>
              <tbody>
                {employees.slice(0, 15).map((emp) => {
                  const isDoctor =
                    emp.designation.includes("Physician") || emp.designation.includes("Attending");
                  const sickTotal = isDoctor ? 12 : 14;
                  const annualTotal = isDoctor ? 25 : 20;
                  const casualTotal = 7;

                  const empRecords = records.filter((r) => r.employeeId === emp.id && r.status === "approved");
                  const sickTaken = empRecords
                    .filter((r) => r.leaveTypeId === "lt_sick")
                    .reduce((sum, r) => sum + Number(r.durationDays || 0), 0);
                  const annualTaken = empRecords
                    .filter((r) => r.leaveTypeId === "lt_annual")
                    .reduce((sum, r) => sum + Number(r.durationDays || 0), 0);

                  return (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap" }}>
                          <span className="zavatar">{initialsOf(emp.fullName)}</span>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>{emp.fullName}</div>
                            <div style={{ fontSize: 13, color: "var(--ink-tertiary)" }}>{emp.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 14, color: "var(--ink-secondary)", whiteSpace: "nowrap" }}>
                        {emp.designation}
                      </td>
                      <td className="num" style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 500, color: "var(--ink)" }}>{sickTotal - sickTaken}</span>
                        <span style={{ color: "var(--ink-tertiary)" }}> / {sickTotal} d</span>
                      </td>
                      <td className="num" style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 500, color: "var(--ink)" }}>{annualTotal - annualTaken}</span>
                        <span style={{ color: "var(--ink-tertiary)" }}> / {annualTotal} d</span>
                      </td>
                      <td className="num" style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 500, color: "var(--ink)" }}>{casualTotal}</span>
                        <span style={{ color: "var(--ink-tertiary)" }}> / {casualTotal} d</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: Policies ── */}
      {activeTab === "policies" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {policies.map((p) => {
            const leaveType = leaveTypeMap.get(p.leaveTypeId);
            const isEditing = editingPolicy?.id === p.id;
            return (
              <div
                key={p.id}
                style={{
                  background: "var(--paper)",
                  border: "1px solid var(--ink-border)",
                  borderRadius: 12,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>{p.name}</div>
                    <div style={{ fontSize: 13, color: "var(--ink-secondary)", marginTop: 2 }}>
                      {leaveType?.name || "Leave"} · {p.employeeCategory || "All staff"}
                    </div>
                  </div>
                  {isSuperuser && !isEditing && (
                    <button
                      onClick={() => setEditingPolicy(p)}
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ink-secondary)", padding: 4 }}
                      title="Edit policy"
                    >
                      <Edit2 style={{ width: 15, height: 15 }} />
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", gap: 12, paddingTop: 12, borderTop: "1px solid var(--ink-border-row)" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "var(--ink-tertiary)", marginBottom: 4 }}>Allowance</div>
                    {isEditing ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="number"
                          defaultValue={p.allowanceDays}
                          id={`policy_input_${p.id}`}
                          style={{ ...zFieldStyle, width: 80, height: 32 }}
                        />
                        <button
                          onClick={() => {
                            const val = (document.getElementById(`policy_input_${p.id}`) as HTMLInputElement)?.value;
                            if (val) handleUpdatePolicy(p.id, val);
                          }}
                          className="zbtn zbtn-secondary"
                          style={{ height: 32, padding: "0 10px", fontSize: 12 }}
                        >
                          <Check style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                        {p.allowanceDays} days / yr
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "var(--ink-tertiary)", marginBottom: 4 }}>Carry-forward</div>
                    <div style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                      {p.carryForwardDays || 0} days
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Record Leave Modal */}
      <RecordLeaveModal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        employees={employees}
        leaveTypes={leaveTypes}
        onSuccess={() => {
          setNotification({ type: "success", message: "Leave record logged successfully." });
          setTimeout(() => setNotification(null), 3000);
        }}
      />

      {/* Schedule Day Off Modal */}
      {showOffDayModal && (
        <Modal title="Schedule day off" onClose={() => setShowOffDayModal(false)}>
          <form onSubmit={handleCreateOffDay} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Select employee</label>
              <select value={offDayEmpId} onChange={(e) => setOffDayEmpId(e.target.value)} required style={{ ...zSelectStyle, width: "100%" }}>
                <option value="">— choose staff —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName} ({e.designation})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={offDayDate} onChange={(e) => setOffDayDate(e.target.value)} required style={{ ...zFieldStyle, width: "100%" }} />
            </div>
            <div>
              <label style={labelStyle}>Reason</label>
              <input type="text" value={offDayReason} onChange={(e) => setOffDayReason(e.target.value)} style={{ ...zFieldStyle, width: "100%" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 14, borderTop: "1px solid var(--ink-border)" }}>
              <button type="button" onClick={() => setShowOffDayModal(false)} className="zbtn zbtn-secondary">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !offDayEmpId}
                className="zbtn zbtn-primary"
                style={{ padding: "10px 20px", fontSize: 15 }}
              >
                <span>Save day off</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Adjust Balance Modal (Superuser) */}
      {showAdjustmentModal && (
        <Modal title="Adjust leave balance" onClose={() => setShowAdjustmentModal(false)}>
          <form onSubmit={handleAdjustBalance} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Employee</label>
              <select value={adjEmpId} onChange={(e) => setAdjEmpId(e.target.value)} required style={{ ...zSelectStyle, width: "100%" }}>
                <option value="">— choose staff —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName} ({e.designation})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Leave type</label>
                <select value={adjLeaveTypeId} onChange={(e) => setAdjLeaveTypeId(e.target.value)} style={{ ...zSelectStyle, width: "100%" }}>
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Days (+/−)</label>
                <input
                  type="number"
                  step="0.5"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(Number(e.target.value))}
                  required
                  style={{ ...zFieldStyle, width: "100%" }}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Reason</label>
              <input type="text" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} required style={{ ...zFieldStyle, width: "100%" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 14, borderTop: "1px solid var(--ink-border)" }}>
              <button type="button" onClick={() => setShowAdjustmentModal(false)} className="zbtn zbtn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting || !adjEmpId} className="zbtn zbtn-primary" style={{ padding: "10px 20px", fontSize: 15 }}>
                <span>Apply &amp; log</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--ink)",
  marginBottom: 4,
};

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(18, 23, 24, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="zelt-surface"
        style={{ maxWidth: 440, width: "100%", padding: 24, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", alignItems: "center", paddingBottom: 12, marginBottom: 14, borderBottom: "1px solid var(--ink-border)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 500, color: "var(--ink)", margin: 0 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ink-secondary)", marginLeft: "auto", display: "flex" }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
