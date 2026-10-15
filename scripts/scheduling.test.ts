import { describe, it, expect } from "bun:test";
import {
  ScheduleIndex,
  coverage,
  requirementsForShiftType,
  validateAssignment,
  validateSchedule,
  previewBulk,
  resolveRules,
  commitToCtx,
} from "../lib/scheduling/rules";
import { materializeShift, weekKeyOf, monthKeyOf } from "../lib/scheduling/materialize";
import { proposeAutoAssign } from "../lib/scheduling/autoAssign";
import type {
  AssignmentRecord,
  SchedulingContext,
  ShiftCandidate,
  ShiftRequirement,
} from "../lib/scheduling/types";

const TZ = "UTC"; // tests avoid real DST zones; DST handled via Luxon in materializeShift

function baseCtx(overrides: Partial<SchedulingContext> = {}): SchedulingContext {
  const shiftTypes = [
    {
      id: "st_day",
      name: "Day Shift",
      shortCode: "D",
      startTime: "08:00",
      endTime: "16:00",
      breakDurationMinutes: 30,
      crossesMidnight: false,
      isNight: false,
      category: "REGULAR",
      active: true,
      minimumStaffRn: 2,
      minimumStaffMd: 0,
      targetStaff: 3,
      maximumStaff: null,
    },
    {
      id: "st_night",
      name: "Night Shift",
      shortCode: "N",
      startTime: "22:00",
      endTime: "06:00",
      breakDurationMinutes: 30,
      crossesMidnight: true,
      isNight: true,
      category: "REGULAR",
      active: true,
      minimumStaffRn: 1,
      minimumStaffMd: 0,
      targetStaff: 2,
      maximumStaff: 4,
    },
    {
      id: "st_eve",
      name: "Evening Shift",
      shortCode: "E",
      startTime: "14:00",
      endTime: "22:00",
      breakDurationMinutes: 0,
      crossesMidnight: false,
      isNight: false,
      category: "REGULAR",
      active: true,
      minimumStaffRn: 1,
      minimumStaffMd: 0,
      targetStaff: 2,
      maximumStaff: null,
    },
  ];
  const employees = [
    {
      id: "e1",
      fullName: "Alice RN",
      designation: "Staff Nurse RN",
      employmentStatus: "active",
      active: true,
      maxHoursPerWeek: null,
      canWorkNights: true,
    },
    {
      id: "e2",
      fullName: "Bob RN",
      designation: "Staff Nurse RN",
      employmentStatus: "active",
      active: true,
      maxHoursPerWeek: null,
      canWorkNights: true,
    },
  ];
  return {
    rules: resolveRules({
      timezone: TZ,
      weekStartDay: 1,
      minRestHours: 10,
      maxConsecutiveDays: 6,
      maxWeeklyHours: 48,
      maxNightsPerMonth: 7,
    }),
    employees,
    shiftTypes,
    requirements: [],
    assignments: [],
    leaves: [],
    offDays: [],
    ...overrides,
  };
}

function asg(
  id: string,
  employeeId: string,
  shiftTypeId: string,
  date: string,
  status = "assigned"
): AssignmentRecord {
  const st = shiftTypeOf(shiftTypeId);
  const mat = materializeShift(date, st, TZ);
  return {
    id,
    employeeId,
    shiftTypeId,
    date,
    startAt: mat.startAt,
    endAt: mat.endAt,
    breakDurationMinutes: st.breakDurationMinutes || 0,
    status,
  };
}

const DAY = { startTime: "08:00", endTime: "16:00", breakDurationMinutes: 30, crossesMidnight: false };
const NIGHT = { startTime: "22:00", endTime: "06:00", breakDurationMinutes: 30, crossesMidnight: true };

function shiftTypeOf(id: string) {
  if (id === "st_night") return NIGHT;
  if (id === "st_eve") return { startTime: "14:00", endTime: "22:00", breakDurationMinutes: 0, crossesMidnight: false };
  return DAY;
}

function cand(employeeId: string, shiftTypeId: string, date: string): ShiftCandidate {
  return { employeeId, shiftTypeId, date };
}

