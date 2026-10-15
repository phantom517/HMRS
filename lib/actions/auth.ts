"use server";

import { randomBytes } from "node:crypto";
import {
  loginAdmin as loginUserAdmin,
  startEmployeeView as viewAsEmployee,
  logoutUser,
  switchSessionUser,
  requireSuperuser,
} from "@/lib/auth/session";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function adminLoginAction(password: string) {
  const user = await loginUserAdmin(password);
  await db.createAuditLog({
    actorUserId: user.id,
    actorName: user.name,
    action: "ADMIN_LOGGED_IN",
    entityType: "user",
    entityId: user.id,
    details: `${user.name} signed in as Admin (full management access).`,
  });

  revalidatePath("/");
  return { success: true, user };
}

export async function viewAsEmployeeAction() {
  const user = await viewAsEmployee();
  await db.createAuditLog({
    actorUserId: user.id,
    actorName: user.name,
    action: "EMPLOYEE_VIEW_STARTED",
    entityType: "user",
    entityId: user.id,
    details: `${user.name} opened a read-only employee view (no edit/add permissions).`,
  });

  revalidatePath("/");
  return { success: true, user };
}

export async function logoutAction(): Promise<void> {
  await logoutUser();
  revalidatePath("/");
}

export async function switchSessionUserAction(userId: string) {
  const user = await switchSessionUser(userId);
  await db.createAuditLog({
    actorUserId: user.id,
    actorName: user.name,
    action: "SESSION_SWITCHED",
    entityType: "user",
    entityId: user.id,
    details: `Session switched to ${user.name} (${user.role}).`,
  });

  revalidatePath("/");
  return { success: true, user };
}

export async function updateAssistantPermissionsAction(
  userId: string,
  perms: {
    canEditEmployees: boolean;
    canManageShifts: boolean;
    canAssignShifts: boolean;
    canApproveLeave: boolean;
    canManagePolicies: boolean;
    canExportReports: boolean;
    canViewAuditLogs: boolean;
    canDeleteEmployees: boolean;
  }
) {
  const actor = await requireSuperuser();
  const targetUser = await db.getUserById(userId);
  if (!targetUser) throw new Error("User not found");

  const updated = await db.updateAssistantPermissions(userId, perms);

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "PERMISSIONS_UPDATED",
    entityType: "assistant_permissions",
    entityId: updated.id,
    details: `Updated permissions for assistant manager ${targetUser.name}`,
    newValues: perms,
  });

  revalidatePath("/settings");
  return { success: true, permissions: updated };
}

export async function createAssistantAccountAction(data: {
  name: string;
  email: string;
  password?: string;
  title: string;
  permissions?: {
    canEditEmployees?: boolean;
    canManageShifts?: boolean;
    canAssignShifts?: boolean;
    canApproveLeave?: boolean;
    canManagePolicies?: boolean;
    canExportReports?: boolean;
    canViewAuditLogs?: boolean;
    canDeleteEmployees?: boolean;
  };
}) {
  const actor = await requireSuperuser();
  const existing = await db.getUserByEmail(data.email);
  if (existing) {
    throw new Error(`User with email "${data.email}" already exists.`);
  }

  // Generate the temporary password SERVER-SIDE, hashed immediately and
  // returned exactly once for the superuser to relay. Never stored or logged
  // in plaintext.
  const tempPassword =
    data.password?.trim() ||
    `Fall-${randomBytes(6).toString("base64url")}-${Date.now().toString(36)}`;

  const bcrypt = (await import("bcryptjs")).default;
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const newUser = await db.createUser(
    {
      name: data.name,
      email: data.email,
      passwordHash,
      role: "assistant",
      title: data.title || "Assistant Clinical Coordinator",
      active: true,
    },
    {
      canEditEmployees: data.permissions?.canEditEmployees ?? true,
      canManageShifts: data.permissions?.canManageShifts ?? false,
      canAssignShifts: data.permissions?.canAssignShifts ?? true,
      canApproveLeave: data.permissions?.canApproveLeave ?? false,
      canManagePolicies: data.permissions?.canManagePolicies ?? false,
      canExportReports: data.permissions?.canExportReports ?? true,
      canViewAuditLogs: data.permissions?.canViewAuditLogs ?? false,
      canDeleteEmployees: false,
    }
  );

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: "ASSISTANT_CREATED",
    entityType: "user",
    entityId: newUser.id,
    details: `Created new assistant account for ${newUser.name} (${newUser.email}) with custom permission matrix`,
    newValues: { id: newUser.id, name: newUser.name, email: newUser.email, role: "assistant" },
  });

  revalidatePath("/settings");
  return { success: true, user: newUser, tempPassword };
}

export async function toggleAssistantActiveAction(userId: string, active: boolean) {
  const actor = await requireSuperuser();
  const target = await db.getUserById(userId);
  if (!target) throw new Error("Assistant not found.");
  if (target.role === "superuser")
    throw new Error("Cannot deactivate the primary superuser account.");

  const updated = await db.updateUser(userId, { active });

  await db.createAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: active ? "ASSISTANT_ACTIVATED" : "ASSISTANT_DEACTIVATED",
    entityType: "user",
    entityId: userId,
    details: `${active ? "Re-activated" : "Deactivated"} assistant account for ${target.name}`,
    previousValues: { active: target.active },
    newValues: { active },
  });

  revalidatePath("/settings");
  return { success: true, user: updated };
}
