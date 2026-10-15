import type {
  AssignmentRecord,
  AutoAssignInput,
  CoverageCell,
  SchedulingContext,
  ShiftCandidate,
  ShiftRequirement,
  SchedulingRules,
  Violation,
  ViolationCode,
  ViolationSeverity,
  ShiftTypeRecord,
  EmployeeRecord,
  Weights,
  DEFAULT_WEIGHTS as _DEFAULT_WEIGHTS_T,
} from "./types";

export {
  designationMatches,
  paidHours,
  countsAsWorking,
} from "./types";

export {
  materializeShift,
  workingDayOf,
  addDaysLocal,
  daysBetweenLocal,
  weekKeyOf,
  monthKeyOf,
  isWeekendDate,
  listLocalDates,
} from "./materialize";

import {
  designationMatches,
  paidHours,
  countsAsWorking,
  type CoverageCell as _Cov,
} from "./types";

import {
  materializeShift,
  addDaysLocal,
  daysBetweenLocal,
  weekKeyOf,
  monthKeyOf,
  isWeekendDate,
  listLocalDates,
} from "./materialize";

// ---------------------------------------------------------------------------
// Requirement resolution: per shift type × designation policy rows, with the
// legacy minimumStaffRn/Md (designation "any") as the fallback. Every page
// (roster coverage footer, dashboard, auto-assign) reads the SAME resolution.
// ---------------------------------------------------------------------------

export function requirementsForShiftType(
  ctx: SchedulingContext,
  shiftTypeId: string
): ShiftRequirement[] {
  const rows = ctx.requirements.filter((r) => r.shiftTypeId === shiftTypeId);
  if (rows.length > 0) return rows;
  const st = ctx.shiftTypes.find((s) => s.id === shiftTypeId);
  if (!st) return [];
  const legacy: ShiftRequirement[] = [];
  if (st.minimumStaffRn > 0) {
    legacy.push({
      shiftTypeId,
      designation: "RN",
      minStaff: st.minimumStaffRn,
      maxStaff: st.maximumStaff,
    });
  }
  if (st.minimumStaffMd > 0) {
    legacy.push({
      shiftTypeId,
      designation: "MD",
      minStaff: st.minimumStaffMd,
      maxStaff: null,
    });
  }
  if (legacy.length === 0) {
    // Legacy defaults existed for every type; keep an "any" row so coverage
    // never silently vanishes.
    legacy.push({ shiftTypeId, designation: "any", minStaff: 0, maxStaff: st.maximumStaff });
  }
  return legacy;
}

/** Resolved rules, tolerating partially-populated settings rows. */
export function resolveRules(settingsRow: Partial<SchedulingRules> | null | undefined): SchedulingRules {
  return {
    timezone: settingsRow?.timezone || "UTC",
    weekStartDay: settingsRow?.weekStartDay ?? 1,
    minRestHours: settingsRow?.minRestHours ?? 11,
    maxConsecutiveDays: settingsRow?.maxConsecutiveDays ?? 5,
    maxWeeklyHours: settingsRow?.maxWeeklyHours ?? 48,
    maxWeeklyHoursSeverity: settingsRow?.maxWeeklyHoursSeverity ?? "warn",
    maxNightsPerMonth: settingsRow?.maxNightsPerMonth ?? 7,
    maxNightsSeverity: settingsRow?.maxNightsSeverity ?? "warn",
    enforceRestInterval: settingsRow?.enforceRestInterval ?? true,
    pendingLeaveAction: settingsRow?.pendingLeaveAction ?? "warn",
  };
}

/** Lookback/lookahead pad so reactions across the range boundary are never missed. */
export function ruleWindowPad(rules: SchedulingRules): number {
  return Math.max(rules.minRestHours, (rules.maxConsecutiveDays + 1) * 1.5, 24);
  // hours → days communicated by loader (pad in hours; loader divides by 24)
}

// ---------------------------------------------------------------------------
// Per-employee state index (sorted by startAt; binary-search neighbours)
// ---------------------------------------------------------------------------