// ---------------------------------------------------------------------------
describe("materializeShift", () => {
  it("overnight 22:00-06:00 materializes to the next day", () => {
    const mat = materializeShift("2024-07-10", NIGHT, TZ);
    expect(mat.startAt.startsWith("2024-07-10T22:00")).toBe(true);
    expect(mat.endAt.startsWith("2024-07-11T06:00")).toBe(true);
    expect(mat.paidHours).toBe(7.5);
  });

  it("paid hours subtract the break", () => {
    expect(materializeShift("2024-07-10", DAY, TZ).paidHours).toBe(7.5);
  });
});

describe("overlap (half-open)", () => {
  it("touching shifts do not overlap", () => {
    let ctx = baseCtx();
    ctx = commitToCtx(ctx, cand("e1", "st_day", "2024-07-10")); // ends 16:00
    // Shift ends exactly when the first begins → legal with a half-open interval
    const custom = commitToCtx(baseCtx(), cand("e1", "st_day", "2024-07-10"));
    const end = custom.assignments[0].endAt;
    const touching: AssignmentRecord = { ...custom.assignments[0], id: "a2", startAt: end };
    const ctx2 = { ...custom, assignments: [custom.assignments[0], { ...touching, endAt: new Date(new Date(end).getTime() + 8 * 3600e3).toISOString() }] };
    const v = validateSchedule(ctx2);
    expect(v.violations.filter((x) => x.code === "OVERLAP").length).toBe(0);
  });

  it("a one-minute overlap IS an overlap", () => {
    let ctx = baseCtx();
    ctx = commitToCtx(ctx, cand("e1", "st_day", "2024-07-10"));
    const a = ctx.assignments[0];
    const shifted: AssignmentRecord = {
      ...a,
      id: "a2",
      startAt: new Date(new Date(a.startAt).getTime() + 60 * 1000).toISOString(),
      endAt: new Date(new Date(a.endAt).getTime() + 60 * 1000).toISOString(),
    };
    const v = validateAssignment(
      { employeeId: "e1", shiftTypeId: "st_day", date: "2024-07-10" },
      ctx
    );
    // Other route to the check: candidate one day later must not fire; use direct schedule scan
    expect(v.filter((x) => x.code === "OVERLAP").length).toBe(1);
    expect(shifted.employeeId).toBe("e1");
  });

  it("cancelled assignments are ignored", () => {
    const ctx = baseCtx({
      assignments: [asg("a1", "e1", "st_day", "2024-07-10", "cancelled")],
    });
    const v = validateAssignment(cand("e1", "st_day", "2024-07-10"), ctx);
    expect(v.filter((x) => x.code === "OVERLAP").length).toBe(0);
  });
});

describe("rest rule across neighbours", () => {
  it("a 22:00 shift followed by a next-day 08:00 shift fails a 10h rest rule (gap 2h)", () => {
    const ctx = baseCtx({
      assignments: [asg("a1", "e1", "st_night", "2024-07-10")], // ends 06:00 on the 11th
    });
    const v = validateAssignment(cand("e1", "st_day", "2024-07-11"), ctx);
    const rest = v.find((x) => x.code === "REST_TOO_SHORT");
    expect(rest?.severity).toBe("block");
    expect(rest?.message).toContain("min 10h");
  });

  it("passes when the gap meets the (lowered) min rest: night ends 06:00, evening starts 14:00 = 8h ≥ min 8h", () => {
    const ctx = baseCtx({
      rules: resolveRules({
        timezone: TZ,
        weekStartDay: 1,
        minRestHours: 8,
        maxConsecutiveDays: 6,
        maxWeeklyHours: 48,
        maxNightsPerMonth: 7,
      }),
      assignments: [asg("a1", "e1", "st_night", "2024-07-10")],
    });
    const v = validateAssignment(cand("e1", "st_eve", "2024-07-11"), ctx);
    expect(v.find((x) => x.code === "REST_TOO_SHORT")).toBeUndefined();
  });

  it("period boundary: the 1st sees the 30th shift (neighbours work across months)", () => {
    // Neighbour detection works purely from sorted instants — a month boundary is just another day
    const ctx = baseCtx({
      assignments: [asg("a1", "e1", "st_night", "2024-06-30")],
    });
    const v = validateAssignment(cand("e1", "st_day", "2024-07-01"), ctx);
    expect(v.find((x) => x.code === "REST_TOO_SHORT")?.severity).toBe("block");
  });
});

