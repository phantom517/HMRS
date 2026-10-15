"use server";

import { db } from "@/lib/db";
import { getCurrentUser, requirePermission, requireSuperuser } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export async function createLeaveRecordAction(formData: {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  replacementEmployeeId?: string;
  notes?: string;
}) {
  const actor = await getCurrentUser();

  const [employee, leaveType] = await Promise.all([
    db.getEmployeeById(formData.employeeId),
    db.getLeaveTypes().then((types) => types.find((t) => t.id === formData.leaveTypeId)),
  ]);

  if (!employee || !leaveType) throw new Error("Employee or leave type not found.");

  // Calculate duration days
  const start = new Date(formData.startDate + "T00:00:00Z");
  const end = new Date(formData.endDate + "T00:00:00Z");
  const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  const initialStatus = actor.role === "superuser" ? "approved" : "pending";

  const newRecord = await db.createLeaveRecord({
    employeeId: formData.employeeId,
    leaveTypeId: formData.leaveTypeId,
    startDate: formData.startDate,
    endDate: formData.endDate,
    durationDays: diffDays.toFixed(1),
    reason: formData.reason,
    status: initialStatus,
    replacementEmployeeId: formData.replacementEmployeeId || null,
    replacementStatus: formData.replacementEmployeeId ? "assigned" : "unassigned",
    recordedBy: actor.name,
    reviewedBy: initialStatus === "approved" ? actor.name : null,
    reviewedAt: initialStatus === "approved" ? new Date() : null,
    notes: formData.notes || null,
  });

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: initialStatus === "approved" ? "LEAVE_RECORDED_AND_APPROVED" : "LEAVE_REQUESTED",
    entityType: "leave_record",
    entityId: newRecord.id,
    details: `${initialStatus === "approved" ? "Logged and approved" : "Submitted"} leave for ${employee.fullName} (${leaveType.name}, ${diffDays} days from ${formData.startDate} to ${formData.endDate})`,
    newValues: newRecord,
  });

  revalidatePath("/leave-off-days");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true, leaveRecord: newRecord };
}

export async function updateLeaveStatusAction(id: string, status: "approved" | "rejected" | "cancelled") {
  const actor = await requirePermission("canApproveLeave");
  const leave = await db.getLeaveRecordById(id);
  if (!leave) throw new Error("Leave record not found.");

  const employee = await db.getEmployeeById(leave.employeeId);

  const updated = await db.updateLeaveRecord(id, {
    status,
    reviewedBy: actor.name,
    reviewedAt: new Date(),
  });

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: `LEAVE_${status.toUpperCase()}`,
    entityType: "leave_record",
    entityId: id,
    details: `${status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Cancelled"} leave for ${employee?.fullName || "Staff"} (${leave.durationDays}d from ${leave.startDate})`,
    previousValues: { status: leave.status },
    newValues: { status },
  });

  revalidatePath("/leave-off-days");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true, leaveRecord: updated };
}

export async function createOffDayAction(params: {
  employeeId: string;
  date: string;
  reason?: string;
  notes?: string;
}) {
  const actor = await requirePermission("canAssignShifts");
  const employee = await db.getEmployeeById(params.employeeId);
  if (!employee) throw new Error("Employee not found.");

  const newOffDay = await db.createOffDay({
    employeeId: params.employeeId,
    date: params.date,
    reason: params.reason || "Scheduled Rotational Rest Interval",
    notes: params.notes || "Separate from statutory leave bank.",
    recordedBy: actor.name,
  });

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "OFF_DAY_SCHEDULED",
    entityType: "off_day",
    entityId: newOffDay.id,
    details: `Scheduled rotational rest day for ${employee.fullName} on ${params.date}`,
    newValues: newOffDay,
  });

  revalidatePath("/leave-off-days");
  revalidatePath("/duty-roster");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true, offDay: newOffDay };
}

export async function deleteOffDayAction(id: string) {
  const actor = await requirePermission("canAssignShifts");
  await db.deleteOffDay(id);

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "OFF_DAY_REMOVED",
    entityType: "off_day",
    entityId: id,
    details: `Removed off day schedule record`,
  });

  revalidatePath("/leave-off-days");
  revalidatePath("/duty-roster");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true };
}

export async function adjustLeaveBalanceAction(params: {
  employeeId: string;
  leaveTypeId: string;
  amount: number; // positive or negative
  reason: string;
}) {
  const actor = await requireSuperuser();
  const employee = await db.getEmployeeById(params.employeeId);
  if (!employee) throw new Error("Employee not found");

  const adjustment = await db.createLeaveBalanceAdjustment({
    employeeId: params.employeeId,
    leaveTypeId: params.leaveTypeId,
    amount: params.amount.toFixed(1),
    reason: params.reason,
    createdBy: actor.name,
  });

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "LEAVE_BALANCE_ADJUSTED",
    entityType: "leave_balance_adjustment",
    entityId: adjustment.id,
    details: `Adjusted leave balance for ${employee.fullName} by ${params.amount > 0 ? "+" : ""}${params.amount} days (${params.reason})`,
    newValues: adjustment,
  });

  revalidatePath("/leave-off-days");
  revalidatePath(`/employees/${params.employeeId}`);
  revalidatePath("/employees");
  return { success: true, adjustment };
}

export async function updateLeavePolicyAction(id: string, updates: Partial<{
  allowanceDays: string;
  carryForwardDays: string;
  active: boolean;
}>) {
  const actor = await requireSuperuser();
  const updated = await db.updateLeavePolicy(id, updates);
  if (!updated) throw new Error("Policy not found");

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "LEAVE_POLICY_UPDATED",
    entityType: "leave_policy",
    entityId: id,
    details: `Updated policy '${updated.name}' allowance to ${updated.allowanceDays} days`,
    newValues: updated,
  });

  revalidatePath("/leave-off-days");
  return { success: true, policy: updated };
}
