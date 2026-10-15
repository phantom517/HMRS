"use server";

import { db } from "@/lib/db";
import { getCurrentUser, requirePermission, requireSuperuser } from "@/lib/auth/session";
import { loadSchedulingContext, materializeForWrite } from "@/lib/scheduling/loader";
import { validateAssignment, validateSchedule } from "@/lib/scheduling/rules";
import { addDaysLocal } from "@/lib/scheduling/materialize";
import { cycleToday } from "@/lib/schedule-cycle";
import {
  RULE_BOUNDS,
  parseRulesDraft,
} from "@/lib/scheduling/settings";
import { diffViolations } from "@/lib/scheduling/rules-impact";
import { proposeAutoAssign } from "@/lib/scheduling/autoAssign";
import { revalidatePath } from "next/cache";

/**
 * Smart Fill: auto-schedule the roster window up to minimum safe staffing.
 * Honors leave, off-days, rest intervals, weekly hours cap and fatigue streaks.
 * Never touches existing assignments — only fills genuine shortfalls.
 */
export async function smartFillRosterAction(params: {
  startDate: string;
  endDate: string;
}) {
  const actor = await requirePermission("canManageShifts");

  // Auto-assign runs through the pure scheduling engine (one source of rules).
  const ctx = await loadSchedulingContext({ from: params.startDate, to: params.endDate });
  const proposal = proposeAutoAssign(
    {
      range: { from: params.startDate, to: params.endDate },
      mode: "fill_gaps",
      seed: 20241024,
      timeBudgetMs: (ctx as any).autoAssignTimeBudgetMs || 2000,
    } as any,
    ctx as any
  );
  const result: { created: any[]; skipped: number; byDate: Record<string, number>; proposal: any } = {
    created: [],
    skipped: 0,
    byDate: {},
    proposal,
  };

  // Persist ONLY the engine's proposal, clipped to the requested date range.
  for (const p of proposal.assignments) {
    if (p.date < params.startDate || p.date > params.endDate) continue;
    try {
      const created = await persistProposal(p, actor.name);
      result.created.push(created);
      result.byDate[p.date] = (result.byDate[p.date] || 0) + 1;
    } catch {
      result.skipped += 1;
    }
  }

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "SMART_FILL_EXECUTED",
    entityType: "shift_assignment",
    entityId: "smart_fill",
    details: `Smart Fill scheduled ${result.created.length} shifts for ${params.startDate} → ${params.endDate} (${result.skipped} slots left unfilled — no eligible staff).`,
    newValues: { byDate: result.byDate, created: result.created.length },
  });

  revalidatePath("/duty-roster");
  revalidatePath("/calendar");
  revalidatePath("/");
  return {
    success: true,
    count: result.created.length,
    skipped: result.skipped,
    assignments: result.created,
    unfilled: proposal.unfilled,
  };
}

/** Insert one engine proposal; the DB no-overlap exclusion is the final guard. */
async function persistProposal(p: any, actorName: string) {
  const shiftType = await db.getShiftTypeById(p.shiftTypeId);
  const employee = await db.getEmployeeById(p.employeeId);
  if (!shiftType || !employee) throw new Error("Employee or shift type missing.");
  return db.createShiftAssignment({
    employeeId: p.employeeId,
    shiftTypeId: p.shiftTypeId,
    date: p.date,
    startAt: new Date(p.startAt),
    endAt: new Date(p.endAt),
    scheduledBreakMinutes: shiftType.breakDurationMinutes,
    status: "assigned",
    wardZone: employee.unit,
    stationRole: employee.designation,
    notes: null,
    handoverNotes: null,
    conflictFlag: false,
    conflictReason: null,
    createdBy: actorName,
  });
}