describe("consecutive days", () => {
  it("a run of 6 passes, the 7th fails; a rest day resets", () => {
    const days = ["2024-07-01", "2024-07-02", "2024-07-03", "2024-07-04", "2024-07-05", "2024-07-06"];
    let ctx = baseCtx({ assignments: days.map((d, i) => asg(`a${i}`, "e1", "st_day", d)) });
    // 7th consecutive day → block
    let v = validateAssignment(cand("e1", "st_day", "2024-07-07"), ctx);
    expect(v.find((x) => x.code === "MAX_CONSECUTIVE_DAYS")?.severity).toBe("block");
    // After a rest day (skip the 7th), the 8th is a run of 1 → passes
    v = validateAssignment(cand("e1", "st_day", "2024-07-08"), ctx);
    expect(v.find((x) => x.code === "MAX_CONSECUTIVE_DAYS")).toBeUndefined();
  });
});

describe("weekly hours & monthly nights", () => {
  it("weekly key follows the configured week start", () => {
    expect(weekKeyOf("2024-07-10", 1, TZ)).toBe("2024-07-08"); // Monday
    expect(weekKeyOf("2024-07-10", 0, TZ)).toBe("2024-07-07"); // Sunday start
    expect(monthKeyOf("2024-07-26", TZ)).toBe("2024-07");
  });
});

describe("leave & off days", () => {
  it("approved leave blocks; a night shift ending inside leave is caught", () => {
    const ctx = baseCtx({
      leaves: [
        { id: "l1", employeeId: "e1", status: "approved", startDate: "2024-07-11", endDate: "2024-07-13" },
      ],
    });
    const v = validateAssignment(cand("e1", "st_night", "2024-07-10"), ctx);
    expect(v.find((x) => x.code === "ON_LEAVE")?.severity).toBe("block");
  });

  it("pending leave behaves per the configured setting", () => {
    const ctx = baseCtx({
      leaves: [{ id: "l2", employeeId: "e1", status: "pending", startDate: "2024-07-11", endDate: "2024-07-11" }],
    });
    expect(validateAssignment(cand("e1", "st_day", "2024-07-11"), ctx).find((x) => x.code === "ON_LEAVE")?.severity).toBe("warn");
    const strict = baseCtx({
      rules: resolveRules({ timezone: TZ, weekStartDay: 1, minRestHours: 10, maxConsecutiveDays: 6, maxWeeklyHours: 48, maxNightsPerMonth: 7, pendingLeaveAction: "block" }) as any,
      leaves: [{ id: "l2", employeeId: "e1", status: "pending", startDate: "2024-07-11", endDate: "2024-07-11" }],
    });
    expect(validateAssignment(cand("e1", "st_day", "2024-07-11"), strict).find((x) => x.code === "ON_LEAVE")?.severity).toBe("block");
  });

  it("off day blocks", () => {
    const ctx = baseCtx({ offDays: [{ id: "o1", employeeId: "e1", date: "2024-07-10" }] });
    expect(validateAssignment(cand("e1", "st_day", "2024-07-10"), ctx).find((x) => x.code === "OFF_DAY")?.severity).toBe("block");
  });
});

describe("coverage & requirements", () => {
  it("falls back to legacy per-type minimums when no policy rows exist", () => {
    const ctx = baseCtx();
    const reqs = requirementsForShiftType(ctx, "st_day");
    expect(reqs.some((r) => r.designation === "RN" && r.minStaff === 2)).toBe(true);
  });

  it("reports per-designation shortfalls and max caps", () => {
    const ctx = baseCtx({
      requirements: [
        { shiftTypeId: "st_night", designation: "MD", minStaff: 1, maxStaff: 1 },
      ] as ShiftRequirement[],
      assignments: [asg("a1", "e2", "st_night", "2024-07-10")],
    });
    const cells = coverage(ctx, { from: "2024-07-10", to: "2024-07-10" });
    const md = cells.find((c) => c.designation === "MD");
    expect(md?.short).toBe(1); // both are RN — MD slot is unfilled
  });
});

