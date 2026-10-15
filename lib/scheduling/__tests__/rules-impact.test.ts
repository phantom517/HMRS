// bun test — diffViolations: counts added/cleared conflicts, lists affected
// people and dates, treats identical violations as unchanged.
import { describe, it, expect } from "bun:test";
import { diffViolations, violationNoun } from "../rules-impact";
import type { EmployeeRecord, Violation } from "../types";

const emps: EmployeeRecord[] = [
  { id: "e1", fullName: "Aiko Tanaka", designation: "RN", employmentStatus: "active", active: true, maxHoursPerWeek: null, canWorkNights: true },
  { id: "e2", fullName: "Marcus Vance", designation: "MD", employmentStatus: "active", active: true, maxHoursPerWeek: null, canWorkNights: true },
];

const v = (over: Partial<Violation>): Violation => ({
  code: "REST_TOO_SHORT",
  severity: "block",
  employeeId: "e1",
  date: "2026-10-14",
  message: "Rest 8h (min 11h)",
  details: {},
  ...over,
});

describe("diffViolations", () => {
  it("counts added and cleared and lists people/dates", () => {
    const before = [v({}), v({ employeeId: "e2", date: "2026-10-15" })];
    const after = [v({}), v({ employeeId: "e2", date: "2026-10-15" }), v({ date: "2026-10-16" })];
    const r = diffViolations(before, after, emps);
    expect(r.addedCount).toBe(1);
    expect(r.clearedCount).toBe(0);
    expect(r.affectedPeople.map((p) => p.name)).toEqual(["Aiko Tanaka"]);
    expect(r.affectedDates).toContain("2026-10-16");
  });

  it("cleared only when identity disappears", () => {
    const before = [v({}), v({ employeeId: "e2", date: "2026-10-15" })];
    const after = [v({})];
    const r = diffViolations(before, after, emps);
    expect(r.clearedCount).toBe(1);
    expect(r.affectedPeople.some((p) => p.name === "Marcus Vance")).toBe(true);
  });

  it("no changes -> zero counts", () => {
    const same = [v({})];
    const r = diffViolations(same, same, emps);
    expect(r.addedCount).toBe(0);
    expect(r.clearedCount).toBe(0);
  });

  it("nouns read in plain language", () => {
    expect(violationNoun("REST_TOO_SHORT")).toBe("conflicts");
    expect(violationNoun("UNDER_MIN_STAFF")).toBe("coverage gaps");
  });
});
