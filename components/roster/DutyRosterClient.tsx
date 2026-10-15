"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  X,
  FileText,
  Table,
  ShieldCheck,
} from "lucide-react";
import { AuthenticatedUser } from "@/lib/auth/session";
import { ConflictCheckerModal } from "@/components/modals/ConflictCheckerModal";
import { ExportModal } from "@/components/modals/ExportModal";
import { WeeklyScheduleView } from "@/components/roster/WeeklyScheduleView";
import { CoverageMatrixView } from "@/components/roster/CoverageMatrixView";
import {
  createShiftAssignmentAction,
  updateShiftAssignmentAction,
  deleteShiftAssignmentAction,
  smartFillRosterAction,
} from "@/lib/actions/shifts";
import {
  getRosterWeek,
  netHoursOf,
  isNightShiftType,
  shiftTintOf,
  shortConflictReason,
  formatHours,
  type RosterWeek,
} from "@/lib/schedule-cycle";

interface DutyRosterClientProps {
  currentUser: AuthenticatedUser;
  employees: Array<any>;
  shiftTypes: Array<any>;
  assignments: Array<any>;
  leaveRecords: Array<any>;
  offDays: Array<any>;
  settings: any;
  week: RosterWeek;
  shiftRequirements: Array<any>;
}

const ZONES = [
  "Red Zone (Resus 1-4 & Trauma Bays)",
  "Yellow Zone (Urgent Acute Assessment)",
  "Green Zone (Fast-Track Ambulatory)",
  "Zone 4: Pediatric ED Wing",
];

function ZAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return <span className="zavatar">{initials}</span>;
}

/* ─── Shared style fragments ─────────────────────────────────────────────── */

const toolbarFieldStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 12,
  background: "var(--linen)",
  border: "1px solid var(--ink-border)",
  fontSize: 13,
  color: "var(--ink)",
  fontFamily: "inherit",
};

const selectStyle: React.CSSProperties = {
  ...toolbarFieldStyle,
  appearance: "none",
  WebkitAppearance: "none",
  padding: "0 32px 0 12px",
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' fill='none' stroke='%23121718' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  cursor: "pointer",
};

/* Tints per shift family — kept in ONE place so legend and cells always match */
const SHIFT_TINTS: Record<string, { bg: string; label: string }> = {
  day: { bg: "var(--linen)", label: "Day shifts" },
  night: { bg: "var(--apricot)", label: "Night shifts" },
  oncall: { bg: "var(--parchment)", label: "On-call / standby" },
};