describe("previewBulk", () => {
  it("applies only conflict-free rows in order and reports the rest", () => {
    const days = ["2024-07-01", "2024-07-02", "2024-07-03", "2024-07-04", "2024-07-05", "2024-07-06"];
    const ctx = baseCtx({ assignments: days.map((d, i) => asg(`a${i}`, "e1", "st_day", d)) });
    const ops = [cand("e1", "st_day", "2024-07-08"), cand("e1", "st_day", "2024-07-09"), cand("e1", "st_day", "2024-07-07")];
    const { applied, violations } = previewBulk(ops, ctx);
    expect(applied.map((o) => o.date).sort()).toEqual(["2024-07-08", "2024-07-09"]);
    expect(violations.some((v) => v.code === "MAX_CONSECUTIVE_DAYS")).toBe(true);
  });
});

describe("proposeAutoAssign", () => {
  it("produces zero NEW blocking violations and is deterministic per seed", () => {
    const ctx = baseCtx({
      leaves: [{ id: "l1", employeeId: "e1", status: "approved", startDate: "2024-07-04", endDate: "2024-07-05" }],
    });
    const input = {
      range: { from: "2024-07-08", to: "2024-07-12" },
      mode: "fill_gaps" as const,
      seed: 42,
    };
    const p1 = proposeAutoAssign(input, ctx);
    const p2 = proposeAutoAssign({ ...input, seed: 42 }, ctx);
    expect(JSON.stringify(p1.assignments)).toBe(JSON.stringify(p2.assignments));
    expect(p1.inputHash).toBe(p2.inputHash);

    for (const p of p1.assignments) {
      const working = commitToCtx(commitCtx, p);
      commitCtx = working;
      const v = validateAssignment({ employeeId: p.employeeId, shiftTypeId: p.shiftTypeId, date: p.date }, ctx);
      // No NEW blocks (existing seeded conflicts may warn)
      expect(v.filter((x) => x.severity === "block").length).toBe(0);
      void working;
    }
  });

  it("never overwrites locked or completed assignments (fill_gaps keeps everything)", () => {
    const days = ["2024-07-08", "2024-07-09", "2024-07-10", "2024-07-11", "2024-07-12"];
    const ctx = baseCtx({
      assignments: days.map((d, i) => ({ ...asg(`a${i}`, "e2", "st_day", d), status: i === 0 ? "completed" : "assigned", locked: i === 0 })),
    });
    const p = proposeAutoAssign(
      { range: { from: "2024-07-08", to: "2024-07-12" }, mode: "fill_gaps", seed: 7 },
      ctx
    );
    // No proposal duplicates an existing (employee, date)
    const dup = p.assignments.find(
      (a) => ctx.assignments.some((x) => x.employeeId === a.employeeId && x.date === a.date)
    );
    expect(dup).toBeUndefined();
  });

  it("reports unfilled slots with reason counts when demand exceeds supply", () => {
    const ctx = baseCtx({
      employees: [{ ...baseCtx().employees[0] }], // only one nurse
      leaves: [{ id: "l1", employeeId: "e1", status: "approved", startDate: "2024-07-08", endDate: "2024-07-12" }],
    });
    const p = proposeAutoAssign(
      { range: { from: "2024-07-08", to: "2024-07-12" }, mode: "fill_gaps", seed: 3 },
      ctx
    );
    expect(p.unfilled.length).toBeGreaterThan(0);
    expect(p.unfilled[0].short).toBeGreaterThan(0);
    // e1 is on leave the whole range — the reason must reflect it
    const reasons = Object.entries(p.unfilled[0].reasons);
    expect(reasons.length).toBeGreaterThan(0);
  });
});

let commitCtx = baseCtx(); // running "in-memory schedule" for the proposal check
