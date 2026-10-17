import { netHoursOf, isNightShiftType } from "@/lib/schedule-cycle";
import type { FatigueAlert, UnfilledAlert } from "@/components/roster/RosterGuardrailBadge";

/* Pure guardrail computations shared by the live audit badge and the
   real-time toast fired after each assignment change. */

export interface GuardrailAuditInput {
  employees: Array<any>;
  assignments: Array<any>;
  shiftTypes: Array<any>;
  activeShiftTypes: Array<any>;
  week: { startDate: string; dates: Array<{ date: string; weekday: string }>; [k: string]: any };
  settings: any;
  weeklyHoursCap: number;
}

export interface GuardrailViolation {
  detail: string;
  type: "critical" | "warning";
}

/** Sum of scheduled hours (net, cancelled excluded) for an employee's assignments. */
function totalHoursOf(empAssignments: Array<any>, shiftTypes: Array<any>): number {
  return empAssignments.reduce((sum, a) => {
    const st = shiftTypes.find((s) => s.id === a.shiftTypeId);
    return sum + netHoursOf(st);
  }, 0);
}

function restHoursBetween(
  prev: any,
  next: any,
  shiftTypes: Array<any>
): number | null {
  const stCurr = shiftTypes.find((s) => s.id === prev.shiftTypeId);
  const stNext = shiftTypes.find((s) => s.id === next.shiftTypeId);
  if (!stCurr || !stNext) return null;

  const endCurr = new Date(`${prev.date}T${stCurr.endTime}:00`);
  if (stCurr.crossesMidnight || isNightShiftType(stCurr)) {
    endCurr.setDate(endCurr.getDate() + 1);
  }
  const startNext = new Date(`${next.date}T${stNext.startTime}:00`);
  return (startNext.getTime() - endCurr.getTime()) / (1000 * 60 * 60);
}

function consecutiveStreak(empAssignments: Array<any>): number {
  let streak = 1;
  for (let i = 0; i < empAssignments.length - 1; i++) {
    const d1 = new Date(empAssignments[i].date);
    const d2 = new Date(empAssignments[i + 1].date);
    const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streak++;
    } else {
      streak = 1;
    }
  }
  return streak;
}

export function sortAssignmentsByDate(assignments: Array<any>): Array<any> {
  return [...assignments].sort((a, b) => a.date.localeCompare(b.date));
}