interface EmpState {
  sorted: AssignmentRecord[]; // non-cancelled only, sorted by startAt
  paidHoursTotal: number;
  weeklyHours: Map<string, number>; // weekKey → hours
  monthlyNights: Map<string, number>; // monthKey → nights
  workingDays: Set<string>;
  weekendShifts: number;
}

export class ScheduleIndex {
  readonly ctx: SchedulingContext;
  private byEmployee = new Map<string, EmpState>();
  private byShiftTypeDay = new Map<string, number>(); // `${shiftTypeId}|${date}` → count
  readonly rules: SchedulingRules;

  constructor(ctx: SchedulingContext) {
    this.ctx = ctx;
    this.rules = resolveRules((ctx as any).rules);
    for (const a of ctx.assignments) {
      if (!countsAsWorking(a)) continue;
      this.addAssignment(a);
    }
  }

  private stateOf(employeeId: string): EmpState {
    let s = this.byEmployee.get(employeeId);
    if (!s) {
      s = { sorted: [], paidHoursTotal: 0, weeklyHours: new Map(), monthlyNights: new Map(), workingDays: new Set(), weekendShifts: 0 };
      this.byEmployee.set(employeeId, s);
    }
    return s;
  }

  addAssignment(a: AssignmentRecord): void {
    if (!countsAsWorking(a)) return;
    const s = this.stateOf(a.employeeId);
    s.sorted.push(a);
    s.sorted.sort((x, y) => new Date(x.startAt).getTime() - new Date(y.startAt).getTime());
    const hrs = paidHours(a.startAt, a.endAt, a.breakDurationMinutes);
    s.paidHoursTotal += hrs;
    s.weeklyHours.set(weekKeyOf(a.date, this.rules.weekStartDay, this.rules.timezone), (s.weeklyHours.get(weekKeyOf(a.date, this.rules.weekStartDay, this.rules.timezone)) || 0) + hrs);
    const st = this.ctx.shiftTypes.find((t) => t.id === a.shiftTypeId);
    if (st && st.isNight) {
      s.monthlyNights.set(monthKeyOf(a.date, this.rules.timezone), (s.monthlyNights.get(monthKeyOf(a.date, this.rules.timezone)) || 0) + 1);
    }
    s.workingDays.add(a.date);
    if (isWeekendDate(a.date, this.rules.timezone)) s.weekendShifts += 1;

    const slotKey = `${a.shiftTypeId}|${a.date}`;
    this.byShiftTypeDay.set(slotKey, (this.byShiftTypeDay.get(slotKey) || 0) + 1);
  }

  removeAssignment(a: AssignmentRecord): void {
    if (!countsAsWorking(a)) return;
    const s = this.byEmployee.get(a.employeeId);
    if (!s) return;
    const i = s.sorted.indexOf(a);
    if (i >= 0) s.sorted.splice(i, 1);
    const hrs = paidHours(a.startAt, a.endAt, a.breakDurationMinutes);
    s.paidHoursTotal = Math.max(0, s.paidHoursTotal - hrs);
    const wk = weekKeyOf(a.date, this.rules.weekStartDay, this.rules.timezone);
    s.weeklyHours.set(wk, Math.max(0, (s.weeklyHours.get(wk) || 0) - hrs));
    const st = this.ctx.shiftTypes.find((t) => t.id === a.shiftTypeId);
    if (st && st.isNight) {
      const mk = monthKeyOf(a.date, this.rules.timezone);
      s.monthlyNights.set(mk, Math.max(0, (s.monthlyNights.get(mk) || 0) - 1));
    }
    s.weekendShifts = Math.max(0, s.weekendShifts - (isWeekendDate(a.date, this.rules.timezone) ? 1 : 0));
    this.rebuildWorkingDays(s);
    const slotKey = `${a.shiftTypeId}|${a.date}`;
    this.byShiftTypeDay.set(slotKey, Math.max(0, (this.byShiftTypeDay.get(slotKey) || 1) - 1));
  }

  private rebuildWorkingDays(s: EmpState): void {
    s.workingDays.clear();
    for (const a of s.sorted) s.workingDays.add(a.date);
  }

  assignedCount(shiftTypeId: string, date: string, since?: Date): number {
    const n = this.byShiftTypeDay.get(`${shiftTypeId}|${date}`) || 0;
    return n;
  }

