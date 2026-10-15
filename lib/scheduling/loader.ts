import "server-only";
import { db } from "@/lib/db";
import { cycleToday } from "@/lib/schedule-cycle";
import type {
  AssignmentRecord,
  EmployeeRecord,
  LeaveRecord,
  OffDayRecord,
  SchedulingContext,
  ShiftRequirement,
  ShiftTypeRecord,
} from "./types";
import { resolveRules } from "./rules";
import { materializeShift } from "./materialize";

/**
 * Build the pure SchedulingContext for a date range, padded on both sides so
 * rest / consecutive-day / weekly-hour rules that cross the boundary still apply.
 */
export async function loadSchedulingContext(range?: {
  from: string;
  to: string;
}): Promise<SchedulingContext> {
  const [employeesData, shiftTypesRaw, settingsRaw] = await Promise.all([
    db.getEmployees({ pageSize: 1000 }),
    db.getShiftTypes(),
    db.getDepartmentSettings(),
  ]);

  const settings = settingsRaw || {};
  const minRest = settings.minRestHoursBetweenShifts || 11;
  const maxConsec = settings.consecutiveShiftsCap || settings.maxConsecutiveDays || 5;
  const padDays = Math.ceil(Math.max(minRest / 24 + 1, maxConsec + 1, 7)); // days of overhang

  const to = range?.to ? isoShiftDays(range.to, padDays) : "9999-12-31";
  // Query window pad so rest/streak rules that cross the range edge still see data.
  // Real today in the department timezone — never a hardcoded fallback year.
  const queryFrom = isoShiftDays(range?.from || cycleToday(), -padDays);

  const [assignmentsRaw, leavesRaw, offDaysRaw, requirementsRaw] = await Promise.all([
    db.getShiftAssignments({ startDate: queryFrom, endDate: to }),
    db.getLeaveRecords({}),
    db.getOffDays({ startDate: queryFrom, endDate: to }),
    db.getShiftRequirements ? db.getShiftRequirements() : Promise.resolve([] as ShiftRequirement[]),
  ]);

  const shiftTypes: ShiftTypeRecord[] = shiftTypesRaw.map((s: any) => ({
    id: s.id,
    name: s.name,
    shortCode: s.shortCode,
    startTime: s.startTime,
    endTime: s.endTime,
    breakDurationMinutes: s.breakDurationMinutes || 0,
    crossesMidnight: Boolean(s.crossesMidnight),
    isNight: Boolean(s.isNight) || /NIGHT|OVERNIGHT|\+1 DAY/i.test(s.category || ""),
    category: s.category || "REGULAR",
    active: s.active !== false,
    minimumStaffRn: s.minimumStaffRn || 0,
    minimumStaffMd: s.minimumStaffMd || 0,
    targetStaff: s.targetStaff || 0,
    maximumStaff: s.maximumStaff ?? null,
  }));

  const employees: EmployeeRecord[] = employeesData.employees.map((e: any) => ({
    id: e.id,
    fullName: e.fullName,
    designation: e.designation,
    employmentStatus: e.employmentStatus,
    active: e.active !== false && e.employmentStatus !== "archived",
    maxHoursPerWeek:
      typeof e.maxHoursPerWeek === "number" && e.maxHoursPerWeek > 0
        ? e.maxHoursPerWeek
        : null,
    canWorkNights: e.canWorkNights !== false,
  }));

  const rules = resolveRules({
    timezone: settings.timezone,
    weekStartDay: settings.weekStartDay ?? 1,
    minRestHours: settings.minRestHoursBetweenShifts,
    maxConsecutiveDays: settings.consecutiveShiftsCap ?? settings.maxConsecutiveDays,
    maxWeeklyHours: settings.weeklyHoursCap,
    maxWeeklyHoursSeverity: settings.maxWeeklyHoursSeverity,
    maxNightsPerMonth: settings.maxNightsPerMonth,
    maxNightsSeverity: settings.maxNightsSeverity,
    enforceRestInterval: settings.enforceRestInterval,
    pendingLeaveAction: settings.pendingLeaveAction,
  });

  const assignments: AssignmentRecord[] = assignmentsRaw
    .filter((a: any) => a.startAt && a.endAt)
    .map((a: any) => ({
      id: a.id,
      employeeId: a.employeeId,
      shiftTypeId: a.shiftTypeId,
      date: a.date,
      startAt: inst(a.startAt),
      endAt: inst(a.endAt),
      breakDurationMinutes: a.scheduledBreakMinutes ?? 0,
      status: a.status,
      conflictFlag: Boolean(a.conflictFlag),
      locked: a.status === "completed" || Boolean(a.locked),
    }));

  const leaves: LeaveRecord[] = leavesRaw.map((l: any) => ({
    id: l.id,
    employeeId: l.employeeId,
    status: l.status,
    startDate: l.startDate,
    endDate: l.endDate,
  }));

  const offDays: OffDayRecord[] = offDaysRaw.map((o: any) => ({
    id: o.id,
    employeeId: o.employeeId,
    date: o.date,
    reason: o.reason,
  }));

  const requirements: ShiftRequirement[] = (requirementsRaw || []).map((r: any) => ({
    shiftTypeId: r.shiftTypeId,
    designation: r.designation || "any",
    minStaff: r.minStaff ?? 0,
    maxStaff: r.maxStaff ?? null,
  }));

  return { rules, employees, shiftTypes, requirements, assignments, leaves, offDays };
}

/** Materialize helper re-exported for actions (write paths). */
export function materializeForWrite(
  date: string,
  shiftType: { startTime: string; endTime: string; breakDurationMinutes: number; crossesMidnight: boolean },
  tz: string
) {
  return materializeShift(date, shiftType, tz);
}

function inst(v: any): string {
  if (v instanceof Date) return v.toISOString();
  return new Date(v).toISOString();
}

function isoShiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}