/** Full audit: every fatigue + unfilled-shifts alert across the roster week. */
export function computeLiveGuardrailAudit({
  employees,
  assignments,
  shiftTypes,
  activeShiftTypes,
  week,
  settings,
  weeklyHoursCap,
}: GuardrailAuditInput): {
  fatigueAlerts: FatigueAlert[];
  unfilledAlerts: UnfilledAlert[];
  totalAlerts: number;
} {
  const fatigueAlerts: FatigueAlert[] = [];
  const unfilledAlerts: UnfilledAlert[] = [];

  // 1. Fatigue Violations Scan
  for (const emp of employees) {
    const empAsgs = sortAssignmentsByDate(
      assignments.filter((a) => a.employeeId === emp.id && a.status !== "cancelled")
    );

    // A) Weekly hours cap
    const totalWeeklyHours = totalHoursOf(empAsgs, shiftTypes);
    const cap = emp.maxHoursPerWeek ?? weeklyHoursCap;
    if (totalWeeklyHours > cap) {
      fatigueAlerts.push({
        id: `hours-${emp.id}`,
        employeeId: emp.id,
        employeeName: emp.fullName,
        employeeRole: emp.designation,
        date: week.startDate,
        shiftTypeId: "",
        shiftName: "Weekly Cap",
        type: "weekly_hours",
        severity: "critical",
        title: "Weekly Hours Limit Exceeded",
        description: `${emp.fullName} is scheduled for ${totalWeeklyHours.toFixed(1)}h this week (Guardrail limit: ${cap}h). Potential clinical burnout risk.`,
      });
    }

    // B) Rest interval (<N hours rest between consecutive shifts)
    for (let i = 0; i < empAsgs.length - 1; i++) {
      const curr = empAsgs[i];
      const next = empAsgs[i + 1];
      const stNext = shiftTypes.find((s) => s.id === next.shiftTypeId);
      if (!stNext) continue;

      const restHours = restHoursBetween(curr, next, shiftTypes);
      if (restHours === null) continue;

      const minRest = settings?.minRestHoursBetweenShifts ?? 11;
      if (restHours >= 0 && restHours < minRest) {
        const stCurr = shiftTypes.find((s) => s.id === curr.shiftTypeId)!;
        fatigueAlerts.push({
          id: `rest-${curr.id}-${next.id}`,
          employeeId: emp.id,
          employeeName: emp.fullName,
          employeeRole: emp.designation,
          date: next.date,
          shiftTypeId: next.shiftTypeId,
          shiftName: stNext.name,
          type: "rest_interval",
          severity: "critical",
          title: `Insufficient Rest Interval (<${minRest}h)`,
          description: `Only ${restHours.toFixed(1)}h rest between ${stCurr.name} (${curr.date}) and ${stNext.name} (${next.date}). Mandated minimum is ${minRest}h.`,
          assignmentId: next.id,
        });
      }
    }

    // C) Consecutive workdays cap
    let consecutive = 1;
    for (let i = 0; i < empAsgs.length - 1; i++) {
      const d1 = new Date(empAsgs[i].date);
      const d2 = new Date(empAsgs[i + 1].date);
      const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        consecutive++;
        if (consecutive > (settings?.consecutiveShiftsCap ?? 5)) {
          fatigueAlerts.push({
            id: `consec-${emp.id}-${empAsgs[i + 1].date}`,
            employeeId: emp.id,
            employeeName: emp.fullName,
            employeeRole: emp.designation,
            date: empAsgs[i + 1].date,
            shiftTypeId: empAsgs[i + 1].shiftTypeId,
            shiftName: "Consecutive Shifts",
            type: "consecutive_days",
            severity: "warning",
            title: "Consecutive Shifts Guardrail Breached",
            description: `${emp.fullName} has ${consecutive} consecutive shifts without a mandatory off-duty rest day.`,
            assignmentId: empAsgs[i + 1].id,
          });
        }
      } else {
        consecutive = 1;
      }
    }

    // D) Conflict flags from database/scheduling
    for (const a of empAsgs) {
      if (a.conflictFlag && !fatigueAlerts.some((al) => al.assignmentId === a.id)) {
        fatigueAlerts.push({
          id: `flag-${a.id}`,
          employeeId: emp.id,
          employeeName: emp.fullName,
          employeeRole: emp.designation,
          date: a.date,
          shiftTypeId: a.shiftTypeId,
          shiftName: shiftTypes.find((s) => s.id === a.shiftTypeId)?.name || "Shift",
          type: "overlap",
          severity: "critical",
          title: "Schedule Conflict Detected",
          description: a.conflictReason || "Overlapping shift, leave collision, or rest violation.",
          assignmentId: a.id,
        });
      }
    }
  }

  // 2. Unfilled Shift Requirements Scan
  for (const d of week.dates) {
    for (const st of activeShiftTypes) {
      const assignedInShift = assignments.filter(
        (a) => a.date === d.date && a.shiftTypeId === st.id && a.status !== "cancelled"
      );

      // Check MD requirements
      const requiredMd = st.minimumStaffMd || 0;
      if (requiredMd > 0) {
        const assignedMd = assignedInShift.filter((a) => {
          const emp = employees.find((e) => e.id === a.employeeId);
          return emp && /md|physician|surgeon|doctor/i.test(emp.designation);
        }).length;
        if (assignedMd < requiredMd) {
          unfilledAlerts.push({
            id: `unfilled-md-${d.date}-${st.id}`,
            date: d.date,
            weekday: d.weekday,
            shiftTypeId: st.id,
            shiftName: st.name,
            shiftColor: st.color,
            shortageCount: requiredMd - assignedMd,
            requiredCount: requiredMd,
            assignedCount: assignedMd,
            designation: "MD / Physician",
            severity: "critical",
            title: `Unfilled MD Requirement: ${st.name}`,
            description: `${d.weekday} (${d.date}): ${assignedMd}/${requiredMd} MDs assigned. Needs ${requiredMd - assignedMd} more physician(s) to meet safe coverage.`,
          });
        }
      }

      // Check RN requirements
      const requiredRn = st.minimumStaffRn || 0;
      if (requiredRn > 0) {
        const assignedRn = assignedInShift.filter((a) => {
          const emp = employees.find((e) => e.id === a.employeeId);
          return emp && /rn|nurse/i.test(emp.designation);
        }).length;
        if (assignedRn < requiredRn) {
          unfilledAlerts.push({
            id: `unfilled-rn-${d.date}-${st.id}`,
            date: d.date,
            weekday: d.weekday,
            shiftTypeId: st.id,
            shiftName: st.name,
            shiftColor: st.color,
            shortageCount: requiredRn - assignedRn,
            requiredCount: requiredRn,
            assignedCount: assignedRn,
            designation: "RN / Staff Nurse",
            severity: isNightShiftType(st) ? "critical" : "warning",
            title: `Unfilled Nurse Requirement: ${st.name}`,
            description: `${d.weekday} (${d.date}): ${assignedRn}/${requiredRn} RNs assigned. Needs ${requiredRn - assignedRn} more nurse(s) for clinical minimum.`,
          });
        }
      }
    }
  }

  return {
    fatigueAlerts,
    unfilledAlerts,
    totalAlerts: fatigueAlerts.length + unfilledAlerts.length,
  };
}

