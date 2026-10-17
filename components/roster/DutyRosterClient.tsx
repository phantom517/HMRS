"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthenticatedUser } from "@/lib/auth/session";
import { ConflictCheckerModal } from "@/components/modals/ConflictCheckerModal";
import { ExportModal } from "@/components/modals/ExportModal";
import { WeeklyScheduleView } from "@/components/roster/WeeklyScheduleView";
import { CoverageMatrixView } from "@/components/roster/CoverageMatrixView";
import { RosterHeader } from "@/components/roster/RosterHeader";
import { LiveAlertBanner, type LiveAlertToast } from "@/components/roster/LiveAlertBanner";
import { RosterToolbar, type RosterViewMode } from "@/components/roster/RosterToolbar";
import { RosterSummaryLine } from "@/components/roster/RosterSummaryLine";
import { RosterGridTable } from "@/components/roster/RosterGridTable";
import {
  AssignmentDrawer,
  type SelectedCell,
} from "@/components/roster/AssignmentDrawer";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  createShiftAssignmentAction,
  updateShiftAssignmentAction,
  deleteShiftAssignmentAction,
  smartFillRosterAction,
} from "@/lib/actions/shifts";
import {
  netHoursOf,
  isNightShiftType,
  type RosterWeek,
} from "@/lib/schedule-cycle";
import {
  computeLiveGuardrailAudit,
  evaluateEmployeeViolations,
} from "@/components/roster/rosterGuardrails";
import {
  filterRosterEmployees,
  groupByDesignation,
  ROSTER_ZONES,
} from "@/components/roster/rosterFilters";

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