export async function createShiftTypeAction(data: {
  name: string;
  shortCode: string;
  description?: string;
  color: string;
  category?: string;
  startTime: string;
  endTime: string;
  breakDurationMinutes: number;
  minimumStaffRn: number;
  minimumStaffMd: number;
  targetStaff?: number;
  maximumStaff?: number;
  crossesMidnight: boolean;
  enforceRestRule?: boolean;
  traumaPremium?: boolean;
}) {
  const actor = await requirePermission("canManageShifts");

  // Calculate net duration
  const [sH, sM] = data.startTime.split(":").map(Number);
  const [eH, eM] = data.endTime.split(":").map(Number);
  let startMins = sH * 60 + sM;
  let endMins = eH * 60 + eM;
  if (endMins <= startMins || data.crossesMidnight) {
    endMins += 24 * 60;
  }
  const totalMins = endMins - startMins;
  const netMins = Math.max(0, totalMins - (data.breakDurationMinutes || 0));
  const netHours = (netMins / 60).toFixed(2);

  const newShift = await db.createShiftType({
    ...data,
    netDurationHours: netHours,
    active: true,
  });

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "SHIFT_TYPE_CREATED",
    entityType: "shift_type",
    entityId: newShift.id,
    details: `Created shift type [${newShift.shortCode}] ${newShift.name} (${newShift.startTime}-${newShift.endTime}, ${netHours}h net)`,
    newValues: newShift,
  });

  revalidatePath("/shift-types");
  revalidatePath("/duty-roster");
  revalidatePath("/");
  return { success: true, shiftType: newShift };
}

export async function updateShiftTypeAction(id: string, updates: Partial<any>) {
  const actor = await requirePermission("canManageShifts");
  const previous = await db.getShiftTypeById(id);

  if (updates.startTime && updates.endTime) {
    const [sH, sM] = updates.startTime.split(":").map(Number);
    const [eH, eM] = updates.endTime.split(":").map(Number);
    let startMins = sH * 60 + sM;
    let endMins = eH * 60 + eM;
    if (endMins <= startMins || updates.crossesMidnight) {
      endMins += 24 * 60;
    }
    const totalMins = endMins - startMins;
    const breakMins = updates.breakDurationMinutes !== undefined ? updates.breakDurationMinutes : (previous?.breakDurationMinutes || 0);
    const netMins = Math.max(0, totalMins - breakMins);
    updates.netDurationHours = (netMins / 60).toFixed(2);
  }

  const updated = await db.updateShiftType(id, updates);
  if (!updated) throw new Error("Shift type not found.");

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "SHIFT_TYPE_UPDATED",
    entityType: "shift_type",
    entityId: id,
    details: `Updated shift template [${updated.shortCode}] ${updated.name}`,
    previousValues: previous,
    newValues: updated,
  });

  revalidatePath("/shift-types");
  revalidatePath("/duty-roster");
  revalidatePath("/");
  return { success: true, shiftType: updated };
}

export async function toggleShiftTypeActiveAction(id: string, active: boolean) {
  const actor = await requirePermission("canManageShifts");
  const shift = await db.updateShiftType(id, { active });
  if (!shift) throw new Error("Shift type not found");

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: active ? "SHIFT_TYPE_ACTIVATED" : "SHIFT_TYPE_DEACTIVATED",
    entityType: "shift_type",
    entityId: id,
    details: `${active ? "Activated" : "Deactivated"} shift type [${shift.shortCode}] in scheduling matrix.`,
  });

  revalidatePath("/shift-types");
  revalidatePath("/duty-roster");
  return { success: true, shiftType: shift };
}

