"use client";

import { useState } from "react";
import {
  Search,
  Download,
  X,
  ChevronRight,
  Edit,
  Archive,
  Clock,
  Trash2,
} from "lucide-react";
import { AuthenticatedUser } from "@/lib/auth/session";
import {
  createEmployeeAction,
  updateEmployeeAction,
  archiveEmployeeAction,
  restoreEmployeeAction,
  hardDeleteEmployeeAction,
} from "@/lib/actions/employees";
import { adjustLeaveBalanceAction } from "@/lib/actions/leave";
import { ExportModal } from "@/components/modals/ExportModal";
import { QuickAssignModal } from "@/components/modals/QuickAssignModal";
import {
  PageHeader,
  SummaryLine,
  SegmentedTabs,
  EmptyState,
  zSelectStyle,
  zFieldStyle,
  initialsOf,
} from "@/components/layout/PageHeader";
import { cycleToday, netHoursOf, formatHours } from "@/lib/schedule-cycle";

interface EmployeeDirectoryClientProps {
  currentUser: AuthenticatedUser;
  initialEmployees: Array<any>;
  shiftTypes: Array<any>;
  assignments: Array<any>;
  leaveRecords: Array<any>;
  offDays: Array<any>;
  settings: any;
}

type CredentialState = "verified" | "expiring" | "expired" | "unverified";

