import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { getSeedData, SeedDataPayload } from "./seed-data";
import { DrizzleDatabase } from "./drizzle-repo";

// Global in-memory storage fallback for evaluation / dev environment when DATABASE_URL is pending
class MemoryDatabase {
  private data: SeedDataPayload;

  constructor() {
    this.data = getSeedData();
  }

  // --- Users & Permissions ---
  async getUsers() {
    return [...this.data.users];
  }

  async getUserById(id: string) {
    return this.data.users.find((u) => u.id === id) || null;
  }

  async getUserByEmail(email: string) {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async getFirstViewerUser() {
    return this.data.users.find((u) => u.role === "viewer") || null;
  }

  async getAssistantPermissions(userId: string) {
    return this.data.permissions.find((p) => p.userId === userId) || null;
  }

  async updateAssistantPermissions(userId: string, perms: Partial<any>) {
    const idx = this.data.permissions.findIndex((p) => p.userId === userId);
    if (idx >= 0) {
      this.data.permissions[idx] = { ...this.data.permissions[idx], ...perms, updatedAt: new Date() };
      return this.data.permissions[idx];
    }
    const newPerm = { id: `perm_${Date.now()}`, userId, ...perms, createdAt: new Date(), updatedAt: new Date() };
    this.data.permissions.push(newPerm);
    return newPerm;
  }

  async createUser(userData: any, perms?: any) {
    const newUser = {
      ...userData,
      id: userData.id || `usr_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.data.users.push(newUser);
    if (perms && newUser.role === "assistant") {
      await this.updateAssistantPermissions(newUser.id, perms);
    }
    return newUser;
  }

  async updateUser(id: string, updates: Partial<any>) {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx >= 0) {
      this.data.users[idx] = { ...this.data.users[idx], ...updates, updatedAt: new Date() };
      return this.data.users[idx];
    }
    return null;
  }

  // --- Employees ---
  async getEmployees(params?: {
    search?: string;
    status?: string; // "all", "active", "on_leave", "off_duty", "archived"
    unit?: string;
    designation?: string;
    page?: number;
    pageSize?: number;
  }) {
    let result = [...this.data.employees];

    if (params?.status && params.status !== "all") {
      result = result.filter((e) => e.employmentStatus === params.status);
    }

    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.fullName.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          e.designation.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.unit.toLowerCase().includes(q)
      );
    }

    if (params?.unit && params.unit !== "All") {
      result = result.filter((e) => e.unit.includes(params.unit!));
    }

    if (params?.designation && params.designation !== "All") {
      result = result.filter((e) => e.designation.includes(params.designation!));
    }

    const totalCount = result.length;
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 100;
    const startIndex = (page - 1) * pageSize;
    const paginated = result.slice(startIndex, startIndex + pageSize);

    return {
      employees: paginated,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  }

  async getEmployeeById(idOrEmpId: string) {
    return (
      this.data.employees.find(
        (e) => e.id === idOrEmpId || e.employeeId.toLowerCase() === idOrEmpId.toLowerCase()
      ) || null
    );
  }

  async createEmployee(empData: any) {
    // Unique check
    const existing = this.data.employees.find(
      (e) => e.employeeId.toLowerCase() === empData.employeeId.toLowerCase()
    );
    if (existing) {
      throw new Error(`Employee ID "${empData.employeeId}" is already registered.`);
    }

    const newEmp = {
      ...empData,
      id: empData.id || `emp_${Date.now()}`,
      active: empData.active !== undefined ? empData.active : true,
      employmentStatus: empData.employmentStatus || "active",
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.data.employees.unshift(newEmp);
    return newEmp;
  }

  async updateEmployee(id: string, updates: Partial<any>) {
    const idx = this.data.employees.findIndex((e) => e.id === id);
    if (idx >= 0) {
      if (updates.employeeId && updates.employeeId !== this.data.employees[idx].employeeId) {
        const dup = this.data.employees.find(
          (e) => e.id !== id && e.employeeId.toLowerCase() === updates.employeeId!.toLowerCase()
        );
        if (dup) throw new Error(`Employee ID "${updates.employeeId}" is already taken.`);
      }
      this.data.employees[idx] = { ...this.data.employees[idx], ...updates, updatedAt: new Date() };
      return this.data.employees[idx];
    }
    return null;
  }

  async archiveEmployee(id: string) {
    const emp = await this.updateEmployee(id, {
      employmentStatus: "archived",
      active: false,
      archivedAt: new Date(),
    });
    return emp;
  }

  async restoreEmployee(id: string) {
    const emp = await this.updateEmployee(id, {
      employmentStatus: "active",
      active: true,
      archivedAt: null,
    });
    return emp;
  }

  async deleteEmployee(id: string) {
    // Check if historical shifts or leave records exist
    const hasShifts = this.data.shiftAssignments.some((s) => s.employeeId === id);
    const hasLeaves = this.data.leaveRecords.some((l) => l.employeeId === id);

    if (hasShifts || hasLeaves) {
      // Must archive instead of breaking referential integrity
      return {
        deleted: false,
        archivedInstead: true,
        message: "Employee has historical shift or leave records. Record has been safely archived to retain compliance history.",
        employee: await this.archiveEmployee(id),
      };
    }

    const prevLen = this.data.employees.length;
    this.data.employees = this.data.employees.filter((e) => e.id !== id);
    return {
      deleted: this.data.employees.length < prevLen,
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
    const target = this.data.employees.find((e) => e.id === id) || null;
    if (!target) return { deleted: false, message: "Employee not found." };

    this.data.shiftAssignments = this.data.shiftAssignments.filter((s) => s.employeeId !== id);
    this.data.leaveRecords = this.data.leaveRecords.filter((l) => l.employeeId !== id);
    if (this.data.leaveRecords.length > 0) {
      this.data.leaveRecords = this.data.leaveRecords.map((l) =>
        l.replacementEmployeeId === id ? { ...l, replacementEmployeeId: null } : l
      );
    }
    this.data.leaveAdjustments = this.data.leaveAdjustments.filter((l) => l.employeeId !== id);
    this.data.offDays = this.data.offDays.filter((o) => o.employeeId !== id);
    this.data.employees = this.data.employees.filter((e) => e.id !== id);

    return {
      deleted: true,
      employee: target,
      message: `Employee ${target.fullName} (${target.employeeId}) and all related shift, leave and off-day records were permanently deleted.`,
    };
  }

  // ── Units (admin-managed dictionary; employees reference BY NAME) ──
  private ensureUnits() {
    if (!this.data.units) {
      // Derive the initial dictionary from the seed employees so the unit
      // filter in the UI matches what's actually on the roster.
      const rawNames = [...new Set([...this.data.employees.map((e) => e.unit)])]
        .map((n) => (n || "").trim())
        .filter(Boolean);
      const names = rawNames.length > 0 ? rawNames : ["Unassigned"];
      this.data.units = (names as any[]).map((name, i) => ({
        id: `unit_${i + 1}`,
        name,
        description: null,
        color: null,
        sortOrder: (i + 1) * 10,
        active: true,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      }));
    }
    return this.data.units!;
  }

  private ensureRoles() {
    if (!this.data.roles) {
      const rawNames = [...new Set([...this.data.employees.map((e) => e.designation)])]
        .map((n) => (n || "").trim())
        .filter(Boolean);
      const names = rawNames.length > 0 ? rawNames : ["Unassigned"];
      this.data.roles = names.map((name, i) => ({
        id: `role_${i + 1}`,
        name,
        staffClass: /rn|nurse/i.test(name) ? "RN" : /md|physician|surgeon|doctor/i.test(name) ? "MD" : "Tech",
        description: null as string | null,
        sortOrder: (i + 1) * 10,
        active: true,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      }));
    }
    return this.data.roles!;
  }

  // --- Units CRUD (rename propagates, delete blocked while in use) ---
  async getUnits() {
    return [...this.ensureUnits()].sort(
      (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100) || a.name.localeCompare(b.name)
    );
  }

  async createUnit(unitData: any) {
    const unitsList = this.ensureUnits();
    const existing = unitsList.find((u) => u.name.toLowerCase() === String(unitData.name).toLowerCase());
    if (existing) throw new Error(`Unit "${unitData.name}" already exists.`);

    const newUnit = {
      ...unitData,
      id: unitData.id || `unit_${Date.now()}`,
      active: unitData.active !== undefined ? unitData.active : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    unitsList.push(newUnit);
    return newUnit;
  }

  async updateUnit(id: string, updates: any) {
    const unitsList = this.ensureUnits();
    const idx = unitsList.findIndex((u) => u.id === id);
    if (idx < 0) return null;

    if (updates.name && updates.name !== unitsList[idx].name) {
      const dup = unitsList.find(
        (u) => u.id !== id && u.name.toLowerCase() === String(updates.name).toLowerCase()
      );
      if (dup) throw new Error(`Unit "${updates.name}" already exists.`);
      // Rename propagates to employees referencing the unit BY NAME.
      this.data.employees = this.data.employees.map((e) =>
        e.unit === unitsList[idx].name ? { ...e, unit: updates.name } : e
      );
    }

    unitsList[idx] = { ...unitsList[idx], ...updates, updatedAt: new Date() };
    return unitsList[idx];
  }

  async deleteUnit(id: string) {
    const unitsList = this.ensureUnits();
    const target = unitsList.find((u) => u.id === id);
    if (!target) return false;

    const inUse = this.data.employees.filter((e) => e.unit === target.name).length;
    if (inUse > 0) {
      throw new Error(
        `Unit "${target.name}" is still assigned to ${inUse} employee(s). Reassign them first or archive the unit instead.`
      );
    }

    this.data.units = unitsList.filter((u) => u.id !== id);
    return true;
  }

  // --- Roles CRUD (rename propagates, delete blocked while in use) ---
  async getRoles() {
    return [...this.ensureRoles()].sort(
      (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100) || a.name.localeCompare(b.name)
    );
  }

  async createRole(roleData: any) {
    const rolesList = this.ensureRoles();
    const existing = rolesList.find((r) => r.name.toLowerCase() === String(roleData.name).toLowerCase());
    if (existing) throw new Error(`Role "${roleData.name}" already exists.`);

    const newRole = {
      ...roleData,
      id: roleData.id || `role_${Date.now()}`,
      active: roleData.active !== undefined ? roleData.active : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    rolesList.push(newRole);
    return newRole;
  }

  async updateRole(id: string, updates: any) {
    const rolesList = this.ensureRoles();
    const idx = rolesList.findIndex((r) => r.id === id);
    if (idx < 0) return null;

    if (updates.name && updates.name !== rolesList[idx].name) {
      const dup = rolesList.find(
        (r) => r.id !== id && r.name.toLowerCase() === String(updates.name).toLowerCase()
      );
      if (dup) throw new Error(`Role "${updates.name}" already exists.`);
      this.data.employees = this.data.employees.map((e) =>
        e.designation === rolesList[idx].name ? { ...e, designation: updates.name } : e
      );
    }

    rolesList[idx] = { ...rolesList[idx], ...updates, updatedAt: new Date() };
    return rolesList[idx];
  }

  async deleteRole(id: string) {
    const rolesList = this.ensureRoles();
    const target = rolesList.find((r) => r.id === id);
    if (!target) return false;

    const inUse = this.data.employees.filter((e) => e.designation === target.name).length;
    if (inUse > 0) {
      throw new Error(
        `Role "${target.name}" is still assigned to ${inUse} employee(s). Reassign them first or archive the role instead.`
      );
    }

    this.data.roles = rolesList.filter((r) => r.id !== id);
    return true;
  }

  // --- Shift Types ---
  async getShiftTypes(activeOnly = false) {
    let list = [...this.data.shiftTypes];
    if (activeOnly) list = list.filter((s) => s.active);
    return list;
  }

  async getShiftTypeById(id: string) {
    return this.data.shiftTypes.find((s) => s.id === id || s.shortCode === id) || null;
  }

  async createShiftType(shiftData: any) {
    const existing = this.data.shiftTypes.find(
      (s) => s.shortCode.toUpperCase() === shiftData.shortCode.toUpperCase()
    );
    if (existing) {
      throw new Error(`Shift Code "${shiftData.shortCode}" already exists.`);
    }

    const newShift = {
      ...shiftData,
      id: shiftData.id || `st_${Date.now()}`,
      active: shiftData.active !== undefined ? shiftData.active : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.data.shiftTypes.push(newShift);
    return newShift;
  }

  async updateShiftType(id: string, updates: Partial<any>) {
    const idx = this.data.shiftTypes.findIndex((s) => s.id === id || s.shortCode === id);
    if (idx >= 0) {
      this.data.shiftTypes[idx] = { ...this.data.shiftTypes[idx], ...updates, updatedAt: new Date() };
      return this.data.shiftTypes[idx];
    }
    return null;
  }

  // --- Shift Assignments ---
  async getShiftAssignments(params?: {
    startDate?: string;
    endDate?: string;
    employeeId?: string;
    shiftTypeId?: string;
    status?: string;
  }) {
    let list = [...this.data.shiftAssignments];

    if (params?.employeeId) {
      list = list.filter((s) => s.employeeId === params.employeeId);
    }
    if (params?.shiftTypeId) {
      list = list.filter((s) => s.shiftTypeId === params.shiftTypeId);
    }
    if (params?.status) {
      list = list.filter((s) => s.status === params.status);
    }
    if (params?.startDate) {
      list = list.filter((s) => s.date >= params.startDate!);
    }
    if (params?.endDate) {
      list = list.filter((s) => s.date <= params.endDate!);
    }

    return list;
  }

  async getShiftAssignmentById(id: string) {
    return this.data.shiftAssignments.find((s) => s.id === id) || null;
  }

  async createShiftAssignment(asgData: any) {
    const newAsg = {
      ...asgData,
      id: asgData.id || `asg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      status: asgData.status || "assigned",
      conflictFlag: asgData.conflictFlag || false,
      conflictReason: asgData.conflictReason || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.data.shiftAssignments.push(newAsg);
    return newAsg;
  }

  async updateShiftAssignment(id: string, updates: Partial<any>) {
    const idx = this.data.shiftAssignments.findIndex((s) => s.id === id);
    if (idx >= 0) {
      this.data.shiftAssignments[idx] = {
        ...this.data.shiftAssignments[idx],
        ...updates,
        updatedAt: new Date(),
      };
      return this.data.shiftAssignments[idx];
    }
    return null;
  }

  async deleteShiftAssignment(id: string) {
    const prev = this.data.shiftAssignments.length;
    this.data.shiftAssignments = this.data.shiftAssignments.filter((s) => s.id !== id);
    return this.data.shiftAssignments.length < prev;
  }

  // --- Leave Records & Policies ---
  async getLeaveTypes() {
    return [...this.data.leaveTypes];
  }

  async getLeavePolicies() {
    return [...this.data.leavePolicies];
  }

  async updateLeavePolicy(id: string, updates: Partial<any>) {
    const idx = this.data.leavePolicies.findIndex((p) => p.id === id);
    if (idx >= 0) {
      this.data.leavePolicies[idx] = { ...this.data.leavePolicies[idx], ...updates, updatedAt: new Date() };
      return this.data.leavePolicies[idx];
    }
    return null;
  }

  async getLeaveRecords(params?: {
    employeeId?: string;
    status?: string; // "all", "pending", "approved", "rejected", "cancelled"
    leaveTypeId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    let list = [...this.data.leaveRecords];
    if (params?.employeeId) list = list.filter((l) => l.employeeId === params.employeeId);
    if (params?.status && params.status !== "ALL" && params.status !== "all") {
      list = list.filter((l) => l.status.toLowerCase() === params.status!.toLowerCase());
    }
    if (params?.leaveTypeId && params.leaveTypeId !== "ALL") {
      list = list.filter((l) => l.leaveTypeId === params.leaveTypeId);
    }
    return list;
  }

  async getLeaveRecordById(id: string) {
    return this.data.leaveRecords.find((l) => l.id === id) || null;
  }

  async createLeaveRecord(leaveData: any) {
    const newRecord = {
      ...leaveData,
      id: leaveData.id || `lv_rec_${Date.now()}`,
      status: leaveData.status || "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.data.leaveRecords.unshift(newRecord);
    return newRecord;
  }

  async updateLeaveRecord(id: string, updates: Partial<any>) {
    const idx = this.data.leaveRecords.findIndex((l) => l.id === id);
    if (idx >= 0) {
      this.data.leaveRecords[idx] = {
        ...this.data.leaveRecords[idx],
        ...updates,
        updatedAt: new Date(),
      };
      return this.data.leaveRecords[idx];
    }
    return null;
  }

  async getLeaveBalanceAdjustments(employeeId?: string) {
    let list = [...this.data.leaveAdjustments];
    if (employeeId) list = list.filter((a) => a.employeeId === employeeId);
    return list;
  }

  async createLeaveBalanceAdjustment(adjData: any) {
    const newAdj = {
      ...adjData,
      id: adjData.id || `ladj_${Date.now()}`,
      createdAt: new Date(),
    };
    this.data.leaveAdjustments.push(newAdj);
    return newAdj;
  }

  // --- Off-Days (Separate from Leave) ---
  async getOffDays(params?: { employeeId?: string; date?: string; startDate?: string; endDate?: string }) {
    let list = [...this.data.offDays];
    if (params?.employeeId) list = list.filter((o) => o.employeeId === params.employeeId);
    if (params?.date) list = list.filter((o) => o.date === params.date);
    if (params?.startDate) list = list.filter((o) => o.date >= params.startDate!);
    if (params?.endDate) list = list.filter((o) => o.date <= params.endDate!);
    return list;
  }

  async createOffDay(offDayData: any) {
    // Unique check per employee and date
    const exists = this.data.offDays.find(
      (o) => o.employeeId === offDayData.employeeId && o.date === offDayData.date
    );
    if (exists) {
      return exists;
    }
    const newOffDay = {
      ...offDayData,
      id: offDayData.id || `off_${Date.now()}`,
      createdAt: new Date(),
    };
    this.data.offDays.push(newOffDay);
    return newOffDay;
  }

  async deleteOffDay(id: string) {
    const prev = this.data.offDays.length;
    this.data.offDays = this.data.offDays.filter((o) => o.id !== id);
    return this.data.offDays.length < prev;
  }

  // --- Department Settings ---
  async getDepartmentSettings() {
    return { ...this.data.departmentSettings };
  }

  async getShiftRequirements() {
    return [...this.data.shiftRequirements];
  }

  async upsertShiftRequirement(row: { shiftTypeId: string; designation: string; minStaff: number; maxStaff: number | null }) {
    const idx = this.data.shiftRequirements.findIndex(
      (r) => r.shiftTypeId === row.shiftTypeId && r.designation === row.designation
    );
    const values = {
      id: idx >= 0 ? this.data.shiftRequirements[idx].id : `sreq_${Date.now()}`,
      ...row,
      createdAt: idx >= 0 ? this.data.shiftRequirements[idx].createdAt : new Date(),
      updatedAt: new Date(),
    };
    if (idx >= 0) this.data.shiftRequirements[idx] = values;
    else this.data.shiftRequirements.push(values);
    return values;
  }

  async deleteShiftRequirement(id: string) {
    this.data.shiftRequirements = this.data.shiftRequirements.filter((r) => r.id !== id);
    return { success: true };
  }

  // --- Holidays (Gregorian dates ONLY — never BS strings) ---
  async getHolidays(params?: { from?: string; to?: string }) {
    return this.data.holidays
      ?.filter((h) => (!params?.from || h.date >= params.from) && (!params?.to || h.date <= params.to))
      ?.sort((a, b) => (a.date < b.date ? -1 : 1)) ?? [];
  }

  async upsertHoliday(row: { date: string; name: string; nameNp?: string | null; category?: string; observed?: boolean; note?: string | null; createdBy?: string | null }) {
    this.data.holidays = this.data.holidays ?? [];
    const idx = this.data.holidays.findIndex((h) => h.date === row.date);
    const values = {
      id: idx >= 0 ? this.data.holidays[idx].id : `hol_${Date.now()}`,
      name: row.name,
      nameNp: row.nameNp ?? null,
      category: row.category ?? "public",
      observed: row.observed ?? true,
      note: row.note ?? null,
      createdBy: row.createdBy ?? null,
      createdAt: idx >= 0 ? this.data.holidays[idx].createdAt : new Date(),
      updatedAt: new Date(),
    };
    if (idx >= 0) this.data.holidays[idx] = values;
    else this.data.holidays.push(values);
    return values;
  }

  async deleteHoliday(id: string) {
    this.data.holidays = this.data.holidays ?? [];
    const prev = this.data.holidays.length;
    this.data.holidays = this.data.holidays.filter((h) => h.id !== id);
    return this.data.holidays.length < prev;
  }

  async updateDepartmentSettings(updates: Partial<any>) {
    this.data.departmentSettings = {
      ...this.data.departmentSettings,
      ...updates,
      updatedAt: new Date(),
    };
    return this.data.departmentSettings;
  }

  // --- Audit Logs ---
  async getAuditLogs(limit = 100) {
    return [...this.data.auditLogs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  /** Server-side paginated audit read (mirrors the Drizzle repository). */
  async getAuditLogsPage(params: {
    page?: number;
    pageSize?: number;
    includeSignIns?: boolean;
    hiddenActions?: string[];
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(200, Math.max(10, params.pageSize ?? 50));
    const hidden = params.includeSignIns ? [] : params.hiddenActions ?? ["ADMIN_LOGGED_IN", "SESSION_SWITCHED", "EMPLOYEE_VIEW_STARTED"];
    const sorted = [...this.data.auditLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const filtered = hidden.length > 0
      ? sorted.filter((l) => !hidden.includes(l.action))
      : sorted;
    const total = filtered.length;
    const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
    return { rows, total, page, pageSize };
  }

  async createAuditLog(logData: {
    actorUserId?: string;
    actorName: string;
    action: string;
    entityType: string;
    entityId: string;
    details?: string;
    previousValues?: any;
    newValues?: any;
  }) {
    const newLog = {
      ...logData,
      id: `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date(),
    };
    this.data.auditLogs.unshift(newLog);
    return newLog;
  }
}

// Global Singleton for in-memory repository
declare global {
  var __hospitalDbInstance: MemoryDatabase | undefined;
}

const memoryDb = globalThis.__hospitalDbInstance ?? new MemoryDatabase();
if (process.env.NODE_ENV !== "production") {
  globalThis.__hospitalDbInstance = memoryDb;
}

// Drizzle Client when DATABASE_URL is configured
export const rawSql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
export const drizzleDb = rawSql ? drizzle(rawSql, { schema }) : null;

// Unified high-level database repository.
// When DATABASE_URL is configured (migrated Neon PostgreSQL), all persistence goes to the
// real database. Otherwise we fall back to the in-memory seed repository for local evaluation.
const drizzleRepository = process.env.DATABASE_URL ? new DrizzleDatabase(process.env.DATABASE_URL) : null;
export const db = drizzleRepository ?? memoryDb;
export { schema };
