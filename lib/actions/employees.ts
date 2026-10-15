"use server";

import { db } from "@/lib/db";
import { getCurrentUser, requirePermission, requireSuperuser } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export async function createEmployeeAction(formData: {
  employeeId: string;
  fullName: string;
  designation: string;
  department?: string;
  unit?: string;
  phoneNumber: string;
  email: string;
  hospitalExt?: string;
  pagerNumber?: string;
  dateJoined: string;
  employmentStatus?: string;
  notes?: string;
  credentials?: Array<{ name: string; issuer: string; expires: string; status: string }>;
}) {
  const actor = await requirePermission("canEditEmployees");

  if (!formData.employeeId || !formData.fullName || !formData.designation || !formData.email) {
    throw new Error("Missing required clinical employee fields.");
  }

  const newEmp = await db.createEmployee(formData);

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "EMPLOYEE_CREATED",
    entityType: "employee",
    entityId: newEmp.id,
    details: `Created clinical profile for ${newEmp.fullName} (${newEmp.employeeId} • ${newEmp.designation})`,
    newValues: newEmp,
  });

  revalidatePath("/employees");
  revalidatePath("/");
  return { success: true, employee: newEmp };
}

export async function updateEmployeeAction(id: string, updates: Partial<{
  employeeId: string;
  fullName: string;
  designation: string;
  department: string;
  unit: string;
  phoneNumber: string;
  email: string;
  hospitalExt: string;
  pagerNumber: string;
  dateJoined: string;
  employmentStatus: string;
  notes: string;
  credentials: Array<{ name: string; issuer: string; expires: string; status: string }>;
}>) {
  const actor = await requirePermission("canEditEmployees");
  const previous = await db.getEmployeeById(id);

  const updated = await db.updateEmployee(id, updates);
  if (!updated) throw new Error("Employee not found.");

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "EMPLOYEE_UPDATED",
    entityType: "employee",
    entityId: id,
    details: `Updated details for ${updated.fullName} (${updated.employeeId})`,
    previousValues: previous,
    newValues: updated,
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
  revalidatePath("/");
  return { success: true, employee: updated };
}

export async function archiveEmployeeAction(id: string) {
  const actor = await requireSuperuser();
  const emp = await db.archiveEmployee(id);
  if (!emp) throw new Error("Employee not found");

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "EMPLOYEE_ARCHIVED",
    entityType: "employee",
    entityId: id,
    details: `Archived employee ${emp.fullName} (${emp.employeeId}). Historical roster and leave data preserved.`,
  });

  revalidatePath("/employees");
  revalidatePath("/");
  return { success: true, employee: emp };
}

export async function restoreEmployeeAction(id: string) {
  const actor = await requireSuperuser();
  const emp = await db.restoreEmployee(id);
  if (!emp) throw new Error("Employee not found");

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "EMPLOYEE_RESTORED",
    entityType: "employee",
    entityId: id,
    details: `Restored archived employee ${emp.fullName} (${emp.employeeId}) to active clinical registry.`,
  });

  revalidatePath("/employees");
  revalidatePath("/");
  return { success: true, employee: emp };
}

export async function deleteEmployeeAction(id: string) {
  const actor = await requireSuperuser();
  const result = await db.deleteEmployee(id);

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: result.archivedInstead ? "EMPLOYEE_ARCHIVED_RETENTION" : "EMPLOYEE_PERMANENTLY_DELETED",
    entityType: "employee",
    entityId: id,
    details: result.message,
  });

  revalidatePath("/employees");
  revalidatePath("/");
  return result;
}

/**
 * Hard delete: removes the employee AND every historical shift, leave,
 * balance adjustment and off-day record tied to them. Irreversible.
 * Wiped history destroys audit/compliance evidence, so only the superuser
 * (or an assistant explicitly granted canDeleteEmployees) may do it.
 */
export async function hardDeleteEmployeeAction(id: string) {
  const actor = await requirePermission("canDeleteEmployees");

  const result = await db.hardDeleteEmployee(id);
  if (!result.deleted) throw new Error(result.message || "Employee could not be deleted.");

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "EMPLOYEE_HARD_DELETED",
    entityType: "employee",
    entityId: id,
    details: result.message,
    previousValues: result.employee,
  });

  revalidatePath("/employees");
  revalidatePath("/");
  return { success: true, message: result.message, employee: result.employee };
}
