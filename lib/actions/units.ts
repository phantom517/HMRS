"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

type UnitUpdates = Partial<{
  name: string;
  description: string | null;
  color: string | null;
  sortOrder: number;
  active: boolean;
}>;

type RoleUpdates = Partial<{
  name: string;
  staffClass: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
}>;

// ── Units ──────────────────────────────────────────────────────────────────

export async function getUnitsAction() {
  await requirePermission("canEditEmployees");
  return { units: await db.getUnits() };
}

export async function createUnitAction(data: UnitUpdates & { name: string }) {
  const actor = await requirePermission("canEditEmployees");

  if (!data.name?.trim()) throw new Error("Unit name is required.");

  const normalized = data.name.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 .()\-]*$/.test(normalized)) {
    throw new Error("Unit name contains invalid characters.");
  }

  const existing = await db.getUnits();
  const duplicate = existing.find((u) => u.name.toLowerCase() === normalized.toLowerCase());
  if (duplicate) {
    throw new Error(`Unit "${normalized}" already exists.`);
  }

  const overlapping = existing.filter((u) => {
    if (u.id === undefined) return false;
    const t = u.name.toLowerCase();
    const n = normalized.toLowerCase();
    if (t === n) return false;
    return t.includes(n) || n.includes(t);
  });
  if (overlapping.length > 0) {
    throw new Error(
      `Similar unit name already exists: "${overlapping[0].name}". Choose a distinct name instead of one that contains or is contained by an existing unit.`
    );
  }

  const unit = await db.createUnit({ ...data, name: data.name.trim() });

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "UNIT_CREATED",
    entityType: "unit",
    entityId: unit.id,
    details: `Created unit "${unit.name}".`,
    newValues: unit,
  });

  revalidatePath("/settings");
  revalidatePath("/employees");
  return { success: true, unit };
}

export async function updateUnitAction(id: string, updates: UnitUpdates) {
  const actor = await requirePermission("canEditEmployees");

  const previous = (await db.getUnits()).find((u) => u.id === id);
  const unit = await db.updateUnit(id, updates);
  if (!unit) throw new Error("Unit not found.");

  const renamed = Boolean(updates.name && previous && updates.name !== previous.name);
  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: renamed ? "UNIT_RENAMED" : "UNIT_UPDATED",
    entityType: "unit",
    entityId: id,
    details: renamed
      ? `Renamed unit "${previous?.name}" → "${unit.name}". Employee records were updated to match.`
      : `Updated unit "${unit.name}".`,
    previousValues: previous,
    newValues: unit,
  });

  revalidatePath("/settings");
  revalidatePath("/employees");
  return { success: true, unit };
}

export async function deleteUnitAction(id: string) {
  const actor = await requirePermission("canEditEmployees");

  const target = (await db.getUnits()).find((u) => u.id === id);
  const deleted = await db.deleteUnit(id);
  if (!deleted) throw new Error("Unit not found.");

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "UNIT_DELETED",
    entityType: "unit",
    entityId: id,
    details: `Deleted unit "${target?.name ?? id}" (unused by any employee).`,
  });

  revalidatePath("/settings");
  revalidatePath("/employees");
  return { success: true };
}

// ── Roles ──────────────────────────────────────────────────────────────────

export async function getRolesAction() {
  await requirePermission("canEditEmployees");
  return { roles: await db.getRoles() };
}

export async function createRoleAction(data: RoleUpdates & { name: string }) {
  const actor = await requirePermission("canEditEmployees");

  if (!data.name?.trim()) throw new Error("Role name is required.");

  const role = await db.createRole({ ...data, name: data.name.trim() });

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "ROLE_CREATED",
    entityType: "role",
    entityId: role.id,
    details: `Created role "${role.name}" (staff class ${role.staffClass}).`,
    newValues: role,
  });

  revalidatePath("/settings");
  revalidatePath("/employees");
  return { success: true, role };
}

export async function updateRoleAction(id: string, updates: RoleUpdates) {
  const actor = await requirePermission("canEditEmployees");

  const previous = (await db.getRoles()).find((r) => r.id === id);
  const role = await db.updateRole(id, updates);
  if (!role) throw new Error("Role not found.");

  const renamed = Boolean(updates.name && previous && updates.name !== previous.name);
  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: renamed ? "ROLE_RENAMED" : "ROLE_UPDATED",
    entityType: "role",
    entityId: id,
    details: renamed
      ? `Renamed role "${previous?.name}" → "${role.name}". Employee designations were updated to match.`
      : `Updated role "${role.name}".`,
    previousValues: previous,
    newValues: role,
  });

  revalidatePath("/settings");
  revalidatePath("/employees");
  return { success: true, role };
}

export async function deleteRoleAction(id: string) {
  const actor = await requirePermission("canEditEmployees");

  const target = (await db.getRoles()).find((r) => r.id === id);
  const deleted = await db.deleteRole(id);
  if (!deleted) throw new Error("Role not found.");

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "ROLE_DELETED",
    entityType: "role",
    entityId: id,
    details: `Deleted role "${target?.name ?? id}" (unused by any employee).`,
  });

  revalidatePath("/settings");
  revalidatePath("/employees");
  return { success: true };
}