export async function createShiftAssignmentAction(params: {
  employeeId: string;
  shiftTypeId: string;
  date: string; // YYYY-MM-DD
  wardZone?: string;
  stationRole?: string;
  notes?: string;
  handoverNotes?: string;
  forceOverrideWarnings?: boolean;
}) {
  const actor = await requirePermission("canAssignShifts");

  // ONE source of scheduling truth: the pure engine (rules come from
  // department_settings + shift_requirements + per-employee exceptions).
  const ctx = await loadSchedulingContext({ from: params.date, to: params.date });
  const violations = validateAssignment(
    { employeeId: params.employeeId, shiftTypeId: params.shiftTypeId, date: params.date, ignoreRestWarning: params.forceOverrideWarnings },
    ctx as any
  );

  const blocking = violations.filter((v) => v.severity === "block");
  if (blocking.length > 0) {
    throw new Error(blocking.map((v) => v.message).join(" · "));
  }
  const warnings = violations.filter((v) => v.severity === "warn");

  const [employee, shiftType] = await Promise.all([
    db.getEmployeeById(params.employeeId),
    db.getShiftTypeById(params.shiftTypeId),
  ]);

  if (!employee || !shiftType) throw new Error("Employee or shift type missing.");

  const tz = ctx.rules.timezone || "UTC";
  const mat = materializeForWrite(params.date, shiftType, tz);
  const startAt = new Date(mat.startAt);
  const endAt = new Date(mat.endAt);

  const hasWarnings = warnings.length > 0;
  const newAssignment = await db.createShiftAssignment({
    employeeId: params.employeeId,
    shiftTypeId: params.shiftTypeId,
    date: params.date,
    startAt,
    endAt,
    scheduledBreakMinutes: shiftType.breakDurationMinutes,
    status: "assigned",
    wardZone: params.wardZone || employee.unit,
    stationRole: params.stationRole || employee.designation,
    notes: params.notes || null,
    handoverNotes: params.handoverNotes || null,
    conflictFlag: hasWarnings,
    conflictReason: hasWarnings ? warnings.map((w: any) => w.message).join("; ") : null,
    createdBy: actor.name,
  });

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "SHIFT_ASSIGNED",
    entityType: "shift_assignment",
    entityId: newAssignment.id,
    details: `Assigned ${employee.fullName} to [${shiftType.shortCode}] on ${params.date}${hasWarnings ? " (Warning flagged)" : ""}`,
    newValues: newAssignment,
  });

  revalidatePath("/duty-roster");
  revalidatePath("/calendar");
  revalidatePath("/");
  return {
    success: true,
    assignment: newAssignment,
    warnings,
  };
}

export async function updateShiftAssignmentAction(id: string, updates: Partial<{
  shiftTypeId: string;
  date: string;
  status: string;
  wardZone: string;
  stationRole: string;
  notes: string;
  handoverNotes: string;
}>) {
  const actor = await requirePermission("canAssignShifts");
  const previous = await db.getShiftAssignmentById(id);
  if (!previous) throw new Error("Assignment not found.");

  const updated = await db.updateShiftAssignment(id, {
    ...updates,
    updatedBy: actor.name,
  });

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "SHIFT_ASSIGNMENT_UPDATED",
    entityType: "shift_assignment",
    entityId: id,
    details: `Updated assignment ${id} status to ${updates.status || previous.status}`,
    previousValues: previous,
    newValues: updated,
  });

  revalidatePath("/duty-roster");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true, assignment: updated };
}

export async function deleteShiftAssignmentAction(id: string) {
  const actor = await requirePermission("canAssignShifts");
  const asg = await db.getShiftAssignmentById(id);
  if (!asg) throw new Error("Assignment not found");

  await db.deleteShiftAssignment(id);

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "SHIFT_ASSIGNMENT_REMOVED",
    entityType: "shift_assignment",
    entityId: id,
    details: `Removed assignment for employee ${asg.employeeId} on ${asg.date}`,
  });

  revalidatePath("/duty-roster");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true };
}

export async function bulkAssignShiftsAction(params: {
  employeeIds: Array<string>;
  shiftTypeId: string;
  startDate: string;
  endDate: string;
  daysOfWeek?: Array<number>; // 0=Sun, 1=Mon...
  wardZone?: string;
  forceOverride?: boolean;
}) {
  const actor = await requirePermission("canAssignShifts");

  const results: Array<any> = [];
  const errors: Array<string> = [];

  const start = new Date(params.startDate + "T00:00:00Z");
  const end = new Date(params.endDate + "T00:00:00Z");

  for (const empId of params.employeeIds) {
    const curr = new Date(start);
    while (curr <= end) {
      const dayNum = curr.getUTCDay();
      if (!params.daysOfWeek || params.daysOfWeek.includes(dayNum)) {
        const dateStr = curr.toISOString().split("T")[0];
        try {
          const res = await createShiftAssignmentAction({
            employeeId: empId,
            shiftTypeId: params.shiftTypeId,
            date: dateStr,
            wardZone: params.wardZone,
            forceOverrideWarnings: params.forceOverride,
          });
          results.push(res.assignment);
        } catch (err: any) {
          errors.push(`${dateStr} (Emp ${empId}): ${err.message}`);
        }
      }
      curr.setDate(curr.getDate() + 1);
    }
  }

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "BULK_ASSIGNMENT_EXECUTED",
    entityType: "shift_assignment",
    entityId: "bulk",
    details: `Bulk scheduled ${results.length} shifts across ${params.employeeIds.length} staff members (${params.startDate} to ${params.endDate})`,
  });

  revalidatePath("/duty-roster");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true, count: results.length, errors };
}