export function DutyRosterClient({
  currentUser,
  employees,
  shiftTypes,
  assignments: initialAssignments,
  leaveRecords,
  offDays,
  settings,
  week,
  shiftRequirements,
}: DutyRosterClientProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"grid" | "weekly" | "coverage">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [selectedZone, setSelectedZone] = useState("ALL");

  const [assignments, setAssignments] = useState(initialAssignments);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [conflictPopoverFor, setConflictPopoverFor] = useState<string | null>(null);

  // Assignment drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    employee: any;
    date: string;
    dayLabel: string;
    existingAssignment?: any;
  } | null>(null);
  const [drawerShiftTypeId, setDrawerShiftTypeId] = useState(shiftTypes[0]?.id || "");
  const [drawerWardZone, setDrawerWardZone] = useState(ZONES[0]);
  const [drawerHandoverNotes, setDrawerHandoverNotes] = useState("");
  const [isSavingDrawer, setIsSavingDrawer] = useState(false);

  const canAssignShifts = currentUser.permissions.canAssignShifts;
  const canManageShifts = currentUser.permissions.canManageShifts;
  const canExportReports = currentUser.permissions.canExportReports;
  const [isSmartFilling, setIsSmartFilling] = useState(false);
  const [smartFillNotice, setSmartFillNotice] = useState<string | null>(null);

  async function handleSmartFill() {
    setIsSmartFilling(true);
    setSmartFillNotice(null);
    try {
      const res = await smartFillRosterAction({ startDate: week.startDate, endDate: week.endDate });
      const existingIds = new Set(assignments.map((a) => a.id));
      const fresh = (res.assignments || []).filter((a: any) => !existingIds.has(a.id));
      setAssignments((prev) => [...prev, ...fresh]);
      setSmartFillNotice(
        `Smart Fill scheduled ${res.count} shifts${res.skipped ? ` (${res.skipped} slots left open — no eligible staff)` : ""}.`
      );
      router.refresh();
    } catch (err: any) {
      setSmartFillNotice(err.message || "Smart Fill failed.");
    } finally {
      setIsSmartFilling(false);
    }
  }

  /* ─── Derived data: ONE set of calculations feeds header, line, and footer ── */

  const activeShiftTypes = useMemo(
    () => shiftTypes.filter((s) => s.active && !/STANDBY|ON-?CALL/i.test(s.category || "")),
    [shiftTypes]
  );

  // Requirement floor: the department's minimum staffing rule, capped by real headcount
  const requiredPerDay = useMemo(() => {
    const ruleSum = activeShiftTypes.reduce(
      (sum, s) => sum + (s.minimumStaffRn || 0) + (s.minimumStaffMd || 0),
      0
    );
    return Math.min(Math.ceil(ruleSum / 2), employees.length); // day+night coverage halved, ≤ headcount
  }, [activeShiftTypes, employees.length]);

  const weeklyHoursCap = settings?.weeklyHoursCap || 48;
  const budgetHours = employees.length * weeklyHoursCap;

  // Live per-employee, per-day map used by rows AND footer so totals always add up
  const weeklyTotals = useMemo(() => {
    let hours = 0;
    let nights = 0;
    const perDay: Record<string, { scheduled: number; hours: number; conflicts: number }> = {};
    for (const d of week.dates) perDay[d.date] = { scheduled: 0, hours: 0, conflicts: 0 };

    for (const a of assignments) {
      if (a.status === "cancelled") continue;
      const st = shiftTypes.find((s) => s.id === a.shiftTypeId);
      const h = netHoursOf(st);
      hours += h;
      if (st && isNightShiftType(st)) nights += 1;
      if (perDay[a.date]) {
        perDay[a.date].scheduled += 1;
        perDay[a.date].hours += h;
        if (a.conflictFlag) perDay[a.date].conflicts += 1;
      }
    }
    return { hours, nights, perDay };
  }, [assignments, shiftTypes, week.dates]);

  const conflictCount = assignments.filter(
    (a) => a.conflictFlag && a.status !== "cancelled"
  ).length;

  const shortfallHours = Math.max(0, budgetHours - weeklyTotals.hours);

  // Per-shift staffing floor: sum of the per-designation requirement rows when
  // they exist (same rows the coverage matrix and auto-assign fill target),
  // falling back to the legacy minimumStaffRn/Md fields per shift type.
  const requiredPerShiftType = useMemo(() => {
    const map = new Map<string, number>();
    for (const st of activeShiftTypes) {
      const reqs = shiftRequirements.filter((r) => r.shiftTypeId === st.id);
      const total = reqs.length > 0
        ? reqs.reduce((sum, r) => sum + (r.minStaff ?? 0), 0)
        : (st.minimumStaffRn || 0) + (st.minimumStaffMd || 0);
      map.set(st.id, total);
    }
    return map;
  }, [activeShiftTypes, shiftRequirements]);

  /* ─── Filtering + grouping ───────────────────────────────────────────────── */

  const filteredEmployees = useMemo(
    () =>
      employees.filter((emp) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = emp.fullName.toLowerCase().includes(q);
          const matchId = emp.employeeId.toLowerCase().includes(q);
          const matchRole = emp.designation.toLowerCase().includes(q);
          if (!matchName && !matchId && !matchRole) return false;
        }
        if (selectedRole !== "ALL") {
          if (selectedRole === "MD" && !emp.designation.includes("MD") && !emp.designation.includes("Physician") && !emp.designation.includes("Surgeon")) return false;
          if (selectedRole === "RN" && !emp.designation.includes("RN") && !emp.designation.includes("Nurse")) return false;
          if (selectedRole === "TECH" && !emp.designation.includes("Tech") && !emp.designation.includes("Paramedic")) return false;
        }
        if (selectedZone !== "ALL") {
          if (selectedZone === "Red" && !emp.unit.includes("Trauma") && !emp.unit.includes("Resus") && !emp.unit.includes("ICU")) return false;
          if (selectedZone === "Acute" && !emp.unit.includes("Acute") && !emp.unit.includes("ICU")) return false;
          if (selectedZone === "FastTrack" && !emp.unit.includes("FastTrack") && !emp.unit.includes("Triage")) return false;
        }
        return true;
      }),
    [employees, searchQuery, selectedRole, selectedZone]
  );

  const groupedRows = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const emp of filteredEmployees) {
      if (!groups.has(emp.designation)) groups.set(emp.designation, []);
      groups.get(emp.designation)!.push(emp);
    }
    return Array.from(groups.entries());
  }, [filteredEmployees]);

  /* ─── Drawer / cell actions ──────────────────────────────────────────────── */

  function openCellDrawer(emp: any, date: string) {
    if (!canAssignShifts) return;
    const existing = assignments.find(
      (a) => a.employeeId === emp.id && a.date === date && a.status !== "cancelled"
    );
    setSelectedCell({
      employee: emp,
      date,
      dayLabel: `${emp.fullName} · ${date}`,
      existingAssignment: existing,
    });
    setDrawerShiftTypeId(existing?.shiftTypeId || shiftTypes[0]?.id || "");
    setDrawerWardZone(existing?.wardZone || ZONES[0]);
    setDrawerHandoverNotes(existing?.notes || "");
    setIsDrawerOpen(true);
    setConflictPopoverFor(null);
  }

  /** "Swap staff": move the conflicted date onto a free colleague instead. */
  function swapFromConflict(cellEmployee: any, date: string) {
    if (!canAssignShifts) return;
    const busyIds = new Set(
      assignments.filter((a) => a.date === date && a.status !== "cancelled").map((a) => a.employeeId)
    );
    const onLeaveIds = new Set(
      leaveRecords
        .filter((l) => l.status === "approved" && l.startDate <= date && l.endDate >= date)
        .map((l) => l.employeeId)
    );
    const free = employees.find((e) => e.id !== cellEmployee.id && !busyIds.has(e.id) && !onLeaveIds.has(e.id));
    if (!free) {
      setSmartFillNotice("No free colleague on that date — try Smart fill week instead.");
      return;
    }
    openCellDrawer(free, date);
  }

  async function handleSaveDrawer(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCell) return;
    setIsSavingDrawer(true);
    try {
      if (selectedCell.existingAssignment) {
        const updated = await updateShiftAssignmentAction(selectedCell.existingAssignment.id, {
          shiftTypeId: drawerShiftTypeId,
          wardZone: drawerWardZone,
          notes: drawerHandoverNotes,
        });
        setAssignments((prev) =>
          prev.map((a) => (a.id === selectedCell.existingAssignment.id ? { ...a, ...updated.assignment } : a))
        );
      } else {
        const created = await createShiftAssignmentAction({
          employeeId: selectedCell.employee.id,
          shiftTypeId: drawerShiftTypeId,
          date: selectedCell.date,
          wardZone: drawerWardZone,
          notes: drawerHandoverNotes,
          forceOverrideWarnings: true,
        });
        setAssignments((prev) => [...prev, created]);
      }
      setIsDrawerOpen(false);
      router.refresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSavingDrawer(false);
    }
  }

  async function handleRemoveAssignment() {
    if (!selectedCell?.existingAssignment) return;
    setIsSavingDrawer(true);
    try {
      await deleteShiftAssignmentAction(selectedCell.existingAssignment.id);
      setAssignments((prev) => prev.filter((a) => a.id !== selectedCell.existingAssignment.id));
      setIsDrawerOpen(false);
      router.refresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSavingDrawer(false);
    }
  }

  /* ─── Grid config ────────────────────────────────────────────────────────── */

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ── Header: controls sit directly on the parchment canvas ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 500,
                color: "var(--ink)",
                letterSpacing: "-0.38px",
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              Roster
            </h1>
            {conflictCount > 0 && (
              <button
                onClick={() => setIsConflictModalOpen(true)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--critical-text)",
                  padding: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {conflictCount} conflicts · Review
              </button>
            )}
          </div>
          {/* Week: derived from the SAME date source the server page used */}
          <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <button
              aria-label="Previous week"
              style={{
                width: 24,
                height: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--ink-secondary)",
              }}
            >
              <ChevronLeft style={{ width: 15, height: 15 }} />
            </button>
            <span style={{ fontSize: 15, color: "var(--ink-secondary)", fontVariantNumeric: "tabular-nums" }}>
              {week.weekLabel}
            </span>
            <button
              aria-label="Next week"
              style={{
                width: 24,
                height: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--ink-secondary)",
              }}
            >
              <ChevronRight style={{ width: 15, height: 15 }} />
            </button>
            <button
              className="zbtn zbtn-text"
              style={{ fontSize: 12, color: "var(--ink-tertiary)", padding: "0 4px" }}
            >
              Today
            </button>
          </div>
        </div>

        {/* Exactly ONE honey action in the viewport */}
        {canAssignShifts && (
          <button
            onClick={() => openCellDrawer(employees[0], week.dates.find((d) => d.isToday)!.date)}
            className="zbtn zbtn-primary"
          >
            <span>Assign shift</span>
          </button>
        )}
      </div>

      {/* ── Toolbar: one row, never wraps at desktop widths ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {/* View switcher: segmented control, text only */}
        <div
          role="tablist"
          aria-label="Roster view"
          style={{
            display: "inline-flex",
            padding: 3,
            background: "var(--linen)",
            borderRadius: 12,
            border: "1px solid var(--ink-border)",
            flexShrink: 0,
          }}
        >
          {(
            [
              { id: "grid", label: "Grid" },
              { id: "weekly", label: "Weekly" },
              { id: "coverage", label: "Coverage" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={viewMode === id}
              onClick={() => setViewMode(id)}
              style={{
                height: 34,
                padding: "0 16px",
                borderRadius: 9,
                fontSize: 13,
                fontWeight: viewMode === id ? 500 : 400,
                color: "var(--ink)",
                background: viewMode === id ? "var(--paper)" : "transparent",
                border: viewMode === id ? "1px solid var(--ink-border)" : "1px solid transparent",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", width: 250, flexShrink: 0 }}>
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
            style={{ ...toolbarFieldStyle, width: "100%", padding: "0 12px 0 34px" }}
          />
        </div>

        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          aria-label="Filter by role"
          style={{ ...selectStyle, minWidth: 120 }}
        >
          <option value="ALL">All roles</option>
          <option value="MD">Physicians (MD)</option>
          <option value="RN">Nurses (RN)</option>
          <option value="TECH">Techs</option>
        </select>

        <select
          value={selectedZone}
          onChange={(e) => setSelectedZone(e.target.value)}
          aria-label="Filter by unit"
          style={{ ...selectStyle, minWidth: 130 }}
        >
          <option value="ALL">All units</option>
          <option value="Red">Red Zone</option>
          <option value="Acute">Yellow Zone</option>
          <option value="FastTrack">Green Zone</option>
        </select>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          {canManageShifts && (
            <button onClick={handleSmartFill} disabled={isSmartFilling} className="zbtn zbtn-secondary" style={{ opacity: isSmartFilling ? 0.6 : 1 }}>
              <ShieldCheck style={{ width: 14, height: 14 }} />
              <span>{isSmartFilling ? "Smart filling…" : "Smart fill week"}</span>
            </button>
          )}
          {canExportReports && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="zbtn zbtn-secondary">
                <span>Export</span>
              </button>
              {isExportMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 6px)",
                    width: 190,
                    background: "var(--paper)",
                    border: "1px solid var(--ink-border)",
                    borderRadius: 12,
                    padding: 6,
                    zIndex: 40,
                  }}
                >
                  <a
                    href="/api/export?type=roster&format=csv"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      fontSize: 13,
                      color: "var(--ink)",
                      textDecoration: "none",
                      borderRadius: 8,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--linen)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <Table style={{ width: 14, height: 14 }} />
                    <span>Export CSV matrix</span>
                  </a>
                  <button
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      setIsExportModalOpen(true);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      fontSize: 13,
                      color: "var(--ink)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      borderRadius: 8,
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--linen)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <FileText style={{ width: 14, height: 14 }} />
                    <span>Printable audit PDF</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {smartFillNotice && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: 12,
            background: "var(--linen)",
            border: "1px solid var(--ink-border)",
            fontSize: 13,
            color: "var(--ink-secondary)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>{smartFillNotice}</span>
          <button
            onClick={() => setSmartFillNotice(null)}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--ink-tertiary)", fontFamily: "inherit" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Quiet summary line + legend, above the grid ── */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 18, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--ink-secondary)", fontVariantNumeric: "tabular-nums" }}>
          Scheduled{" "}
          <strong style={{ color: "var(--ink)", fontWeight: 500 }}>{formatHours(weeklyTotals.hours)}</strong>
          {" "}of{" "}
          <strong style={{ color: "var(--ink)", fontWeight: 500 }}>{formatHours(budgetHours)}</strong>
          {shortfallHours > 0 && (
            <span style={{ color: "var(--critical-text)", fontWeight: 500 }}> · {formatHours(shortfallHours)} short</span>
          )}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          {Object.entries(SHIFT_TINTS).map(([key, tint]) => (
            <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-tertiary)" }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: tint.bg,
                  border: key === "oncall" ? "1px solid var(--ink-border)" : "1px solid var(--ink-border-row)",
                }}
              />
              {tint.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── View body: Spreadsheet grid / Weekly timetable / Coverage matrix ── */}
      {viewMode === "weekly" ? (
        <WeeklyScheduleView
          week={week}
          employees={employees}
          shiftTypes={activeShiftTypes}
          assignments={assignments}
          leaveRecords={leaveRecords}
          offDays={offDays}
          requiredPerShiftType={requiredPerShiftType}
          canAssignShifts={canAssignShifts}
          onOpenCell={openCellDrawer}
        />
      ) : viewMode === "coverage" ? (
        <CoverageMatrixView
          week={week}
          employees={employees}
          shiftTypes={shiftTypes}
          assignments={assignments}
          leaveRecords={leaveRecords}
          offDays={offDays}
          requirements={shiftRequirements}
          settings={settings}
        />
      ) : (
      <div
        className="ztable-roster-wrap"
        style={{
          background: "var(--paper)",
          border: "1px solid var(--ink-border)",
          borderRadius: 12,
          maxHeight: "calc(100vh - 320px)",
          minHeight: 320,
        }}
      >
        <div style={{ overflow: "auto", maxHeight: "inherit", borderRadius: "inherit" }}>
          <table className="ztable ztable-roster">
            <colgroup>
              <col style={{ width: 220 }} />
              <col style={{ width: 76 }} />
              <col style={{ width: 64 }} />
              {week.dates.map((d) => (
                <col key={d.date} style={{ width: 112, minWidth: 112 }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="staff-cell" style={{ position: "sticky", left: 0, zIndex: 5, background: "var(--paper)", textAlign: "left" }}>
                  Staff member
                </th>
                <th className="num">Hours</th>
                <th className="num">Nights</th>
                {week.dates.map((d) => (
                  <th key={d.date} style={{ textAlign: "center", position: "relative" }}>
                    <span style={{ display: "block", fontSize: 13, color: "var(--ink-tertiary)", whiteSpace: "nowrap" }}>
                      {d.weekday}
                    </span>
                    {d.isToday ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: "var(--ink)",
                          color: "var(--paper)",
                          fontSize: 14,
                          fontWeight: 500,
                          marginTop: 2,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {d.dayNumber}
                      </span>
                    ) : (
                      <span style={{ display: "block", fontSize: 16, fontWeight: 500, color: "var(--ink)", marginTop: 2, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                        {d.dayNumber}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedRows.length === 0 && (
                <tr>
                  <td colSpan={3 + week.dates.length} style={{ textAlign: "center", color: "var(--ink-tertiary)", fontSize: 14 }}>
                    No staff match these filters.
                  </td>
                </tr>
              )}
              {groupedRows.map(([designation, group]) => [
                <tr key={`hdr-${designation}`} className="roster-group-row">
                  <td
                    className="staff-cell"
                    colSpan={3 + week.dates.length}
                    style={{
                      background: "var(--linen)",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--ink)",
                      height: 36,
                      borderBottom: "1px solid var(--ink-border)",
                      position: "sticky",
                      left: 0,
                    }}
                  >
                    {designation} · {group.length}
                  </td>
                </tr>,
                ...group.map((emp) => {
                  const empAssignments = assignments.filter(
                    (a) => a.employeeId === emp.id && a.status !== "cancelled"
                  );
                  const totalHours = empAssignments.reduce((acc, a) => {
                    const st = shiftTypes.find((s) => s.id === a.shiftTypeId);
                    return acc + netHoursOf(st);
                  }, 0);
                  const nightsCount = empAssignments.filter((a) =>
                    isNightShiftType(shiftTypes.find((s) => s.id === a.shiftTypeId))
                  ).length;
                  const overHours = totalHours > weeklyHoursCap;

                  return (
                    <tr key={emp.id}>
                      <td
                        className="staff-cell"
                        style={{ position: "sticky", left: 0, zIndex: 2, background: "var(--paper)" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap" }}>
                          <ZAvatar name={emp.fullName} />
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

                      <td
                        className="num"
                        style={{ fontWeight: 500, color: overHours ? "var(--critical-text)" : "var(--ink)" }}
                        title={overHours ? `Over ${weeklyHoursCap}h weekly max` : undefined}
                      >
                        {totalHours.toFixed(1)}
                      </td>
                      <td className="num" style={{ color: "var(--ink-secondary)" }}>
                        {nightsCount}
                      </td>

                      {week.dates.map((d) => {
                        const asg = assignments.find(
                          (a) => a.employeeId === emp.id && a.date === d.date && a.status !== "cancelled"
                        );
                        const st = asg ? shiftTypes.find((s) => s.id === asg.shiftTypeId) : null;
                        const isOff = offDays.some(
                          (o) => o.employeeId === emp.id && o.date === d.date
                        );
                        const leave = leaveRecords.find(
                          (l) =>
                            l.employeeId === emp.id &&
                            l.status === "approved" &&
                            l.startDate <= d.date &&
                            l.endDate >= d.date
                        );
                        const isConflict = Boolean(asg?.conflictFlag);
                        const todayStyle: React.CSSProperties = d.isToday
                          ? {
                              background: "rgba(246, 243, 239, 0.55)",
                              borderLeft: "1px solid var(--ink-border)",
                              borderRight: "1px solid var(--ink-border)",
                            }
                          : {};

                        // Unit suffix only when it differs from the person's default unit
                        const unitSuffix =
                          asg && asg.wardZone && !emp.unit.includes(asg.wardZone)
                            ? asg.wardZone.split(" ")[0].replace(/Zoo?ne/i, "").trim().slice(0, 10)
                            : "";

                        const ariaLabel = asg
                          ? `${emp.fullName}, ${d.date}: ${isConflict ? shortConflictReason(asg.conflictReason || "") + " — " : ""}${st?.name || "shift"} ${st?.startTime}-${st?.endTime}, ${formatHours(netHoursOf(st))}${unitSuffix ? ", " + asg.wardZone : ""}`
                          : leave || isOff
                          ? `${emp.fullName}, ${d.date}: ${leave ? "On leave" : "Rotational off-day"}`
                          : `${emp.fullName}, ${d.date}: open slot`;

                        return (
                          <td
                            key={d.date}
                            className={d.isToday ? "today-col" : undefined}
                            style={{
                              textAlign: "center",
                              padding: "4px 8px",
                              position: "relative",
                              ...todayStyle,
                            }}
                          >
                            {leave || isOff ? (
                              <button
                                className="cell-btn"
                                aria-label={ariaLabel}
                                onClick={() => openCellDrawer(emp, d.date)}
                                style={{
                                  width: "100%",
                                  height: 48,
                                  background: "transparent",
                                  border: "none",
                                  cursor: canAssignShifts ? "pointer" : "default",
                                  fontFamily: "inherit",
                                  fontSize: 13,
                                  color: "var(--ink-tertiary)",
                                }}
                              >
                                {leave ? "Leave" : "Off"}
                              </button>
                            ) : asg && st ? (
                              <button
                                className="cell-btn"
                                aria-label={ariaLabel}
                                onClick={() =>
                                  isConflict && canAssignShifts
                                    ? setConflictPopoverFor(conflictPopoverFor === asg.id ? null : asg.id)
                                    : openCellDrawer(emp, d.date)
                                }
                                style={{
                                  width: "100%",
                                  height: 48,
                                  borderRadius: 8,
                                  background: isConflict ? "var(--critical-bg)" : SHIFT_TINTS[shiftTintOf(st)]?.bg || "var(--linen)",
                                  border: "none",
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                  padding: "0 10px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 6,
                                  whiteSpace: "nowrap",
                                  color: isConflict ? "var(--critical-text)" : "var(--ink)",
                                }}
                                title={
                                  isConflict
                                    ? (asg.conflictReason || "Rule conflict")
                                    : `${st.name} · ${st.startTime}–${st.endTime} · ${formatHours(netHoursOf(st))} · ${asg.wardZone || emp.unit}`
                                }
                              >
                                {isConflict ? (
                                  <span style={{ fontSize: 13, fontWeight: 500 }}>
                                    {shortConflictReason(asg.conflictReason || "")}
                                  </span>
                                ) : (
                                  <>
                                    <span style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
                                      {st.startTime.slice(0, 5)}–{st.endTime.slice(0, 5)}
                                    </span>
                                    {unitSuffix && (
                                      <span style={{ fontSize: 12, color: "var(--ink-secondary)" }}>{unitSuffix}</span>
                                    )}
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                className="cell-btn"
                                aria-label={ariaLabel}
                                onClick={() => openCellDrawer(emp, d.date)}
                                style={{
                                  width: "100%",
                                  height: 48,
                                  borderRadius: 8,
                                  background: "transparent",
                                  border: "none",
                                  cursor: canAssignShifts ? "pointer" : "default",
                                  fontFamily: "inherit",
                                  color: "rgb(18 23 24 / 45%)",
                                  fontSize: 16,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {canAssignShifts && <Plus className="cell-add" style={{ width: 16, height: 16 }} />}
                              </button>
                            )}

                            {/* Conflict popover: rule broken + actions */}
                            {isConflict && conflictPopoverFor === asg.id && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "calc(100% - 4px)",
                                  left: "50%",
                                  transform: "translateX(-50%)",
                                  width: 216,
                                  background: "var(--paper)",
                                  border: "1px solid var(--ink-border)",
                                  borderRadius: 12,
                                  padding: 12,
                                  zIndex: 30,
                                  textAlign: "left",
                                  boxShadow: "none",
                                }}
                              >
                                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--critical-text)", marginBottom: 4 }}>
                                  {shortConflictReason(asg.conflictReason || "")}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--ink-secondary)", lineHeight: 1.45, marginBottom: 8 }}>
                                  {asg.conflictReason || ""} ({emp.fullName}, {d.date})
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button
                                    className="zbtn zbtn-secondary"
                                    style={{ fontSize: 12, padding: "6px 10px", flex: 1 }}
                                    onClick={() => openCellDrawer(emp, d.date)}
                                  >
                                    Reassign
                                  </button>
                                  <button
                                    className="zbtn zbtn-secondary"
                                    style={{ fontSize: 12, padding: "6px 10px", flex: 1 }}
                                    onClick={() => swapFromConflict(emp, d.date)}
                                  >
                                    Swap
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                }),
              ])}
            </tbody>
            <tfoot>
              <tr>
                <td
                  className="staff-cell"
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 3,
                    background: "var(--linen)",
                    borderBottom: "none",
                    fontWeight: 500,
                  }}
                >
                  <div style={{ fontWeight: 500, color: "var(--ink)", lineHeight: 1.25 }}>Coverage</div>
                  <div style={{ fontSize: 12, fontWeight: 400, color: "var(--ink-tertiary)", lineHeight: 1.3 }}>
                    present / required
                  </div>
                </td>
                <td className="num" style={{ background: "var(--linen)", fontWeight: 500, borderBottom: "none" }}>
                  {formatHours(weeklyTotals.hours)}
                </td>
                <td className="num" style={{ background: "var(--linen)", color: "var(--ink-secondary)", borderBottom: "none" }}>
                  {weeklyTotals.nights}
                </td>
                {week.dates.map((d) => {
                  const day = weeklyTotals.perDay[d.date];
                  const short = day.scheduled < requiredPerDay;
                  return (
                    <td
                      key={d.date}
                      style={{
                        background: "var(--linen)",
                        textAlign: "center",
                        borderBottom: "none",
                        whiteSpace: "nowrap",
                        fontVariantNumeric: "tabular-nums",
                        color: short ? "var(--critical-text)" : "var(--ink)",
                        fontWeight: short ? 500 : 400,
                      }}
                      title={`${day.scheduled} scheduled · ${requiredPerDay} required (${employees.length} active staff)`}
                    >
                      {day.scheduled} / {requiredPerDay}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      )}

      {/* ── Slide-Over Assignment Drawer ── */}
      {isDrawerOpen && selectedCell && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(18, 23, 24, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <div
            className="zelt-surface"
            style={{
              width: 380,
              height: "100%",
              borderRadius: "12px 0 0 12px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: 24,
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: 16,
                  borderBottom: "1px solid var(--ink-border)",
                }}
              >
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)" }}>Shift Assignment</h3>
                  <span style={{ fontSize: 13, color: "var(--ink-secondary)" }}>{selectedCell.date}</span>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  style={{
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 12,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--ink)",
                  }}
                >
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>

              <div
                style={{
                  padding: "16px 0",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  borderBottom: "1px solid var(--ink-border)",
                }}
              >
                <ZAvatar name={selectedCell.employee.fullName} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>
                    {selectedCell.employee.fullName}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>
                    {selectedCell.employee.employeeId} · {selectedCell.employee.designation}
                  </div>
                </div>
              </div>

              <form
                onSubmit={handleSaveDrawer}
                style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}
              >
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>
                    Shift Template
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {shiftTypes.slice(0, 4).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setDrawerShiftTypeId(st.id)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: drawerShiftTypeId === st.id ? "var(--paper)" : "var(--linen)",
                          border:
                            drawerShiftTypeId === st.id
                              ? "1px solid var(--ink)"
                              : "1px solid var(--ink-border)",
                          textAlign: "left",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                          fontFamily: "inherit",
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
                          [{st.shortCode}] {st.name}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--ink-secondary)" }}>
                          {st.startTime}–{st.endTime}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>
                    Care Zone
                  </label>
                  <select
                    value={drawerWardZone}
                    onChange={(e) => setDrawerWardZone(e.target.value)}
                    style={{ ...selectStyle, width: "100%" }}
                  >
                    {ZONES.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>
                    Handover Notes
                  </label>
                  <textarea
                    value={drawerHandoverNotes}
                    onChange={(e) => setDrawerHandoverNotes(e.target.value)}
                    rows={3}
                    placeholder="e.g. Lead resuscitation team until 13:00…"
                    style={{ ...toolbarFieldStyle, width: "100%", padding: "10px 12px", resize: "none" }}
                  />
                </div>
              </form>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                paddingTop: 16,
                borderTop: "1px solid var(--ink-border)",
              }}
            >
              <button
                type="button"
                onClick={handleSaveDrawer}
                disabled={isSavingDrawer}
                className="zbtn zbtn-primary"
                style={{ width: "100%" }}
              >
                {isSavingDrawer ? "Saving…" : selectedCell.existingAssignment ? "Update assignment" : "Commit shift slot"}
              </button>
              {selectedCell.existingAssignment && (
                <button
                  type="button"
                  onClick={handleRemoveAssignment}
                  disabled={isSavingDrawer}
                  className="zbtn zbtn-text"
                  style={{ textAlign: "center", color: "var(--critical-text)", padding: 6 }}
                >
                  Delete assignment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <ConflictCheckerModal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
      />
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        employees={employees}
        shiftTypes={shiftTypes}
        assignments={assignments}
        leaveRecords={leaveRecords}
      />
    </div>
  );
}
