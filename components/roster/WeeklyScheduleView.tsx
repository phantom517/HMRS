"use client";

import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/layout/PageHeader";
import {
  isNightShiftType,
  netHoursOf,
  shortConflictReason,
  formatHours,
  type RosterWeek,
} from "@/lib/schedule-cycle";

interface WeeklyScheduleViewProps {
  week: RosterWeek;
  employees: Array<any>;
  shiftTypes: Array<any>;
  assignments: Array<any>;
  leaveRecords: Array<any>;
  offDays: Array<any>;
  /** Per shiftTypeId: total minimum staffing across designation rows. */
  requiredPerShiftType: Map<string, number>;
  canAssignShifts: boolean;
  onOpenCell: (employee: any, date: string) => void;
}

/**
 * WEEKLY timetable: rows = active shift types, columns = the 7 days.
 * Each day cell lists who is working; conflicts flagged inline; open slots
 * reported as quiet "N open" counts from the same staffing minimums the
 * coverage view and the roster footer use.
 */
export function WeeklyScheduleView({
  week,
  employees,
  shiftTypes,
  assignments,
  leaveRecords,
  offDays,
  requiredPerShiftType,
  canAssignShifts,
  onOpenCell,
}: WeeklyScheduleViewProps) {
  const activeShifts = shiftTypes.filter(
    (s) => s.active && !/off.?day|not.?working|rest day/i.test(s.name || "")
  )
    .slice()
    .sort((a, b) => (a.startTime > b.startTime ? 1 : -1));

  const empById = new Map(employees.map((e) => [e.id, e]));

  if (activeShifts.length === 0) {
    return (
      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--ink-border)",
          borderRadius: 12,
        }}
      >
        <EmptyState
          title="No shift types"
          hint="Add shift types first — they define the rows of the weekly schedule."
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
            <col style={{ width: 240 }} />
            {week.dates.map((d) => (
              <col key={d.date} style={{ width: 120, minWidth: 120 }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign: "left", position: "sticky", left: 0, zIndex: 2, background: "var(--paper)" }}>
                Shift
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
            </tr>
          </thead>
          <tbody>
            {activeShifts.map((st) => {
              const required = requiredPerShiftType.get(st.id) || 0;
              const tintBg =
                isNightShiftType(st) ? "var(--apricot)" : /STANDBY|ON-?CALL/i.test(st.category || "") ? "var(--parchment)" : "var(--linen)";
              return [
                <tr key={`weekly-row-${st.id}`}>
                  {/* Shift column (sticky) */}
                  <td
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 1,
                      background: "var(--paper)",
                      borderBottom: "1px solid var(--ink-border-row)",
                      verticalAlign: "top",
                      paddingTop: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          background: tintBg,
                          border: "1px solid var(--ink-border-row)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 500,
                          color: "var(--ink)",
                          flexShrink: 0,
                        }}
                      >
                        {st.shortCode}
                      </span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)", lineHeight: 1.25 }}>
                          {st.name}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--ink-tertiary)", lineHeight: 1.3, fontVariantNumeric: "tabular-nums" }}>
                          {st.startTime}–{st.endTime} · {formatHours(netHoursOf(st))}{required > 0 ? ` · needs ${required}` : ""}
                        </div>
                      </div>
                    </div>
                  </td>

                  {week.dates.map((d) => {
                    const dayAsgs = assignments.filter(
                      (a) => a.date === d.date && a.shiftTypeId === st.id && a.status !== "cancelled"
                    );
                    const open = Math.max(0, required - dayAsgs.length);
                    const tint: React.CSSProperties = d.isToday
                      ? { background: "rgba(246, 243, 239, 0.55)", borderLeft: "1px solid var(--ink-border)", borderRight: "1px solid var(--ink-border)" }
                      : {};
                    return (
                      <td key={d.date} style={{ verticalAlign: "top", padding: "6px 8px", ...tint }}>
                        {dayAsgs.length === 0 && open === 0 && (
                          <span style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>—</span>
                        )}
                        {dayAsgs.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {dayAsgs.map((a) => {
                              const emp = empById.get(a.employeeId);
                              const isConflict = Boolean(a.conflictFlag);
                              return (
                                <button
                                  key={a.id}
                                  onClick={() => emp && onOpenCell(emp, d.date)}
                                  disabled={!canAssignShifts}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: canAssignShifts ? "pointer" : "default",
                                    fontFamily: "inherit",
                                    textAlign: "left",
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: isConflict ? "var(--critical-text)" : "var(--ink)",
                                    padding: "3px 6px",
                                    borderRadius: 8,
                                    whiteSpace: "nowrap",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                  title={
                                    isConflict
                                      ? a.conflictReason || "Conflict"
                                      : `${emp?.fullName || ""} · ${st.name} · ${st.startTime}–${st.endTime}`
                                  }
                                >
                                  {isConflict && (
                                    <AlertTriangle style={{ width: 12, height: 12, flexShrink: 0 }} />
                                  )}
                                  <span className="truncate" style={{ maxWidth: 96 }}>
                                    {emp?.fullName || "Unknown"}
                                  </span>
                                  {isConflict && (
                                    <span style={{ fontWeight: 400, fontSize: 11 }}>
                                      {shortConflictReason(a.conflictReason || "")}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {open > 0 ? (
                          <div
                            style={{
                              marginTop: 2,
                              fontSize: 12,
                              color: "var(--ink-tertiary)",
                              fontVariantNumeric: "tabular-nums",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {open} open
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