export async function resolveCoverageDeficitAction(params: {
  leaveRecordId?: string;
  targetEmployeeId: string;
  replacementEmployeeId: string;
  date: string;
  shiftTypeId: string;
  notes?: string;
}) {
  const actor = await requirePermission("canAssignShifts");

  const [target, replacement, shiftType] = await Promise.all([
    db.getEmployeeById(params.targetEmployeeId),
    db.getEmployeeById(params.replacementEmployeeId),
    db.getShiftTypeById(params.shiftTypeId),
  ]);

  if (!target || !replacement || !shiftType) throw new Error("Invalid staff or shift selection.");

  // Create replacement shift assignment
  const asg = await createShiftAssignmentAction({
    employeeId: replacement.id,
    shiftTypeId: shiftType.id,
    date: params.date,
    wardZone: target.unit,
    stationRole: `Coverage for ${target.fullName}`,
    notes: `Emergency coverage dispatch: Substitute for ${target.fullName} (${params.notes || "Medical Leave"})`,
    forceOverrideWarnings: true,
  });

  // If there was a leave record, update replacement status
  if (params.leaveRecordId) {
    await db.updateLeaveRecord(params.leaveRecordId, {
      replacementEmployeeId: replacement.id,
      replacementStatus: "assigned",
    });
  }

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "DEFICIT_COVERED",
    entityType: "shift_assignment",
    entityId: asg.assignment.id,
    details: `Dispatched ${replacement.fullName} to cover ${target.fullName}'s [${shiftType.shortCode}] on ${params.date}`,
  });

  revalidatePath("/duty-roster");
  revalidatePath("/leave-off-days");
  revalidatePath("/");
  return { success: true, assignment: asg.assignment };
}

export async function updateDepartmentSettingsAction(settingsData: Partial<{
  departmentName?: string;
  hospitalName?: string;
  timezone?: string;
  startDayOfWeek?: number;
  weekStartDay?: number;
  enforceRestInterval?: boolean;
  allowEmergencyOvertime?: boolean;
  weeklyHoursCap?: number;
  warningHoursCap?: number;
  consecutiveShiftsCap?: number;
  maxConsecutiveDays?: number;
  maxNightShiftsPerMonth?: number;
  maxNightsPerMonth?: number;
  minRestHoursBetweenShifts?: number;
  rosterLockHoursAhead?: number;
  maxWeeklyHoursSeverity?: "warn" | "block";
  maxNightsSeverity?: "warn" | "block";
  pendingLeaveAction?: "warn" | "ignore" | "block";
  autoAssignEnabled?: boolean;
  autoAssignTimeBudgetMs?: number;
}>) {
  const actor = await requireSuperuser();
  const previous = await db.getDepartmentSettings();

  // Cross-field + bounds validation on the rule subset (server-side, not
  // prompt-only and not client-only). Rejects rather than clamping so the
  // caller sees the real reason.
  const ruleKeys = [
    "minRestHoursBetweenShifts",
    "consecutiveShiftsCap",
    "maxNightsPerMonth",
    "weeklyHoursCap",
    "warningHoursCap",
    "rosterLockHoursAhead",
  ] as const;
  for (const key of ruleKeys) {
    const v = (settingsData as Record<string, unknown>)[key];
    if (v != null) {
      const bound = RULE_BOUNDS[key];
      const n = Number(v);
      if (!Number.isFinite(n) || n < bound.min || n > bound.max) {
        throw new Error(`${key} must be between ${bound.min} and ${bound.max}.`);
      }
    }
  }
  if (
    settingsData.warningHoursCap != null &&
    settingsData.weeklyHoursCap != null &&
    Number(settingsData.warningHoursCap) > Number(settingsData.weeklyHoursCap)
  ) {
    throw new Error("Warn at must not exceed the weekly max.");
  }
  for (const key of ["maxWeeklyHoursSeverity", "maxNightsSeverity"] as const) {
    const v = (settingsData as Record<string, unknown>)[key];
    if (v != null && v !== "warn" && v !== "block") {
      throw new Error(`${key} must be "warn" or "block".`);
    }
  }

  const updated = await db.updateDepartmentSettings({
    ...settingsData,
    updatedBy: actor.name,
  });

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "GUARDRAILS_UPDATED",
    entityType: "department_settings",
    entityId: updated.id || "dept_settings",
    details: `Updated department settings: ${Object.keys(settingsData).join(", ")}`,
    previousValues: previous,
    newValues: updated,
  });

  revalidatePath("/shift-types");
  revalidatePath("/settings");
  revalidatePath("/");
  return { success: true, settings: updated };
}