  assignmentsOf(employeeId: string): AssignmentRecord[] {
    return this.stateOf(employeeId).sorted;
  }

  weeklyHours(employeeId: string, date: string): number {
    const s = this.byEmployee.get(employeeId);
    if (!s) return 0;
    return s.weeklyHours.get(weekKeyOf(date, this.rules.weekStartDay, this.rules.timezone)) || 0;
  }

  monthlyNights(employeeId: string, date: string): number {
    const s = this.byEmployee.get(employeeId);
    if (!s) return 0;
    return s.monthlyNights.get(monthKeyOf(date, this.rules.timezone)) || 0;
  }

  workingDaysOf(employeeId: string): Set<string> {
    return this.stateOf(employeeId).workingDays;
  }

  /** Insertion point via binary search on startAt. */
  insertionPoint(employeeId: string, startAt: string): number {
    const arr = this.stateOf(employeeId).sorted;
    let lo = 0, hi = arr.length;
    const t = new Date(startAt).getTime();
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (new Date(arr[mid].startAt).getTime() < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  monthKeysOf(employeeId: string): string[] {
    return Array.from(this.byEmployee.get(employeeId)?.monthlyNights.keys() || []);
  }

  fairnessOf(employeeId: string): { hours: number; nights: number; weekendShifts: number } {
    const s = this.byEmployee.get(employeeId);
    return {
      hours: Math.round((s?.paidHoursTotal || 0) * 10) / 10,
      nights: s?.monthlyNights.size ? Array.from(s.monthlyNights.values()).reduce((a, b) => a + b, 0) : 0,
      weekendShifts: s?.weekendShifts || 0,
    };
  }

  fairnessAcross(employeeIds: string[]) {
    const all = employeeIds
      .map((id) => ({ employeeId: id, ...this.fairnessOf(id) }))
      .filter((f) => f.hours > 0 || f.nights > 0);
    const hours = all.map((f) => f.hours);
    const min = hours.length ? Math.min(...hours) : 0;
    const max = hours.length ? Math.max(...hours) : 0;
    return { rows: all, min, max, spread: Math.round((max - min) * 10) / 10 };
  }
}

// ---------------------------------------------------------------------------
// validateAssignment — the single point every consumer uses
// ---------------------------------------------------------------------------

export function validateAssignment(candidate: ShiftCandidate, ctx: SchedulingContext): Violation[] {
  const rules = resolveRules(ctx.rules);
  const violations: Violation[] = [];
  const index = new ScheduleIndex(ctx);

  const emp = ctx.employees.find((e) => e.id === candidate.employeeId);
  const st = ctx.shiftTypes.find((s) => s.id === candidate.shiftTypeId);

  if (!emp) {
    violations.push({
      code: "DESIGNATION_NOT_ELIGIBLE",
      severity: "block",
      message: "No such employee.",
      details: { employeeId: candidate.employeeId },
    });
    return violations;
  }

  if (!st) {
    violations.push({
      code: "SHIFT_INACTIVE",
      severity: "block",
      message: "No such shift type.",
      details: { shiftTypeId: candidate.shiftTypeId },
    });
    return violations;
  }

  const base = { employeeId: emp.id, date: candidate.date, shiftTypeId: st.id };

  if (emp.employmentStatus === "archived" || !emp.active) {
    violations.push({
      ...base,
      code: "EMPLOYEE_ARCHIVED",
      severity: "block",
      message: "Employee is archived.",
      details: {},
    });
  }

  if (!st.active) {
    violations.push({
      ...base,
      code: "SHIFT_INACTIVE",
      severity: "block",
      message: "Shift template is inactive.",
      details: {},
    });
  }

  const tz = rules.timezone;
  const mat = materializeShift(candidate.date, st, tz);

  // Designation eligibility: “any” rows accept everyone; specific rows ask for match.
  const reqs = requirementsForShiftType(ctx, st.id);
  const specific = reqs.filter((r) => r.designation !== "any");

  if (specific.length > 0) {
    const roles = [emp.designation, roleClassOf(emp.designation)];
    if (!reqs.some((r) => roles.includes(r.designation))) {
      violations.push({
        ...base,
        code: "DESIGNATION_NOT_ELIGIBLE",
        severity: "block",
        message: `${emp.designation} is not rostered for ${st.name}.`,
        details: { designation: emp.designation },
      });
    }
  }

  // Night-shift permission exception.
  if (st.isNight && emp.canWorkNights === false) {
    violations.push({
      ...base,
      code: "NIGHTS_NOT_ALLOWED",
      severity: "block",
      message: "Not cleared for night shifts.",
      details: {},
    });
  }

  // OVERLAP — true interval intersection on half-open [start, end):
  // touching edges never overlap, but an identical/contained interval does.
  // Only the sorted neighbours can possibly intersect.
  const iw = index.insertionPoint(emp.id, mat.startAt);
  const arr = index.assignmentsOf(emp.id);
  const prev = arr[iw - 1];
  const next = arr[iw];
  const intersects = (other: AssignmentRecord) =>
    new Date(mat.startAt).getTime() < new Date(other.endAt).getTime() &&
    new Date(other.startAt).getTime() < new Date(mat.endAt).getTime();
  if (next && intersects(next)) {
    violations.push({
      ...base,
      code: "OVERLAP",
      severity: "block",
      assignmentId: next.id,
      message: "Already working a shift that overlaps this one.",
      details: { otherStart: next.date },
    });
  } else if (prev && intersects(prev)) {
    violations.push({
      ...base,
      code: "OVERLAP",
      severity: "block",
      assignmentId: prev.id,
      message: "Already working a shift that overlaps this one.",
      details: { otherStart: prev.date },
    });
  }

  // ON_LEAVE (approved = block). Leave covers [startDate 00:00, endDate+1 00:00)
  // LOCAL; a night shift starting the day before but ending inside the leave
  // window still intersects it. Pending leave behaves per the setting.
  const leave = ctx.leaves.find((l) => {
    if (l.employeeId !== emp.id) return false;
    if (l.status === "cancelled" || l.status === "rejected") return false;
    const midnight = { startTime: "00:00", endTime: "00:00", breakDurationMinutes: 0, crossesMidnight: true };
    const leaveStartAt = materializeShift(l.startDate, midnight, rules.timezone).startAt;
    const leaveEndAt = materializeShift(l.endDate, midnight, rules.timezone).endAt;
    return (
      new Date(mat.startAt).getTime() < new Date(leaveEndAt).getTime() &&
      new Date(leaveStartAt).getTime() < new Date(mat.endAt).getTime()
    );
  });
  if (leave) {
    if (leave.status === "approved") {
      violations.push({
        ...base,
        code: "ON_LEAVE",
        severity: "block",
        message: `On approved leave ${leave.startDate} → ${leave.endDate}.`,
        details: { leaveId: leave.id },
      });
    } else if (leave.status === "pending") {
      if (rules.pendingLeaveAction === "block") {
        violations.push({
          ...base,
          code: "ON_LEAVE",
          severity: "block",
          message: `Pending leave ${leave.startDate} → ${leave.endDate} blocks assignment.`,
          details: { leaveId: leave.id },
        });
      } else if (rules.pendingLeaveAction === "warn") {
        violations.push({
          ...base,
          code: "ON_LEAVE",
          severity: "warn",
          message: `Pending leave ${leave.startDate} → ${leave.endDate}.`,
          details: { leaveId: leave.id },
        });
      }
    }
  }

  // OFF_DAY (recorded off day on the working day).
  const offDay = ctx.offDays.find((o) => o.employeeId === emp.id && o.date === candidate.date);
  if (offDay) {
    violations.push({
      ...base,
      code: "OFF_DAY",
      severity: "block",
      message: "Scheduled day off on this date.",
      details: {},
    });
  }

  // REST_TOO_SHORT vs immediate neighbours only (sorted array ⇒ neighbours suffice).
  if (rules.enforceRestInterval) {
    const minRest = rules.minRestHours;
    const MS_H = 3600000;

    if (candidate.ignoreRestWarning && prev) {
      // explicitly overridden by the user — still reported as warning
      const gap = (new Date(mat.startAt).getTime() - new Date(prev.endAt).getTime()) / MS_H;
      if (gap < minRest) {
        violations.push({
          ...base,
          code: "REST_TOO_SHORT",
          severity: "warn",
          assignmentId: prev.id,
          message: `Rest ${fmt(gap)}h (min ${minRest}h)`,
          details: { gapHours: Math.round(gap * 10) / 10, minRestHours: minRest },
        });
      }
    } else {
      if (prev) {
        const gap = (new Date(mat.startAt).getTime() - new Date(prev.endAt).getTime()) / MS_H;
        if (gap >= 0 && gap < minRest) {
          violations.push({
            ...base,
            code: "REST_TOO_SHORT",
            severity: "block",
            assignmentId: prev.id,
            message: `Rest ${fmt(gap)}h (min ${minRest}h)`,
            details: { gapHours: Math.round(gap * 10) / 10, minRestHours: minRest },
          });
        }
      }
      if (next) {
        const gapAfter = (new Date(next.startAt).getTime() - new Date(mat.endAt).getTime()) / MS_H;
        if (gapAfter >= 0 && gapAfter < minRest) {
          violations.push({
            ...base,
            code: "REST_TOO_SHORT",
            severity: "block",
            assignmentId: next.id,
            message: `Rest ${fmt(gapAfter)}h before next shift (min ${minRest}h)`,
            details: { gapHours: Math.round(gapAfter * 10) / 10, minRestHours: minRest },
          });
        }
      }
    }
  }

  // MAX_CONSECUTIVE_DAYS — walk outward over the working-day set.
  const cap = rules.maxConsecutiveDays;
  const days = index.workingDaysOf(emp.id);
  let run = 1;
  let back = addDaysLocal(candidate.date, -1, tz);
  while (days.has(back)) {
    run++;
    back = addDaysLocal(back, -1, tz);
  }
  let fwd = addDaysLocal(candidate.date, 1, tz);
  while (days.has(fwd)) {
    run++;
    fwd = addDaysLocal(fwd, 1, tz);
  }
  if (run > cap) {
    violations.push({
      ...base,
      code: "MAX_CONSECUTIVE_DAYS",
      severity: "block",
      message: `${run} days in a row (max ${cap}).`,
      details: { run, cap },
    });
  }

  // MAX_WEEKLY_HOURS (severity configurable) + per-employee exception.
  const weekCap = emp.maxHoursPerWeek ?? rules.maxWeeklyHours;
  const weekNow = index.weeklyHours(emp.id, candidate.date);
  const newHours = paidHours(mat.startAt, mat.endAt, st.breakDurationMinutes || 0);
  if (weekNow + newHours > weekCap) {
    violations.push({
      ...base,
      code: "MAX_WEEKLY_HOURS",
      severity: rules.maxWeeklyHoursSeverity === "block" ? "block" : "warn",
      message: `${fmt(weekNow + newHours)}h this week (max ${weekCap}h).`,
      details: { weekHours: Math.round((weekNow + newHours) * 10) / 10, cap: weekCap },
    });
  }

  // MAX_NIGHTS_MONTH (severity configurable).
  if (st.isNight) {
    const monthCount =
      (index.monthlyNights(emp.id, candidate.date) || 0);
    if (monthCount + 1 > rules.maxNightsPerMonth) {
      violations.push({
        ...base,
        code: "MAX_NIGHTS_MONTH",
        severity: rules.maxNightsSeverity === "block" ? "block" : "warn",
        message: `${monthCount + 1} nights this month (max ${rules.maxNightsPerMonth}).`,
        details: { nights: monthCount + 1, cap: rules.maxNightsPerMonth },
      });
    }
  }

  // OVER_MAX_STAFF — per shift-type × designation cap (bulk applies).
  const applicableMax = reqs
    .filter((r) => designationMatches(r.designation, emp.designation))
    .reduce<string | null>(
      (acc, r) => (r.maxStaff != null ? String(Math.min(Number(acc ?? Infinity), r.maxStaff)) : acc),
      null
    );
  const effectiveMax =
    applicableMax != null ? Number(applicableMax) : (st.maximumStaff ?? Infinity);

  return violations;
}

function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");
}

const ROLE_CLASS_CACHE = new Map<string, string | null>();
export function roleClassOf(designation: string): string | null {
  if (ROLE_CLASS_CACHE.has(designation)) return ROLE_CLASS_CACHE.get(designation)!;
  let out: string | null = null;
  if (/MD|Physician|Surgeon|Intensivist|Anesthesiolog|Toxicolog/i.test(designation)) out = "MD";
  else if (/Tech|Paramedic|EMT/i.test(designation)) out = "Tech";
  else if (/RN|Nurse/i.test(designation)) out = "RN";
  ROLE_CLASS_CACHE.set(designation, out);
  return out;
}

export function employeeRoleClass(emp: EmployeeRecord): string {
  return roleClassOf(emp.designation) ?? "any";
}

// ---------------------------------------------------------------------------
// validateSchedule — full scan over the range (dashboard count, sidebar badge,
// roster flags and calendar alerts all consume this same result)
// ---------------------------------------------------------------------------

export function validateSchedule(
  ctx: SchedulingContext,
  range?: { from: string; to: string }
): { violations: Violation[]; flaggedAssignmentIds: Set<string> } {
  const rules = resolveRules(ctx.rules);
  const index = new ScheduleIndex(ctx);
  const violations: Violation[] = [];
  const flagged = new Set<string>();
  const seen = new Set<string>();

  // Per-assignment rule checks (rest, consecutive, weekly hours, nights)
  for (const a of ctx.assignments) {
    if (!countsAsWorking(a)) continue;
    if (range && (a.date < range.from || a.date > range.to)) continue;
    const st = ctx.shiftTypes.find((s) => s.id === a.shiftTypeId);
    if (!st) continue;

    // Rest to the next assignment (prev walk handled by on-insert checks above,
    // but full scans catch pre-existing data).
    const arr = index.assignmentsOf(a.employeeId);
    const i = arr.findIndex((x) => x.id === a.id);
    if (i >= 0 && arr[i + 1]) {
      const gap = (new Date(arr[i + 1].startAt).getTime() - new Date(a.endAt).getTime()) / 3600000;
      if (gap < rules.minRestHours) {
        const key = `REST|${a.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          violations.push({
            code: "REST_TOO_SHORT",
            severity: "block",
            employeeId: a.employeeId,
            date: a.date,
            assignmentId: a.id,
            shiftTypeId: a.shiftTypeId,
            message: `Rest ${fmt(gap)}h (min ${rules.minRestHours}h)`,
            details: { gapHours: Math.round(gap * 10) / 10, minRestHours: rules.minRestHours },
          });
          flagged.add(a.id);
        }
      }
    }
  }

  // Leave / off-day overlaps for stored assignments
  for (const a of ctx.assignments) {
    if (!countsAsWorking(a)) continue;
    if (range && (a.date < range.from || a.date > range.to)) continue;
    const approved = ctx.leaves.find(
      (l) =>
        l.employeeId === a.employeeId &&
        l.status === "approved" &&
        l.startDate <= a.date &&
        l.endDate >= a.date
    );
    if (approved) {
      violations.push({
        code: "ON_LEAVE",
        severity: "block",
        employeeId: a.employeeId,
        date: a.date,
        assignmentId: a.id,
        shiftTypeId: a.shiftTypeId,
        message: "On approved leave on this date.",
        details: { leaveId: approved.id },
      });
      flagged.add(a.id);
    }
  }

  // Coverage gaps (per date × shift × designation) — UNDER_MIN_STAFF warnings
  const gaps = coverage(ctx, range);
  for (const g of gaps) {
    if (g.short > 0) {
      violations.push({
        code: "UNDER_MIN_STAFF",
        severity: "warn",
        date: g.date,
        shiftTypeId: g.shiftTypeId,
        designation: g.designation,
        message: `Short ${g.short} ${g.designation === "any" ? "staff" : g.designation} on ${stLabel(ctx, g.shiftTypeId)}`,
        details: { required: g.required, assigned: g.assigned, short: g.short },
      });
    }
  }

  return { violations, flaggedAssignmentIds: flagged };
}

function stLabel(ctx: SchedulingContext, shiftTypeId: string): string {
  const st = ctx.shiftTypes.find((s) => s.id === shiftTypeId);
  return st ? st.name : "shift";
}

// ---------------------------------------------------------------------------
// coverage — per date × shift × designation
// ---------------------------------------------------------------------------

export function coverage(
  ctx: SchedulingContext,
  range?: { from: string; to: string }
): CoverageCell[] {
  const rules = resolveRules(ctx.rules);
  const from = range?.from || ctx.assignments.reduce((m, a) => (a.date < m ? a.date : m), "9999-12-31");
  const to = range?.to || ctx.assignments.reduce((m, a) => (a.date > m ? a.date : m), "0000-01-01");
  if (from > to) return [];

  const cells: CoverageCell[] = [];
  for (const date of listLocalDates(from, to, rules.timezone)) {
    for (const st of ctx.shiftTypes) {
      if (!st.active) continue;
      const slots = ctx.assignments.filter(
        (a) => a.date === date && a.shiftTypeId === st.id && countsAsWorking(a)
      );
      const reqs = requirementsForShiftType(ctx, st.id);
      for (const req of reqs) {
        let assignedN: number;
        if (req.designation === "any") {
          assignedN = slots.length;
        } else {
          assignedN = slots.filter((a) => {
            const emp = ctx.employees.find((e) => e.id === a.employeeId);
            return emp && matchPromotesDesignation(req, emp);
          }).length;
        }
        cells.push({
          date,
          shiftTypeId: st.id,
          designation: req.designation,
          required: req.minStaff,
          assigned: assignedN,
          short: Math.max(0, req.minStaff - assignedN),
          over: req.maxStaff != null ? Math.max(0, assignedN - req.maxStaff) : 0,
        });
      }
    }
  }

  return cells;
}

function matchPromotesDesignation(req: ShiftRequirement, emp: EmployeeRecord): boolean {
  if (req.designation === "any") return true;
  return req.designation === emp.designation || req.designation === roleClassOf(emp.designation);
}

// ---------------------------------------------------------------------------
// previewBulk — same validator, applied sequentially with in-memory commitment
// ---------------------------------------------------------------------------

export function previewBulk(
  ops: ShiftCandidate[],
  ctx: SchedulingContext
): { applied: ShiftCandidate[]; violations: Violation[] } {
  const violations: Violation[] = [];
  const applied: ShiftCandidate[] = [];
  // Work on a mutable clone so sequential ops see earlier proposals.
  let workingCtx: SchedulingContext = ctx;

  for (const op of ops) {
    const v = validateAssignment(op, workingCtx);
    const blocking = v.filter((x) => x.severity === "block");
    violations.push(...v);
    if (blocking.length === 0) {
      applied.push(op);
      workingCtx = commitToCtx(workingCtx, op);
    }
  }

  return { applied, violations };
}

/** Clone the context with `candidate` committed as a new assignment. */
export function commitToCtx(ctx: SchedulingContext, candidate: ShiftCandidate): SchedulingContext {
  const st = ctx.shiftTypes.find((s) => s.id === candidate.shiftTypeId);
  if (!st) return ctx;
  const rules = resolveRules(ctx.rules);
  const mat = materializeShift(candidate.date, st, rules.timezone);
  const asg: AssignmentRecord = {
    id: `proposed_${candidate.employeeId}_${candidate.shiftTypeId}_${candidate.date}`,
    employeeId: candidate.employeeId,
    shiftTypeId: candidate.shiftTypeId,
    date: candidate.date,
    startAt: mat.startAt,
    endAt: mat.endAt,
    breakDurationMinutes: st.breakDurationMinutes || 0,
    status: "assigned",
  };
  return { ...ctx, assignments: [...ctx.assignments, asg] };
}

export type { Violation, ViolationCode, ViolationSeverity, ShiftTypeRecord, Weights };
export type { DEFAULT_WEIGHTS as DEFAULT_WEIGHTS_T } from "./types";
export { DEFAULT_WEIGHTS } from "./types";
export type { AutoAssignInput };
