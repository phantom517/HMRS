// bun test lib/audit — grouping window, labels, and data integrity.
import { describe, it, expect } from "bun:test";
import {
  auditActionLabel,
  groupAuditRows,
  isSignInAction,
  SIGN_IN_ACTIONS,
  recordTypeLabel,
  type AuditRowLike,
} from "../catalog";

function row(
  id: string,
  secondsAgo: number,
  overrides: Partial<AuditRowLike> = {}
): AuditRowLike {
  return {
    id,
    createdAt: new Date(Date.parse("2026-10-14T10:00:00Z") - secondsAgo * 1000).toISOString(),
    actorName: "Admin",
    action: "EMPLOYEE_ARCHIVED",
    entityType: "employee",
    entityId: `emp_${id}`,
    ...overrides,
  };
}

describe("audit action labels", () => {
  it("plain sentence-case labels, never raw enums", () => {
    expect(auditActionLabel("EMPLOYEE_ARCHIVED")).toBe("Archived employee");
    expect(auditActionLabel("SOME_UNKNOWN_CODE")).toBe("Some unknown code");
    expect(auditActionLabel(null)).toBe("");
  });
  it("sign-in codes are catalogued and detectable", () => {
    for (const a of SIGN_IN_ACTIONS) expect(isSignInAction(a)).toBe(true);
    expect(isSignInAction("SHIFT_ASSIGNED")).toBe(false);
  });
  it("record type label", () => {
    expect(recordTypeLabel("shift_assignment")).toBe("Shift");
  });
});

describe("60-second grouping", () => {
  it("collapses consecutive same actor + action + type within 60s", () => {
    const rows = [row("a", 0), row("b", 30), row("c", 59)];
    const groups = groupAuditRows(rows);
    expect(groups.length).toBe(1);
    expect(groups[0].count).toBe(3);
    expect(groups[0].rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("does not group across a 60s gap", () => {
    const rows = [row("a", 0), row("b", 61)];
    const groups = groupAuditRows(rows);
    expect(groups.length).toBe(2);
  });

  it("does not group different actors or actions", () => {
    const rows = [
      row("a", 0, { action: "EMPLOYEE_ARCHIVED" }),
      row("b", 5, { action: "SHIFT_ASSIGNED" }),
      row("c", 10, { actorName: "Sam", action: "SHIFT_ASSIGNED" }),
    ];
    expect(groupAuditRows(rows).length).toBe(3);
  });

  it("group label reads as a numbered sentence", () => {
    const groups = groupAuditRows([row("a", 0), row("b", 10)]);
    expect(groups[0].label).toBe("Archived 2 employees");
  });

  it("single rows stay individual entries", () => {
    const groups = groupAuditRows([row("a", 0)]);
    expect(groups.length).toBe(1);
    expect(groups[0].label).toBe("Archived employee");
  });
});
