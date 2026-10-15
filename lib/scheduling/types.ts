/**
 * Pure scheduling-engine types. Plain data in, plain data out — no Drizzle,
 * no wall-clock time (Date.now), no randomness except the seeded PRNG in
 * autoAssign. This is the single vocabulary every consumer shares.
 */

export type ViolationCode =
  | "OVERLAP"
  | "ON_LEAVE"
  | "OFF_DAY"
  | "EMPLOYEE_ARCHIVED"
  | "SHIFT_INACTIVE"
  | "DESIGNATION_NOT_ELIGIBLE"
  | "NIGHTS_NOT_ALLOWED"
  | "REST_TOO_SHORT"
  | "MAX_CONSECUTIVE_DAYS"
  | "MAX_WEEKLY_HOURS"
  | "MAX_NIGHTS_MONTH"
  | "OVER_MAX_STAFF"
  | "UNDER_MIN_STAFF";

export type ViolationSeverity = "block" | "warn";

export interface Violation {
  code: ViolationCode;
  severity: ViolationSeverity;
  employeeId?: string;
  /** Local calendar date YYYY-MM-DD (the assignment's working day). */
  date?: string;
  assignmentId?: string;
  shiftTypeId?: string;
  designation?: string;
  message: string; // short, plain language, e.g. "Rest 8h (min 10h)"
  details: Record<string, string | number>;
}

export interface ShiftRequirement {
  shiftTypeId: string;
  designation: string; // "any" | "RN" | "MD" | "Tech" | full designation string
  minStaff: number;
  maxStaff: number | null;
}

/** Every adjustable knob for the engine. All values stored in department_settings. */
export interface SchedulingRules {
  timezone: string;
  weekStartDay: number; // 0=Sun .. 6=Sat
  minRestHours: number;
  maxConsecutiveDays: number;
  maxWeeklyHours: number;
  maxWeeklyHoursSeverity: "warn" | "block";
  maxNightsPerMonth: number;
  maxNightsSeverity: "warn" | "block";
  enforceRestInterval: boolean;
  /** How pending leave is treated: "warn" (default) | "ignore" | "block". */
  pendingLeaveAction: "warn" | "ignore" | "block";
}

export interface EmployeeRecord {
  id: string;
  fullName: string;
  designation: string;
  employmentStatus: string; // "active" | "on_leave" | "off_duty" | "archived"
  active: boolean;
  /** Per-employee exception: null inherits the department weekly cap. */
  maxHoursPerWeek: number | null;
  /** Per-employee exception: false = nights are blocked by default. */
  canWorkNights: boolean;
}

export interface ShiftTypeRecord {
  id: string;
  name: string;
  shortCode: string;
  startTime: string; // "HH:MM" local
  endTime: string;
  breakDurationMinutes: number;
  crossesMidnight: boolean;
  isNight: boolean;
  category: string;
  active: boolean;
  // Legacy whole-shift minimums (used when no per-designation requirement row exists)
  minimumStaffRn: number;
  minimumStaffMd: number;
  targetStaff: number;
  maximumStaff: number | null;
}

export interface AssignmentRecord {
  id: string;
  employeeId: string;
  shiftTypeId: string;
  date: string; // local working day YYYY-MM-DD
  startAt: string; // ISO instant
  endAt: string; // ISO instant, half-open [start, end)
  breakDurationMinutes: number;
  status: string; // "assigned" | "completed" | "cancelled" | "missed"
  conflictFlag?: boolean;
  locked?: boolean;
}

export interface LeaveRecord {
  id: string;
  employeeId: string;
  status: string; // "pending" | "approved" | "rejected" | "cancelled"
  startDate: string; // inclusive, local
  endDate: string; // inclusive, local
}

export interface OffDayRecord {
  id: string;
  employeeId: string;
  date: string; // local
  reason?: string;
}

/** Everything the pure functions need, preloaded by the server loader. */
export interface SchedulingContext {
  rules: SchedulingRules;
  employees: EmployeeRecord[];
  shiftTypes: ShiftTypeRecord[];
  requirements: ShiftRequirement[];
  assignments: AssignmentRecord[];
  leaves: LeaveRecord[];
  offDays: OffDayRecord[];
}

/** Candidate = what would be written. Dates are local working days. */
export interface ShiftCandidate {
  employeeId: string;
  shiftTypeId: string;
  date: string; // local YYYY-MM-DD
  ignoreRestWarning?: boolean;
}

export interface NewAssignment extends ShiftCandidate {
  startAt: string;
  endAt: string;
  breakDurationMinutes: number;
  createdBy?: string;
}

export interface CoverageCell {
  date: string;
  shiftTypeId: string;
  designation: string;
  required: number;
  assigned: number;
  short: number;
  over: number;
}

export interface Weights {
  fairness: number; // penalize above-average hours/nights
  continuity: number; // same shift type as yesterday
  pattern: number; // avoid isolated single days; encourage night blocks
  restBuffer: number; // gaps well above minimum
  weekendBalance: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  fairness: 2.0,
  continuity: 0.4,
  pattern: 0.6,
  restBuffer: 0.2,
  weekendBalance: 1.0,
};

export interface AutoAssignInput {
  range: { from: string; to: string };
  mode: "fill_gaps" | "rebuild_unlocked";
  shiftTypeIds?: string[];
  employeeIds?: string[];
  seed: number;
  weights?: Partial<Weights>;
  timeBudgetMs?: number;
}

export interface AutoAssignProposal {
  assignments: NewAssignment[];
  unfilled: Array<{
    date: string;
    shiftTypeId: string;
    designation: string;
    short: number;
    reasons: Partial<Record<ViolationCode, number>>;
  }>;
  warnings: Violation[];
  fairness: Array<{
    employeeId: string;
    name: string;
    hours: number;
    nights: number;
    weekendShifts: number;
  }>;
  fairnessSpread: { min: number; max: number; spread: number };
  inputHash: string;
}

/** A (designation-designation) matcher: exact match or "any" fallback. */
export function designationMatches(
  requirementDesignation: string,
  employeeDesignation: string
): boolean {
  if (requirementDesignation === "any") return true;
  return requirementDesignation === employeeDesignation;
}

/** Total paid hours of an interval: duration minus break. */
export function paidHours(
  startAt: string,
  endAt: string,
  breakMinutes: number
): number {
  const dur =
    (new Date(endAt).getTime() - new Date(startAt).getTime()) / 3600000;
  return Math.max(0, dur - breakMinutes / 60);
}

/** Is this assignment counted as working (not cancelled)? */
export function countsAsWorking(a: AssignmentRecord): boolean {
  return a.status !== "cancelled";
}