function credentialStateOf(emp: any): CredentialState {
  const creds = Array.isArray(emp.credentials) ? emp.credentials : [];
  const today = cycleToday();
  if (creds.length === 0) return "unverified";
  const hasExpired = creds.some((c: any) => c.expires && c.expires < today);
  const hasExpiring = creds.some(
    (c: any) => c.expires && c.expires >= today && c.expires <= addDays(today, 60)
  );
  const allValid = creds.every(
    (c: any) => !c.expires || c.expires > addDays(today, 60)
  );
  if (hasExpired) return "expired";
  if (hasExpiring) return "expiring";
  if (allValid) return "verified";
  return "unverified";
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

const CRED_LABEL: Record<CredentialState, string> = {
  verified: "Verified",
  expiring: "Expiring",
  expired: "Expired",
  unverified: "Not verified",
};

export function EmployeeDirectoryClient({
  currentUser,
  initialEmployees,
  shiftTypes,
  assignments,
  leaveRecords,
  offDays,
  settings,
}: EmployeeDirectoryClientProps) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "on_leave" | "archived">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("ALL");
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(employees[0]?.id || "");
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdjustBalanceOpen, setIsAdjustBalanceOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isQuickAssignOpen, setIsQuickAssignOpen] = useState(false);

  const [formData, setFormData] = useState({
    employeeId: "",
    fullName: "",
    designation: "Staff Critical Care RN",
    unit: "Trauma Bay 1-4 • Red Team",
    phoneNumber: "+1 (555) 000-0000",
    email: "",
    dateJoined: "2024-01-15",
    credentials: "ACLS, TNCC",
  });

  // Per-employee scheduling exceptions (empty string = inherit department default)
  const [exceptionFields, setExceptionFields] = useState({ maxHoursPerWeek: "", canWorkNights: true });

  const [adjustAmount, setAdjustAmount] = useState(2.0);
  const [adjustType, setAdjustType] = useState("lt_annual");
  const [adjustReason, setAdjustReason] = useState("Overtime hours converted to leave quota");

  const selectedEmployee =
    employees.find((e) => e.id === selectedEmployeeId) || employees[0];

  const canEditEmployees = currentUser.permissions.canEditEmployees;
  const canAssignShifts = currentUser.permissions.canAssignShifts;
  const canExportReports = currentUser.permissions.canExportReports;
  const canDeleteEmployees = currentUser.permissions.canDeleteEmployees;
  const weeklyHoursCap = settings?.weeklyHoursCap || 48;

  // ── Tabs: real counts from employee records ──
  const tabCounts = {
    all: employees.length,
    active: employees.filter((e) => e.employmentStatus === "active").length,
    on_leave: employees.filter((e) => e.employmentStatus === "on_leave").length,
    archived: employees.filter((e) => e.employmentStatus === "archived").length,
  };

  // ── Quiet summary: only real, visible problems go red ──
  const onLeaveCount = tabCounts.on_leave;
  const unverifiable = employees.filter(
    (e) => e.employmentStatus === "active" && credentialStateOf(e) !== "verified"
  ).length;
  const overCap = employees.filter((emp) => weekHoursOf(emp) > weeklyHoursCap).length;
  function weekHoursOf(emp: any): number {
    return assignments
      .filter((a) => a.employeeId === emp.id && a.status !== "cancelled")
      .reduce((acc, a) => acc + netHoursOf(shiftTypes.find((s) => s.id === a.shiftTypeId)), 0);
  }
  const hasActiveFilters =
    searchQuery.trim() !== "" || selectedUnit !== "ALL" || selectedRole !== "ALL";

  const filteredEmployees = employees.filter((emp) => {
    if (statusFilter !== "all" && emp.employmentStatus !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        emp.fullName.toLowerCase().includes(q) ||
        emp.employeeId.toLowerCase().includes(q) ||
        emp.designation.toLowerCase().includes(q) ||
        emp.unit.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (selectedUnit !== "ALL" && !emp.unit.includes(selectedUnit)) return false;
    if (selectedRole !== "ALL") {
      if (selectedRole === "MD" && !emp.designation.includes("MD")) return false;
      if (selectedRole === "RN" && !emp.designation.includes("RN")) return false;
      if (selectedRole === "TECH" && !emp.designation.includes("Tech") && !emp.designation.includes("Paramedic"))
        return false;
    }
    return true;
  });

  // Role group rows (same pattern as the Roster)
  const groupedRows = (() => {
    const groups = new Map<string, any[]>();
    for (const emp of filteredEmployees) {
      if (!groups.has(emp.designation)) groups.set(emp.designation, []);
      groups.get(emp.designation)!.push(emp);
    }
    return Array.from(groups.entries());
  })();

  // Selected employee stats (drawer)
  const selectedAssignments = selectedEmployee
    ? assignments.filter((a) => a.employeeId === selectedEmployee.id && a.status !== "cancelled")
    : [];
  const selectedLeaves = selectedEmployee
    ? leaveRecords.filter((l) => l.employeeId === selectedEmployee.id)
    : [];

  // ── Handlers (unchanged behaviour) ──
  async function handleCreateClinician(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await createEmployeeAction({
        employeeId: formData.employeeId,
        fullName: formData.fullName,
        designation: formData.designation,
        unit: formData.unit,
        phoneNumber: formData.phoneNumber,
        email: formData.email,
        dateJoined: formData.dateJoined,
        credentials: formData.credentials.split(",").map((c) => ({
          name: c.trim(),
          issuer: "AHA / Board Certification",
          expires: "2026-12-31",
          status: "Active & Valid",
        })),
      });
      setEmployees((prev) => [res.employee, ...prev]);
      setSelectedEmployeeId(res.employee.id);
      setIsAddModalOpen(false);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  }

  async function handleUpdateClinician(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmployee) return;
    try {
      const res = await updateEmployeeAction(selectedEmployee.id, {
        fullName: formData.fullName,
        designation: formData.designation,
        unit: formData.unit,
        phoneNumber: formData.phoneNumber,
        email: formData.email,
        // Scheduling exceptions — per-employee overrides of the department rules
        maxHoursPerWeek:
          exceptionFields.maxHoursPerWeek.trim() === ""
            ? null
            : Number(exceptionFields.maxHoursPerWeek) || null,
        canWorkNights: exceptionFields.canWorkNights,
      } as any);
      setEmployees((prev) => prev.map((e) => (e.id === selectedEmployee.id ? res.employee : e)));
      setIsEditModalOpen(false);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  }

  async function handleArchiveToggle() {
    if (!selectedEmployee) return;
    try {
      if (selectedEmployee.employmentStatus === "archived") {
        const res = await restoreEmployeeAction(selectedEmployee.id);
        setEmployees((prev) => prev.map((e) => (e.id === selectedEmployee.id ? res.employee : e)));
      } else {
        const res = await archiveEmployeeAction(selectedEmployee.id);
        setEmployees((prev) => prev.map((e) => (e.id === selectedEmployee.id ? res.employee : e)));
      }
    } catch (err: any) {
      alert("Action failed: " + err.message);
    }
  }

  async function handleDeleteClinician() {
    if (!selectedEmployee) return;
    if (
      !confirm(
        `Permanently delete ${selectedEmployee.fullName} (${selectedEmployee.employeeId})?\n\nThis erases their ENTIRE history: every shift assignment, leave record, off-day and balance adjustment. It cannot be undone.\n\nIf you only want to take them off the roster without destroying records, use Archive instead.`
      )
    )
      return;
    try {
      await hardDeleteEmployeeAction(selectedEmployee.id);
      setIsDetailOpen(false);
      setEmployees((prev) => prev.filter((e) => e.id !== selectedEmployee.id));
    } catch (err: any) {
      alert("Action failed: " + err.message);
    }
  }

  async function handleAdjustBalance(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmployee) return;
    try {
      await adjustLeaveBalanceAction({
        employeeId: selectedEmployee.id,
        leaveTypeId: adjustType,
        amount: adjustAmount,
        reason: adjustReason,
      });
      alert(`Updated leave quota for ${selectedEmployee.fullName} by ${adjustAmount} days.`);
      setIsAdjustBalanceOpen(false);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Everyone on the ED roster, with hours and credentials."
        actions={
          <>
            {canExportReports && (
              <button onClick={() => setIsExportOpen(true)} className="zbtn zbtn-secondary">
                <Download style={{ width: 14, height: 14 }} />
                <span>Export</span>
              </button>
            )}
            {canEditEmployees && (
              <button
                onClick={() => {
                  setFormData({
                    employeeId: `NUR-${Math.floor(200 + Math.random() * 800)}`,
                    fullName: "",
                    designation: "Staff Critical Care RN",
                    unit: "Trauma Bay 1-4 • Red Team",
                    phoneNumber: "+1 (555) 234-8901",
                    email: "",
                    dateJoined: "2024-10-12",
                    credentials: "ACLS, TNCC, BLS",
                  });
                  setIsAddModalOpen(true);
                }}
                className="zbtn zbtn-primary"
              >
                <span>Add employee</span>
              </button>
            )}
          </>
        }
        summary={
          <SummaryLine
            parts={[
              { label: "staff", value: tabCounts.all },
              { label: "on duty", value: tabCounts.active },
              { label: "on leave", value: onLeaveCount, critical: onLeaveCount > 0 },
              ...(overCap > 0 ? [{ label: `over ${weeklyHoursCap}h week`, value: overCap, critical: true }] : []),
              ...(unverifiable > 0
                ? [{ label: "credentials not verified", value: unverifiable, critical: true }]
                : []),
            ]}
          />
        }
      />

      {/* ── Toolbar: tabs left, search + filters right, never wraps ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <SegmentedTabs
          active={statusFilter}
          onChange={(id) => setStatusFilter(id as any)}
          tabs={[
            { id: "all", label: "All", count: tabCounts.all },
            { id: "active", label: "On duty", count: tabCounts.active },
            { id: "on_leave", label: "On leave", count: tabCounts.on_leave },
            { id: "archived", label: "Archived", count: tabCounts.archived },
          ]}
        />

        <div style={{ position: "relative", width: 220, flexShrink: 0 }}>
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
            placeholder="Search staff…"
            style={{ ...zFieldStyle, width: "100%", padding: "0 12px 0 34px" }}
          />
        </div>

        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          aria-label="Filter by role"
          style={{ ...zSelectStyle, minWidth: 110 }}
        >
          <option value="ALL">All roles</option>
          <option value="MD">Physicians</option>
          <option value="RN">Nurses</option>
          <option value="TECH">Techs</option>
        </select>

        <select
          value={selectedUnit}
          onChange={(e) => setSelectedUnit(e.target.value)}
          aria-label="Filter by unit"
          style={{ ...zSelectStyle, minWidth: 120 }}
        >
          <option value="ALL">All units</option>
          {Array.from(new Set(employees.map((e) => e.unit)))
            .filter(Boolean)
            .map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedUnit("ALL");
              setSelectedRole("ALL");
            }}
            className="zbtn zbtn-text"
            style={{ fontSize: 13 }}
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Table ── */}
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
                <th style={{ textAlign: "left" }}>Name</th>
                <th style={{ textAlign: "left", width: 180 }}>Role</th>
                <th style={{ textAlign: "left", width: 170 }}>Unit</th>
                <th className="num" style={{ width: 120 }}>Hours · this week</th>
                <th className="num" style={{ width: 70 }}>Nights</th>
                <th style={{ textAlign: "right", width: 110 }}>Credentials</th>
                <th style={{ width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="No staff match these filters"
                      hint="Try clearing the search or picking another tab."
                    />
                  </td>
                </tr>
              ) : (
                groupedRows.map(([designation, group]) => [
                  <tr key={`grp-${designation}`}>
                    <td
                      colSpan={7}
                      style={{
                        background: "var(--linen)",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--ink)",
                        height: 36,
                        borderBottom: "1px solid var(--ink-border)",
                      }}
                    >
                      {designation} · {group.length}
                    </td>
                  </tr>,
                  ...group.map((emp) => {
                    const hours = weekHoursOf(emp);
                    const over = hours > weeklyHoursCap;
                    const credState = credentialStateOf(emp);
                    const empAsgs = assignments.filter(
                      (a) => a.employeeId === emp.id && a.status !== "cancelled"
                    );
                    const nights = empAsgs.filter((a) => {
                      const st = shiftTypes.find((s) => s.id === a.shiftTypeId);
                      return st && (st.crossesMidnight || st.shortCode === "N");
                    }).length;
                    return (
                      <tr
                        key={emp.id}
                        onClick={() => {
                          setSelectedEmployeeId(emp.id);
                          setIsDetailOpen(true);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap" }}>
                            <span className="zavatar">{initialsOf(emp.fullName)}</span>
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)", lineHeight: 1.25 }}>
                                {emp.fullName}
                              </div>
                              <div style={{ fontSize: 13, color: "var(--ink-tertiary)", lineHeight: 1.3 }}>
                                {emp.employeeId}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 14, color: "var(--ink)", whiteSpace: "nowrap" }}>
                          {emp.designation}
                        </td>
                        <td style={{ fontSize: 14, color: "var(--ink-secondary)", whiteSpace: "nowrap" }}>
                          {emp.unit}
                        </td>
                        <td
                          className="num"
                          style={{
                            fontSize: 15,
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 500,
                            color: over ? "var(--critical-text)" : "var(--ink)",
                          }}
                          title={over ? `Over ${weeklyHoursCap}h weekly max` : undefined}
                        >
                          {formatHours(hours)}
                        </td>
                        <td className="num" style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-secondary)" }}>
                          {nights}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: "var(--ink)",
                              background: credState === "expiring" ? "var(--apricot)" : "var(--linen)",
                              border: credState === "expiring" ? "none" : "1px solid var(--ink-border-row)",
                              borderRadius: 12,
                              padding: "3px 10px",
                            }}
                          >
                            {CRED_LABEL[credState]}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", color: "var(--ink-tertiary)" }}>
                          <ChevronRight style={{ width: 16, height: 16 }} />
                        </td>
                      </tr>
                    );
                  }),
                ])
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detail drawer ── */}
      {isDetailOpen && selectedEmployee && (
        <Drawer onClose={() => setIsDetailOpen(false)}>{drawerContent()}</Drawer>
      )}

      {/* Add / Edit Clinician Modal (unchanged, restyled buttons) */}
      {(isAddModalOpen || isEditModalOpen) && (
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
            style={{ maxWidth: 500, width: "100%", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                paddingBottom: 12,
                borderBottom: "1px solid var(--ink-border)",
              }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 500, color: "var(--ink)", margin: 0 }}>
                {isAddModalOpen ? "Register new employee" : `Edit profile: ${selectedEmployee?.fullName}`}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ink-secondary)", marginLeft: "auto", display: "flex" }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={isAddModalOpen ? handleCreateClinician : handleUpdateClinician} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <LabeledInput label="Employee ID" value={formData.employeeId} disabled={isEditModalOpen} onChange={(v) => setFormData({ ...formData, employeeId: v })} />
                <LabeledInput label="Full name" value={formData.fullName} onChange={(v) => setFormData({ ...formData, fullName: v })} placeholder="e.g. Dr. John Doe, MD" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <LabeledInput label="Designation" value={formData.designation} onChange={(v) => setFormData({ ...formData, designation: v })} />
                <LabeledInput label="Unit" value={formData.unit} onChange={(v) => setFormData({ ...formData, unit: v })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <LabeledInput label="Phone number" value={formData.phoneNumber} onChange={(v) => setFormData({ ...formData, phoneNumber: v })} />
                <LabeledInput label="Hospital email" type="email" value={formData.email} onChange={(v) => setFormData({ ...formData, email: v })} />
              </div>

              {!isAddModalOpen && (
                <div style={{ padding: "12px", background: "var(--linen)", borderRadius: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 8 }}>
                    Scheduling exceptions (optional)
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <LabeledInput
                      label="Max hours per week (blank = department default)"
                      type="number"
                      value={exceptionFields.maxHoursPerWeek}
                      onChange={(v) => setExceptionFields({ ...exceptionFields, maxHoursPerWeek: v })}
                    />
                    <div>
                      <label style={{ ...labelStyle, display: "block", marginBottom: 4 }}>Night shifts</label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--ink)" }}>
                        <input
                          type="checkbox"
                          checked={exceptionFields.canWorkNights}
                          onChange={(e) => setExceptionFields({ ...exceptionFields, canWorkNights: e.target.checked })}
                          style={{ width: 16, height: 16, accentColor: "var(--ink)" }}
                        />
                        <span>Allowed to work nights</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 10,
                  paddingTop: 14,
                  borderTop: "1px solid var(--ink-border)",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="zbtn zbtn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="zbtn zbtn-primary" style={{ padding: "10px 20px", fontSize: 15 }}>
                  {isAddModalOpen ? "Add employee" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Leave Balance Modal */}
      {isAdjustBalanceOpen && selectedEmployee && (
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
            style={{ maxWidth: 440, width: "100%", padding: 24, display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div style={{ display: "flex", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid var(--ink-border)" }}>
              <h3 style={{ fontSize: 18, fontWeight: 500, color: "var(--ink)", margin: 0 }}>
                Adjust leave balance: {selectedEmployee.fullName}
              </h3>
              <button
                onClick={() => setIsAdjustBalanceOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ink-secondary)", marginLeft: "auto", display: "flex" }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <form onSubmit={handleAdjustBalance} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ ...labelStyle, display: "block", marginBottom: 4 }}>Leave type</label>
                <select value={adjustType} onChange={(e) => setAdjustType(e.target.value)} style={{ ...zSelectStyle, width: "100%" }}>
                  <option value="lt_annual">Annual vacation</option>
                  <option value="lt_sick">Sick leave</option>
                  <option value="lt_cme">CME</option>
                  <option value="lt_casual">Casual day</option>
                </select>
              </div>
              <LabeledInput
                label="Adjustment (days)"
                type="number"
                value={String(adjustAmount)}
                onChange={(v) => setAdjustAmount(parseFloat(v) || 0)}
              />
              <LabeledInput label="Reason" value={adjustReason} onChange={(v) => setAdjustReason(v)} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 14, borderTop: "1px solid var(--ink-border)" }}>
                <button type="button" onClick={() => setIsAdjustBalanceOpen(false)} className="zbtn zbtn-secondary">
                  Cancel
                </button>
                <button type="submit" className="zbtn zbtn-primary" style={{ padding: "10px 20px", fontSize: 15 }}>
                  Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        reportTitle="Clinical Staff Directory & Credential Index"
        reportCode="RPT-01"
      />
      <QuickAssignModal
        isOpen={isQuickAssignOpen}
        onClose={() => setIsQuickAssignOpen(false)}
        employees={employees}
        shiftTypes={shiftTypes}
        preselectedEmployeeId={selectedEmployee?.id}
      />
    </div>
  );

  /* ── Drawer content (declared inside the component to close over state) ── */
  function drawerContent() {
    const hours = weekHoursOf(selectedEmployee);
    const nights = selectedAssignments.filter((a) => {
      const st = shiftTypes.find((s) => s.id === a.shiftTypeId);
      return st && (st.crossesMidnight || st.shortCode === "N");
    }).length;
    const creds = Array.isArray(selectedEmployee.credentials) ? selectedEmployee.credentials : [];

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 16, borderBottom: "1px solid var(--ink-border)", background: "var(--linen)", margin: "-24px -24px 0", padding: 24 }}>
          <span className="zavatar" style={{ width: 44, height: 44, fontSize: 16 }}>
            {initialsOf(selectedEmployee.fullName)}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)" }}>{selectedEmployee.fullName}</div>
            <div style={{ fontSize: 13, color: "var(--ink-secondary)" }}>
              {selectedEmployee.designation} · {selectedEmployee.employeeId}
            </div>
          </div>
          <button
            onClick={() => setIsDetailOpen(false)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-secondary)", display: "flex" }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ padding: "20px 0", display: "flex", flexDirection: "column", gap: 16, flex: 1, overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 24 }}>
            <Stat label="Hours · this week" value={formatHours(hours)} />
            <Stat label="Nights" value={String(nights)} />
            <Stat label="Completed" value={String(selectedAssignments.filter((a) => a.status === "completed").length)} />
          </div>

          <div>
            <div style={{ ...labelStyle, marginBottom: 8 }}>Credentials</div>
            {creds.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--ink-tertiary)" }}>None on record.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {creds.map((c: any, i: number) => (
                  <span key={i} style={{ fontSize: 13, background: "var(--linen)", border: "1px solid var(--ink-border-row)", borderRadius: 10, padding: "5px 10px", color: "var(--ink)" }}>
                    {c.name}
                    {c.expires ? ` · exp ${c.expires}` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ ...labelStyle, marginBottom: 8 }}>Recent shifts</div>
            {selectedAssignments.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--ink-tertiary)" }}>No shifts scheduled this week.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {selectedAssignments.slice(0, 8).map((asg) => {
                  const st = shiftTypes.find((s) => s.id === asg.shiftTypeId);
                  return (
                    <div key={asg.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--linen)", borderRadius: 10, padding: "8px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Clock style={{ width: 14, height: 14, color: "var(--ink-secondary)" }} />
                        <span style={{ fontSize: 13, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{asg.date}</span>
                      </div>
                      <span style={{ fontSize: 13, color: "var(--ink-secondary)", whiteSpace: "nowrap" }}>
                        {st?.name} {st?.startTime}–{st?.endTime}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div style={{ ...labelStyle, marginBottom: 8 }}>Leave requests</div>
            {selectedLeaves.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--ink-tertiary)" }}>No leave requests on file.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {selectedLeaves.map((l) => (
                  <div key={l.id} style={{ background: "var(--linen)", borderRadius: 10, padding: "8px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{l.reason}</span>
                      <span style={{ fontSize: 12, color: "var(--ink-secondary)", textTransform: "capitalize" }}>{l.status}</span>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--ink-secondary)" }}>
                      {l.startDate} – {l.endDate} · {l.durationDays} days
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ ...labelStyle, marginBottom: 8 }}>Contact</div>
            <div style={{ fontSize: 13, color: "var(--ink-secondary)", lineHeight: 1.6 }}>
              {selectedEmployee.phoneNumber}
              <br />
              {selectedEmployee.email}
            </div>
          </div>
        </div>

        {canEditEmployees && (
          <div style={{ display: "flex", gap: 10, paddingTop: 16, borderTop: "1px solid var(--ink-border)" }}>
            <button
              onClick={() => {
                setFormData({
                  employeeId: selectedEmployee.employeeId,
                  fullName: selectedEmployee.fullName,
                  designation: selectedEmployee.designation,
                  unit: selectedEmployee.unit,
                  phoneNumber: selectedEmployee.phoneNumber,
                  email: selectedEmployee.email,
                  dateJoined: selectedEmployee.dateJoined,
                  credentials: "ACLS, TNCC",
                });
                setExceptionFields({
                  maxHoursPerWeek:
                    selectedEmployee.maxHoursPerWeek != null
                      ? String(selectedEmployee.maxHoursPerWeek)
                      : "",
                  canWorkNights: selectedEmployee.canWorkNights !== false,
                });
                setIsEditModalOpen(true);
              }}
              className="zbtn zbtn-secondary"
              style={{ flex: 1, fontSize: 13, padding: "8px 12px" }}
            >
              <Edit style={{ width: 14, height: 14 }} />
              <span>Edit record</span>
            </button>
            {canAssignShifts && (
              <button
                onClick={() => setIsQuickAssignOpen(true)}
                className="zbtn zbtn-secondary"
                style={{ flex: 1, fontSize: 13, padding: "8px 12px" }}
              >
                Manage shifts
              </button>
            )}
            <button
              onClick={handleArchiveToggle}
              className="zbtn zbtn-text"
              style={{
                fontSize: 13,
                color: selectedEmployee.employmentStatus === "archived" ? "var(--ink)" : "var(--critical-text)",
              }}
            >
              <Archive style={{ width: 14, height: 14 }} />
              <span>{selectedEmployee.employmentStatus === "archived" ? "Restore" : "Archive"}</span>
            </button>
            {canDeleteEmployees && (
              <button
                onClick={handleDeleteClinician}
                className="zbtn zbtn-text"
                style={{ fontSize: 13, color: "var(--critical-text)" }}
                title="Permanently delete this employee and all their history — irreversible"
              >
                <Trash2 style={{ width: 14, height: 14 }} />
                <span>Delete permanently</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  function Stat({ label, value }: { label: string; value: string }) {
    return (
      <div>
        <div style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 500, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      </div>
    );
  }
}


const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--ink)",
};

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label style={{ ...labelStyle, display: "block", marginBottom: 4 }}>{label}</label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...zFieldStyle, width: "100%", opacity: disabled ? 0.6 : 1 }}
      />
    </div>
  );
}

function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(18, 23, 24, 0.4)",
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        className="zelt-surface"
        style={{ width: 420, height: "100%", borderRadius: "12px 0 0 12px", padding: 24, overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