const AUTO_DISMISS_MS = 6000;

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
  const [viewMode, setViewMode] = useState<RosterViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [selectedZone, setSelectedZone] = useState("ALL");

  const [assignments, setAssignments] = useState(initialAssignments);
  const [selectedDayMobile, setSelectedDayMobile] = useState<string>("all");
  const [liveAlertToast, setLiveAlertToast] = useState<LiveAlertToast | null>(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [conflictPopoverFor, setConflictPopoverFor] = useState<string | null>(null);

  // Assignment drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [drawerShiftTypeId, setDrawerShiftTypeId] = useState(shiftTypes[0]?.id || "");
  const [drawerWardZone, setDrawerWardZone] = useState(ROSTER_ZONES[0]);
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
      const nextAsgs = [...assignments, ...fresh];
      setAssignments(nextAsgs);
      const noticeMsg = `Smart Fill scheduled ${res.count} shifts${res.skipped ? ` (${res.skipped} slots left open — no eligible staff)` : ""}.`;
      setSmartFillNotice(noticeMsg);
      const alertMsg = `Roster auto-filled (${res.count} shifts). Automated guardrails audited across the department.`;
      setLiveAlertToast({ message: alertMsg, type: "success" });
      setTimeout(() => setLiveAlertToast(null), AUTO_DISMISS_MS);
      router.refresh();
    } catch (err: any) {
      setSmartFillNotice(err.message || "Smart Fill failed.");
      setLiveAlertToast({
        message: err.message || "Smart Fill failed.",
        type: "critical",
      });
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

  // ─── Automated Real-time Guardrail Audit (Fatigue + Unfilled Shifts) ───────────
  const liveGuardrailAudit = useMemo(
    () =>
      computeLiveGuardrailAudit({
        employees,
        assignments,
        shiftTypes,
        activeShiftTypes,
        week,
        settings,
        weeklyHoursCap,
      }),
    [employees, assignments, shiftTypes, activeShiftTypes, week, settings, weeklyHoursCap]
  );

  // Mobile-responsive visible dates (either all 7 days or single day on small screens)
  const visibleDates = useMemo(() => {
    if (selectedDayMobile === "all") return week.dates;
    const match = week.dates.filter((d) => d.date === selectedDayMobile);
    return match.length > 0 ? match : week.dates;
  }, [selectedDayMobile, week.dates]);

  /* ─── Filtering + grouping ───────────────────────────────────────────────── */

  const filteredEmployees = useMemo(
    () => filterRosterEmployees(employees, searchQuery, selectedRole, selectedZone),
    [employees, searchQuery, selectedRole, selectedZone]
  );

  const groupedRows = useMemo(() => groupByDesignation(filteredEmployees), [filteredEmployees]);

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
    setDrawerWardZone(existing?.wardZone || ROSTER_ZONES[0]);
    setDrawerHandoverNotes(existing?.notes || "");
    setIsDrawerOpen(true);
    setConflictPopoverFor(null);
  }

  /** Open drawer from automated guardrail badge alert item */
  function handleOpenDrawerFromAlert(empOrUndefined: any, date: string, shiftTypeId?: string) {
    if (!canAssignShifts) return;
    let targetEmp = empOrUndefined;
    if (empOrUndefined && empOrUndefined.id) {
      targetEmp = employees.find((e) => e.id === empOrUndefined.id) || empOrUndefined;
    } else {
      // Find an active employee not busy on that date, or fallback to first employee
      const busyIds = new Set(
        assignments.filter((a) => a.date === date && a.status !== "cancelled").map((a) => a.employeeId)
      );
      targetEmp = employees.find((e) => !busyIds.has(e.id)) || employees[0];
    }
    if (targetEmp) {
      openCellDrawer(targetEmp, date);
      if (shiftTypeId) {
        setDrawerShiftTypeId(shiftTypeId);
      }
    }
  }

  /** Automated real-time guardrail alert fired immediately when roster updates */
  function triggerGuardrailNotification(
    updatedAssignments: any[],
    actionDesc: string,
    targetEmployeeId?: string
  ) {
    const emp = targetEmployeeId
      ? employees.find((e) => e.id === targetEmployeeId)
      : null;
    const violation = emp
      ? evaluateEmployeeViolations(emp, updatedAssignments, shiftTypes, settings, weeklyHoursCap)
      : null;

    if (violation) {
      setLiveAlertToast({
        message: `${actionDesc} · ⚠️ Guardrail Alert: ${violation.detail}`,
        type: violation.type,
      });
    } else {
      setLiveAlertToast({
        message: `${actionDesc} · ✅ Automated guardrails verified compliant.`,
        type: "success",
      });
    }

    setTimeout(() => {
      setLiveAlertToast(null);
    }, AUTO_DISMISS_MS);
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

  async function handleSaveDrawer() {
    if (!selectedCell) return;
    setIsSavingDrawer(true);
    try {
      let updatedAssignments = [...assignments];
      let actionLabel = "";
      if (selectedCell.existingAssignment) {
        const updated = await updateShiftAssignmentAction(selectedCell.existingAssignment.id, {
          shiftTypeId: drawerShiftTypeId,
          wardZone: drawerWardZone,
          notes: drawerHandoverNotes,
        });
        updatedAssignments = assignments.map((a) =>
          a.id === selectedCell.existingAssignment.id ? { ...a, ...updated.assignment } : a
        );
        actionLabel = `Updated shift for ${selectedCell.employee.fullName}`;
      } else {
        const created = await createShiftAssignmentAction({
          employeeId: selectedCell.employee.id,
          shiftTypeId: drawerShiftTypeId,
          date: selectedCell.date,
          wardZone: drawerWardZone,
          notes: drawerHandoverNotes,
          forceOverrideWarnings: true,
        });
        updatedAssignments = [...assignments, created];
        actionLabel = `Assigned shift to ${selectedCell.employee.fullName}`;
      }
      setAssignments(updatedAssignments);
      setIsDrawerOpen(false);

      // Trigger immediate automated guardrail alert
      triggerGuardrailNotification(updatedAssignments, actionLabel, selectedCell.employee.id);
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
      const updatedAssignments = assignments.filter((a) => a.id !== selectedCell.existingAssignment.id);
      setAssignments(updatedAssignments);
      setIsDrawerOpen(false);

      // Trigger immediate automated guardrail alert
      triggerGuardrailNotification(
        updatedAssignments,
        `Removed shift assignment for ${selectedCell.employee.fullName}`,
        selectedCell.employee.id
      );
      router.refresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSavingDrawer(false);
    }
  }

  /* ─── Composition ────────────────────────────────────────────────────────── */

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <RosterHeader
        week={week}
        conflictCount={conflictCount}
        onOpenConflicts={() => setIsConflictModalOpen(true)}
        fatigueAlerts={liveGuardrailAudit.fatigueAlerts}
        unfilledAlerts={liveGuardrailAudit.unfilledAlerts}
        onOpenDrawerFromAlert={handleOpenDrawerFromAlert}
        onSmartFill={handleSmartFill}
        isSmartFilling={isSmartFilling}
        canAssignShifts={canAssignShifts}
        onAssignShift={() => {
          const todayDate = week.dates.find((d) => d.isToday)?.date || week.startDate;
          openCellDrawer(employees[0], todayDate);
        }}
      />

      {/* ── Real-Time Automated Guardrail Alert Banner ── */}
      {liveAlertToast && (
        <LiveAlertBanner
          alert={liveAlertToast}
          totalAlerts={liveGuardrailAudit.totalAlerts}
          onDismiss={() => setLiveAlertToast(null)}
          onOpenAudit={() => {
            const btn = document.querySelector(".roster-guardrail-badge-btn") as HTMLButtonElement | null;
            btn?.click();
          }}
        />
      )}

      <RosterToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        selectedRole={selectedRole}
        onRoleChange={setSelectedRole}
        selectedZone={selectedZone}
        onZoneChange={setSelectedZone}
        canManageShifts={canManageShifts}
        onSmartFill={handleSmartFill}
        isSmartFilling={isSmartFilling}
        canExportReports={canExportReports}
        onOpenExportModal={() => setIsExportModalOpen(true)}
      />

      {smartFillNotice && (
        <Alert>
          <AlertDescription>{smartFillNotice}</AlertDescription>
          <AlertAction className="top-1.5 right-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setSmartFillNotice(null)}
            >
              Dismiss
            </Button>
          </AlertAction>
        </Alert>
      )}

      <RosterSummaryLine
        scheduledHours={weeklyTotals.hours}
        budgetHours={budgetHours}
        shortfallHours={shortfallHours}
      />

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
        <RosterGridTable
          week={week}
          visibleDates={visibleDates}
          selectedDayMobile={selectedDayMobile}
          onSelectDayMobile={setSelectedDayMobile}
          groupedRows={groupedRows}
          assignments={assignments}
          shiftTypes={shiftTypes}
          offDays={offDays}
          leaveRecords={leaveRecords}
          weeklyHoursCap={weeklyHoursCap}
          canAssignShifts={canAssignShifts}
          conflictPopoverFor={conflictPopoverFor}
          onToggleConflictPopover={(assignmentId) =>
            setConflictPopoverFor(conflictPopoverFor === assignmentId ? null : assignmentId)
          }
          onOpenCell={openCellDrawer}
          onSwapFromConflict={swapFromConflict}
          weeklyTotals={weeklyTotals}
          requiredPerDay={requiredPerDay}
          employeesCount={employees.length}
        />
      )}

      {/* ── Slide-Over Assignment Drawer (Responsive Bottom-Sheet on mobile) ── */}
      {selectedCell && (
        <AssignmentDrawer
          open={isDrawerOpen}
          selectedCell={selectedCell}
          shiftTypes={shiftTypes}
          shiftTypeId={drawerShiftTypeId}
          onShiftTypeIdChange={setDrawerShiftTypeId}
          wardZone={drawerWardZone}
          onWardZoneChange={setDrawerWardZone}
          handoverNotes={drawerHandoverNotes}
          onHandoverNotesChange={setDrawerHandoverNotes}
          isSaving={isSavingDrawer}
          onClose={() => setIsDrawerOpen(false)}
          onSave={handleSaveDrawer}
          onRemove={handleRemoveAssignment}
        />
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
