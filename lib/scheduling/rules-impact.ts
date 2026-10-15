// lib/scheduling/rules-impact.ts — pure diff of two validateSchedule runs.
// NO db, no react: violations in, structured impact out. Unit-tested and
// shared by the Settings save preview and tests only.
import type { EmployeeRecord, Violation } from "./types";

export interface RulesImpact {
  addedCount: number;
  clearedCount: number;
  addedByCode: Record<string, number>;
  clearedByCode: Record<string, number>;
  affectedPeople: Array<{ id: string; name: string }>;
  affectedDates: string[];
}

const MAX_LISTED = 20;

/** Stable identity of a violation across two runs. */
function violationKey(v: Violation): string {
  return [
    v.code,
    v.employeeId ?? "",
    v.date ?? "",
    v.shiftTypeId ?? "",
    v.assignmentId ?? "",
    v.designation ?? "",
  ].join("|");
}

/** Letters that read well after "This adds": "conflicts" etc. */
export function violationNoun(code: string): string {
  switch (code) {
    case "OVERLAP":
    case "REST_TOO_SHORT":
    case "MAX_CONSECUTIVE_DAYS":
    case "MAX_WEEKLY_HOURS":
    case "MAX_NIGHTS_MONTH":
    case "ON_LEAVE":
    case "OFF_DAY":
      return "conflicts";
    case "UNDER_MIN_STAFF":
      return "coverage gaps";
    default:
      return "violations";
  }
}

export function diffViolations(
  before: Violation[],
  after: Violation[],
  employees: EmployeeRecord[]
): RulesImpact {
  const beforeKeys = new Set(before.map(violationKey));
  const afterKeys = new Set(after.map(violationKey));

  const added = after.filter((v) => !beforeKeys.has(violationKey(v)));
  const cleared = before.filter((v) => !afterKeys.has(violationKey(v)));

  const addedByCode: Record<string, number> = {};
  for (const v of added) addedByCode[v.code] = (addedByCode[v.code] ?? 0) + 1;
  const clearedByCode: Record<string, number> = {};
  for (const v of cleared) clearedByCode[v.code] = (clearedByCode[v.code] ?? 0) + 1;

  const names = new Map(employees.map((e) => [e.id, e.fullName]));
  const peopleSet = new Map<string, string>();
  for (const v of [...added, ...cleared]) {
    if (v.employeeId) peopleSet.set(v.employeeId, names.get(v.employeeId) ?? v.employeeId);
  }
  const affectedPeople = Array.from(peopleSet, ([id, name]) => ({ id, name })).slice(0, MAX_LISTED);

  const dateSet = new Set<string>();
  for (const v of [...added, ...cleared]) {
    if (v.date) dateSet.add(v.date);
  }
  const affectedDates = Array.from(dateSet).sort().slice(0, MAX_LISTED);

  return {
    addedCount: added.length,
    clearedCount: cleared.length,
    addedByCode,
    clearedByCode,
    affectedPeople,
    affectedDates,
  };
}
