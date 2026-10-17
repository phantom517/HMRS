import { and, asc, count, desc, eq, gte, ilike, lte, notInArray, or, sql as dsql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

/**
 * Drizzle-backed repository. Implements the exact same high-level method set as the
 * in-memory fallback repository so all pages/server-actions keep working unchanged.
 */
export class DrizzleDatabase {
  private db;

  constructor(connectionString: string) {
    this.db = drizzle(neon(connectionString), { schema });
  }

  // --- Users & Permissions ---
  async getUsers() {
    return this.db.select().from(schema.users).orderBy(asc(schema.users.createdAt));
  }

  async getUserById(id: string) {
    const rows = await this.db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return rows[0] || null;
  }

  async getUserByEmail(email: string) {
    const rows = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (rows[0]) return rows[0];
    const fallback = await this.db
      .select()
      .from(schema.users)
      .where(ilike(schema.users.email, email))
      .limit(1);
    return fallback[0] || null;
  }

  async getFirstViewerUser() {
    const rows = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.role, "viewer"))
      .limit(1);
    return rows[0] || null;
  }

  async getAssistantPermissions(userId: string) {
    const rows = await this.db
      .select()
      .from(schema.assistantPermissions)
      .where(eq(schema.assistantPermissions.userId, userId))
      .limit(1);
    return rows[0] || null;
  }

  async updateAssistantPermissions(userId: string, perms: any) {
    const existing = await this.getAssistantPermissions(userId);
    if (existing) {
      const updated = await this.db
        .update(schema.assistantPermissions)
        .set({ ...perms, updatedAt: new Date() })
        .where(eq(schema.assistantPermissions.id, existing.id))
        .returning();
      return updated[0];
    }
    const inserted = await this.db
      .insert(schema.assistantPermissions)
      .values({
        id: `perm_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        userId,
        ...perms,
      })
      .returning();
    return inserted[0];
  }

  async createUser(userData: any, perms?: any) {
    const newUser = {
      ...userData,
      id: userData.id || `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      createdAt: userData.createdAt || new Date(),
      updatedAt: userData.updatedAt || new Date(),
    };
    const inserted = await this.db.insert(schema.users).values(newUser).returning();
    const user = inserted[0];
    if (perms && user.role === "assistant") {
      await this.updateAssistantPermissions(user.id, perms);
    }
    return user;
  }

  async updateUser(id: string, updates: any) {
    const updated = await this.db
      .update(schema.users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.users.id, id))
      .returning();
    return updated[0] || null;
  }

  // --- Employees ---
  async getEmployees(params?: {
    search?: string;
    status?: string;
    unit?: string;
    designation?: string;
    page?: number;
    pageSize?: number;
  }) {
    const conditions: Array<any> = [];
    if (params?.status && params.status !== "all") {
      conditions.push(eq(schema.employees.employmentStatus, params.status));
    }
    if (params?.search) {
      const q = `%${params.search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.employees.fullName, q),
          ilike(schema.employees.employeeId, q),
          ilike(schema.employees.designation, q),
          ilike(schema.employees.email, q),
          ilike(schema.employees.unit, q)
        )
      );
    }
    if (params?.unit && params.unit !== "All") {
      conditions.push(ilike(schema.employees.unit, `%${params.unit}%`));
    }
    if (params?.designation && params.designation !== "All") {
      conditions.push(ilike(schema.employees.designation, `%${params.designation}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const totalCountRows = await this.db
      .select({ count: dsql`count(*)` })
      .from(schema.employees)
      .where(where);
    const totalCount = Number(totalCountRows[0]?.count ?? 0);

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 100;
    const employees = await this.db
      .select()
      .from(schema.employees)
      .where(where)
      .orderBy(desc(schema.employees.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return {
      employees,
      totalCount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    };
  }

  async getEmployeeById(idOrEmpId: string) {
    const byId = await this.db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.id, idOrEmpId))
      .limit(1);
    if (byId[0]) return byId[0];
    const byEmpId = await this.db
      .select()
      .from(schema.employees)
      .where(ilike(schema.employees.employeeId, idOrEmpId))
      .limit(1);
    return byEmpId[0] || null;
  }

  async createEmployee(empData: any) {
    const existing = await this.db
      .select()
      .from(schema.employees)
      .where(ilike(schema.employees.employeeId, empData.employeeId))
      .limit(1);
    if (existing[0]) {
      throw new Error(`Employee ID "${empData.employeeId}" is already registered.`);
    }

    const inserted = await this.db
      .insert(schema.employees)
      .values({
        ...empData,
        id: empData.id || `emp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        active: empData.active !== undefined ? empData.active : true,
        employmentStatus: empData.employmentStatus || "active",
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return inserted[0];
  }

  async updateEmployee(id: string, updates: any) {
    if (updates.employeeId) {
      const dup = await this.db
        .select()
        .from(schema.employees)
        .where(and(ilike(schema.employees.employeeId, updates.employeeId), dsql`${schema.employees.id} <> ${id}`))
        .limit(1);
      if (dup[0]) throw new Error(`Employee ID "${updates.employeeId}" is already taken.`);
    }
    const updated = await this.db
      .update(schema.employees)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.employees.id, id))
      .returning();
    return updated[0] || null;
  }

  async archiveEmployee(id: string) {
    return this.updateEmployee(id, {
      employmentStatus: "archived",
      active: false,
      archivedAt: new Date(),
    });
  }

  async restoreEmployee(id: string) {
    return this.updateEmployee(id, {
      employmentStatus: "active",
      active: true,
      archivedAt: null,
    });
  }

  async deleteEmployee(id: string) {
    const hasShifts = await this.db
      .select({ id: schema.shiftAssignments.id })
      .from(schema.shiftAssignments)
      .where(eq(schema.shiftAssignments.employeeId, id))
      .limit(1);
    const hasLeaves = await this.db
      .select({ id: schema.leaveRecords.id })
      .from(schema.leaveRecords)
      .where(eq(schema.leaveRecords.employeeId, id))
      .limit(1);

    if (hasShifts[0] || hasLeaves[0]) {
      const emp = await this.archiveEmployee(id);
      return {
        deleted: false,
        archivedInstead: true,
        message:
          "Employee has historical shift or leave records. Record has been safely archived to retain compliance history.",
        employee: emp,
      };
    }

    const deleted = await this.db.delete(schema.employees).where(eq(schema.employees.id, id)).returning();
    return {
      deleted: deleted.length > 0,
      archivedInstead: false,
      message: "Employee record permanently removed.",
    };
  }

  /**
   * Permanently delete an employee AND every historical record tied to them:
   * shift assignments, leave records, balance adjustments and off-days.
   * Cannot be undone — the caller (server action) is responsible for access
   * control and confirmation.
   */
  async hardDeleteEmployee(id: string) {
    const target = await this.db.select().from(schema.employees).where(eq(schema.employees.id, id)).limit(1);
    if (!target[0]) return { deleted: false, message: "Employee not found." };

    // leaveRecords.replacementEmployeeId references employees too — detach first.
    await this.db
      .update(schema.leaveRecords)
      .set({ replacementEmployeeId: null })
      .where(eq(schema.leaveRecords.replacementEmployeeId, id));

    await this.db.delete(schema.offDays).where(eq(schema.offDays.employeeId, id));
    await this.db.delete(schema.leaveBalanceAdjustments).where(eq(schema.leaveBalanceAdjustments.employeeId, id));
    await this.db.delete(schema.leaveRecords).where(eq(schema.leaveRecords.employeeId, id));
    await this.db.delete(schema.shiftAssignments).where(eq(schema.shiftAssignments.employeeId, id));
    await this.db.delete(schema.employees).where(eq(schema.employees.id, id));

    return {
      deleted: true,
      employee: target[0],
      message: `Employee ${target[0].fullName} (${target[0].employeeId}) and all related shift, leave and off-day records were permanently deleted.`,
    };
  }

  // ── Units (admin-managed dictionary; employees reference BY NAME) ──
  async getUnits() {
    return this.db.select().from(schema.units).orderBy(asc(schema.units.sortOrder), asc(schema.units.name));
  }

  async createUnit(unitData: any) {
    const existing = await this.db
      .select()
      .from(schema.units)
      .where(ilike(schema.units.name, unitData.name))
      .limit(1);
    if (existing[0]) throw new Error(`Unit "${unitData.name}" already exists.`);

    const inserted = await this.db
      .insert(schema.units)
      .values({
        ...unitData,
        id: unitData.id || `unit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        active: unitData.active !== undefined ? unitData.active : true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return inserted[0];
  }

  async updateUnit(id: string, updates: any) {
    const target = await this.db.select().from(schema.units).where(eq(schema.units.id, id)).limit(1);
    if (!target[0]) return null;

    // Renaming propagates: employees reference the unit BY NAME.
    if (updates.name && updates.name !== target[0].name) {
      const dup = await this.db
        .select()
        .from(schema.units)
        .where(and(ilike(schema.units.name, updates.name), dsql`${schema.units.id} <> ${id}`))
        .limit(1);
      if (dup[0]) throw new Error(`Unit "${updates.name}" already exists.`);
      await this.db
        .update(schema.employees)
        .set({ unit: updates.name, updatedAt: new Date() })
        .where(eq(schema.employees.unit, target[0].name));
    }

    const updated = await this.db
      .update(schema.units)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.units.id, id))
      .returning();
    return updated[0] || null;
  }

  async deleteUnit(id: string) {
    const target = await this.db.select().from(schema.units).where(eq(schema.units.id, id)).limit(1);
    if (!target[0]) return false;

    const inUse = await this.db
      .select({ count: dsql`count(*)` })
      .from(schema.employees)
      .where(eq(schema.employees.unit, target[0].name));
    if (Number(inUse[0]?.count ?? 0) > 0) {
      throw new Error(
        `Unit "${target[0].name}" is still assigned to ${inUse[0].count} employee(s). Reassign them first or archive the unit instead.`
      );
    }

    const deleted = await this.db.delete(schema.units).where(eq(schema.units.id, id)).returning();
    return deleted.length > 0;
  }

  // ── Roles (admin-managed dictionary; employees reference BY NAME) ──
  async getRoles() {
    return this.db.select().from(schema.roles).orderBy(asc(schema.roles.sortOrder), asc(schema.roles.name));
  }

  async createRole(roleData: any) {
    const existing = await this.db
      .select()
      .from(schema.roles)
      .where(ilike(schema.roles.name, roleData.name))
      .limit(1);
    if (existing[0]) throw new Error(`Role "${roleData.name}" already exists.`);

    const inserted = await this.db
      .insert(schema.roles)
      .values({
        ...roleData,
        id: roleData.id || `role_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        active: roleData.active !== undefined ? roleData.active : true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return inserted[0];
  }

  async updateRole(id: string, updates: any) {
    const target = await this.db.select().from(schema.roles).where(eq(schema.roles.id, id)).limit(1);
    if (!target[0]) return null;

    if (updates.name && updates.name !== target[0].name) {
      const dup = await this.db
        .select()
        .from(schema.roles)
        .where(and(ilike(schema.roles.name, updates.name), dsql`${schema.roles.id} <> ${id}`))
        .limit(1);
      if (dup[0]) throw new Error(`Role "${updates.name}" already exists.`);
      await this.db
        .update(schema.employees)
        .set({ designation: updates.name, updatedAt: new Date() })
        .where(eq(schema.employees.designation, target[0].name));
    }

    const updated = await this.db
      .update(schema.roles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.roles.id, id))
      .returning();
    return updated[0] || null;
  }

  async deleteRole(id: string) {
    const target = await this.db.select().from(schema.roles).where(eq(schema.roles.id, id)).limit(1);
    if (!target[0]) return false;

    const inUse = await this.db
      .select({ count: dsql`count(*)` })
      .from(schema.employees)
      .where(eq(schema.employees.designation, target[0].name));
    if (Number(inUse[0]?.count ?? 0) > 0) {
      throw new Error(
        `Role "${target[0].name}" is still assigned to ${inUse[0].count} employee(s). Reassign them first or archive the role instead.`
      );
    }

    const deleted = await this.db.delete(schema.roles).where(eq(schema.roles.id, id)).returning();
    return deleted.length > 0;
  }

  // --- Shift Types ---
  async getShiftTypes(activeOnly = false) {
    const rows = await this.db.select().from(schema.shiftTypes).orderBy(asc(schema.shiftTypes.startTime));
    if (activeOnly) return rows.filter((s) => s.active);
    return rows;
  }

  async getShiftTypeById(id: string) {
    const byId = await this.db.select().from(schema.shiftTypes).where(eq(schema.shiftTypes.id, id)).limit(1);
    if (byId[0]) return byId[0];
    const byCode = await this.db
      .select()
      .from(schema.shiftTypes)
      .where(eq(schema.shiftTypes.shortCode, id))
      .limit(1);
    return byCode[0] || null;
  }

  async createShiftType(shiftData: any) {
    const existing = await this.db
      .select()
      .from(schema.shiftTypes)
      .where(ilike(schema.shiftTypes.shortCode, shiftData.shortCode))
      .limit(1);
    if (existing[0]) {
      throw new Error(`Shift Code "${shiftData.shortCode}" already exists.`);
    }

    const inserted = await this.db
      .insert(schema.shiftTypes)
      .values({
        ...shiftData,
        id: shiftData.id || `st_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        active: shiftData.active !== undefined ? shiftData.active : true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return inserted[0];
  }

  async updateShiftType(id: string, updates: any) {
    const target = await this.getShiftTypeById(id);
    if (!target) return null;
    const updated = await this.db
      .update(schema.shiftTypes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.shiftTypes.id, target.id))
      .returning();
    return updated[0] || null;
  }

  // --- Shift Assignments ---
  async getShiftAssignments(params?: {
    startDate?: string;
    endDate?: string;
    employeeId?: string;
    shiftTypeId?: string;
    status?: string;
  }) {
    const conditions: Array<any> = [];
    if (params?.employeeId) conditions.push(eq(schema.shiftAssignments.employeeId, params.employeeId));
    if (params?.shiftTypeId) conditions.push(eq(schema.shiftAssignments.shiftTypeId, params.shiftTypeId));
    if (params?.status) conditions.push(eq(schema.shiftAssignments.status, params.status));
    if (params?.startDate) conditions.push(gte(schema.shiftAssignments.date, params.startDate));
    if (params?.endDate) conditions.push(lte(schema.shiftAssignments.date, params.endDate));

    return this.db
      .select()
      .from(schema.shiftAssignments)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(schema.shiftAssignments.startAt));
  }

  async getShiftAssignmentById(id: string) {
    const rows = await this.db
      .select()
      .from(schema.shiftAssignments)
      .where(eq(schema.shiftAssignments.id, id))
      .limit(1);
    return rows[0] || null;
  }

  async createShiftAssignment(asgData: any) {
    const inserted = await this.db
      .insert(schema.shiftAssignments)
      .values({
        ...asgData,
        id: asgData.id || `asg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        status: asgData.status || "assigned",
        conflictFlag: asgData.conflictFlag || false,
        conflictReason: asgData.conflictReason || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return inserted[0];
  }

  async updateShiftAssignment(id: string, updates: any) {
    const updated = await this.db
      .update(schema.shiftAssignments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.shiftAssignments.id, id))
      .returning();
    return updated[0] || null;
  }

  async deleteShiftAssignment(id: string) {
    const deleted = await this.db
      .delete(schema.shiftAssignments)
      .where(eq(schema.shiftAssignments.id, id))
      .returning();
    return deleted.length > 0;
  }

  // --- Leave Records & Policies ---
  async getLeaveTypes() {
    return this.db.select().from(schema.leaveTypes).orderBy(asc(schema.leaveTypes.name));
  }

  async getLeavePolicies() {
    return this.db.select().from(schema.leavePolicies).orderBy(asc(schema.leavePolicies.name));
  }

  async updateLeavePolicy(id: string, updates: any) {
    const updated = await this.db
      .update(schema.leavePolicies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.leavePolicies.id, id))
      .returning();
    return updated[0] || null;
  }

  async getLeaveRecords(params?: {
    employeeId?: string;
    status?: string;
    leaveTypeId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const conditions: Array<any> = [];
    if (params?.employeeId) conditions.push(eq(schema.leaveRecords.employeeId, params.employeeId));
    if (params?.status && params.status !== "ALL" && params.status !== "all") {
      conditions.push(ilike(schema.leaveRecords.status, params.status));
    }
    if (params?.leaveTypeId && params.leaveTypeId !== "ALL") {
      conditions.push(eq(schema.leaveRecords.leaveTypeId, params.leaveTypeId));
    }
    if (params?.startDate) conditions.push(gte(schema.leaveRecords.endDate, params.startDate));
    if (params?.endDate) conditions.push(lte(schema.leaveRecords.startDate, params.endDate));

    return this.db
      .select()
      .from(schema.leaveRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.leaveRecords.createdAt));
  }

  async getLeaveRecordById(id: string) {
    const rows = await this.db.select().from(schema.leaveRecords).where(eq(schema.leaveRecords.id, id)).limit(1);
    return rows[0] || null;
  }

  async createLeaveRecord(leaveData: any) {
    const inserted = await this.db
      .insert(schema.leaveRecords)
      .values({
        ...leaveData,
        id: leaveData.id || `lv_rec_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        status: leaveData.status || "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return inserted[0];
  }

  async updateLeaveRecord(id: string, updates: any) {
    const updated = await this.db
      .update(schema.leaveRecords)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.leaveRecords.id, id))
      .returning();
    return updated[0] || null;
  }

  async getLeaveBalanceAdjustments(employeeId?: string) {
    return this.db
      .select()
      .from(schema.leaveBalanceAdjustments)
      .where(employeeId ? eq(schema.leaveBalanceAdjustments.employeeId, employeeId) : undefined)
      .orderBy(desc(schema.leaveBalanceAdjustments.createdAt));
  }

  async createLeaveBalanceAdjustment(adjData: any) {
    const inserted = await this.db
      .insert(schema.leaveBalanceAdjustments)
      .values({
        ...adjData,
        id: adjData.id || `ladj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date(),
      })
      .returning();
    return inserted[0];
  }

  // --- Off-Days ---
  async getOffDays(params?: { employeeId?: string; date?: string; startDate?: string; endDate?: string }) {
    const conditions: Array<any> = [];
    if (params?.employeeId) conditions.push(eq(schema.offDays.employeeId, params.employeeId));
    if (params?.date) conditions.push(eq(schema.offDays.date, params.date));
    if (params?.startDate) conditions.push(gte(schema.offDays.date, params.startDate));
    if (params?.endDate) conditions.push(lte(schema.offDays.date, params.endDate));

    return this.db
      .select()
      .from(schema.offDays)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(schema.offDays.date));
  }

  async createOffDay(offDayData: any) {
    const exists = await this.db
      .select()
      .from(schema.offDays)
      .where(
        and(
          eq(schema.offDays.employeeId, offDayData.employeeId),
          eq(schema.offDays.date, offDayData.date)
        )
      )
      .limit(1);
    if (exists[0]) return exists[0];

    const inserted = await this.db
      .insert(schema.offDays)
      .values({
        ...offDayData,
        id: offDayData.id || `off_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date(),
      })
      .returning();
    return inserted[0];
  }

  async deleteOffDay(id: string) {
    const deleted = await this.db.delete(schema.offDays).where(eq(schema.offDays.id, id)).returning();
    return deleted.length > 0;
  }

  // --- Department Settings ---
  async getDepartmentSettings() {
    const rows = await this.db.select().from(schema.departmentSettings).limit(1);
    return rows[0] || null;
  }

  // ── Per shift-type × designation staffing policy ──
  async getShiftRequirements() {
    return this.db.select().from(schema.shiftRequirements);
  }

  async upsertShiftRequirement(row: { shiftTypeId: string; designation: string; minStaff: number; maxStaff: number | null }) {
    const existing = await this.db
      .select()
      .from(schema.shiftRequirements)
      .where(
        and(
          eq(schema.shiftRequirements.shiftTypeId, row.shiftTypeId),
          eq(schema.shiftRequirements.designation, row.designation)
        )
      )
      .limit(1);
    const id = existing[0]?.id || `sreq_${crypto.randomUUID()}`;
    const values = { ...row, id, updatedAt: new Date() };
    if (existing[0]) {
      await this.db.update(schema.shiftRequirements).set({ minStaff: row.minStaff, maxStaff: row.maxStaff, updatedAt: new Date() }).where(eq(schema.shiftRequirements.id, id));
      return values;
    }
    const inserted = await this.db.insert(schema.shiftRequirements).values(values).returning();
    return inserted[0];
  }

  async deleteShiftRequirement(id: string) {
    await this.db.delete(schema.shiftRequirements).where(eq(schema.shiftRequirements.id, id));
    return { success: true };
  }

  // ── Holidays (Gregorian dates ONLY — never BS strings) ──
  async getHolidays(params?: { from?: string; to?: string }) {
    const conditions: Array<any> = [];
    if (params?.from) conditions.push(gte(schema.holidays.date, params.from));
    if (params?.to) conditions.push(lte(schema.holidays.date, params.to));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return this.db.select().from(schema.holidays).where(where).orderBy(schema.holidays.date);
  }

  async upsertHoliday(row: { date: string; name: string; nameNp?: string | null; category?: string; observed?: boolean; note?: string | null; createdBy?: string | null }) {
    const existing = await this.db
      .select()
      .from(schema.holidays)
      .where(eq(schema.holidays.date, row.date))
      .limit(1);
    const id = existing[0]?.id || `hol_${crypto.randomUUID()}`;
    const values = { ...row, id, updatedAt: new Date() };
    if (existing[0]) {
      await this.db.update(schema.holidays).set({
        name: row.name,
        nameNp: row.nameNp ?? null,
        category: row.category ?? "public",
        observed: row.observed ?? true,
        note: row.note ?? null,
        updatedAt: new Date(),
      }).where(eq(schema.holidays.id, id));
      return values;
    }
    const inserted = await this.db.insert(schema.holidays).values(values).returning();
    return inserted[0];
  }

  async deleteHoliday(id: string) {
    const deleted = await this.db.delete(schema.holidays).where(eq(schema.holidays.id, id)).returning();
    return deleted.length > 0;
  }

  async updateDepartmentSettings(updates: any) {
    const current = await this.getDepartmentSettings();
    if (current) {
      const updated = await this.db
        .update(schema.departmentSettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.departmentSettings.id, current.id))
        .returning();
      return updated[0];
    }
    const inserted = await this.db
      .insert(schema.departmentSettings)
      .values({
        id: `dept_settings_${Date.now()}`,
        ...updates,
      })
      .returning();
    return inserted[0];
  }

  // --- Audit Logs ---
  async getAuditLogs(limit = 100) {
    return this.db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(limit);
  }

  /**
   * Server-side paginated audit read with a real total. Sign-in/session noise
   * actions are excluded unless includeSignIns — server-side so pagination
   * counts stay consistent with what is shown.
   */
  async getAuditLogsPage(params: {
    page?: number;
    pageSize?: number;
    includeSignIns?: boolean;
    hiddenActions?: string[];
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(200, Math.max(10, params.pageSize ?? 50));
    const hidden = params.includeSignIns ? [] : (params.hiddenActions ?? ["ADMIN_LOGGED_IN", "SESSION_SWITCHED", "EMPLOYEE_VIEW_STARTED"]);
    const where = hidden.length > 0
      ? notInArray(schema.auditLogs.action, hidden)
      : undefined;

    const totalRows = await this.db
      .select({ n: count() })
      .from(schema.auditLogs)
      .where(where);
    const total = Number(totalRows[0]?.n ?? 0);

    const rows = await this.db
      .select()
      .from(schema.auditLogs)
      .where(where)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { rows, total, page, pageSize };
  }

  async createAuditLog(logData: any) {
    const inserted = await this.db
      .insert(schema.auditLogs)
      .values({
        ...logData,
        id: `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date(),
      })
      .returning();
    return inserted[0];
  }
}