/**
 * Impact preview for a rules draft: runs validateSchedule on the current
 * roster with the draft rules vs the stored ones and diffs the violations.
 * Read-only — never writes. This is what opens the "This adds 3 conflicts
 * and clears 1" dialog; nothing is applied silently.
 */
export async function previewRulesImpactAction(
  draft: Partial<{
    minRestHoursBetweenShifts: number;
    consecutiveShiftsCap: number;
    maxNightsPerMonth: number;
    weeklyHoursCap: number;
    warningHoursCap: number;
    maxWeeklyHoursSeverity: string;
    maxNightsSeverity: string;
    pendingLeaveAction: string;
    weekStartDay: number;
    timezone: string;
  }>
) {
  await requireSuperuser();

  const parsed = parseRulesDraft(draft);
  if (!parsed.ok) {
    throw new Error(parsed.errors.map((e) => e.message).join(" "));
  }

  const today = cycleToday();
  const range = { from: addDaysLocal(today, -42, "UTC"), to: addDaysLocal(today, 42, "UTC") };
  const ctx = await loadSchedulingContext(range);

  // Draft rules mapped into the engine vocabulary, merged over the stored ones.
  const clamped = (v: number, b: { min: number; max: number }) =>
    Math.min(b.max, Math.max(b.min, v));
  const draftRules: Record<string, unknown> = {
    ...ctx.rules,
    minRestHours: clamped(parsed.value.minRestHoursBetweenShifts, RULE_BOUNDS.minRestHoursBetweenShifts),
    maxConsecutiveDays: clamped(parsed.value.consecutiveShiftsCap, RULE_BOUNDS.consecutiveShiftsCap),
    maxNightsPerMonth: clamped(parsed.value.maxNightsPerMonth, RULE_BOUNDS.maxNightsPerMonth),
    maxWeeklyHours: clamped(parsed.value.weeklyHoursCap, RULE_BOUNDS.weeklyHoursCap),
    maxWeeklyHoursSeverity: parsed.value.maxWeeklyHoursSeverity,
    maxNightsSeverity: parsed.value.maxNightsSeverity,
    pendingLeaveAction: parsed.value.pendingLeaveAction,
    weekStartDay: parsed.value.weekStartDay,
  };

  const before = validateSchedule(ctx, range).violations;
  const after = validateSchedule(
    { ...ctx, rules: draftRules as unknown as typeof ctx.rules },
    range
  ).violations;

  return diffViolations(
    before,
    after,
    ctx.employees
  );
}

/**
 * Per shift-type × designation staffing policy (the "who must be on this shift"
 * rows). This is what coverage checks and auto-assign fill.
 */
export async function saveShiftRequirementAction(params: {
  shiftTypeId: string;
  designation: string;
  minStaff: number;
  maxStaff: number | null;
}) {
  const actor = await requirePermission("canManageShifts");
  const saved = await db.upsertShiftRequirement({
    shiftTypeId: params.shiftTypeId,
    designation: params.designation || "any",
    minStaff: Math.max(0, Number(params.minStaff) || 0),
    maxStaff: params.maxStaff != null && Number(params.maxStaff) > 0 ? Number(params.maxStaff) : null,
  });
  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "SHIFT_REQUIREMENT_UPDATED",
    entityType: "shift_requirement",
    entityId: `${params.shiftTypeId}:${saved.designation}`,
    details: `Set ${params.shiftTypeId} ${saved.designation} staffing: min ${saved.minStaff}${saved.maxStaff != null ? `, max ${saved.maxStaff}` : ""}`,
  });
  revalidatePath("/shift-types");
  revalidatePath("/duty-roster");
  return { success: true, requirement: saved };
}
