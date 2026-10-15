"use client";

import { useMemo } from "react";
import { EmptyState } from "@/components/layout/PageHeader";
import { coverage, requirementsForShiftType } from "@/lib/scheduling/rules";
import type {
  AssignmentRecord,
  EmployeeRecord,
  LeaveRecord,
  OffDayRecord,
  ShiftRequirement,
  ShiftTypeRecord,
  SchedulingContext,
} from "@/lib/scheduling/types";
import type { RosterWeek } from "@/lib/schedule-cycle";

interface CoverageMatrixViewProps {
  week: RosterWeek;
  employees: Array<any>;
  shiftTypes: Array<any>;
  assignments: Array<any>;
  leaveRecords: Array<any>;
  offDays: Array<any>;
  requirements: Array<any>;
  settings: any;
}

interface EngineShiftType extends Omit<ShiftTypeRecord, "netDurationHours"> {}

const DESIGNATION_ORDER = ["RN", "MD", "Tech", "any"];

/**
 * COVERAGE matrix: for every date × shift type × designation row it shows
 * "assigned / required" straight from the engine's coverage() — the same
 * numbers the roster footer and auto-assign fill targets use. Red appears
 * only where a slot is genuinely short.
 */
export function CoverageMatrixView({
  week,
  employees,
  shiftTypes,
  assignments,
  leaveRecords,
  offDays,
  requirements,
  settings,
}: CoverageMatrixViewProps) {
  // Build the pure engine context from the week-scoped props.
  const ctx: SchedulingContext = useMemo(() => {
    const engineShiftTypes: ShiftTypeRecord[] = shiftTypes.map((s) => ({
      id: s.id,
      name: s.name,
      shortCode: s.shortCode,
      startTime: s.startTime,
      endTime: s.endTime,
      breakDurationMinutes: s.breakDurationMinutes || 0,
      crossesMidnight: Boolean(s.crossesMidnight),
      isNight: Boolean(s.isNight) || Boolean(s.crossesMidnight) || /NIGHT|OVERNIGHT|\+1 DAY/i.test(s.category || ""),
      category: s.category || "REGULAR",
      active: s.active !== false,
      minimumStaffRn: s.minimumStaffRn || 0,
      minimumStaffMd: s.minimumStaffMd || 0,
      targetStaff: s.targetStaff || 0,
      maximumStaff: s.maximumStaff ?? null,
    }));
    const engineEmployees: EmployeeRecord[] = employees.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      designation: e.designation,
      employmentStatus: e.employmentStatus,
      active: e.active !== false && e.employmentStatus !== "archived",
      maxHoursPerWeek: typeof e.maxHoursPerWeek === "number" && e.maxHoursPerWeek > 0 ? e.maxHoursPerWeek : null,
      canWorkNights: e.canWorkNights !== false,
    }));
    const engineAssignments: AssignmentRecord[] = assignments.map((a) => ({
      id: a.id,
      employeeId: a.employeeId,
      shiftTypeId: a.shiftTypeId,
      date: a.date,
      startAt: a.startAt instanceof Date ? a.startAt.toISOString() : String(a.startAt),
      endAt: a.endAt instanceof Date ? a.endAt.toISOString() : String(a.endAt),
      breakDurationMinutes: a.scheduledBreakMinutes ?? 0,
      status: a.status,
    }));
    const engineLeaves: LeaveRecord[] = leaveRecords.map((l) => ({
      id: l.id,
      employeeId: l.employeeId,
      status: l.status,
      startDate: l.startDate,
      endDate: l.endDate,
    }));
    const engineOffDays: OffDayRecord[] = offDays.map((o) => ({ id: o.id, employeeId: o.employeeId, date: o.date }));
    const engineRequirements: ShiftRequirement[] = (requirements || []).map((r) => ({
      shiftTypeId: r.shiftTypeId,
      designation: r.designation || "any",
      minStaff: r.minStaff ?? 0,
      maxStaff: r.maxStaff ?? null,
    }));

    return {
      rules: {
        timezone: settings?.timezone || "America/Chicago",
        weekStartDay: settings?.weekStartDay ?? 1,
        minRestHours: settings?.minRestHoursBetweenShifts || 11,
        maxConsecutiveDays: settings?.consecutiveShiftsCap || 5,
        maxWeeklyHours: settings?.weeklyHoursCap || 48,
        maxWeeklyHoursSeverity: settings?.maxWeeklyHoursSeverity || "warn",
        maxNightsPerMonth: settings?.maxNightsPerMonth || 7,
        maxNightsSeverity: settings?.maxNightsSeverity || "warn",
        enforceRestInterval: settings?.enforceRestInterval ?? true,
        pendingLeaveAction: settings?.pendingLeaveAction || "warn",
      },
      employees: engineEmployees,
      shiftTypes: engineShiftTypes,
      requirements: engineRequirements,
      assignments: engineAssignments,
      leaves: engineLeaves,
      offDays: engineOffDays,
    };
  }, [employees, shiftTypes, assignments, leaveRecords, offDays, requirements, settings]);

  const cells = useMemo(
    () => coverage(ctx, { from: week.startDate, to: week.endDate }),
    [ctx, week.startDate, week.endDate]
  );

  // Group cells: shiftType → designation rows (skip rows without any requirement)
  const rowsByShift = useMemo(() => {
    const map = new Map<string, Array<{ designation: string; perDay: Map<string, { assigned: number; required: number; short: number }>; weekAssigned: number; weekRequired: number }>>();
    const order: string[] = [];
    for (const st of ctx.shiftTypes.filter((s) => s.active)) {
      const reqs = requirementsForShiftType(ctx, st.id);
      const usable = reqs.filter((r) => r.minStaff > 0 || (r.maxStaff != null && r.maxStaff > 0));
      if (usable.length === 0) continue;
      order.push(st.id);
      const rows = usable
        .map((r) => {
          const perDay = new Map<string, { assigned: number; required: number; short: number }>();
          for (const d of week.dates) {
            const cell = cells.find((c) => c.date === d.date && c.shiftTypeId === st.id && c.designation === r.designation);
            perDay.set(d.date, {
              assigned: cell?.assigned ?? 0,
              required: cell?.required ?? r.minStaff,
              short: cell?.short ?? 0,
            });
          }
          const weekAssigned = Array.from(perDay.values()).reduce((s, v) => s + v.assigned, 0);
          const weekRequired = Array.from(perDay.values()).reduce((s, v) => s + v.required, 0);
          const designationRow =
            DESIGNATION_ORDER.indexOf(r.designation) >= 0 ? DESIGNATION_ORDER.indexOf(r.designation) : 99;
          return { designation: r.designation, perDay, weekAssigned, weekRequired, designationRow, __r: r };
        })
        .sort((a, b) => a.designationRow - b.designationRow);
      map.set(st.id, rows);
    }
    void order;
    return map;
  }, [ctx, cells, week.dates]);

  const activeWithRows = ctx.shiftTypes.filter((s) => s.active && rowsByShift.has(s.id));

  if (activeWithRows.length === 0) {
    return (
      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--ink-border)",
          borderRadius: 12,
        }}
      >
        <EmptyState
          title="No coverage requirements"
          hint="Set minimum staffing on the Shift types page — the matrix fills in from those rules."
        />
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--ink-border)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table className="ztable ztable-roster" style={{ minWidth: 1080 }}>
          <colgroup>
            <col style={{ width: 230 }} />
            {week.dates.map((d) => (
              <col key={d.date} style={{ width: 112, minWidth: 112 }} />
            ))}
            <col style={{ width: 110 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign: "left", position: "sticky", left: 0, zIndex: 2, background: "var(--paper)" }}>
                Coverage
              </th>
              {week.dates.map((d) => (
                <th key={d.date} style={{ textAlign: "center" }}>
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
                    <span
                      style={{
                        display: "block",
                        fontSize: 16,
                        fontWeight: 500,
                        color: "var(--ink)",
                        marginTop: 2,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {d.dayNumber}
                    </span>
                  )}
                </th>
              ))}
              <th className="num">Week</th>
            </tr>
          </thead>
          <tbody>
            {activeWithRows.flatMap((st) => [
              <tr key={`grp-${st.id}`}>
                <td
                  colSpan={2 + week.dates.length}
                  style={{
                    background: "var(--linen)",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--ink)",
                    height: 36,
                    borderBottom: "1px solid var(--ink-border)",
                    whiteSpace: "nowrap",
                    position: "sticky",
                    left: 0,
                  }}
                >
                  {st.name} · {st.startTime}–{st.endTime}
                </td>
              </tr>,
              ...(rowsByShift.get(st.id) || []).map((row) => (
                <tr key={`${st.id}-${row.designation}`}>
                  <td
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 1,
                      background: "var(--paper)",
                      borderBottom: "1px solid var(--ink-border-row)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ fontSize: 13, color: "var(--ink-secondary)", paddingLeft: 12 }}>
                      {row.designation === "any" ? "Any role" : row.designation}
                    </span>
                  </td>

                  {week.dates.map((d) => {
                    const cell = row.perDay.get(d.date)!;
                    const short = cell.short > 0;
                    const tint: React.CSSProperties = d.isToday
                      ? { background: "rgba(246, 243, 239, 0.55)", borderLeft: "1px solid var(--ink-border)", borderRight: "1px solid var(--ink-border)" }
                      : {};
                    return (
                      <td
                        key={d.date}
                        className="num"
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                          color: short ? "var(--critical-text)" : "var(--ink)",
                          fontWeight: short ? 500 : 400,
                          ...tint,
                        }}
                      >
                        {cell.assigned} / {cell.required}
                      </td>
                    );
                  })}

                  <td
                    className="num"
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      color: row.weekAssigned < row.weekRequired ? "var(--critical-text)" : "var(--ink-secondary)",
                      fontWeight: row.weekAssigned < row.weekRequired ? 500 : 400,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.weekAssigned} / {row.weekRequired}
                  </td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// EngineShiftType is structurally identical to ShiftTypeRecord (no netDurationHours field exists there);
// kept as a local alias for clarity.
export type { EngineShiftType };