/**
 * Evaluate guardrail violations (weekly hours, rest interval, consecutive shifts)
 * for one employee against an updated assignment list — same rules as the audit.
 */
export function evaluateEmployeeViolations(
  emp: any,
  updatedAssignments: Array<any>,
  shiftTypes: Array<any>,
  settings: any,
  weeklyHoursCap: number
): GuardrailViolation | null {
  const empAsgs = sortAssignmentsByDate(
    updatedAssignments.filter((a) => a.employeeId === emp.id && a.status !== "cancelled")
  );

  // 1. Weekly hours cap violation check
  const totalHours = totalHoursOf(empAsgs, shiftTypes);
  const cap = emp.maxHoursPerWeek ?? weeklyHoursCap;
  if (totalHours > cap) {
    return {
      detail: `${emp.fullName} exceeds weekly limit (${totalHours.toFixed(1)}h / ${cap}h max cap)`,
      type: "critical",
    };
  }

  // 2. Rest interval check (<minRest hours minimum rest rule)
  for (let i = 0; i < empAsgs.length - 1; i++) {
    const restHours = restHoursBetween(empAsgs[i], empAsgs[i + 1], shiftTypes);
    if (restHours === null) continue;
    const minRest = settings?.minRestHoursBetweenShifts ?? 11;
    if (restHours >= 0 && restHours < minRest) {
      return {
        detail: `Rest interval violation for ${emp.fullName}: only ${restHours.toFixed(1)}h rest (< ${minRest}h minimum)`,
        type: "critical",
      };
    }
  }

  // 3. Consecutive shifts cap
  const capConsecutive = settings?.consecutiveShiftsCap ?? 5;
  let consecutive = 1;
  for (let i = 0; i < empAsgs.length - 1; i++) {
    const d1 = new Date(empAsgs[i].date);
    const d2 = new Date(empAsgs[i + 1].date);
    const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      consecutive++;
      if (consecutive > capConsecutive) {
        return {
          detail: `${emp.fullName} has ${consecutive} consecutive shifts without mandatory rest day`,
          type: "warning",
        };
      }
    } else {
      consecutive = 1;
    }
  }

  return null;
}
